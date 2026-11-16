"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function useSnookerMutation() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  async function mutate(url: string, data: Record<string, unknown>) {
    if (busy) return null;
    const fingerprint = JSON.stringify({ url, data });
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, requestId: pending.current.key }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Unable to save changes."); router.refresh(); return null; }
      pending.current = null; router.refresh(); return result;
    } catch { setError("Connection interrupted. Retry the same action safely, or refresh to check its result."); return null; }
    finally { setBusy(false); }
  }
  return { mutate, busy, error, setError };
}
