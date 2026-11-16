import { Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { businessSlug } from "../src/lib/auth/config";
import { hashPassword } from "../src/lib/auth/password";
import { emailSchema, loginSchema, passwordSchema } from "../src/lib/auth/validation";
const db = new PrismaClient();
async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEV_SEED !== "true"
  )
    throw new Error(
      "Development seed requires ALLOW_DEV_SEED=true and must not run in production.",
    );
  const business = await db.business.upsert({
    where: { slug: businessSlug() },
    update: {},
    create: {
      slug: businessSlug(),
      name: "Development Snooker & Café",
      settings: { create: { version: 1 } },
    },
  });
  const email = process.env.DEV_OWNER_EMAIL;
  const password = process.env.DEV_OWNER_PASSWORD;
  if (!!email !== !!password) throw new Error("Provide both DEV_OWNER_EMAIL and DEV_OWNER_PASSWORD.");
  if (email && password) {
    const normalizedEmail = emailSchema.parse(email);
    // Short bootstrap passwords are development-only and must be replaced at login.
    loginSchema.shape.password.min(8).parse(password);
    const mustChangePassword = !passwordSchema.safeParse(password).success;
    const passwordHash = await hashPassword(password);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${business.id} FOR UPDATE`;
      // Never silently promote, overwrite, reset, or create another bootstrap owner.
      if (await tx.staff.count({ where: { businessId: business.id } })) return;
      if (await tx.staff.findUnique({ where: { email: normalizedEmail } })) throw new Error("Owner email is already in use.");
      const owner = await tx.staff.create({ data: { businessId: business.id, email: normalizedEmail, name: "Development Owner", passwordHash, role: "OWNER", mustChangePassword } });
      await tx.auditLog.create({ data: { businessId: business.id, actorId: owner.id, targetId: owner.id, action: "DEV_OWNER_PROVISIONED" } });
    });
  }
  console.info("Development workspace initialized. Existing accounts were not changed. No operational records were created.");
}
main()
  .catch((error) => {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error("Development seed could not connect to PostgreSQL. Check DATABASE_URL, the running server, database name and database user.", error.errorCode ?? "");
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Development seed database error:", error.code, "Ensure npm run db:deploy completed successfully.");
    } else if (error instanceof ZodError) {
      console.error("Invalid seed credentials: provide a valid DEV_OWNER_EMAIL and an 8–128 character DEV_OWNER_PASSWORD.");
    } else {
      console.error("Development seed failed. Check ALLOW_DEV_SEED=true, non-production mode, Node >=24.7, and both owner credentials. Existing accounts are never overwritten.");
    }
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
