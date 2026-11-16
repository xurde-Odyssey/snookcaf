import { Prisma } from "@prisma/client";
export const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export function elapsedSeconds(activeSince: Date | null, now: Date) {
  if (!activeSince) return new Prisma.Decimal(0);
  const ms = now.getTime() - activeSince.getTime();
  if (ms < 0) throw new Error("Server clock moved backwards.");
  return new Prisma.Decimal(ms).div(1000);
}
export function segmentAmount(type: "HOURLY" | "FRAME_WISE", rate: Prisma.Decimal.Value, seconds: Prisma.Decimal.Value, frames: number | null) {
  const r = new Prisma.Decimal(rate);
  if (r.isNegative() || new Prisma.Decimal(seconds).isNegative()) throw new Error("Negative pricing component.");
  if (type === "FRAME_WISE" && (frames === null || !Number.isSafeInteger(frames) || frames < 0)) throw new Error("Record completed frames.");
  return money(type === "HOURLY" ? r.mul(seconds).div(3600) : r.mul(frames!));
}
export const referenceTotal = (amounts: Prisma.Decimal.Value[]) => money(amounts.reduce<Prisma.Decimal>((sum, amount) => sum.add(amount), new Prisma.Decimal(0)));
export const adjustmentDifference = (reference: Prisma.Decimal.Value, approved: Prisma.Decimal.Value) => money(new Prisma.Decimal(approved).minus(reference));
