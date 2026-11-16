import type { LucideIcon } from "lucide-react";
export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="rounded-lg bg-muted p-2.5 text-muted-foreground">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}
