import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="rounded-xl border border-border bg-white p-10 text-center">
      <p className="text-sm text-muted-foreground">404 · Page not found</p>
      <h1 className="my-4 text-2xl font-semibold">
        Let’s get you back to the club.
      </h1>
      <Button asChild>
        <Link href="/">Go to dashboard</Link>
      </Button>
    </div>
  );
}
