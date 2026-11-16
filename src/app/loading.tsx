export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="space-y-6 motion-safe:animate-pulse"
    >
      <div className="h-10 w-56 rounded-lg bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-gray-200" />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
