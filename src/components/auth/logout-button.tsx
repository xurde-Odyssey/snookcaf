"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function LogoutButton({ compact = false }: { compact?: boolean } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error();
      // A full document navigation discards cached protected React payloads on logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch { setError("Sign out failed. Try again."); setBusy(false); }
  }
  return <div><Button variant={compact ? "ghost" : "outline"} size="sm" className={compact ? "h-8 px-2 text-white hover:bg-white/10 hover:text-white" : undefined} disabled={busy} onClick={logout}>{busy ? "Signing out…" : compact ? "Log out" : "Sign out"}</Button>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}</div>;
}
