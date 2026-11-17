import { z } from "zod";

const requestId = z.string().uuid();
export const settlementSchema = z.object({
  requestId,
  cashAmount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).default("0"),
  qrAmount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).default("0"),
  cashTendered: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).optional(),
  transactionReference: z.string().trim().max(120).optional(),
  confirmedQrReceived: z.literal(true).optional(),
  recordCredit: z.boolean().default(false),
  customerId: z.string().cuid().optional(),
  customerName: z.string().trim().min(1).max(100).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  discount: z.object({ type: z.enum(["FIXED", "PERCENTAGE"]), value: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/), reason: z.string().trim().min(1).max(300) }).strict().optional(),
}).strict();

export const paymentMethodsSchema = z.object({
  enabledPaymentMethods: z.array(z.enum(["CASH", "QR"])).min(1).max(2),
}).strict();

export const businessBillingSettingsSchema = z.object({
  contactEmail: z.union([z.string().trim().email().max(254), z.literal("")]),
  contactPhone: z.string().trim().max(40),
  contactAddress: z.string().trim().max(240),
}).strict();

export const repaymentSchema = z.object({
  requestId,
  cashAmount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).default("0"),
  qrAmount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).default("0"),
  cashTendered: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).optional(),
  transactionReference: z.string().trim().max(120).optional(),
  confirmedQrReceived: z.literal(true).optional(),
}).strict();
