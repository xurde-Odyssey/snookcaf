import { z } from "zod";
import { roles, areas } from "./permissions";
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(100), email: emailSchema, password: passwordSchema,
  role: z.enum(roles).default("STAFF"), operationalArea: z.enum(areas).default("NONE"),
  currentPassword: z.string().min(1).max(128),
}).strict();
export const updateStaffSchema = z.object({
  role: z.enum(roles).optional(), active: z.boolean().optional(), operationalArea: z.enum(areas).optional(),
  password: passwordSchema.optional(), currentPassword: z.string().min(1).max(128),
}).strict().refine(v => v.role !== undefined || v.active !== undefined || v.operationalArea !== undefined || v.password !== undefined, "Choose a change.");
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), password: passwordSchema }).strict()
  .refine(v => v.currentPassword !== v.password, "Choose a different password.");
