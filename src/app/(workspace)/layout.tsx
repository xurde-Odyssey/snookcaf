import { AppShell } from "@/components/layout/app-shell";
import { requirePage } from "@/lib/auth/page";
import { publicStaff } from "@/lib/auth/service";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  return <AppShell user={publicStaff(user)}>{children}</AppShell>;
}
