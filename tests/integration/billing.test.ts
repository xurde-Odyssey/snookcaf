import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { digest } from "@/lib/auth/service";
import { billing } from "@/features/billing/server/service";
import { createSnookerService } from "@/features/snooker/server/service";
import type { Role } from "@prisma/client";

let businessId: string; let ownerToken: string; let cashierToken: string; let ownerId: string; let cashierId: string;
async function account(role: Role) {
  const staff = await db.staff.create({ data: { businessId, email: `${randomUUID()}@billing.test`, name: role, role, operationalArea: "BOTH", mustChangePassword: false, passwordHash: "integration-fixture-only" } });
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { staffId: staff.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 3_600_000) } });
  return { id: staff.id, token };
}
beforeAll(() => {
  if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Run billing integration tests only against the selected disposable _test database.");
});
beforeEach(async () => {
  const slug = `phase5-billing-${randomUUID()}`; process.env.BUSINESS_SLUG = slug; process.env.APP_ORIGIN = "http://localhost:3000";
  businessId = (await db.business.create({ data: { slug, name: "Cue. & Coffee test" } })).id;
  const owner = await account("OWNER"); ownerId = owner.id; ownerToken = owner.token;
  const cashier = await account("CASHIER"); cashierId = cashier.id; cashierToken = cashier.token;
  await db.businessSettings.create({ data: { businessId, version: 1, enabledPaymentMethods: ["CASH", "QR"], currency: "NPR", timezone: "Asia/Kathmandu" } });
});
afterAll(async () => { await db.$disconnect(); });

async function cafeBill(total: string, sessionId?: string) {
  const order = await db.cafeOrder.create({ data: { businessId, orderNumber: `ORD-${randomUUID()}`, sessionId: sessionId ?? null, createdById: cashierId, status: "COMPLETED", subtotal: total } });
  await db.cafeOrderItem.create({ data: { orderId: order.id, productId: randomUUID(), productNameSnapshot: "Cafe item", unitPriceSnapshot: total, quantity: 1, subtotal: total } });
  if (sessionId) return db.pendingCheckout.findUniqueOrThrow({ where: { sessionId } });
  return db.pendingCheckout.create({ data: { businessId, billNumber: `BILL-${randomUUID()}`, cafeOrderId: order.id, status: "PENDING", referenceAmount: "0", cafeSubtotal: total, subtotal: total, amount: total, createdAt: new Date() } });
}

