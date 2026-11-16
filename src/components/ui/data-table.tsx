import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";
export interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
}
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="No records to display"
        description="There are no matching records. Try changing your search or filters."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-y border-border bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th scope="col" className="px-5 py-3 font-medium" key={c.key}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-muted/40">
              {columns.map((c) => (
                <td key={c.key} className="px-5 py-4">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
