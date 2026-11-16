import { requirePage } from "@/lib/auth/page";
import { requestToken } from "@/lib/auth/http";
import { listStaff } from "@/features/staff/server/service";
import { StaffManager } from "@/components/staff/staff-manager";
export default async function StaffPage() {
  const actor = await requirePage("staff.manage");
  const staff = await listStaff(await requestToken());
  return <StaffManager actor={{ id: actor.id, role: actor.role }} staff={staff.map(user => ({ ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() }))} />;
}
