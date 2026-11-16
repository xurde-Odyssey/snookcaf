"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Coffee,
  Info,
  ReceiptText,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  TableStatusBadge,
  type TableStatus,
} from "@/components/ui/table-status";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { demoOrders, demoTables } from "@/features/dashboard/fixtures";
import { formatMoney } from "@/lib/format";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/lib/utils";
export function Dashboard({ date }: { date: string }) {
  const [sample, setSample] = useState(true);
  const [filter, setFilter] = useState<TableStatus | "all">("all");
  const [selected, setSelected] = useState<(typeof demoTables)[number] | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const tables = sample
    ? demoTables.filter((t) => filter === "all" || t.status === filter)
    : [];
  const orders = sample
    ? demoOrders.filter((o) =>
        `${o.id} ${o.items} ${o.table}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            YOUR CLUB, AT A GLANCE
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A little clarity for a busy day.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5 text-xs text-muted-foreground">
          <CalendarDays size={15} />
          {date}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Info size={17} className="mt-0.5 shrink-0 text-orange-800" />
          <p className="text-xs leading-5 text-orange-950">
            <strong>UI preview.</strong> All figures, orders, and table states
            are fictional samples. No live operations are connected.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium">
          <input
            type="checkbox"
            checked={sample}
            onChange={(e) => setSample(e.target.checked)}
            className="h-4 w-4 accent-orange-700"
          />
          Show sample data
        </label>
      </div>
      <section
        aria-label="Sample key performance indicators"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Total sales"
          value={sample ? formatMoney(18450) : "—"}
          detail="Sample settled sales · not live data"
          icon={Wallet}
        />
        <KpiCard
          label="Snooker revenue"
          value={sample ? formatMoney(12500) : "—"}
          detail="Sample table charges"
          icon={CircleDot}
        />
        <KpiCard
          label="Café revenue"
          value={sample ? formatMoney(5950) : "—"}
          detail="Sample food & beverage sales"
          icon={Coffee}
        />
        <KpiCard
          label="Active tables"
          value={sample ? "02 / 06" : "—"}
          detail="Illustrative occupancy · timers paused"
          icon={ReceiptText}
        />
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="font-semibold">Revenue overview</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Illustrative hourly pattern · NPR
              </p>
            </div>
            <div className="flex gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-primary" />
                Snooker
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-slate-500" />
                Café
              </span>
            </div>
          </div>
          <div className="px-5 pb-5">
            {sample ? (
              <RevenueChart />
            ) : (
              <EmptyState
                title="Your revenue story starts here"
                description="Settled transaction reporting will be connected in Phase 8."
              />
            )}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="font-semibold">The daily picture</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Separate figures. A clearer overview.
          </p>
          <div className="mt-5 space-y-4">
            {[
              {
                label: "Payments collected",
                value: 17250,
                icon: ArrowDownLeft,
              },
              { label: "Outstanding balance", value: 1200, icon: ReceiptText },
              { label: "Daily expenses", value: 2400, icon: ArrowUpRight },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="rounded-lg bg-muted p-2.5 text-muted-foreground">
                  <Icon size={17} />
                </span>
                <span className="flex-1 text-sm text-muted-foreground">
                  {label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {sample ? formatMoney(value) : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            Sales and cash collected are different measures. Profit and gross
            margin await cost-of-goods data.
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">On the floor</h2>
            <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
              SAMPLE TABLES
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Status
            <select
              aria-label="Filter tables by status"
              value={filter}
              onChange={(e) => setFilter(e.target.value as TableStatus | "all")}
              className="min-h-10 rounded-lg border border-border bg-white px-3 text-foreground"
            >
              <option value="all">All tables</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 2xl:grid-cols-3">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => setSelected(table)}
              className="rounded-xl border border-border p-4 text-left transition hover:border-gray-400 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  TABLE {table.id}
                </span>
                <TableStatusBadge status={table.status} />
              </div>
              <div className="my-4 flex items-center gap-4">
                <div
                  aria-hidden="true"
                  className={cn(
                    "relative flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border-[5px] border-[#ddd6c7] shadow-inner",
                    table.status === "occupied"
                      ? "bg-[#315c4c]"
                      : "bg-[#eef0eb]",
                  )}
                >
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[#746b5b]" />
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#746b5b]" />
                  <span className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-[#746b5b]" />
                  <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#746b5b]" />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      table.status === "occupied" ? "bg-white" : "bg-[#bcc8bd]",
                    )}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{table.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {table.type}
                  </p>
                </div>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-xs">
                <span className="font-mono text-muted-foreground">
                  {table.elapsed === "—"
                    ? "No sample session"
                    : `${table.elapsed} · frozen`}
                </span>
                <span className="font-semibold">
                  {table.amount ? formatMoney(table.amount) : "View preview"}{" "}
                  <span aria-hidden="true">↗</span>
                </span>
              </div>
            </button>
          ))}
        </div>
        {!tables.length && (
          <EmptyState
            title="No tables to show"
            description={
              sample
                ? "Try another status to explore the sample tables."
                : "Table management will be available in Phase 3."
            }
          />
        )}
      </section>
      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-semibold">Recent café orders</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sample orders for layout preview
            </p>
          </div>
          <div className="relative">
            <label htmlFor="order-search" className="sr-only">
              Search sample orders
            </label>
            <input
              id="order-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sample orders…"
              className="h-10 w-full rounded-lg border border-border bg-white py-2 pl-3 pr-9 text-xs sm:w-56"
            />
            {search && (
              <button
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1 p-2"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
        <DataTable
          caption="Fictional café orders"
          rows={orders}
          rowKey={(o) => o.id}
          columns={[
            {
              key: "id",
              title: "Order",
              render: (o) => <span className="font-medium">#{o.id}</span>,
            },
            {
              key: "items",
              title: "Items",
              render: (o) => (
                <span className="text-muted-foreground">{o.items}</span>
              ),
            },
            { key: "table", title: "Table / customer", render: (o) => o.table },
            {
              key: "status",
              title: "Status",
              render: (o) => (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs",
                    o.status === "Preparing"
                      ? "bg-orange-50 text-orange-800"
                      : "bg-emerald-50 text-emerald-800",
                  )}
                >
                  {o.status}
                </span>
              ),
            },
            {
              key: "amount",
              title: "Amount",
              render: (o) => (
                <span className="font-medium tabular-nums">
                  {formatMoney(o.amount)}
                </span>
              ),
            },
          ]}
        />
        <div className="flex justify-end border-t border-border p-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/orders">
              Explore orders workspace <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      </section>
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={
          selected ? `Table ${selected.id} · ${selected.name}` : "Table preview"
        }
        description="This is a UI component preview. Session controls will be implemented in Phase 3."
      >
        {selected && (
          <div className="space-y-5">
            <TableStatusBadge status={selected.status} />
            <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Table type</dt>
                <dd className="mt-1 font-medium">{selected.type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sample amount</dt>
                <dd className="mt-1 font-medium">
                  {formatMoney(selected.amount)}
                </dd>
              </div>
            </dl>
            <p className="text-sm leading-6 text-muted-foreground">
              The sample timer is frozen. No session has been started, and no
              charges are being recorded.
            </p>
            <Button className="w-full" onClick={() => setSelected(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
