import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { navigation } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { requirePage } from "@/lib/auth/page";
import { routePermissions } from "@/lib/auth/permissions";
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = navigation.find((n) => n.href === `/${module}`);
  if (!item) notFound();
  await requirePage(routePermissions[item.href]);
  const Icon = item.icon;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Workspace
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {item.label}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your workspace is ready for the next stage.
      </p>
      <section className="mt-8 flex min-h-96 flex-col items-center justify-center rounded-xl border border-border bg-white px-6 py-12 text-center">
        <div className="mb-5 rounded-2xl bg-orange-50 p-5 text-orange-800">
          <Icon size={30} strokeWidth={1.5} />
        </div>
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Layers size={13} />
          Planned · Phase {item.phase}
        </span>
        <h2 className="text-xl font-semibold">{item.label}, coming next</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Phase 1 establishes the design system and navigation. This module has
          no connected business operations yet.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
        </Button>
      </section>
    </div>
  );
}
