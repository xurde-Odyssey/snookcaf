import { cn } from "@/lib/utils";
export type TableStatus = "available" | "occupied" | "reserved" | "maintenance";
const styles: Record<TableStatus, string> = {
  available: "bg-emerald-50 text-emerald-800",
  occupied: "bg-orange-50 text-orange-800",
  reserved: "bg-blue-50 text-blue-800",
  maintenance: "bg-gray-100 text-gray-700",
};
export function TableStatusBadge({ status }: { status: TableStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
        styles[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
