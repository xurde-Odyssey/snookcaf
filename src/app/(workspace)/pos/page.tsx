import { CafePosWorkspace } from "@/components/cafe/cafe-workspace";
import { requirePage } from "@/lib/auth/page";

export const dynamic = "force-dynamic";

export default async function PosPage({ searchParams }: { searchParams: Promise<{ sessionId?: string }> }) {
  await requirePage("cafe.order");
  const { sessionId } = await searchParams;
  return <CafePosWorkspace key={sessionId ?? "standalone"} initialSessionId={sessionId} />;
}
