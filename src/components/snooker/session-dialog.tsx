"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/auth/auth-form";
import { can, type Identity } from "@/lib/auth/permissions";
import type { SessionView } from "@/features/snooker/types";
import { useSnookerMutation } from "./use-mutation";
const label = (value: string) => value.replaceAll("_", " ");
const timestamp = (value: string) => value.replace("T", " ").replace("Z", " UTC");
function eventDetails(metadata: Record<string, unknown>) {
  const details: string[] = [];
  if (typeof metadata.from === "string" && typeof metadata.to === "string") details.push(`${label(metadata.from)} → ${label(metadata.to)}`);
  if (typeof metadata.billableSeconds === "string") details.push(`${metadata.billableSeconds} billable seconds`);
  if (typeof metadata.frameCount === "number") details.push(`${metadata.frameCount} completed frames`);
  for (const [key, title] of [["calculatedAmount", "Calculated"], ["referenceAmount", "Reference"], ["reference", "Reference"], ["proposedAmount", "Proposed"], ["approvedAmount", "Approved"], ["difference", "Difference"], ["amount", "Outstanding"]]) {
    if (typeof metadata[key] === "string") details.push(`${title}: Rs. ${metadata[key]}`);
  }
  if (typeof metadata.status === "string") details.push(label(metadata.status));
  if (typeof metadata.reason === "string") details.push(metadata.reason);
  if (metadata.tableReleased === true) details.push("Table released");
  return details.join(" · ");
}
function difference(reference: string, proposed: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(proposed)) return "—";
  const cents = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); };
  const diff = cents(proposed) - cents(reference); const abs = diff < 0 ? -diff : diff;
  return `${diff < 0 ? "−" : "+"}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
}
export function SessionDialog({ session: initial, actor, close, onUpdated }: { session: SessionView; actor: Identity & { id: string; name: string }; close: () => void; onUpdated: (s: SessionView) => void }) {
  const [session, setSession] = useState(initial);
  const pending = session.adjustments.find(a => a.status === "REQUESTED");
  const [amount, setAmount] = useState(pending?.proposedAmount ?? "");
  const [reason, setReason] = useState(pending?.proposedReason ?? "");
  const { mutate, busy, error } = useSnookerMutation();
  const operating = session.status === "RUNNING" || session.status === "PAUSED";
  const operate = can(actor, "tables.operate"); const approve = can(actor, "session.adjust_final_charge");
  async function command(data: Record<string, unknown>) {
    const result = await mutate(`/api/snooker/sessions/${session.id}`, { ...data, revision: session.revision });
    if (result) { setSession(result.session); onUpdated(result.session); }
  }
  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const frames = session.segments.filter(s => s.playType === "FRAME_WISE" && s.frameCount === null).map(s => ({ segmentId: s.id, count: Number(form.get(s.id)) }));
    await command({ action: "finish", frames, ...(amount ? { proposal: { amount, reason } } : {}) });
  }
  return <Modal open onOpenChange={open => { if (!open && !busy) close(); }} title={`Table ${session.tableNumber} · Pricing review`} description="Calculated charges are preserved. Custom pricing requires an owner or administrator. No payment is recorded here.">
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-4 text-sm">
        <div className="col-span-2"><dt>Session ID</dt><dd className="break-all font-mono text-xs">{session.id}</dd></div>
        <div><dt>Staff member</dt><dd>{session.startedBy.name}</dd></div><div><dt>Status</dt><dd>{label(session.status)}</dd></div>
        <div><dt>Initial play type</dt><dd>{label(session.initialPlayType)}</dd></div><div><dt>Current / final play type</dt><dd>{label(session.currentPlayType)}</dd></div>
      </dl>
      <section aria-label="Pricing segments" className="space-y-3"><h2>Pricing breakdown</h2>{session.segments.map(s => <article key={s.id} className="rounded-lg border p-3 text-sm">
        <p className="font-semibold">Segment {s.sequence + 1} · {label(s.playType)}</p><p className="break-words text-xs text-muted-foreground">{timestamp(s.startedAt)} → {s.endedAt ? timestamp(s.endedAt) : "Open"}</p>
        <p>Saved rate: Rs. {s.appliedRate} / {s.playType === "HOURLY" ? "hour" : "frame"}</p>
        <p>{s.playType === "HOURLY" ? `Recorded billable duration: ${s.billableSeconds} seconds` : `Completed frames: ${s.frameCount ?? "Required at finish"}`}</p>
        {s.activeSince && <p className="text-xs text-muted-foreground">Running since {timestamp(s.activeSince)}. Current elapsed time is calculated by the server on pause, switch or finish.</p>}
        <p>Calculated amount: {s.calculatedAmount === null ? "Not finalized" : `Rs. ${s.calculatedAmount}`}</p>
      </article>)}</section>
      <dl className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm">
        <div><dt>Calculated reference charge</dt><dd data-testid="reference-total" className="text-xl font-bold">{session.calculatedAmount === null ? "Calculated when finished" : `Rs. ${session.calculatedAmount}`}</dd></div>
        <div><dt>Proposed adjusted charge</dt><dd>{pending ? `Rs. ${pending.proposedAmount} — awaiting approval` : "No pending proposal"}</dd></div>
        <div><dt>Approved final charge</dt><dd data-testid="approved-total">{session.approvedFinalAmount === null ? "No custom approval" : `Rs. ${session.approvedFinalAmount}`}</dd></div>
        {session.adjustmentApprovedBy && <><div><dt>Approving admin</dt><dd>{session.adjustmentApprovedBy.name}</dd></div><div><dt>Approved at</dt><dd>{timestamp(session.adjustmentApprovedAt!)}</dd></div><div><dt>Adjustment difference</dt><dd>Rs. {session.adjustmentDifference}</dd></div><div><dt>Reason</dt><dd>{session.adjustmentReason}</dd></div></>}
        <div><dt>Checkout status</dt><dd>{session.checkout ? label(session.checkout.status) : "Not created"}</dd></div>
        <div><dt>Outstanding checkout amount</dt><dd>{session.checkout?.amount == null ? "Undetermined — no approved payable amount" : `Rs. ${session.checkout.amount}`}</dd></div>
      </dl>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error} <button className="underline" onClick={close}>Return and refresh</button></p>}
      {operating && operate && <>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => command({ action: session.status === "RUNNING" ? "pause" : "resume" })}>{session.status === "RUNNING" ? "Pause" : "Resume"}</Button><Button variant="outline" disabled={busy} onClick={() => command({ action: "switch", playType: session.currentPlayType === "HOURLY" ? "FRAME_WISE" : "HOURLY" })}>Switch to {session.currentPlayType === "HOURLY" ? "frame-wise" : "hourly"}</Button></div>
        <form onSubmit={finish} className="space-y-4 rounded-lg border p-4"><h2>Finish Session</h2>
          {session.segments.filter(s => s.playType === "FRAME_WISE" && s.frameCount === null).map(s => <label key={s.id} className="block text-sm">Completed frames — segment {s.sequence + 1}<input className={inputClass} name={s.id} type="number" min="0" max="10000" step="1" required /></label>)}
          <label className="block text-sm">Proposed final charge (optional)<input className={inputClass} type="number" min="0" max="99999999.99" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          {amount && <label className="block text-sm">Adjustment reason<textarea className={inputClass} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} required /></label>}
          <p className="text-xs text-muted-foreground">Leave the proposal blank to use the calculated amount. Finishing releases the table. A proposal holds checkout for admin review.</p>
          <Button disabled={busy} type="submit">{busy ? "Saving…" : "Finish Session"}</Button>
        </form>
      </>}
      {!operating && !pending && session.approvedFinalAmount === null && operate && <form className="space-y-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void command({ action: "propose", amount, reason }); }}>
        <h2>Request pricing adjustment</h2><label className="block text-sm">Proposed final charge<input className={inputClass} type="number" min="0" max="99999999.99" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
        <p>Difference: Rs. {difference(session.calculatedAmount!, amount)}</p><label className="block text-sm">Adjustment reason<textarea className={inputClass} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} required /></label><Button type="submit" disabled={busy}>Request admin approval</Button>
      </form>}
      {pending && approve && <form className="space-y-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void command({ action: "approve", adjustmentId: pending.id, amount, reason }); }}>
        <h2>Admin approval</h2><p className="text-sm">Approving as {actor.name}. Requested by {pending.proposedBy.name}.</p>
        <label className="block text-sm">Approved final charge<input className={inputClass} type="number" min="0" max="99999999.99" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <p>Difference: Rs. {difference(session.calculatedAmount!, amount)}</p><label className="block text-sm">Approval reason<textarea className={inputClass} maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2"><Button disabled={busy} type="submit">Approve Custom Amount</Button><Button disabled={busy} variant="outline" type="button" onClick={() => command({ action: "reject", adjustmentId: pending.id, reason: reason.trim() || "Use calculated amount; custom proposal rejected." })}>Use Calculated Amount</Button></div>
      </form>}
      {pending && !approve && <p className="rounded-lg bg-muted p-3 text-sm">Waiting for an administrator to review this proposal in their own session. The financial obligation remains outstanding.</p>}
      {pending && pending.proposedById === actor.id && operate && <Button variant="outline" disabled={busy} onClick={() => command({ action: "cancel", adjustmentId: pending.id, reason: "Requester cancelled proposal; use calculated amount." })}>Cancel request and use calculated amount</Button>}
      {!!session.adjustments.length && <section className="space-y-2"><h2>Adjustment history</h2>{session.adjustments.map(a => <div key={a.id} className="rounded border p-3 text-sm"><p>{label(a.status)} · proposed Rs. {a.proposedAmount} by {a.proposedBy.name}</p><p>{a.proposedReason}</p>{a.reviewedBy && <p>{a.reviewedBy.name}: {a.reviewReason} {a.approvedAmount !== null && `· approved Rs. ${a.approvedAmount}`}</p>}</div>)}</section>}
      <details><summary className="cursor-pointer font-semibold">Complete session timeline</summary><ol className="mt-3 space-y-3 text-xs">{session.events.map(e => <li key={e.id} className="border-l-2 border-orange-300 pl-3"><p>{timestamp(e.createdAt)} · {e.actor.name}</p><p className="font-semibold">{label(e.action)}</p><p className="break-all text-muted-foreground">{eventDetails(e.metadata)}</p></li>)}</ol></details>
      <Button variant="outline" disabled={busy} onClick={close}>Cancel / Return to Session</Button>
    </div>
  </Modal>;
}
