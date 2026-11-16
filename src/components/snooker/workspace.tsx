"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { inputClass } from "@/components/auth/auth-form";
import { can, type Identity } from "@/lib/auth/permissions";
import type { TableView, SessionView, MenuView, PricingView } from "@/features/snooker/types";
import { SessionDialog } from "./session-dialog";
import { useSnookerMutation } from "./use-mutation";
type Actor = Identity & { id: string; name: string };
export function TablesWorkspace({ tables, actor }: { tables: TableView[]; actor: Actor }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [editing, setEditing] = useState<TableView | "new" | null>(null);
  const { mutate, busy, error } = useSnookerMutation();
  const manage = can(actor, "tables.manage");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const body = { number: data.get("number"), name: data.get("name"), defaultPlayType: data.get("playType") };
    const result = await mutate("/api/snooker/catalog", editing === "new" ? { action: "table.create", ...body } : { action: "table.update", id: editing!.id, ...body, archived: data.get("archived") === "on" });
    if (result) setEditing(null);
  }
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl">Snooker Tables</h1><p className="mt-2 text-sm text-muted-foreground">Server-timed sessions. Finish play to release a table and create pending checkout.</p></div>{manage && <Button onClick={() => setEditing("new")}>Add table</Button>}</div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {!tables.length && <div className="rounded-xl border bg-white p-8">No tables yet. An administrator can add tables and configure play rates.</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{tables.filter(t => manage || !t.archivedAt).map(table => <article key={table.id} className="space-y-4 rounded-xl border bg-white p-5" data-testid={`table-${table.number}`}>
      <div className="flex items-center justify-between gap-2"><h2>Table {table.number} · {table.name}</h2><span className="rounded-full bg-muted px-2 py-1 text-xs">{table.archivedAt ? "Archived" : table.sessions.length ? table.sessions[0].status : "Available"}</span></div>
      <p className="text-sm text-muted-foreground">Default: {table.defaultPlayType.replaceAll("_", " ")}</p>
      <div className="flex flex-wrap gap-2">{table.sessions[0] ? <Button onClick={() => setSession(table.sessions[0])}>Open session</Button> : !table.archivedAt && can(actor, "tables.operate") && <Button disabled={busy} onClick={async () => { const result = await mutate("/api/snooker/sessions", { tableId: table.id }); if (result) setSession(result.session); }}>Start session</Button>}
      {manage && <Button variant="outline" disabled={busy || !!table.sessions.length} onClick={() => setEditing(table)}>Edit table</Button>}</div>
    </article>)}</div>
    {session && <SessionDialog key={session.id} session={session} actor={actor} close={() => setSession(null)} onUpdated={setSession} />}
    <Modal open={editing !== null} onOpenChange={open => { if (!open && !busy) setEditing(null); }} title={editing === "new" ? "Add table" : "Edit table"} description="A table starts sessions in its fixed default play type. Archived tables retain all session history.">
      <form key={editing === "new" ? "new" : editing?.id} onSubmit={save} className="space-y-4">
        <label className="block text-sm">Table number<input name="number" required maxLength={20} defaultValue={editing && editing !== "new" ? editing.number : ""} className={inputClass} /></label>
        <label className="block text-sm">Table name<input name="name" required maxLength={100} defaultValue={editing && editing !== "new" ? editing.name : ""} className={inputClass} /></label>
        <label className="block text-sm">Default play type<select name="playType" defaultValue={editing && editing !== "new" ? editing.defaultPlayType : "HOURLY"} className={inputClass}><option value="HOURLY">Hourly</option><option value="FRAME_WISE">Frame-wise</option></select></label>
        {editing && editing !== "new" && <label className="flex items-center gap-2 text-sm"><input name="archived" type="checkbox" defaultChecked={!!editing.archivedAt} />Archived</label>}
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save table"}</Button>
      </form>
    </Modal>
  </div>;
}
export function SessionHistory({ sessions, actor, review = false }: { sessions: SessionView[]; actor: Actor; review?: boolean }) {
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [search, setSearch] = useState("");
  const shown = sessions.filter(s => `${s.id} ${s.tableNumber} ${s.startedBy.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><h1 className="text-3xl">{review ? "Pricing reviews" : "Session history"}</h1><p className="text-sm text-muted-foreground">{review ? "Review requested adjustments in your own authenticated admin session. Checkout remains awaiting approval until reviewed." : "Calculated charges, pricing snapshots, proposals and approvals are retained. These are outstanding checkouts, not recorded payments."}</p>
    <label className="block max-w-md text-sm">Search table, session or staff<input value={search} onChange={e => setSearch(e.target.value)} className={inputClass} /></label>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-muted"><tr>{["Table / session", "Staff", "Status", "Reference", "Approved", "Checkout", "History"].map(t => <th key={t} className="p-4">{t}</th>)}</tr></thead><tbody>{shown.map(s => <tr key={s.id} className="border-b"><td className="p-4">Table {s.tableNumber}<p className="max-w-40 break-all text-xs text-muted-foreground">{s.id}</p></td><td className="p-4">{s.startedBy.name}</td><td className="p-4">{s.status.replaceAll("_", " ")}</td><td className="p-4">{s.calculatedAmount === null ? "Open" : `Rs. ${s.calculatedAmount}`}</td><td className="p-4">{s.approvedFinalAmount === null ? "—" : `Rs. ${s.approvedFinalAmount}`}</td><td className="p-4">{s.checkout?.status.replaceAll("_", " ") ?? "—"}</td><td className="p-4"><Button variant="outline" size="sm" onClick={() => setSelected(s)}>{review ? "Review pricing" : "View history"}</Button></td></tr>)}</tbody></table>{!shown.length && <p className="p-8 text-center">{review ? "No pricing requests awaiting approval." : "No sessions found."}</p>}</div>
    <p className="text-xs text-muted-foreground">Showing up to 100 most recent sessions. Each session includes its complete pricing history.</p>
    {selected && <SessionDialog key={selected.id} session={selected} actor={actor} close={() => setSelected(null)} onUpdated={setSelected} />}
  </div>;
}
export function MenuWorkspace({ items }: { items: MenuView[] }) {
  const [editing, setEditing] = useState<MenuView | "new" | null>(null); const { mutate, busy, error } = useSnookerMutation();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const common = { name: form.get("name"), price: form.get("price") };
    const result = await mutate("/api/snooker/catalog", editing === "new" ? { action: "menu.create", ...common } : { action: "menu.update", id: editing!.id, ...common, archived: form.get("archived") === "on" }); if (result) setEditing(null);
  }
  return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><h1 className="text-3xl">Café menu</h1><Button onClick={() => setEditing("new")}>Add menu item</Button></div><p className="text-sm text-muted-foreground">Admin-managed menu catalog. Ordering and payments are not connected.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <article key={item.id} className="space-y-3 rounded-xl border bg-white p-5"><h2>{item.name}</h2><p>Rs. {item.price} · {item.archivedAt ? "Archived" : "Active"}</p><Button variant="outline" onClick={() => setEditing(item)}>Edit item</Button></article>)}</div>{!items.length && <p className="rounded-xl border bg-white p-8">No menu items yet.</p>}
    <Modal open={editing !== null} onOpenChange={open => { if (!open && !busy) setEditing(null); }} title={editing === "new" ? "Add menu item" : "Edit menu item"} description="Manage the catalog. Archive items to keep history intact."><form key={editing === "new" ? "new" : editing?.id} onSubmit={save} className="space-y-4"><label className="block text-sm">Item name<input name="name" maxLength={100} required defaultValue={editing && editing !== "new" ? editing.name : ""} className={inputClass} /></label><label className="block text-sm">Price (NPR)<input name="price" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={editing && editing !== "new" ? editing.price : ""} className={inputClass} /></label>{editing && editing !== "new" && <label className="flex items-center gap-2"><input type="checkbox" name="archived" defaultChecked={!!editing.archivedAt} />Archived</label>}{error && <p role="alert" className="text-red-800">{error}</p>}<Button disabled={busy} type="submit">{busy ? "Saving…" : "Save menu item"}</Button></form></Modal>
  </div>;
}
export function PricingWorkspace({ versions }: { versions: PricingView[] }) {
  const { mutate, busy, error } = useSnookerMutation(); const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setSaved(false); const result = await mutate("/api/snooker/catalog", { action: "pricing.set", hourlyRate: form.get("hourlyRate"), frameRate: form.get("frameRate") }); if (result) setSaved(true); }
  return <div className="space-y-6"><h1 className="text-3xl">Play rates</h1><p className="text-sm text-muted-foreground">Global NPR rates apply to new segments only. Existing segments keep their saved rate, even during a running session.</p>
    <form onSubmit={save} className="max-w-lg space-y-4 rounded-xl border bg-white p-6"><label className="block text-sm">Hourly rate<input name="hourlyRate" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={versions[0]?.hourlyRate ?? ""} className={inputClass} /></label><label className="block text-sm">Frame rate<input name="frameRate" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={versions[0]?.frameRate ?? ""} className={inputClass} /></label>{error && <p role="alert" className="text-red-800">{error}</p>}{saved && <p role="status">New pricing version saved.</p>}<Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save rates"}</Button></form>
    <section className="space-y-3"><h2>Rate history (latest 50)</h2>{versions.map(v => <p key={v.id} className="rounded-lg border bg-white p-4 text-sm">{v.createdAt.replace("T", " ")} · Rs. {v.hourlyRate}/hour · Rs. {v.frameRate}/frame</p>)}{!versions.length && <p>No rates configured. Set rates before starting a session.</p>}</section>
  </div>;
}
