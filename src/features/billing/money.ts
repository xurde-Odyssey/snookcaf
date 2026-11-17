import { Prisma } from "@prisma/client";
import { AuthError } from "@/lib/auth/errors";

export function cashChange(totalValue: Prisma.Decimal.Value, receivedValue: Prisma.Decimal.Value) {
  const total = new Prisma.Decimal(totalValue);
  const received = new Prisma.Decimal(receivedValue);
  if (total.isNegative()) throw new AuthError(400, "Bill total cannot be negative.");
  if (received.lessThan(total)) throw new AuthError(400, "Cash received must cover the full bill.");
  return received.sub(total);
}

export function calculateDiscount(subtotalValue: Prisma.Decimal.Value, type: "FIXED" | "PERCENTAGE", valueInput: Prisma.Decimal.Value) {
  const subtotal = new Prisma.Decimal(subtotalValue);
  const value = new Prisma.Decimal(valueInput);
  if (value.lessThanOrEqualTo(0)) throw new AuthError(400, "Discount must be greater than zero.");
  if (type === "PERCENTAGE") {
    if (value.greaterThan(100)) throw new AuthError(400, "Percentage discount must be no more than 100.");
    return subtotal.mul(value).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
  if (value.greaterThan(subtotal)) throw new AuthError(400, "Fixed discount cannot exceed the subtotal.");
  return value;
}

export function paymentBalance(totalValue: Prisma.Decimal.Value, paidValue: Prisma.Decimal.Value, cashValue: Prisma.Decimal.Value, qrValue: Prisma.Decimal.Value) {
  const total = new Prisma.Decimal(totalValue);
  const paid = new Prisma.Decimal(paidValue);
  const allocations = new Prisma.Decimal(cashValue).add(qrValue);
  const balance = total.sub(paid);
  if (total.isNegative() || paid.isNegative() || allocations.isNegative() || allocations.greaterThan(balance)) throw new AuthError(400, "Payment amounts exceed the outstanding bill amount.");
  return { allocations, remaining: balance.sub(allocations) };
}