describe("billing, split tender and customer credit", () => {
  it("applies an owner-authorized fixed discount and records Cash", async () => {
    const bill = await cafeBill("1600");
    const result = await billing.settle(ownerToken, bill.id, { requestId: randomUUID(), cashAmount: "1500", qrAmount: "0", discount: { type: "FIXED", value: "100", reason: "Customer service" } });
    expect(result.checkout.subtotal.toFixed(2)).toBe("1600.00");
    expect(result.checkout.discountAmount.toFixed(2)).toBe("100.00");
    expect(result.checkout.amount?.toFixed(2)).toBe("1500.00");
    expect(result.checkout.status).toBe("PAID");
    expect(result.payments.map(payment => [payment.method, payment.amount.toFixed(2)])).toEqual([["CASH", "1500.00"]]);
    expect(result.checkout.discountApprovedById).toBe(ownerId);
    const percentageBill = await cafeBill("1600");
    const percentage = await billing.settle(ownerToken, percentageBill.id, { requestId: randomUUID(), cashAmount: "1440", qrAmount: "0", discount: { type: "PERCENTAGE", value: "10", reason: "Off-peak promotion" } });
    expect(percentage.checkout.discountAmount.toFixed(2)).toBe("160.00"); expect(percentage.checkout.amount?.toFixed(2)).toBe("1440.00");
  });

  it("rejects a cashier discount even when the request reaches the service directly", async () => {
    const bill = await cafeBill("500");
    await expect(billing.settle(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "450", qrAmount: "0", discount: { type: "PERCENTAGE", value: "10", reason: "Unauthorized" } })).rejects.toMatchObject({ status: 403 });
    expect((await db.pendingCheckout.findUniqueOrThrow({ where: { id: bill.id } })).discountType).toBeNull();
  });

  it("stores split Cash/QR payments as customer credit and supports multiple repayments", async () => {
    const bill = await cafeBill("1500");
    const result = await billing.settle(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "500", qrAmount: "700", confirmedQrReceived: true, transactionReference: "QR-1", recordCredit: true, customerName: "Sam Customer", customerPhone: "9800000000" });
    expect(result.checkout.status).toBe("PARTIALLY_PAID");
    expect(result.payments.map(payment => [payment.method, payment.amount.toFixed(2)])).toEqual([["CASH", "500.00"], ["QR", "700.00"]]);
    expect(result.remaining).toBe("300.00");
    const customerId = result.checkout.customerId!;
    const first = await billing.repay(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "200", qrAmount: "0" });
    expect(first.remaining).toBe("100.00"); expect(first.checkout.status).toBe("PARTIALLY_PAID");
    const second = await billing.repay(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "0", qrAmount: "100", confirmedQrReceived: true, transactionReference: "QR-2" });
    expect(second.remaining).toBe("0.00"); expect(second.checkout.status).toBe("PAID");
    expect((await billing.getCreditCustomer(cashierToken, customerId)).checkouts[0].payments).toHaveLength(4);
    expect(await db.payment.count({ where: { checkoutId: bill.id } })).toBe(4);
  });

  it("requires customer identity for full credit and permits a later full repayment", async () => {
    const bill = await cafeBill("250");
    const credit = await billing.settle(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "0", qrAmount: "0", recordCredit: true, customerName: "Walk-in customer" });
    expect(credit.checkout.status).toBe("CREDIT"); expect(credit.checkout.creditRecordedAt).toBeTruthy(); expect(credit.checkout.creditReceiptNumber).toMatch(/^CR-/);
    expect(credit.payments).toHaveLength(0);
    const repayment = await billing.repay(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "250", qrAmount: "0" });
    expect(repayment.checkout.status).toBe("PAID"); expect(repayment.remaining).toBe("0.00");
  });

  it("prevents concurrent repayments from exceeding the balance", async () => {
    const bill = await cafeBill("300");
    await billing.settle(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "0", qrAmount: "0", recordCredit: true, customerName: "Concurrent test" });
    const results = await Promise.allSettled([
      billing.repay(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "200", qrAmount: "0" }),
      billing.repay(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "200", qrAmount: "0" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.payment.aggregate({ where: { checkoutId: bill.id }, _sum: { amount: true } }))._sum.amount?.toFixed(2)).toBe("200.00");
  });

  it("combines finalized snooker and session-linked café charges once", async () => {
    let now = new Date("2026-11-17T00:00:00Z"); const snooker = createSnookerService(() => new Date(now));
    await db.pricingVersion.create({ data: { businessId, version: 1, hourlyRate: "400", frameRate: "100", createdById: ownerId } });
    const table = await db.snookerTable.create({ data: { businessId, number: "01", name: "Table 01", defaultPlayType: "HOURLY" } });
    let session = await snooker.start(cashierToken, { requestId: randomUUID(), tableId: table.id });
    now = new Date(now.getTime() + 30 * 60 * 1000);
    session = await snooker.command(cashierToken, session.id, { requestId: randomUUID(), revision: session.revision, action: "finish", frames: [] });
    const bill = await cafeBill("80", session.id);
    const refreshed = (await billing.listPending(cashierToken)).find(row => row.id === bill.id)!;
    expect(refreshed.subtotal.toFixed(2)).toBe("280.00");
    expect(refreshed.amount?.toFixed(2)).toBe("280.00");
    const result = await billing.settle(cashierToken, bill.id, { requestId: randomUUID(), cashAmount: "280", qrAmount: "0" });
    expect(result.checkout.status).toBe("PAID"); expect(result.checkout.payments).toHaveLength(1);
    expect(await db.pendingCheckout.count({ where: { sessionId: session.id } })).toBe(1);
  });
});
