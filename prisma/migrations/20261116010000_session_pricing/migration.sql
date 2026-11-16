-- CreateEnum
CREATE TYPE "PlayType" AS ENUM ('HOURLY', 'FRAME_WISE');

-- CreateEnum
CREATE TYPE "PlaySessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'PENDING_REVIEW', 'PENDING_CHECKOUT');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('AWAITING_APPROVAL', 'PENDING');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SnookerTable" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPlayType" "PlayType" NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SnookerTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingVersion" (
    "version" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(12,2) NOT NULL,
    "frameRate" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnookerSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "initialPlayType" "PlayType" NOT NULL,
    "currentPlayType" "PlayType" NOT NULL,
    "status" "PlaySessionStatus" NOT NULL DEFAULT 'RUNNING',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "calculatedAmount" DECIMAL(12,2),
    "approvedFinalAmount" DECIMAL(12,2),
    "adjustmentDifference" DECIMAL(12,2),
    "adjustmentReason" TEXT,
    "adjustmentApprovedById" TEXT,
    "adjustmentApprovedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SnookerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPricingSegment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "pricingVersionId" TEXT NOT NULL,
    "playType" "PlayType" NOT NULL,
    "appliedRate" DECIMAL(12,2) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "activeSince" TIMESTAMPTZ(3),
    "billableSeconds" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "frameCount" INTEGER,
    "calculatedAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SessionPricingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAdjustment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedAmount" DECIMAL(12,2) NOT NULL,
    "proposedReason" TEXT NOT NULL,
    "referenceAmount" DECIMAL(12,2) NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "proposedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewReason" TEXT,
    "approvedAmount" DECIMAL(12,2),

    CONSTRAINT "SessionAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingCheckout" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "CheckoutStatus" NOT NULL,
    "referenceAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PendingCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPricingEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SessionPricingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationReceipt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnookerTable_businessId_number_key" ON "SnookerTable"("businessId", "number");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_archivedAt_idx" ON "MenuItem"("businessId", "archivedAt");

-- CreateIndex
CREATE INDEX "PricingVersion_businessId_createdAt_idx" ON "PricingVersion"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "SnookerSession_businessId_status_startedAt_idx" ON "SnookerSession"("businessId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPricingSegment_sessionId_sequence_key" ON "SessionPricingSegment"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "SessionAdjustment_sessionId_status_idx" ON "SessionAdjustment"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingCheckout_sessionId_key" ON "PendingCheckout"("sessionId");

-- CreateIndex
CREATE INDEX "SessionPricingEvent_sessionId_createdAt_idx" ON "SessionPricingEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationReceipt_businessId_key_key" ON "OperationReceipt"("businessId", "key");

-- AddForeignKey
ALTER TABLE "SnookerTable" ADD CONSTRAINT "SnookerTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingVersion" ADD CONSTRAINT "PricingVersion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingVersion" ADD CONSTRAINT "PricingVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnookerSession" ADD CONSTRAINT "SnookerSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnookerSession" ADD CONSTRAINT "SnookerSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "SnookerTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnookerSession" ADD CONSTRAINT "SnookerSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnookerSession" ADD CONSTRAINT "SnookerSession_adjustmentApprovedById_fkey" FOREIGN KEY ("adjustmentApprovedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPricingSegment" ADD CONSTRAINT "SessionPricingSegment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SnookerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPricingSegment" ADD CONSTRAINT "SessionPricingSegment_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAdjustment" ADD CONSTRAINT "SessionAdjustment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SnookerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAdjustment" ADD CONSTRAINT "SessionAdjustment_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAdjustment" ADD CONSTRAINT "SessionAdjustment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SnookerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPricingEvent" ADD CONSTRAINT "SessionPricingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SnookerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPricingEvent" ADD CONSTRAINT "SessionPricingEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationReceipt" ADD CONSTRAINT "OperationReceipt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "PricingVersion_businessId_version_key" ON "PricingVersion" ("businessId", "version");

-- Business invariants not representable in Prisma's schema DSL.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE UNIQUE INDEX "one_active_session_per_table" ON "SnookerSession" ("tableId") WHERE status IN ('RUNNING', 'PAUSED');
CREATE UNIQUE INDEX "one_open_segment_per_session" ON "SessionPricingSegment" ("sessionId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "one_approved_adjustment" ON "SessionAdjustment" ("sessionId") WHERE status = 'APPROVED';
CREATE UNIQUE INDEX "one_pending_adjustment" ON "SessionAdjustment" ("sessionId") WHERE status = 'REQUESTED';
ALTER TABLE "SessionPricingSegment" ADD CONSTRAINT "segments_do_not_overlap"
  EXCLUDE USING gist ("sessionId" WITH =, tstzrange("startedAt", "endedAt", '[)') WITH &&);
ALTER TABLE "SessionPricingSegment" ADD CONSTRAINT "valid_segment" CHECK (
  sequence >= 0 AND "appliedRate" >= 0 AND "billableSeconds" >= 0
  AND ("frameCount" IS NULL OR "frameCount" >= 0)
  AND ("calculatedAmount" IS NULL OR "calculatedAmount" >= 0)
  AND ("endedAt" IS NULL OR "endedAt" >= "startedAt")
  AND ("endedAt" IS NULL OR "activeSince" IS NULL)
  AND ("activeSince" IS NULL OR "activeSince" >= "startedAt")
  AND ("playType" <> 'HOURLY' OR "frameCount" IS NULL)
  AND ("playType" <> 'FRAME_WISE' OR ("activeSince" IS NULL AND "billableSeconds" = 0))
);
ALTER TABLE "PricingVersion" ADD CONSTRAINT "nonnegative_rates" CHECK ("hourlyRate" >= 0 AND "frameRate" >= 0);
ALTER TABLE "MenuItem" ADD CONSTRAINT "nonnegative_menu_price" CHECK (price >= 0);
ALTER TABLE "SnookerSession" ADD CONSTRAINT "valid_session_financials" CHECK (
  revision >= 0 AND ("endedAt" IS NULL OR "endedAt" >= "startedAt")
  AND ((status IN ('RUNNING','PAUSED') AND "endedAt" IS NULL AND "calculatedAmount" IS NULL)
    OR (status IN ('PENDING_REVIEW','PENDING_CHECKOUT') AND "endedAt" IS NOT NULL AND "calculatedAmount" IS NOT NULL AND "calculatedAmount" >= 0))
  AND (("approvedFinalAmount" IS NULL AND "adjustmentDifference" IS NULL AND "adjustmentReason" IS NULL AND "adjustmentApprovedById" IS NULL AND "adjustmentApprovedAt" IS NULL)
    OR ("approvedFinalAmount" IS NOT NULL AND "approvedFinalAmount" >= 0 AND "adjustmentDifference" IS NOT NULL
      AND "adjustmentDifference" = "approvedFinalAmount" - "calculatedAmount"
      AND "adjustmentReason" IS NOT NULL AND length(trim("adjustmentReason")) > 0
      AND "adjustmentApprovedById" IS NOT NULL AND "adjustmentApprovedAt" IS NOT NULL AND status = 'PENDING_CHECKOUT'))
);
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "valid_checkout_amount" CHECK (
  "referenceAmount" >= 0 AND ((status = 'AWAITING_APPROVAL' AND amount IS NULL) OR (status = 'PENDING' AND amount IS NOT NULL AND amount >= 0))
);
ALTER TABLE "SessionAdjustment" ADD CONSTRAINT "valid_adjustment" CHECK (
  "proposedAmount" >= 0 AND "referenceAmount" >= 0 AND length(trim("proposedReason")) > 0
  AND ((status = 'REQUESTED' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "approvedAmount" IS NULL)
    OR (status <> 'REQUESTED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewReason" IS NOT NULL AND length(trim("reviewReason")) > 0))
  AND ((status = 'APPROVED' AND "approvedAmount" IS NOT NULL AND "approvedAmount" >= 0) OR (status <> 'APPROVED' AND "approvedAmount" IS NULL))
);

CREATE FUNCTION phase3_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Pricing history is append-only'; END; $$;
CREATE TRIGGER pricing_event_immutable BEFORE UPDATE OR DELETE ON "SessionPricingEvent" FOR EACH ROW EXECUTE FUNCTION phase3_append_only();
CREATE TRIGGER pricing_version_immutable BEFORE UPDATE OR DELETE ON "PricingVersion" FOR EACH ROW EXECUTE FUNCTION phase3_append_only();
CREATE TRIGGER operation_receipt_immutable BEFORE UPDATE OR DELETE ON "OperationReceipt" FOR EACH ROW EXECUTE FUNCTION phase3_append_only();

CREATE FUNCTION phase3_segment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Pricing segments cannot be removed'; END IF;
  IF ROW(OLD."sessionId", OLD.sequence, OLD."pricingVersionId", OLD."playType", OLD."appliedRate", OLD."startedAt")
     IS DISTINCT FROM ROW(NEW."sessionId", NEW.sequence, NEW."pricingVersionId", NEW."playType", NEW."appliedRate", NEW."startedAt") THEN
    RAISE EXCEPTION 'Pricing snapshots cannot change';
  END IF;
  IF OLD."endedAt" IS NOT NULL THEN
    IF ROW(OLD."endedAt", OLD."billableSeconds", OLD."activeSince") IS DISTINCT FROM ROW(NEW."endedAt", NEW."billableSeconds", NEW."activeSince") THEN RAISE EXCEPTION 'Closed duration cannot change'; END IF;
    IF OLD."playType" = 'HOURLY' OR OLD."frameCount" IS NOT NULL THEN
      IF ROW(OLD."frameCount", OLD."calculatedAmount") IS DISTINCT FROM ROW(NEW."frameCount", NEW."calculatedAmount") THEN RAISE EXCEPTION 'Calculated history cannot change'; END IF;
    ELSE
      IF NEW."frameCount" IS NULL OR NEW."calculatedAmount" IS NULL THEN RAISE EXCEPTION 'Record frames and amount together'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER segment_snapshot_immutable BEFORE UPDATE OR DELETE ON "SessionPricingSegment" FOR EACH ROW EXECUTE FUNCTION phase3_segment_snapshot();

CREATE FUNCTION phase3_session_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD."businessId", OLD."tableId", OLD."tableNumber", OLD."startedById", OLD."initialPlayType", OLD."startedAt") IS DISTINCT FROM ROW(NEW."businessId", NEW."tableId", NEW."tableNumber", NEW."startedById", NEW."initialPlayType", NEW."startedAt") THEN RAISE EXCEPTION 'Session identity cannot change'; END IF;
  IF OLD."endedAt" IS NOT NULL AND ROW(OLD."endedAt", OLD."calculatedAmount", OLD."currentPlayType") IS DISTINCT FROM ROW(NEW."endedAt", NEW."calculatedAmount", NEW."currentPlayType") THEN RAISE EXCEPTION 'Finalized reference cannot change'; END IF;
  IF OLD."approvedFinalAmount" IS NULL AND NEW."approvedFinalAmount" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Staff" WHERE id = NEW."adjustmentApprovedById" AND "businessId" = NEW."businessId" AND active = true AND role IN ('OWNER','ADMIN')
  ) THEN RAISE EXCEPTION 'Only an active owner or administrator can approve pricing'; END IF;
  IF OLD."approvedFinalAmount" IS NOT NULL AND ROW(OLD."approvedFinalAmount", OLD."adjustmentDifference", OLD."adjustmentReason", OLD."adjustmentApprovedById", OLD."adjustmentApprovedAt") IS DISTINCT FROM ROW(NEW."approvedFinalAmount", NEW."adjustmentDifference", NEW."adjustmentReason", NEW."adjustmentApprovedById", NEW."adjustmentApprovedAt") THEN RAISE EXCEPTION 'Approved financial history cannot change'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER session_snapshot_immutable BEFORE UPDATE ON "SnookerSession" FOR EACH ROW EXECUTE FUNCTION phase3_session_snapshot();
CREATE FUNCTION phase3_adjustment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'REQUESTED' THEN RAISE EXCEPTION 'Reviewed adjustment history is immutable'; END IF;
  IF ROW(OLD."sessionId", OLD."proposedById", OLD."proposedAmount", OLD."proposedReason", OLD."referenceAmount", OLD."proposedAt") IS DISTINCT FROM ROW(NEW."sessionId", NEW."proposedById", NEW."proposedAmount", NEW."proposedReason", NEW."referenceAmount", NEW."proposedAt") THEN RAISE EXCEPTION 'Proposal history is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER adjustment_snapshot_immutable BEFORE UPDATE OR DELETE ON "SessionAdjustment" FOR EACH ROW EXECUTE FUNCTION phase3_adjustment_snapshot();

-- Deferred checks inspect the committed final state, after all atomic writes.
CREATE FUNCTION phase3_checkout_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid TEXT; s "SnookerSession"%ROWTYPE; c "PendingCheckout"%ROWTYPE; pending_count INT; open_count INT;
BEGIN
  IF TG_TABLE_NAME = 'SnookerSession' THEN sid := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN sid := OLD."sessionId";
  ELSE sid := NEW."sessionId"; END IF;
  SELECT * INTO s FROM "SnookerSession" WHERE id = sid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM "PendingCheckout" WHERE "sessionId" = sid;
  SELECT count(*) INTO pending_count FROM "SessionAdjustment" WHERE "sessionId" = sid AND status = 'REQUESTED';
  SELECT count(*) INTO open_count FROM "SessionPricingSegment" WHERE "sessionId" = sid AND "endedAt" IS NULL;
  IF s.status IN ('RUNNING','PAUSED') THEN
    IF c.id IS NOT NULL OR pending_count <> 0 OR open_count <> 1 THEN RAISE EXCEPTION 'Active session must have one open segment and no checkout'; END IF;
  ELSE
    IF c.id IS NULL OR open_count <> 0 OR EXISTS (SELECT 1 FROM "SessionPricingSegment" WHERE "sessionId" = sid AND "calculatedAmount" IS NULL) THEN RAISE EXCEPTION 'Finished session requires calculated segments and one checkout'; END IF;
    IF c."referenceAmount" IS DISTINCT FROM s."calculatedAmount" OR s."calculatedAmount" IS DISTINCT FROM (SELECT sum("calculatedAmount") FROM "SessionPricingSegment" WHERE "sessionId" = sid) THEN RAISE EXCEPTION 'Reference total mismatch'; END IF;
    IF EXISTS (SELECT 1 FROM "SessionAdjustment" WHERE "sessionId" = sid AND "referenceAmount" IS DISTINCT FROM s."calculatedAmount") THEN RAISE EXCEPTION 'Adjustment reference mismatch'; END IF;
    IF s."approvedFinalAmount" IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM "SessionAdjustment" WHERE "sessionId" = sid AND status = 'APPROVED'
        AND "approvedAmount" = s."approvedFinalAmount" AND "reviewedById" = s."adjustmentApprovedById"
        AND "reviewedAt" = s."adjustmentApprovedAt" AND "reviewReason" = s."adjustmentReason") THEN RAISE EXCEPTION 'Approval record mismatch'; END IF;
    ELSIF EXISTS (SELECT 1 FROM "SessionAdjustment" WHERE "sessionId" = sid AND status = 'APPROVED') THEN RAISE EXCEPTION 'Missing approved session amount'; END IF;
    IF s.status = 'PENDING_REVIEW' THEN
      IF c.status <> 'AWAITING_APPROVAL' OR c.amount IS NOT NULL OR pending_count <> 1 THEN RAISE EXCEPTION 'Pending review must retain its obligation'; END IF;
    ELSE
      IF c.status <> 'PENDING' OR c.amount IS DISTINCT FROM COALESCE(s."approvedFinalAmount", s."calculatedAmount") OR pending_count <> 0 THEN RAISE EXCEPTION 'Checkout amount/status mismatch'; END IF;
    END IF;
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER session_checkout_consistency AFTER INSERT OR UPDATE ON "SnookerSession" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase3_checkout_consistency();
CREATE CONSTRAINT TRIGGER checkout_session_consistency AFTER INSERT OR UPDATE OR DELETE ON "PendingCheckout" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase3_checkout_consistency();
CREATE CONSTRAINT TRIGGER segment_session_consistency AFTER INSERT OR UPDATE OR DELETE ON "SessionPricingSegment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase3_checkout_consistency();
CREATE CONSTRAINT TRIGGER adjustment_session_consistency AFTER INSERT OR UPDATE OR DELETE ON "SessionAdjustment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase3_checkout_consistency();

CREATE FUNCTION phase3_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.action IN ('SESSION_STARTED','SESSION_PAUSED','SESSION_RESUMED','PRICING_SEGMENT_CLOSED','PLAY_TYPE_SWITCHED','SEGMENT_FRAMES_RECORDED','SESSION_FINALIZED','CHECKOUT_ENTRY_CREATED','FINAL_CHARGE_PROPOSED','ADJUSTMENT_APPROVED','ADJUSTMENT_REJECTED','ADJUSTMENT_CANCELLED','TABLE_CREATE','TABLE_UPDATE','MENU_CREATE','MENU_UPDATE','PRICING_SET') THEN RAISE EXCEPTION 'Phase 3 audit records are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER phase3_audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION phase3_audit_immutable();
