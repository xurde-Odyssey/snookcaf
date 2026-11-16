import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const now = new Date();
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
  const limits = await db.loginRateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
  console.info(`Removed ${sessions.count} expired sessions and ${limits.count} expired rate-limit windows.`);
}
main().catch(() => { console.error("Authentication cleanup failed."); process.exitCode = 1; }).finally(() => db.$disconnect());
