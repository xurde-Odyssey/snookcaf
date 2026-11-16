"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function LogoutButton() {
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
  return <div><Button variant="outline" size="sm" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Sign out"}</Button>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}</div>;
}
