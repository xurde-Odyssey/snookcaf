export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="grid min-h-[65vh] place-items-center"
    >
      <div className="flex flex-col items-center gap-3">
        <div aria-hidden="true" className="relative flex h-10 w-24 items-center justify-center gap-1 overflow-hidden rounded-md border-2 border-[#D7C7A3] bg-[#15583D]">
          <span className="snooker-ball h-2.5 w-2.5 rounded-full bg-red-600" />
          <span className="snooker-ball h-2.5 w-2.5 rounded-full border border-gray-300 bg-white" />
          <span className="snooker-ball h-2.5 w-2.5 rounded-full bg-black" />
        </div>
        <p className="text-sm font-medium text-[#4B5563]">Loading workspace…</p>
      </div>
    </div>
  );
}
