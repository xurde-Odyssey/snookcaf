import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type Staff } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/errors";
import { audit, digest, identityTransaction, requireUser, type Tx } from "@/lib/auth/service";
import { type Permission } from "@/lib/auth/permissions";
import { adjustmentDifference, elapsedSeconds, referenceTotal, segmentAmount } from "../pricing";
import { catalogSchema, sessionCommandSchema, startSchema } from "../validation";
import { sessionClock } from "./clock";
const person = { select: { id: true, name: true } } as const;
const detail = {
  startedBy: person, adjustmentApprovedBy: person,
  segments: { orderBy: { sequence: "asc" as const } },
  adjustments: { orderBy: { proposedAt: "asc" as const }, include: { proposedBy: person, reviewedBy: person } },
  events: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }], include: { actor: person } },
  checkout: true,
} satisfies Prisma.SnookerSessionInclude;
const sessionInclude = detail;
function fingerprint(actor: Staff, input: unknown, target = "") { return digest(JSON.stringify({ actor: actor.id, target, input })); }
async function receipt(tx: Tx, businessId: string, key: string, hash: string) {
  const previous = await tx.operationReceipt.findUnique({ where: { businessId_key: { businessId, key } } });
  if (previous && previous.fingerprint !== hash) throw new AuthError(409, "This request ID was already used for a different operation.");
  return previous;
}
async function saveReceipt(tx: Tx, businessId: string, key: string, hash: string, resultId: string) {
  await tx.operationReceipt.create({ data: { businessId, key, fingerprint: hash, resultId } });
}
async function event(tx: Tx, actor: Staff, sessionId: string, action: string, now: Date, metadata: Prisma.InputJsonObject = {}) {
  await tx.sessionPricingEvent.create({ data: { sessionId, actorId: actor.id, action, createdAt: now, metadata } });
  await audit(tx, actor.businessId, actor.id, action, sessionId, { ...metadata, occurredAt: now.toISOString() });
}
async function latestPricing(tx: Tx, businessId: string) {
  const pricing = await tx.pricingVersion.findFirst({ where: { businessId }, orderBy: { version: "desc" } });
  if (!pricing) throw new AuthError(409, "An administrator must configure hourly and frame rates first.");
  return pricing;
}
async function getSession(tx: Tx, id: string, businessId: string) {
  const session = await tx.snookerSession.findFirst({ where: { id, businessId }, include: sessionInclude });
  if (!session) throw new AuthError(404, "Session not found.");
  return session;
}
export function createSnookerService(clock: () => Date = sessionClock) {
  return {
    async catalog(token: string | undefined, kind: "tables" | "menu" | "pricing") {
      const permission: Permission = kind === "tables" ? "tables.view" : kind === "menu" ? "menu.manage" : "pricing.manage";
      const user = await requireUser(token, permission);
      if (kind === "menu") return db.menuItem.findMany({ where: { businessId: user.businessId }, orderBy: { name: "asc" } });
      if (kind === "pricing") return db.pricingVersion.findMany({ where: { businessId: user.businessId }, orderBy: { version: "desc" }, take: 50 });
      return db.snookerTable.findMany({ where: { businessId: user.businessId }, orderBy: { number: "asc" }, include: { sessions: { where: { status: { in: ["RUNNING", "PAUSED"] } }, include: sessionInclude } } });
    },
    async mutateCatalog(token: string | undefined, input: unknown) {
      const data = catalogSchema.parse(input);
      const permission: Permission = data.action.startsWith("table.") ? "tables.manage" : data.action.startsWith("menu.") ? "menu.manage" : "pricing.manage";
      await requireUser(token, permission);
      return identityTransaction(async (tx, businessId) => {
        const actor = await requireUser(token, permission, tx);
        const hash = fingerprint(actor, data);
        const previous = await receipt(tx, businessId, data.requestId, hash);
        if (previous) return { id: previous.resultId };
        const now = clock(); let result: { id: string };
        if (data.action === "pricing.set") {
          const last = await tx.pricingVersion.findFirst({ where: { businessId }, orderBy: { version: "desc" } });
          result = await tx.pricingVersion.create({ data: { businessId, version: (last?.version ?? 0) + 1, hourlyRate: data.hourlyRate, frameRate: data.frameRate, createdById: actor.id, createdAt: now } });
        } else if (data.action === "table.create") {
          result = await tx.snookerTable.create({ data: { businessId, number: data.number, name: data.name, defaultPlayType: data.defaultPlayType } });
        } else if (data.action === "table.update") {
          const table = await tx.snookerTable.findFirst({ where: { id: data.id, businessId } });
          if (!table) throw new AuthError(404, "Table not found.");
          if (await tx.snookerSession.count({ where: { tableId: table.id, status: { in: ["RUNNING", "PAUSED"] } } })) throw new AuthError(409, "Finish the active session before editing or archiving this table.");
          result = await tx.snookerTable.update({ where: { id: table.id }, data: { number: data.number, name: data.name, defaultPlayType: data.defaultPlayType, archivedAt: data.archived ? table.archivedAt ?? now : null } });
        } else if (data.action === "menu.create") {
          result = await tx.menuItem.create({ data: { businessId, name: data.name, category: data.category, price: data.price } });
        } else {
          const item = await tx.menuItem.findFirst({ where: { id: data.id, businessId } });
          if (!item) throw new AuthError(404, "Menu item not found.");
          result = await tx.menuItem.update({ where: { id: item.id }, data: { name: data.name, category: data.category, price: data.price, archivedAt: data.archived ? item.archivedAt ?? now : null } });
        }
        await audit(tx, businessId, actor.id, data.action.toUpperCase().replace(".", "_"), result.id, { ...data });
        await saveReceipt(tx, businessId, data.requestId, hash, result.id);
        return { id: result.id };
      });
    },
    async list(token: string | undefined, review = false) {
      const actor = await requireUser(token, review ? "session.adjust_final_charge" : "tables.view");
      return db.snookerSession.findMany({ where: { businessId: actor.businessId, ...(review ? { status: "PENDING_REVIEW" as const } : {}) }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 100, include: sessionInclude });
    },
    async get(token: string | undefined, id: string) {
      const actor = await requireUser(token, "tables.view");
      return getSession(db, id, actor.businessId);
    },
    async start(token: string | undefined, input: unknown) {
      await requireUser(token, "tables.operate");
      const data = startSchema.parse(input);
      return identityTransaction(async (tx, businessId) => {
        const actor = await requireUser(token, "tables.operate", tx);
        const hash = fingerprint(actor, data);
        const previous = await receipt(tx, businessId, data.requestId, hash);
        if (previous) return getSession(tx, previous.resultId, businessId);
        const table = await tx.snookerTable.findFirst({ where: { id: data.tableId, businessId, archivedAt: null } });
        if (!table) throw new AuthError(404, "Available table not found.");
        if (await tx.snookerSession.count({ where: { tableId: table.id, status: { in: ["RUNNING", "PAUSED"] } } })) throw new AuthError(409, "This table already has an active session.");
        const pricing = await latestPricing(tx, businessId); const now = clock();
        const session = await tx.snookerSession.create({ data: { businessId, tableId: table.id, tableNumber: table.number, startedById: actor.id, initialPlayType: table.defaultPlayType, currentPlayType: table.defaultPlayType, startedAt: now,
          segments: { create: { sequence: 0, pricingVersionId: pricing.id, playType: table.defaultPlayType, appliedRate: table.defaultPlayType === "HOURLY" ? pricing.hourlyRate : pricing.frameRate, startedAt: now, activeSince: table.defaultPlayType === "HOURLY" ? now : null } } } });
        await event(tx, actor, session.id, "SESSION_STARTED", now, { playType: table.defaultPlayType, tableNumber: table.number });
        await saveReceipt(tx, businessId, data.requestId, hash, session.id);
        return getSession(tx, session.id, businessId);
      });
    },
    async command(token: string | undefined, id: string, input: unknown) {
      const data = sessionCommandSchema.parse(input);
      const permission = data.action === "approve" || data.action === "reject" ? "session.adjust_final_charge" : "tables.operate";
      await requireUser(token, permission);
      return identityTransaction(async (tx, businessId) => {
        const actor = await requireUser(token, permission, tx);
        const hash = fingerprint(actor, data, id);
        const previous = await receipt(tx, businessId, data.requestId, hash);
        if (previous) return getSession(tx, previous.resultId, businessId);
        const session = await getSession(tx, id, businessId);
        if (session.revision !== data.revision) throw new AuthError(409, "Session changed. Refresh before trying again.");
        const now = clock();
        const lastTime = session.events.at(-1)?.createdAt ?? session.startedAt;
        if (now < lastTime) throw new AuthError(409, "Server clock moved backwards. Try again later.");
        const active = session.status === "RUNNING" || session.status === "PAUSED";
        const open = session.segments.find(segment => segment.endedAt === null);
        if (["pause", "resume", "switch", "finish"].includes(data.action) && (!active || !open)) throw new AuthError(409, "This session has already finished.");
        if (data.action === "pause" || data.action === "resume") {
          if (session.status !== (data.action === "pause" ? "RUNNING" : "PAUSED")) throw new AuthError(409, "Session is not in the expected state.");
          await tx.sessionPricingSegment.update({ where: { id: open!.id }, data: {
            billableSeconds: open!.billableSeconds.add(elapsedSeconds(open!.activeSince, now)),
            activeSince: data.action === "resume" && open!.playType === "HOURLY" ? now : null,
          } });
          await tx.snookerSession.update({ where: { id }, data: { status: data.action === "pause" ? "PAUSED" : "RUNNING" } });
          await event(tx, actor, id, data.action === "pause" ? "SESSION_PAUSED" : "SESSION_RESUMED", now);
        } else if (data.action === "switch" || data.action === "finish") {
          if (data.action === "switch" && data.playType === session.currentPlayType) throw new AuthError(409, "Choose a different play type.");
          if (data.action === "switch" && session.segments.length >= 100) throw new AuthError(409, "Maximum 100 pricing segments per session. Finish this session first.");
          const seconds = open!.billableSeconds.add(elapsedSeconds(open!.activeSince, now));
          const calculated = open!.playType === "HOURLY" ? segmentAmount("HOURLY", open!.appliedRate, seconds, null) : null;
          if (calculated?.greaterThan("99999999.99")) throw new AuthError(409, "Calculated segment exceeds the supported charge limit.");
          await tx.sessionPricingSegment.update({ where: { id: open!.id }, data: { endedAt: now, activeSince: null, billableSeconds: seconds, calculatedAmount: calculated } });
          await event(tx, actor, id, "PRICING_SEGMENT_CLOSED", now, { segmentId: open!.id, playType: open!.playType, billableSeconds: seconds.toString(), calculatedAmount: calculated?.toFixed(2) ?? null });
          if (data.action === "switch") {
            const pricing = await latestPricing(tx, businessId);
            await tx.sessionPricingSegment.create({ data: { sessionId: id, sequence: open!.sequence + 1, pricingVersionId: pricing.id, playType: data.playType, appliedRate: data.playType === "HOURLY" ? pricing.hourlyRate : pricing.frameRate, startedAt: now, activeSince: session.status === "RUNNING" && data.playType === "HOURLY" ? now : null } });
            await tx.snookerSession.update({ where: { id }, data: { currentPlayType: data.playType } });
            await event(tx, actor, id, "PLAY_TYPE_SWITCHED", now, { from: session.currentPlayType, to: data.playType, previousSegmentId: open!.id });
          } else {
            const framesNeeded = session.segments.filter(s => s.playType === "FRAME_WISE" && s.frameCount === null);
            if (data.frames.length !== framesNeeded.length || new Set(data.frames.map(f => f.segmentId)).size !== framesNeeded.length || data.frames.some(f => !framesNeeded.some(s => s.id === f.segmentId))) throw new AuthError(400, "Enter a completed frame count for every frame-wise segment, and no other segments.");
            for (const segment of framesNeeded) {
              const count = data.frames.find(f => f.segmentId === segment.id)!.count;
              const amount = segmentAmount("FRAME_WISE", segment.appliedRate, 0, count);
              if (amount.greaterThan("99999999.99")) throw new AuthError(409, "Calculated frame charge exceeds the supported charge limit.");
              await tx.sessionPricingSegment.update({ where: { id: segment.id }, data: { frameCount: count, calculatedAmount: amount } });
              await event(tx, actor, id, "SEGMENT_FRAMES_RECORDED", now, { segmentId: segment.id, frameCount: count, calculatedAmount: amount.toFixed(2) });
            }
            const segments = await tx.sessionPricingSegment.findMany({ where: { sessionId: id } });
            const reference = referenceTotal(segments.map(s => s.calculatedAmount!));
            if (reference.greaterThan("99999999.99")) throw new AuthError(409, "Charge exceeds the supported amount limit. Contact the owner.");
            await tx.snookerSession.update({ where: { id }, data: { endedAt: now, calculatedAmount: reference, status: data.proposal ? "PENDING_REVIEW" : "PENDING_CHECKOUT" } });
            await tx.pendingCheckout.create({ data: { businessId, billNumber: `BILL-${now.getTime().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`, sessionId: id, referenceAmount: reference, subtotal: reference, amount: data.proposal ? null : reference, status: data.proposal ? "AWAITING_APPROVAL" : "PENDING", createdAt: now } });
            await event(tx, actor, id, "SESSION_FINALIZED", now, { calculatedAmount: reference.toFixed(2), tableReleased: true });
            await event(tx, actor, id, "CHECKOUT_ENTRY_CREATED", now, { status: data.proposal ? "AWAITING_APPROVAL" : "PENDING", amount: data.proposal ? null : reference.toFixed(2) });
            if (data.proposal) {
              await tx.sessionAdjustment.create({ data: { sessionId: id, proposedById: actor.id, proposedAmount: data.proposal.amount, proposedReason: data.proposal.reason, referenceAmount: reference, proposedAt: now } });
              await event(tx, actor, id, "FINAL_CHARGE_PROPOSED", now, { reference: reference.toFixed(2), proposedAmount: data.proposal.amount, reason: data.proposal.reason });
            }
          }
        } else if (data.action === "propose") {
          if (session.status !== "PENDING_CHECKOUT" || session.approvedFinalAmount !== null) throw new AuthError(409, "Only an unadjusted pending checkout can request review.");
          await tx.sessionAdjustment.create({ data: { sessionId: id, proposedById: actor.id, proposedAmount: data.amount, proposedReason: data.reason, referenceAmount: session.calculatedAmount!, proposedAt: now } });
          await tx.snookerSession.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
          await tx.pendingCheckout.update({ where: { sessionId: id }, data: { status: "AWAITING_APPROVAL", amount: null } });
          await event(tx, actor, id, "FINAL_CHARGE_PROPOSED", now, { reference: session.calculatedAmount!.toFixed(2), proposedAmount: data.amount, reason: data.reason });
        } else {
          const adjustment = session.adjustments.find(a => a.id === data.adjustmentId && a.status === "REQUESTED");
          if (session.status !== "PENDING_REVIEW" || !adjustment) throw new AuthError(409, "This adjustment is no longer awaiting review.");
          if (data.action === "cancel" && adjustment.proposedById !== actor.id) throw new AuthError(403, "Only the requester can cancel this proposal. Administrators may reject it.");
          const approved = data.action === "approve" ? new Prisma.Decimal(data.amount) : null;
          await tx.sessionAdjustment.update({ where: { id: adjustment.id }, data: { status: data.action === "approve" ? "APPROVED" : data.action === "reject" ? "REJECTED" : "CANCELLED", reviewedById: actor.id, reviewedAt: now, reviewReason: data.reason, approvedAmount: approved } });
          await tx.snookerSession.update({ where: { id }, data: { status: "PENDING_CHECKOUT", ...(approved !== null ? { approvedFinalAmount: approved, adjustmentDifference: adjustmentDifference(session.calculatedAmount!, approved), adjustmentReason: data.reason, adjustmentApprovedById: actor.id, adjustmentApprovedAt: now } : {}) } });
          const finalSnookerAmount = approved ?? session.calculatedAmount!;
          const checkoutSubtotal = finalSnookerAmount.add(session.checkout?.cafeSubtotal ?? new Prisma.Decimal(0));
          await tx.pendingCheckout.update({ where: { sessionId: id }, data: { status: "PENDING", subtotal: checkoutSubtotal, amount: checkoutSubtotal.sub(session.checkout?.discountAmount ?? new Prisma.Decimal(0)) } });
          await event(tx, actor, id, data.action === "approve" ? "ADJUSTMENT_APPROVED" : data.action === "reject" ? "ADJUSTMENT_REJECTED" : "ADJUSTMENT_CANCELLED", now, { adjustmentId: adjustment.id, referenceAmount: session.calculatedAmount!.toFixed(2), approvedAmount: approved?.toFixed(2) ?? null, difference: approved !== null ? adjustmentDifference(session.calculatedAmount!, approved).toFixed(2) : null, reason: data.reason });
        }
        await tx.snookerSession.update({ where: { id }, data: { revision: { increment: 1 } } });
        await saveReceipt(tx, businessId, data.requestId, hash, id);
        return getSession(tx, id, businessId);
      });
    },
  };
}
export const snooker = createSnookerService();
