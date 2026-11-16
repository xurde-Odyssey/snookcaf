import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { requestToken } from "@/lib/auth/http";
import { sessionUser } from "@/lib/auth/service";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const token = await requestToken();
  const user = token ? await sessionUser(token) : null;
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/");
  const { changed } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-[#111111] p-5"><section className="w-full max-w-md rounded-2xl bg-white p-7 sm:p-10">
    <p className="mb-8 text-xl font-bold">cue<span className="text-primary">.</span> & coffee</p><h1 className="text-3xl">Staff sign in</h1><p className="mb-6 mt-2 text-sm text-muted-foreground">Welcome back to your workspace.</p>
    {changed && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm">Password changed. Sign in with your new password.</p>}
    <AuthForm /><p className="mt-6 text-sm text-muted-foreground">Need an account or password reset? Contact your administrator.</p>
  </section></main>;
}
