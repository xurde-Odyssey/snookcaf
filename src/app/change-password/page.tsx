import { requirePage } from "@/lib/auth/page";
import { AuthForm } from "@/components/auth/auth-form";
import { LogoutButton } from "@/components/auth/logout-button";
export default async function ChangePassword() {
  await requirePage(undefined, true);
  return <main className="mx-auto max-w-md p-6"><h1 className="mb-3 mt-10 text-3xl">Change password</h1><p className="mb-6 text-sm text-muted-foreground">Choose a private password before accessing the workspace.</p><AuthForm change /><div className="mt-6"><LogoutButton /></div></main>;
}
