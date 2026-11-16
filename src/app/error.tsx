"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-white p-8">
      <h1 className="text-xl font-semibold">We couldn’t load this workspace</h1>
      <p className="my-4 text-sm text-muted-foreground">
        Please try again. If the problem continues, reload the page.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
