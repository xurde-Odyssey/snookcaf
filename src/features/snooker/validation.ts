import { z } from "zod";
export const amountSchema = z.string().regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/, "Enter a nonnegative amount with at most two decimal places.");
export const playTypeSchema = z.enum(["HOURLY", "FRAME_WISE"]);
const id = z.string().min(1).max(100);
const base = { requestId: z.uuid() };
const revision = z.number().int().nonnegative();
const reason = z.string().trim().min(1, "An adjustment reason is required.").max(500);
export const proposalSchema = z.object({ amount: amountSchema, reason }).strict();
export const catalogSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("table.create"), number: z.string().trim().min(1).max(20), name: z.string().trim().min(1).max(100), defaultPlayType: playTypeSchema }).strict(),
  z.object({ ...base, action: z.literal("table.update"), id, number: z.string().trim().min(1).max(20), name: z.string().trim().min(1).max(100), defaultPlayType: playTypeSchema, archived: z.boolean() }).strict(),
  z.object({ ...base, action: z.literal("menu.create"), name: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(50).default("Other"), price: amountSchema }).strict(),
  z.object({ ...base, action: z.literal("menu.update"), id, name: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(50).default("Other"), price: amountSchema, archived: z.boolean() }).strict(),
  z.object({ ...base, action: z.literal("pricing.set"), hourlyRate: amountSchema, frameRate: amountSchema }).strict(),
]);
export const startSchema = z.object({ ...base, tableId: id }).strict();
export const sessionCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, revision, action: z.literal("pause") }).strict(),
  z.object({ ...base, revision, action: z.literal("resume") }).strict(),
  z.object({ ...base, revision, action: z.literal("switch"), playType: playTypeSchema }).strict(),
  z.object({ ...base, revision, action: z.literal("finish"), frames: z.array(z.object({ segmentId: id, count: z.number().int().min(0).max(10000) }).strict()).max(100), proposal: proposalSchema.optional() }).strict(),
  z.object({ ...base, revision, action: z.literal("propose"), ...proposalSchema.shape }).strict(),
  z.object({ ...base, revision, action: z.literal("approve"), adjustmentId: id, amount: amountSchema, reason }).strict(),
  z.object({ ...base, revision, action: z.literal("reject"), adjustmentId: id, reason }).strict(),
  z.object({ ...base, revision, action: z.literal("cancel"), adjustmentId: id, reason }).strict(),
]);
