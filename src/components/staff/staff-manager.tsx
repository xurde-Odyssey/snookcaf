"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { inputClass } from "@/components/auth/auth-form";
import { roles, areas, canManageRole, type Role, type Area } from "@/lib/auth/permissions";
type StaffRow = { id: string; name: string; email: string; role: Role; operationalArea: Area; active: boolean; mustChangePassword: boolean; createdAt: string; updatedAt: string };
export function StaffManager({ staff, actor }: { staff: StaffRow[]; actor: { id: string; role: Role } }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  function edit(row: StaffRow | null) { setSelected(row); setError(""); setOpen(true); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const common = { role: form.get("role"), operationalArea: form.get("operationalArea"), currentPassword: form.get("currentPassword") };
    const password = String(form.get("password") || "");
    const body = selected ? { ...common, active: form.get("active") === "on", ...(password ? { password } : {}) } : { ...common, name: form.get("name"), email: form.get("email"), password };
    try {
      const response = await fetch(selected ? `/api/staff/${selected.id}` : "/api/staff", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Unable to save account."); return; }
      if (selected?.id === actor.id) {
        // Discard cached protected payloads after changing our own permissions.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login"); return;
      }
      setOpen(false); setNotice(selected ? "Account updated. Existing sessions were signed out." : "Staff account created. Share the temporary password privately; the staff member must change it on first sign-in."); router.refresh();
    } catch { setError("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl">Staff</h1><p className="mt-2 text-sm text-muted-foreground">Manage accounts, assigned areas and access.</p></div><Button onClick={() => edit(null)}>Create staff account</Button></div>
    {notice && <p role="status" className="rounded-xl border border-orange-200 bg-orange-50 p-4">{notice}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Staff directory — up to 500 most recent accounts</caption><thead className="border-b bg-muted"><tr>{["Staff", "Role / area", "Status", "Created", "Updated", "Actions"].map(label => <th key={label} className="p-4 font-semibold">{label}</th>)}</tr></thead><tbody>
      {staff.map(user => <tr key={user.id} className="border-b last:border-0"><td className="p-4"><p className="font-semibold">{user.name}</p><p className="text-muted-foreground">{user.email}</p></td><td className="p-4">{user.role}<p className="text-xs text-muted-foreground">{user.operationalArea}</p></td><td className="p-4"><span className={user.active ? "text-green-800" : "text-red-800"}>{user.active ? "Active" : "Disabled"}</span>{user.mustChangePassword && <p className="text-xs text-muted-foreground">Password change required</p>}</td><td className="whitespace-nowrap p-4">{user.createdAt.replace("T", " ").slice(0, 16)} UTC</td><td className="whitespace-nowrap p-4">{user.updatedAt.replace("T", " ").slice(0, 16)} UTC</td><td className="p-4">{canManageRole(actor.role, user.role) ? <Button variant="outline" size="sm" onClick={() => edit(user)} aria-label={`Manage ${user.name}`}>Manage</Button> : <span className="text-muted-foreground">Owner managed</span>}</td></tr>)}
    </tbody></table>{!staff.length && <p className="p-8 text-center">No staff accounts found.</p>}</div>
    <p className="text-xs text-muted-foreground">Showing up to 500 accounts. All security changes are audited. Administrators can manage managers, cashiers and staff only.</p>
    <Modal open={open} onOpenChange={value => { if (!busy) setOpen(value); }} title={selected ? `Manage ${selected.name}` : "Create staff account"} description="Confirm changes with your own password. Changed accounts are signed out on every device.">
      <form key={selected?.id ?? "new"} onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto p-1">
        {!selected && <><label className="block text-sm">Full name<input name="name" maxLength={100} required className={inputClass} /></label><label className="block text-sm">Email<input name="email" type="email" maxLength={254} autoComplete="off" required className={inputClass} /></label></>}
        <label className="block text-sm">Role<select name="role" defaultValue={selected?.role ?? "STAFF"} className={inputClass}>{roles.filter(role => canManageRole(actor.role, role)).map(role => <option key={role}>{role}</option>)}</select></label>
        <label className="block text-sm">Assigned operational area (STAFF role)<select name="operationalArea" defaultValue={selected?.operationalArea ?? "NONE"} className={inputClass}>{areas.map(area => <option key={area}>{area}</option>)}</select></label>
        {selected && <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={selected.active} className="h-4 w-4 accent-orange-700" />Account active</label>}
        <label className="block text-sm">{selected ? "Reset with temporary password (optional)" : "Temporary password"}<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required={!selected} className={inputClass} /></label>
        <p className="text-xs text-muted-foreground">Use 12–128 characters. Share temporary passwords privately. The recipient must choose a new password before working.</p>
        <label className="block text-sm">Your current password<input name="currentPassword" type="password" maxLength={128} autoComplete="current-password" required className={inputClass} /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex gap-3"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save account"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
      </form>
    </Modal>
  </div>;
}
