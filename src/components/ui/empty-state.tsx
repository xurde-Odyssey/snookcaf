import { Inbox } from "lucide-react";
export function EmptyState({
  title = "Nothing here yet",
  description = "Records will appear here once operations are enabled.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-muted p-4 text-muted-foreground">
        <Inbox size={24} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
