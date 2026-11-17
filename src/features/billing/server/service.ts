import "server-only";
import { randomBytes } from "node:crypto";
import { CheckoutStatus, Prisma, type PaymentMethod, type Staff } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, digest, identityTransaction, requireUser } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import type { Tx } from "@/lib/auth/service";
import { businessBillingSettingsSchema, paymentMethodsSchema, repaymentSchema, settlementSchema } from "../validation";
import { calculateDiscount, cashChange, paymentBalance } from "../money";

const cashLimit = new Prisma.Decimal("99999999.99");
const includeBill = {
  session: { include: { startedBy: { select: { id: true, name: true } }, segments: { orderBy: { sequence: "asc" as const } }, adjustmentApprovedBy: { select: { id: true, name: true } }, table: { select: { number: true, name: true } }, cafeOrders: { where: { status: { not: "CANCELLED" as const } }, include: { items: true } } } },
  cafeOrder: { include: { items: true, createdBy: { select: { id: true, name: true } } } },
  payments: { orderBy: { createdAt: "asc" as const }, include: { cashier: { select: { id: true, name: true } } } },
  customer: true,
  discountApprovedBy: { select: { id: true, name: true } },
  creditRecordedBy: { select: { id: true, name: true } },
} satisfies Prisma.PendingCheckoutInclude;
const includePayment = {
  cashier: { select: { id: true, name: true } },
  business: { include: { settings: { orderBy: { version: "desc" as const }, take: 1 } } },
  checkout: { include: includeBill },
} satisfies Prisma.PaymentInclude;

