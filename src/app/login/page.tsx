import Image from "next/image";
import { redirect } from "next/navigation";
import { CircleDot, Coffee, ReceiptText, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { requestToken } from "@/lib/auth/http";
import { sessionUser } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const token = await requestToken();
  const user = token ? await sessionUser(token) : null;
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/");
  const { changed } = await searchParams;

  return (
    <main className="login-canvas grid min-h-screen place-items-center px-4 py-5 sm:px-6 sm:py-8">
      <div className="login-frame grid w-full max-w-6xl overflow-hidden rounded-3xl border border-[#E6E6E6] bg-white shadow-[0_24px_80px_rgba(20,20,20,0.1)] lg:min-h-[680px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="login-story relative flex min-h-[430px] flex-col overflow-hidden px-7 py-8 text-white sm:px-10 sm:py-10 lg:min-h-0 lg:px-14 lg:py-12">
          <div className="login-enter flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white p-1">
              <Image src="/cuecafe.png" alt="" width={36} height={36} priority className="h-9 w-9 rounded-full object-cover" />
            </span>
            <span className="text-lg font-bold tracking-tight">cue<span className="text-white/80">.</span> &amp; coffee</span>
          </div>

          <div className="login-enter mt-10 max-w-xl sm:mt-14 lg:mt-16">
            <h1 className="max-w-lg text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl lg:text-[42px]">
              Your club, café, and daily operations in one place.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/90 sm:text-base sm:leading-7">
              Cue. &amp; Coffee helps your team keep tables moving, manage café orders, and stay on top of billing from one simple workspace.
            </p>
          </div>

          <div className="login-enter mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
            {[
              { icon: CircleDot, title: "Snooker", detail: "Tables & sessions" },
              { icon: Coffee, title: "Café", detail: "Orders & menu" },
              { icon: ReceiptText, title: "Billing", detail: "Bills & payments" },
            ].map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-xl border border-white/30 bg-white/10 p-3.5">
                <Icon size={17} className="text-white" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-[11px] text-white/80">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-2 pt-8 text-[11px] text-white/85">
            <ShieldCheck size={14} className="text-white" aria-hidden="true" />
            Secure staff access · Accounts are managed by your administrator
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="login-form-enter w-full max-w-sm">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#E5650F]">Welcome back</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#171717] sm:text-[28px]">Sign in to your workspace</h2>
              <p className="mt-2 text-sm leading-6 text-[#71717A]">Use your staff email and password to continue.</p>
            </div>
            {changed && <p role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Password changed. Sign in with your new password.</p>}
            <AuthForm />
            <p className="mt-7 border-t border-[#E6E6E6] pt-5 text-xs leading-5 text-[#71717A]">
              Need an account or password reset? Contact your administrator.
            </p>
          </div>
        </section>
      </div>
      <p className="mt-5 text-center text-[11px] text-[#71717A]">Cue. &amp; Coffee · Staff access only</p>
    </main>
  );
}
