"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
export const inputClass = "mt-2 block min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2";
export function AuthForm({ change = false }: { change?: boolean }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const body = change ? { currentPassword: data.get("currentPassword"), password: data.get("password") } : { email: data.get("email"), password: data.get("password") };
    if (change && data.get("password") !== data.get("confirm")) { setError("Passwords do not match."); setBusy(false); return; }
    try {
      const response = await fetch(change ? "/api/auth/password" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Unable to sign in."); setBusy(false); return; }
      window.location.assign(change ? "/login?changed=1" : result.user.mustChangePassword ? "/change-password" : "/");
    } catch { setError("Unable to connect. Try again."); setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    {!change && <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="username" maxLength={254} required className={inputClass} /></label>}
    {change && <label className="block text-sm font-medium">Current or temporary password<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required className={inputClass} /></label>}
    <label className="block text-sm font-medium">{change ? "New password" : "Password"}<input name="password" type="password" autoComplete={change ? "new-password" : "current-password"} minLength={change ? 12 : 1} maxLength={128} required className={inputClass} /></label>
    {change && <><p className="text-sm text-muted-foreground">Use 12–128 characters. All existing sessions will be signed out.</p><label className="block text-sm font-medium">Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={inputClass} /></label></>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : change ? "Change password" : "Sign in"}</Button>
  </form>;
}
