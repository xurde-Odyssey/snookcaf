"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coffee, Minus, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";

type Product = { id: string; name: string; category: string; price: string; archivedAt: string | null; available?: boolean };
type ActiveSession = { id: string; tableNumber: string; tableName?: string; startedBy?: { name: string }; customerName?: string | null };
type OrderItem = { id?: string; productId: string; productNameSnapshot: string; unitPriceSnapshot: string; quantity: number; subtotal: string };
type CafeOrder = { id: string; orderNumber: string; status: "ACTIVE" | "COMPLETED" | "CANCELLED"; subtotal: string; notes: string | null; createdAt: string; session: { id: string; tableNumber: string; startedBy?: { name: string } } | null; createdBy: { id: string; name: string }; items: OrderItem[]; cancellationReason?: string | null };
type CatalogData = { products: Product[]; activeSessions: ActiveSession[] };
type OrderData = { orders: CafeOrder[] };
type CartLine = { product: Product; quantity: number };
const statuses = ["ALL", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
const posGroups = ["All", "Beverages", "Food & Snacks", "Veg Snacks", "Other"] as const;
const beverageTypes = ["All", "Coffee", "Tea", "Cold drinks", "Beer", "Other beverages"] as const;
const foodTypes = ["All", "Non-Vegetarian", "Other food"] as const;
const kathmanduTime = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(new Date(value));
function productGroup(value: string) {
  const name = value.trim().toLowerCase();
  if (/coffee|tea|cold.?drink|soft.?drink|beverage|beer|juice|soda|espresso|latte|milkshake/.test(name)) return "Beverages";
  if (/non.?veg|nonvegetarian/.test(name)) return "Food & Snacks";
  if (/veg.*snack|snack.*veg/.test(name)) return "Veg Snacks";
  if (/food|snack|momo|meat|chicken|burger/.test(name)) return "Food & Snacks";
  return "Other";
}
function productSubcategory(value: string, group: string) {
  const name = value.trim().toLowerCase();
  if (group === "Beverages") {
    if (/coffee|espresso|latte/.test(name)) return "Coffee";
    if (/tea/.test(name)) return "Tea";
    if (/cold.?drink|soft.?drink|juice|soda|milkshake/.test(name)) return "Cold drinks";
    if (/beer/.test(name)) return "Beer";
    return "Other beverages";
  }
  if (group === "Food & Snacks") return /non.?veg|nonvegetarian/.test(name) ? "Non-Vegetarian" : "Other food";
  return "";
}

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Unable to complete this request.");
  return data as T;
}

