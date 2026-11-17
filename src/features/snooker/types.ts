export type PlayType = "HOURLY" | "FRAME_WISE";
export type Person = { id: string; name: string };
export type SegmentView = { id: string; sequence: number; playType: PlayType; appliedRate: string; startedAt: string; endedAt: string | null; activeSince: string | null; billableSeconds: string; frameCount: number | null; calculatedAmount: string | null };
export type AdjustmentView = { id: string; status: "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED"; proposedAmount: string; proposedReason: string; proposedAt: string; proposedById: string; proposedBy: Person; reviewedBy: Person | null; reviewedAt: string | null; reviewReason: string | null; approvedAmount: string | null };
export type SessionView = {
  id: string; tableNumber: string; startedBy: Person; initialPlayType: PlayType; currentPlayType: PlayType;
  status: "RUNNING" | "PAUSED" | "PENDING_REVIEW" | "PENDING_CHECKOUT"; revision: number; startedAt: string; endedAt: string | null;
  calculatedAmount: string | null; approvedFinalAmount: string | null; adjustmentDifference: string | null; adjustmentReason: string | null;
  adjustmentApprovedBy: Person | null; adjustmentApprovedAt: string | null;
  segments: SegmentView[]; adjustments: AdjustmentView[];
  events: { id: string; action: string; createdAt: string; actor: Person; metadata: Record<string, unknown> }[];
  checkout: { id: string; status: "AWAITING_APPROVAL" | "PENDING"; amount: string | null; referenceAmount: string } | null;
};
export type TableView = { id: string; number: string; name: string; defaultPlayType: PlayType; archivedAt: string | null; sessions: SessionView[] };
export type MenuView = { id: string; name: string; category: string; price: string; archivedAt: string | null };
export type PricingView = { id: string; hourlyRate: string; frameRate: string; createdAt: string };