function fingerprint(actor: Staff, input: unknown, target: string) {
  return digest(JSON.stringify({ actor: actor.id, target, input }));
}
function partsAtBusinessTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}
function receiptNumber(date: Date) {
  const p = partsAtBusinessTime(date);
  return `CC-${p.year}${p.month}${p.day}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
function billNumber(date: Date) { return `BILL-${receiptNumber(date).slice(3)}`; }
function businessDayBounds(date = new Date()) {
  const p = partsAtBusinessTime(date) as { year: string; month: string; day: string };
  const start = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - 345 * 60_000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}
function sumOrderItems(orders: { items: { subtotal: Prisma.Decimal }[] }[]) {
  return orders.reduce((sum, order) => order.items.reduce((subtotal, item) => subtotal.add(item.subtotal), sum), new Prisma.Decimal(0));
}
async function ensureStandaloneCheckouts(tx: Tx, businessId: string, now: Date) {
  const orders = await tx.cafeOrder.findMany({ where: { businessId, sessionId: null, status: { not: "CANCELLED" } }, include: { checkout: true } });
  for (const order of orders) {
    if (!order.checkout) {
      const subtotal = sumOrderItems([{ items: await tx.cafeOrderItem.findMany({ where: { orderId: order.id } }) }]);
      await tx.pendingCheckout.create({ data: { businessId, billNumber: billNumber(now), cafeOrderId: order.id, status: "PENDING", referenceAmount: new Prisma.Decimal(0), amount: subtotal, subtotal, cafeSubtotal: subtotal, createdAt: now } });
      await audit(tx, businessId, order.createdById, "CHECKOUT_ENTRY_CREATED", order.id, { kind: "CAFE_STANDALONE", amount: subtotal.toFixed(2) });
    } else if (order.checkout.status === "PENDING") {
      const subtotal = sumOrderItems([{ items: await tx.cafeOrderItem.findMany({ where: { orderId: order.id } }) }]);
      await tx.pendingCheckout.update({ where: { id: order.checkout.id }, data: { amount: subtotal.sub(order.checkout.discountAmount), subtotal, cafeSubtotal: subtotal } });
    }
  }
}
async function recalculateCheckout(tx: Tx, businessId: string, checkoutId: string) {
  const checkout = await tx.pendingCheckout.findFirst({ where: { id: checkoutId, businessId }, include: includeBill });
  if (!checkout) throw new AuthError(404, "Bill not found.");
  if (checkout.status === "PENDING" && checkout.cafeOrder?.status === "CANCELLED" && checkout.payments.length === 0) {
    await tx.pendingCheckout.update({ where: { id: checkout.id }, data: { status: "CANCELLED", amount: new Prisma.Decimal(0), subtotal: new Prisma.Decimal(0), cafeSubtotal: new Prisma.Decimal(0) } });
    await audit(tx, businessId, checkout.cafeOrder.cancelledById, "CANCELLED_ORDER_CHECKOUT_VOIDED", checkout.id, { orderNumber: checkout.cafeOrder.orderNumber });
    return tx.pendingCheckout.findUniqueOrThrow({ where: { id: checkout.id }, include: includeBill });
  }
  if (checkout.status !== "PENDING" && checkout.status !== "PARTIALLY_PAID" && checkout.status !== "CREDIT") return checkout;
  const orders = checkout.sessionId
    ? await tx.cafeOrder.findMany({ where: { businessId, sessionId: checkout.sessionId, status: { not: "CANCELLED" } }, include: { items: true } })
    : checkout.cafeOrderId
      ? await tx.cafeOrder.findMany({ where: { id: checkout.cafeOrderId, businessId, status: { not: "CANCELLED" } }, include: { items: true } })
      : [];
  const cafeSubtotal = sumOrderItems(orders);
  const snookerSubtotal = checkout.session
    ? (checkout.session.approvedFinalAmount ?? checkout.session.calculatedAmount ?? checkout.referenceAmount)
    : new Prisma.Decimal(0);
  const subtotal = snookerSubtotal.add(cafeSubtotal);
  const total = subtotal.sub(checkout.discountAmount);
  if (total.lessThan(0) || total.greaterThan(cashLimit)) throw new AuthError(409, "Bill total is outside the supported amount range.");
  if (!checkout.payments.length && checkout.status === "PENDING" && (!checkout.amount?.equals(total) || !checkout.cafeSubtotal.equals(cafeSubtotal) || !checkout.subtotal.equals(subtotal))) {
    await tx.pendingCheckout.update({ where: { id: checkout.id }, data: { amount: total, subtotal, cafeSubtotal } });
  }
  const refreshed = await tx.pendingCheckout.findUniqueOrThrow({ where: { id: checkout.id }, include: includeBill });
  return { ...refreshed, cafeOrders: orders };
}

export const billing = {
  async summary(token: string | undefined) {
    const actor = await requireUser(token, "billing.view");
    const { start, end } = businessDayBounds();
    const [sales, collected, pending, creditBills, repaymentRows, creditCustomerCount] = await Promise.all([
      db.pendingCheckout.aggregate({ where: { businessId: actor.businessId, status: { in: ["PENDING", "PARTIALLY_PAID", "CREDIT", "PAID"] }, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      db.payment.aggregate({ where: { businessId: actor.businessId, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      db.pendingCheckout.aggregate({ where: { businessId: actor.businessId, status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
      db.pendingCheckout.findMany({ where: { businessId: actor.businessId, status: { in: ["CREDIT", "PARTIALLY_PAID"] } }, include: { payments: { select: { amount: true } } } }),
      db.payment.findMany({ where: { businessId: actor.businessId, createdAt: { gte: start, lt: end }, checkout: { creditRecordedAt: { not: null } } }, select: { amount: true, createdAt: true, checkout: { select: { creditRecordedAt: true } } } }),
      db.customer.count({ where: { businessId: actor.businessId, checkouts: { some: { status: { in: ["CREDIT", "PARTIALLY_PAID"] }, creditRecordedAt: { not: null } } } } }),
    ]);
    const creditOutstanding = creditBills.reduce((sum, bill) => sum.add(bill.amount ?? 0).sub(bill.payments.reduce((paid, payment) => paid.add(payment.amount), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    const creditRepayments = repaymentRows.filter(row => row.checkout.creditRecordedAt && row.createdAt > row.checkout.creditRecordedAt).reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
    return { salesToday: sales._sum.amount?.toFixed(2) ?? "0.00", collectedToday: collected._sum.amount?.toFixed(2) ?? "0.00", outstandingAmount: pending._sum.amount?.toFixed(2) ?? "0.00", outstandingCount: pending._count._all, creditOutstanding: creditOutstanding.toFixed(2), creditRepaymentsToday: creditRepayments.toFixed(2), creditCustomerCount };
  },
  async listPending(token: string | undefined, search = "") {
    await requireUser(token, "billing.view");
    return identityTransaction(async (tx, businessId) => {
      await requireUser(token, "billing.view", tx);
      const now = new Date();
      await ensureStandaloneCheckouts(tx, businessId, now);
      const ids = await tx.pendingCheckout.findMany({ where: { businessId, status: { in: ["PENDING", "AWAITING_APPROVAL"] } }, select: { id: true } });
      const rows = [];
      for (const row of ids) rows.push(await recalculateCheckout(tx, businessId, row.id));
      return rows.filter(row => row.status === "PENDING" || row.status === "AWAITING_APPROVAL").filter(row => {
        if (!search) return true;
        const q = search.toLocaleLowerCase();
        return row.id.toLocaleLowerCase().includes(q) || row.session?.tableNumber.toLocaleLowerCase().includes(q) || row.cafeOrder?.orderNumber.toLocaleLowerCase().includes(q);
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    });
  },
  async listTransactions(token: string | undefined, from?: Date, to?: Date, method?: PaymentMethod, status?: CheckoutStatus) {
    const actor = await requireUser(token, "billing.view");
    return db.payment.findMany({ where: { businessId: actor.businessId, ...(method ? { method } : {}), ...(status ? { checkout: { status } } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}) }, orderBy: { createdAt: "desc" }, take: 200, include: includePayment });
  },
  async listCredits(token: string | undefined, search = "") {
    const actor = await requireUser(token, "billing.view");
    const customers = await db.customer.findMany({
      where: {
        businessId: actor.businessId,
        checkouts: { some: { status: { in: ["CREDIT", "PARTIALLY_PAID"] }, creditRecordedAt: { not: null } } },
        ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search } }] } : {}),
      },
      include: { checkouts: { where: { status: { in: ["CREDIT", "PARTIALLY_PAID"] }, creditRecordedAt: { not: null } }, include: { payments: { select: { amount: true } } } } },
      orderBy: { name: "asc" },
    });
    return customers.map(customer => {
      const balance = customer.checkouts.reduce((sum, bill) => sum.add((bill.amount ?? new Prisma.Decimal(0)).sub(bill.payments.reduce((paid, payment) => paid.add(payment.amount), new Prisma.Decimal(0)))), new Prisma.Decimal(0));
      return { id: customer.id, name: customer.name, phone: customer.phone, outstandingBillCount: customer.checkouts.length, outstandingAmount: balance.toFixed(2) };
    }).filter(customer => Number(customer.outstandingAmount) > 0);
  },
  async listCustomers(token: string | undefined, search = "") {
    const actor = await requireUser(token, "billing.settle");
    return db.customer.findMany({ where: { businessId: actor.businessId, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}) }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true, phone: true } });
  },
  async getCreditCustomer(token: string | undefined, id: string) {
    const actor = await requireUser(token, "billing.view");
    const customer = await db.customer.findFirst({ where: { id, businessId: actor.businessId }, include: { checkouts: { where: { creditRecordedAt: { not: null } }, orderBy: { createdAt: "desc" }, include: includeBill } } });
    if (!customer) throw new AuthError(404, "Customer not found.");
    return { ...customer, checkouts: customer.checkouts.map(bill => ({ ...bill, remaining: (bill.amount ?? new Prisma.Decimal(0)).sub(bill.payments.reduce((paid, payment) => paid.add(payment.amount), new Prisma.Decimal(0))).toFixed(2) })) };
  },
  async repay(token: string | undefined, id: string, input: unknown) {
    const data = repaymentSchema.parse(input);
    await requireUser(token, "billing.settle");
    return identityTransaction(async (tx, businessId) => {
      const actor = await requireUser(token, "billing.settle", tx);
      const hash = fingerprint(actor, data, `credit:${id}`);
      const prior = await tx.operationReceipt.findUnique({ where: { businessId_key: { businessId, key: data.requestId } } });
      if (prior) {
        if (prior.fingerprint !== hash) throw new AuthError(409, "This request ID was already used for a different operation.");
        const existing = await tx.pendingCheckout.findFirst({ where: { id: prior.resultId, businessId }, include: includeBill });
        if (existing) return { checkout: existing, payments: existing.payments };
      }
      const bill = await tx.pendingCheckout.findFirst({ where: { id, businessId, customerId: { not: null }, creditRecordedAt: { not: null }, status: { in: ["CREDIT", "PARTIALLY_PAID"] } }, include: includeBill });
      if (!bill?.amount) throw new AuthError(404, "Outstanding credit bill not found.");
      const paid = bill.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      const outstanding = bill.amount.sub(paid);
      const cashAmount = new Prisma.Decimal(data.cashAmount); const qrAmount = new Prisma.Decimal(data.qrAmount); const amount = cashAmount.add(qrAmount);
      if (amount.lessThanOrEqualTo(0)) throw new AuthError(400, "Repayment must be greater than zero.");
      paymentBalance(bill.amount, paid, cashAmount, qrAmount);
      const settings = await tx.businessSettings.findFirst({ where: { businessId }, orderBy: { version: "desc" } });
      const enabled = Array.isArray(settings?.enabledPaymentMethods) ? settings.enabledPaymentMethods : ["CASH", "QR"];
      if (cashAmount.greaterThan(0) && !enabled.includes("CASH")) throw new AuthError(400, "Cash payments are not enabled.");
      if (qrAmount.greaterThan(0) && (!enabled.includes("QR") || data.confirmedQrReceived !== true)) throw new AuthError(400, "Confirm that QR payment was received.");
      let cashReceived: Prisma.Decimal | null = null; let changeGiven: Prisma.Decimal | null = null;
      if (cashAmount.greaterThan(0)) { cashReceived = new Prisma.Decimal(data.cashTendered ?? data.cashAmount); changeGiven = cashChange(cashAmount, cashReceived); }
      const now = new Date(); const payments = [];
      if (cashAmount.greaterThan(0)) payments.push(await tx.payment.create({ data: { businessId, checkoutId: id, receiptNumber: receiptNumber(now), amount: cashAmount, method: "CASH", cashReceived, changeGiven, cashierId: actor.id, createdAt: now } }));
      if (qrAmount.greaterThan(0)) payments.push(await tx.payment.create({ data: { businessId, checkoutId: id, receiptNumber: receiptNumber(now), amount: qrAmount, method: "QR", transactionReference: data.transactionReference || null, cashierId: actor.id, createdAt: now } }));
      const remaining = outstanding.sub(amount); const status = remaining.isZero() ? CheckoutStatus.PAID : CheckoutStatus.PARTIALLY_PAID;
      await tx.pendingCheckout.update({ where: { id }, data: { status } });
      await audit(tx, businessId, actor.id, "CUSTOMER_CREDIT_REPAID", id, { customerId: bill.customerId!, amount: amount.toFixed(2), remaining: remaining.toFixed(2), paymentIds: payments.map(payment => payment.id) });
      await tx.operationReceipt.create({ data: { businessId, key: data.requestId, fingerprint: hash, resultId: id } });
      return { checkout: await tx.pendingCheckout.findUniqueOrThrow({ where: { id }, include: includeBill }), payments, remaining: remaining.toFixed(2) };
    });
  },
  async get(token: string | undefined, id: string) {
    await requireUser(token, "billing.view");
    return identityTransaction(async (tx, businessId) => {
      await requireUser(token, "billing.view", tx);
      const checkout = await tx.pendingCheckout.findFirst({ where: { id, businessId } });
      if (!checkout) throw new AuthError(404, "Bill not found.");
      return recalculateCheckout(tx, businessId, id);
    });
  },
  async settle(token: string | undefined, id: string, input: unknown) {
    const data = settlementSchema.parse(input);
    await requireUser(token, "billing.settle");
    return identityTransaction(async (tx, businessId) => {
      const actor = await requireUser(token, "billing.settle", tx);
      const hash = fingerprint(actor, data, id);
      const prior = await tx.operationReceipt.findUnique({ where: { businessId_key: { businessId, key: data.requestId } } });
      if (prior) {
        if (prior.fingerprint !== hash) throw new AuthError(409, "This request ID was already used for a different operation.");
        const existing = await tx.pendingCheckout.findFirst({ where: { id: prior.resultId, businessId }, include: includeBill });
        if (existing) return { checkout: existing, payments: existing.payments };
      }
      const bill = await recalculateCheckout(tx, businessId, id);
      if (bill.status === "AWAITING_APPROVAL") throw new AuthError(409, "This bill is awaiting pricing approval.");
      if (!["PENDING", "PARTIALLY_PAID", "CREDIT"].includes(bill.status)) throw new AuthError(409, "This bill cannot be settled.");
      if (bill.amount === null) throw new AuthError(409, "Bill amount is not ready for settlement.");
      if (data.discount) {
        const discountActor = await requireUser(token, "billing.discount", tx);
        if (bill.payments.length || bill.creditRecordedAt) throw new AuthError(409, "A discount cannot be changed after payment or credit has been recorded.");
        if (bill.discountType) throw new AuthError(409, "A bill may have one discount only.");
        const value = new Prisma.Decimal(data.discount.value);
        const discountAmount = calculateDiscount(bill.subtotal, data.discount.type, value);
        const payable = bill.subtotal.sub(discountAmount);
        await tx.pendingCheckout.update({ where: { id }, data: { discountType: data.discount.type, discountValue: value, discountAmount, discountReason: data.discount.reason, discountApprovedById: discountActor.id, discountApprovedAt: new Date(), amount: payable } });
        await audit(tx, businessId, discountActor.id, "BILL_DISCOUNT_APPROVED", id, { subtotal: bill.subtotal.toFixed(2), type: data.discount.type, value: value.toFixed(2), discountAmount: discountAmount.toFixed(2), totalAmount: payable.toFixed(2), reason: data.discount.reason });
      }
      const currentBill = data.discount ? await recalculateCheckout(tx, businessId, id) : bill;
      const payable = currentBill.amount!;
      const cashAmount = new Prisma.Decimal(data.cashAmount);
      const qrAmount = new Prisma.Decimal(data.qrAmount);
      const paymentTotal = cashAmount.add(qrAmount);
      if (cashAmount.isNegative() || qrAmount.isNegative() || paymentTotal.greaterThan(cashLimit)) throw new AuthError(400, "Payment amounts are invalid.");
      const settings = await tx.businessSettings.findFirst({ where: { businessId }, orderBy: { version: "desc" } });
      const enabled = Array.isArray(settings?.enabledPaymentMethods) ? settings.enabledPaymentMethods : ["CASH", "QR"];
      if (cashAmount.greaterThan(0) && !enabled.includes("CASH")) throw new AuthError(400, "Cash payments are not enabled.");
      if (qrAmount.greaterThan(0) && !enabled.includes("QR")) throw new AuthError(400, "QR payments are not enabled.");
      if (qrAmount.greaterThan(0) && data.confirmedQrReceived !== true) throw new AuthError(400, "Confirm that QR payment was received.");
      const priorPaid = currentBill.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      const balance = payable.sub(priorPaid);
      if (balance.isZero() && payable.isZero() && priorPaid.isZero() && paymentTotal.isZero()) {
        await tx.pendingCheckout.update({ where: { id: bill.id }, data: { status: CheckoutStatus.PAID, amount: payable } });
        await audit(tx, businessId, actor.id, "BILL_SETTLED", bill.id, { paymentIds: [], amountPaid: "0.00", remaining: "0.00", status: CheckoutStatus.PAID, reason: "Fully discounted" });
        await tx.operationReceipt.create({ data: { businessId, key: data.requestId, fingerprint: hash, resultId: bill.id } });
        const updated = await tx.pendingCheckout.findUniqueOrThrow({ where: { id: bill.id }, include: includeBill });
        return { checkout: updated, payments: updated.payments, remaining: "0.00", collectedTotal: "0.00" };
      }
      if (balance.lessThanOrEqualTo(0)) throw new AuthError(409, "This bill has already been settled.");
      const { remaining } = paymentBalance(payable, priorPaid, cashAmount, qrAmount);
      if (remaining.greaterThan(0) && !data.recordCredit) throw new AuthError(400, "Choose to record the remaining balance as customer credit.");
      if (data.recordCredit && remaining.greaterThan(0) && !data.customerId && !data.customerName) throw new AuthError(400, "A customer name is required to record credit.");
      let customerId = currentBill.customerId;
      if (remaining.greaterThan(0)) {
        if (data.customerId) {
          const customer = await tx.customer.findFirst({ where: { id: data.customerId, businessId } });
          if (!customer) throw new AuthError(404, "Customer not found.");
          customerId = customer.id;
        } else if (!customerId) {
          const customer = await tx.customer.create({ data: { businessId, name: data.customerName!, phone: data.customerPhone || null } });
          customerId = customer.id;
          await audit(tx, businessId, actor.id, "CUSTOMER_CREATED_FOR_CREDIT", customer.id, { name: customer.name, phone: customer.phone });
        }
      }
      let cashTendered: Prisma.Decimal | null = null;
      let changeGiven: Prisma.Decimal | null = null;
      if (cashAmount.greaterThan(0)) {
        cashTendered = new Prisma.Decimal(data.cashTendered ?? data.cashAmount);
        changeGiven = cashChange(cashAmount, cashTendered);
        if (cashTendered.greaterThan(cashLimit) || changeGiven.greaterThan(cashLimit)) throw new AuthError(400, "Cash amount is too large.");
      } else if (data.cashTendered) throw new AuthError(400, "Enter cash tendered only when allocating a cash payment.");
      const now = new Date();
      const payments = [];
      if (cashAmount.greaterThan(0)) payments.push(await tx.payment.create({ data: { businessId, checkoutId: bill.id, receiptNumber: receiptNumber(now), amount: cashAmount, method: "CASH", cashReceived: cashTendered, changeGiven, cashierId: actor.id, createdAt: now } }));
      if (qrAmount.greaterThan(0)) payments.push(await tx.payment.create({ data: { businessId, checkoutId: bill.id, receiptNumber: receiptNumber(now), amount: qrAmount, method: "QR", transactionReference: data.transactionReference || null, cashierId: actor.id, createdAt: now } }));
      const nextPaid = priorPaid.add(paymentTotal);
      const status = remaining.isZero() ? CheckoutStatus.PAID : paymentTotal.isZero() ? CheckoutStatus.CREDIT : CheckoutStatus.PARTIALLY_PAID;
      const firstCredit = remaining.greaterThan(0) && !currentBill.creditRecordedAt;
      await tx.pendingCheckout.update({ where: { id: bill.id }, data: { status, amount: payable, customerId: remaining.greaterThan(0) ? customerId : currentBill.customerId, creditRecordedAt: remaining.greaterThan(0) ? currentBill.creditRecordedAt ?? now : currentBill.creditRecordedAt, ...(firstCredit ? { creditReceiptNumber: `CR-${receiptNumber(now).slice(3)}`, creditRecordedById: actor.id } : {}) } });
      await audit(tx, businessId, actor.id, "BILL_PAYMENT_RECORDED", bill.id, { paymentIds: payments.map(payment => payment.id), amountPaid: paymentTotal.toFixed(2), remaining: remaining.toFixed(2), status });
      await tx.operationReceipt.create({ data: { businessId, key: data.requestId, fingerprint: hash, resultId: bill.id } });
      const updated = await tx.pendingCheckout.findUniqueOrThrow({ where: { id: bill.id }, include: includeBill });
      return { checkout: updated, payments: updated.payments, remaining: remaining.toFixed(2), collectedTotal: nextPaid.toFixed(2) };
    });
  },
  async getPaymentMethods(token: string | undefined) {
    const actor = await requireUser(token, "billing.view");
    const settings = await db.businessSettings.findFirst({ where: { businessId: actor.businessId }, orderBy: { version: "desc" } });
    const methods = settings?.enabledPaymentMethods;
    return { enabledPaymentMethods: Array.isArray(methods) ? methods : ["CASH", "QR"] };
  },
  async getBusinessDetails(token: string | undefined) {
    const actor = await requireUser(token, "billing.view");
    const [business, settings] = await Promise.all([
      db.business.findUnique({ where: { id: actor.businessId }, select: { name: true } }),
      db.businessSettings.findFirst({ where: { businessId: actor.businessId }, orderBy: { version: "desc" } }),
    ]);
    return { name: business?.name ?? "Cue. & Coffee", contactEmail: settings?.contactEmail ?? "", contactPhone: settings?.contactPhone ?? "", contactAddress: settings?.contactAddress ?? "" };
  },
  async setBusinessDetails(token: string | undefined, input: unknown) {
    const data = businessBillingSettingsSchema.parse(input);
    await requireUser(token, "settings.manage");
    return identityTransaction(async (tx, businessId) => {
      const actor = await requireUser(token, "settings.manage", tx);
      const current = await tx.businessSettings.findFirst({ where: { businessId }, orderBy: { version: "desc" } });
      if (!current) throw new AuthError(409, "Business settings are not configured.");
      const next = await tx.businessSettings.create({ data: { businessId, version: current.version + 1, currency: current.currency, timezone: current.timezone, enabledPaymentMethods: current.enabledPaymentMethods ?? ["CASH", "QR"], contactEmail: data.contactEmail || null, contactPhone: data.contactPhone || null, contactAddress: data.contactAddress || null } });
      await audit(tx, businessId, actor.id, "BILLING_CONTACT_UPDATED", next.id, { contactEmail: next.contactEmail, contactPhone: next.contactPhone, contactAddress: next.contactAddress });
      return { contactEmail: next.contactEmail, contactPhone: next.contactPhone, contactAddress: next.contactAddress };
    });
  },
  async setPaymentMethods(token: string | undefined, input: unknown) {
    const data = paymentMethodsSchema.parse(input);
    await requireUser(token, "settings.manage");
    return identityTransaction(async (tx, businessId) => {
      const actor = await requireUser(token, "settings.manage", tx);
      const current = await tx.businessSettings.findFirst({ where: { businessId }, orderBy: { version: "desc" } });
      if (!current) throw new AuthError(409, "Business settings are not configured.");
      const updated = await tx.businessSettings.create({ data: { businessId, version: current.version + 1, currency: current.currency, timezone: current.timezone, enabledPaymentMethods: data.enabledPaymentMethods, contactEmail: current.contactEmail, contactPhone: current.contactPhone, contactAddress: current.contactAddress } });
      await audit(tx, businessId, actor.id, "PAYMENT_METHODS_UPDATED", updated.id, { enabledPaymentMethods: data.enabledPaymentMethods });
      return { enabledPaymentMethods: data.enabledPaymentMethods };
    });
  },
};