export function CafePosWorkspace({ initialSessionId }: { initialSessionId?: string }) {
  const requestedSessionId = initialSessionId ?? "";
  const [catalog, setCatalog] = useState<CatalogData>({ products: [], activeSessions: [] });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [subcategory, setSubcategory] = useState("All");
  const [orderType, setOrderType] = useState<"STANDALONE" | "SESSION">(requestedSessionId ? "SESSION" : "STANDALONE");
  const [sessionId, setSessionId] = useState(requestedSessionId);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchCatalog = useCallback(async () => responseData<CatalogData>(await fetch("/api/cafe/pos", { cache: "no-store" })), []);
  useEffect(() => {
    let active = true;
    void fetchCatalog().then(data => { if (active) setCatalog(data); }).catch(cause => { if (active) setCatalogError(cause instanceof Error ? cause.message : "Unable to load the café menu."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchCatalog]);
  async function refreshCatalog() {
    setLoading(true); setCatalogError("");
    try { setCatalog(await fetchCatalog()); }
    catch (cause) { setCatalogError(cause instanceof Error ? cause.message : "Unable to load the café menu."); }
    finally { setLoading(false); }
  }

  const categories = posGroups.filter(group => group !== "Other" || catalog.products.some(product => productGroup(product.category) === "Other"));
  const subcategories = category === "Beverages" ? beverageTypes : category === "Food & Snacks" ? foodTypes : [];
  const products = useMemo(() => catalog.products.filter(product => {
    if (product.archivedAt || product.available === false || !product.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    const group = productGroup(product.category);
    return (category === "All" || group === category) && (subcategory === "All" || productSubcategory(product.category, group) === subcategory);
  }), [catalog.products, category, subcategory, query]);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const selectedSession = catalog.activeSessions.find(session => session.id === sessionId);

  function add(product: Product) {
    setNotice("");
    setCart(current => current.some(line => line.product.id === product.id) ? current.map(line => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }]);
  }
  function adjust(productId: string, delta: number) {
    setCart(current => current.map(line => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0));
  }
  async function createOrder() {
    if (!cart.length || (orderType === "SESSION" && !sessionId)) return;
    setSaving(true); setOrderError(""); setNotice("");
    try {
      const data = await responseData<{ order: CafeOrder }>(await fetch("/api/cafe/orders", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), orderType, sessionId: orderType === "SESSION" ? sessionId : null, notes: notes.trim() || null, items: cart.map(line => ({ productId: line.product.id, quantity: line.quantity })) }),
      }));
      setNotice(`Order ${data.order.orderNumber} created.`); setCart([]); setNotes(""); setCartOpen(false);
    } catch (cause) {
      setOrderError(cause instanceof Error ? cause.message : "Unable to create this order.");
    } finally { setSaving(false); }
  }

  function cartPanel() {
    return <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-border pb-3"><div><h2 className="font-semibold text-[#171717]">Current order</h2><p className="mt-1 text-xs text-[#71717A]">{count} {count === 1 ? "item" : "items"}</p></div><button type="button" className="rounded p-1 text-[#71717A] hover:bg-[#F1F3F5] lg:hidden" onClick={() => setCartOpen(false)} aria-label="Close cart"><X size={18}/></button></div>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-[#F1F3F5] p-1" aria-label="Order type">
        {([ ["STANDALONE", "Walk-in"], ["SESSION", "Snooker table"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setOrderType(value)} aria-pressed={orderType === value} className={`rounded-md px-2 py-2 text-xs font-semibold ${orderType === value ? "bg-white text-[#171717] shadow-sm" : "text-[#71717A]"}`}>{label}</button>)}
      </div>
      {orderType === "SESSION" && <label className="mt-3 block text-xs font-medium text-[#4B5563]">Active table / session<select aria-label="Active table or session" value={sessionId} onChange={event => setSessionId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-[#171717]"><option value="">Select an active table</option>{catalog.activeSessions.map(session => <option key={session.id} value={session.id}>Table {session.tableNumber}{session.customerName ? ` · ${session.customerName}` : session.startedBy ? ` · ${session.startedBy.name}` : ""}</option>)}</select></label>}
      {selectedSession && <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-[#7C3210]">Adding to Table {selectedSession.tableNumber} · session-linked charges</p>}
      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {!cart.length ? <EmptyState title="Your cart is empty" description="Add items from the menu to start an order."/> : cart.map(line => <div key={line.product.id} className="flex items-center gap-3 border-b border-border pb-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-primary"><Coffee size={17}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{line.product.name}</p><p className="text-xs text-[#71717A]">{formatMoney(Number(line.product.price))} each</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => adjust(line.product.id, -1)} aria-label={`Decrease ${line.product.name}`} className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-[#F1F3F5]"><Minus size={13}/></button><span className="w-4 text-center text-sm tabular-nums">{line.quantity}</span><button type="button" onClick={() => adjust(line.product.id, 1)} aria-label={`Increase ${line.product.name}`} className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-[#F1F3F5]"><Plus size={13}/></button></div><span className="w-20 text-right text-sm font-semibold tabular-nums">{formatMoney(Number(line.product.price) * line.quantity)}</span><button type="button" onClick={() => adjust(line.product.id, -line.quantity)} aria-label={`Remove ${line.product.name}`} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={15}/></button></div>)}
      </div>
      <div className="mt-4 border-t border-border pt-4"><label className="block text-xs font-medium text-[#4B5563]">Order note <span className="font-normal text-[#71717A]">(optional)</span><textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={300} rows={2} placeholder="Add a note for this order" className="mt-1 w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"/></label><div className="my-4 flex items-center justify-between text-sm"><span className="text-[#4B5563]">Subtotal</span><strong className="text-base text-[#171717]">{formatMoney(total)}</strong></div>{orderError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{orderError}</p>}<Button className="w-full" disabled={saving || !cart.length || (orderType === "SESSION" && !sessionId)} onClick={() => void createOrder()}>{saving ? "Creating order…" : `Create order · ${formatMoney(total)}`}</Button></div>
    </div>;
  }

  return <div className="space-y-5 pb-20 lg:pb-0">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-[26px] font-bold tracking-tight">Point of Sale</h1><p className="mt-1 text-sm text-[#4B5563]">Create a café order for a walk-in or an active snooker session.</p></div><Button variant="outline" size="sm" onClick={() => void refreshCatalog()} disabled={loading}>Refresh menu</Button></header>
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
      <section className="min-w-0 space-y-4">
        <label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"/><input aria-label="Search café products" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search menu items" className="h-11 w-full rounded-lg border border-border bg-white pl-10 pr-3 text-sm focus:border-primary focus:outline-none"/></label>
        <div className="flex flex-wrap gap-2" aria-label="Product categories">{categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setSubcategory("All"); }} className={`min-h-9 rounded-full border px-4 text-xs font-semibold ${category === value ? "border-primary bg-primary text-[#171717]" : "border-border bg-white text-[#4B5563] hover:bg-[#F1F3F5]"}`}>{value}</button>)}</div>
        {subcategories.length > 0 && <div className="flex flex-wrap gap-2" aria-label={`${category} subcategories`}>{subcategories.map(value => <button key={value} type="button" aria-pressed={subcategory === value} onClick={() => setSubcategory(value)} className={`min-h-8 rounded-full px-3 text-xs font-medium ${subcategory === value ? "bg-[#141414] text-white" : "border border-border bg-white text-[#4B5563] hover:bg-[#F1F3F5]"}`}>{value}</button>)}</div>}
        {!loading && catalogError && <EmptyState title="Menu could not be loaded" description={catalogError}/>}
        {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{[1,2,3,4,5,6,7,8].map(n => <div key={n} className="h-32 animate-pulse rounded-xl border border-border bg-white" />)}</div> : !catalogError && products.length === 0 ? <EmptyState title={query ? "No matching items" : "No active menu items"} description={query ? "Try another search or category." : "An administrator can add active items in Café Menu settings."}/> : !catalogError && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{products.map(product => <article key={product.id} className="group flex min-h-36 flex-col justify-between rounded-xl border border-border bg-white p-3.5 transition-colors hover:border-orange-300 sm:p-4"><div><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF3E8] text-[#D65B12]"><Coffee size={18}/></div><h2 className="line-clamp-2 text-sm font-semibold text-[#171717]">{product.name}</h2><p className="mt-1 text-xs text-[#71717A]">{product.category}</p></div><div className="mt-4 flex items-center justify-between gap-2"><span className="text-sm font-bold text-[#171717]">{formatMoney(Number(product.price))}</span><button type="button" onClick={() => add(product)} aria-label={`Add ${product.name} to order`} className="flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2 text-xs font-semibold text-[#171717] transition-transform hover:scale-105"><Plus size={15}/>Add</button></div></article>)}</div>}
      </section>
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] min-h-[520px] rounded-xl border border-border bg-white p-4 lg:block">{cartPanel()}</aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white p-3 shadow-[0_-8px_24px_rgba(20,20,20,0.08)] lg:hidden"><Button className="w-full justify-between" onClick={() => setCartOpen(true)}><span className="flex items-center gap-2"><ShoppingBag size={17}/>Cart · {count} {count === 1 ? "item" : "items"}</span><span>{formatMoney(total)}</span></Button></div>
    <Modal open={cartOpen} onOpenChange={setCartOpen} title="Current order" description="Review items and create the café order."><div className="min-h-[60vh]">{cartPanel()}</div></Modal>
  </div>;
}

export function CafeOrdersWorkspace({ canManage, canCancel }: { canManage: boolean; canCancel: boolean }) {
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [selected, setSelected] = useState<CafeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<Record<string, number>>({});
  const [editNotes, setEditNotes] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try { setOrders((await responseData<OrderData>(await fetch(`/api/cafe/orders?${params}`, { cache: "no-store" }))).orders); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load café orders."); }
    finally { setLoading(false); }
  }, [search, status, from, to]);
  useEffect(() => { const timer = setTimeout(() => void loadOrders(), 220); return () => clearTimeout(timer); }, [loadOrders]);

  async function mutateOrder(body: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await responseData(await fetch(`/api/cafe/orders/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), ...body }) }));
      setNotice(`Order ${selected.orderNumber} updated.`); setSelected(null); setShowCancel(false); setCancelReason(""); await loadOrders();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this order."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <header><h1 className="text-[26px] font-bold tracking-tight">Café orders</h1><p className="mt-1 text-sm text-[#4B5563]">Search and manage orders by reference, table, date, or status.</p></header>
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3"><label className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"/><input aria-label="Search order number or table" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order or table" className="h-10 w-full rounded-lg border border-border pl-9 pr-3 text-sm"/></label><select aria-label="Filter order status" value={status} onChange={event => setStatus(event.target.value as (typeof statuses)[number])} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">{statuses.map(item => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item}</option>)}</select><label className="text-xs text-[#4B5563]">From<input aria-label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} className="ml-2 h-10 rounded-lg border border-border px-2 text-sm"/></label><label className="text-xs text-[#4B5563]">To<input aria-label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} className="ml-2 h-10 rounded-lg border border-border px-2 text-sm"/></label></div>
      {error && <p role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="p-10 text-center text-sm text-[#71717A]">Loading orders…</div> : !orders.length ? <EmptyState title="No café orders found" description="Orders will appear here after they are created in Point of Sale."/> : <div className="divide-y divide-border">
        <div className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_1fr_auto] gap-3 bg-[#F7F7F7] px-4 py-3 text-xs font-semibold text-[#4B5563] md:grid"><span>Order</span><span>Table / type</span><span>Date</span><span>Items</span><span>Status</span><span className="text-right">Subtotal</span></div>
        {orders.map(order => <button key={order.id} type="button" onClick={() => { setSelected(order); setShowCancel(false); setCancelReason(""); setError(""); }} className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-orange-50/50 md:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-3"><span className="text-sm font-semibold text-[#171717]">{order.orderNumber}</span><span className="text-xs text-[#4B5563]">{order.session ? `Table ${order.session.tableNumber}` : "Walk-in café"}</span><span className="text-xs text-[#71717A]">{kathmanduTime(order.createdAt)}</span><span className="text-xs text-[#4B5563]">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</span><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${order.status === "ACTIVE" ? "bg-orange-50 text-[#A6440B]" : order.status === "COMPLETED" ? "bg-green-50 text-green-800" : "bg-gray-100 text-[#4B5563]"}`}>{order.status}</span><span className="text-sm font-semibold tabular-nums text-[#171717] md:text-right">{formatMoney(Number(order.subtotal))}</span></button>)}
      </div>}
    </section>

    <Modal open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setEditing(false); } }} title={selected?.orderNumber ?? "Order details"} description={selected?.session ? `Table ${selected.session.tableNumber} · ${selected.session.id}` : "Standalone café order"}>
      {selected && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected.status === "ACTIVE" ? "bg-orange-50 text-[#A6440B]" : selected.status === "COMPLETED" ? "bg-green-50 text-green-800" : "bg-gray-100 text-[#4B5563]"}`}>{selected.status}</span><span className="text-xs text-[#71717A]">{kathmanduTime(selected.createdAt)} · {selected.createdBy.name}</span></div><div className="divide-y divide-border rounded-lg border border-border">{selected.items.map(item => <div key={item.id ?? item.productId} className="flex justify-between gap-4 p-3 text-sm"><span>{item.productNameSnapshot} × {item.quantity}<small className="ml-2 text-xs text-[#71717A]">{formatMoney(Number(item.unitPriceSnapshot))} each</small></span><span className="font-medium">{formatMoney(Number(item.subtotal))}</span></div>)}<div className="flex justify-between p-3 text-sm font-bold"><span>Subtotal</span><span>{formatMoney(Number(selected.subtotal))}</span></div></div>{selected.notes && <p className="rounded-lg bg-[#F7F7F7] p-3 text-sm"><b>Note:</b> {selected.notes}</p>}{selected.cancellationReason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><b>Cancellation reason:</b> {selected.cancellationReason}</p>}
        {selected.status === "ACTIVE" && canManage && <div className="flex flex-wrap gap-2">{!showCancel && !editing && <Button variant="outline" onClick={() => { setEditing(true); setEditItems(Object.fromEntries(selected.items.map(item => [item.productId, item.quantity]))); setEditNotes(selected.notes ?? ""); }}>Edit items</Button>}{!showCancel && !editing && <Button variant="outline" onClick={() => void mutateOrder({ action: "complete" })} disabled={saving}>Complete order</Button>}{canCancel && !showCancel && !editing && <Button variant="outline" className="text-red-700" onClick={() => setShowCancel(true)}><Trash2 size={15}/>Cancel order</Button>}</div>}
        {editing && <div className="space-y-3 rounded-lg border border-border p-3"><p className="text-sm font-semibold">Update unpaid order items</p>{selected.items.map(item => <label key={item.productId} className="flex items-center justify-between gap-3 text-sm"><span>{item.productNameSnapshot} · {formatMoney(Number(item.unitPriceSnapshot))}</span><input aria-label={`${item.productNameSnapshot} quantity`} type="number" min="0" max="999" step="1" value={editItems[item.productId] ?? 0} onChange={event => setEditItems(current => ({ ...current, [item.productId]: Number(event.target.value) }))} className="h-9 w-20 rounded border border-border px-2"/></label>)}<label className="block text-xs font-medium">Order note<textarea value={editNotes} onChange={event => setEditNotes(event.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded border border-border p-2 text-sm"/></label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(false)}>Keep order</Button><Button size="sm" disabled={saving || !selected.items.some(item => (editItems[item.productId] ?? 0) > 0)} onClick={() => void mutateOrder({ action: "update", notes: editNotes.trim() || null, items: selected.items.map(item => ({ productId: item.productId, quantity: editItems[item.productId] ?? 0 })).filter(item => item.quantity > 0) })}>{saving ? "Saving…" : "Save changes"}</Button></div></div>}
        {showCancel && <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3"><label className="block text-xs font-medium text-[#4B5563]">Cancellation reason (required)<textarea value={cancelReason} onChange={event => setCancelReason(event.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-sm"/></label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setShowCancel(false)}>Keep order</Button><Button size="sm" disabled={saving || !cancelReason.trim()} onClick={() => void mutateOrder({ action: "cancel", reason: cancelReason.trim() })}>Confirm cancellation</Button></div></div>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>}
    </Modal>
  </div>;
}
