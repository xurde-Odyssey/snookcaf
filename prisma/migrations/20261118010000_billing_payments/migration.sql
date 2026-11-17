CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QR');
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

ALTER TABLE "BusinessSettings"
  ADD COLUMN "enabledPaymentMethods" JSONB NOT NULL DEFAULT '["CASH","QR"]'::jsonb,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "contactAddress" TEXT;

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer"("businessId", "phone");

ALTER TABLE "PendingCheckout"
  ADD COLUMN "billNumber" TEXT,
  ADD COLUMN "businessId" TEXT,
  ADD COLUMN "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountType" "DiscountType",
  ADD COLUMN "discountValue" DECIMAL(12,2),
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "discountApprovedById" TEXT,
  ADD COLUMN "discountApprovedAt" TIMESTAMPTZ(3),
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "creditRecordedAt" TIMESTAMPTZ(3),
  ADD COLUMN "creditReceiptNumber" TEXT,
  ADD COLUMN "creditRecordedById" TEXT;

UPDATE "PendingCheckout" SET "billNumber" = 'BILL-' || UPPER(SUBSTRING("id" FROM 1 FOR 20)), "subtotal" = "referenceAmount" + "cafeSubtotal";
UPDATE "PendingCheckout" AS checkout SET "businessId" = session."businessId"
FROM "SnookerSession" AS session WHERE session."id" = checkout."sessionId";
UPDATE "PendingCheckout" AS checkout SET "businessId" = cafe."businessId"
FROM "CafeOrder" AS cafe WHERE checkout."businessId" IS NULL AND cafe."id" = checkout."cafeOrderId";
UPDATE "PendingCheckout" SET "businessId" = (SELECT "id" FROM "Business" ORDER BY "createdAt" ASC LIMIT 1) WHERE "businessId" IS NULL;
UPDATE "PendingCheckout" AS checkout
SET "subtotal" = COALESCE(session."approvedFinalAmount", session."calculatedAmount", checkout."referenceAmount") + checkout."cafeSubtotal"
FROM "SnookerSession" AS session WHERE session.id = checkout."sessionId";
UPDATE "PendingCheckout" SET "subtotal" = "cafeSubtotal", "amount" = "cafeSubtotal"
WHERE "sessionId" IS NULL AND "cafeOrderId" IS NOT NULL AND "status" = 'PENDING';

ALTER TABLE "PendingCheckout" ALTER COLUMN "billNumber" SET NOT NULL;
ALTER TABLE "PendingCheckout" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_subtotal_nonnegative" CHECK ("subtotal" >= 0);
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_discount_valid" CHECK ("discountAmount" >= 0 AND "discountAmount" <= "subtotal");
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_exactly_one_origin" CHECK (("sessionId" IS NOT NULL) <> ("cafeOrderId" IS NOT NULL));
ALTER TABLE "PendingCheckout" DROP CONSTRAINT "valid_checkout_amount";
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "valid_checkout_amount" CHECK (
  "referenceAmount" >= 0 AND
  ((status = 'AWAITING_APPROVAL' AND amount IS NULL) OR
   (status IN ('PENDING','PARTIALLY_PAID','CREDIT','PAID','CANCELLED') AND amount IS NOT NULL AND amount >= 0)) AND
  (("discountType" IS NULL AND "discountValue" IS NULL AND "discountAmount" = 0 AND "discountReason" IS NULL AND "discountApprovedById" IS NULL AND "discountApprovedAt" IS NULL) OR
   ("discountType" = 'FIXED' AND "discountValue" > 0 AND "discountValue" <= "subtotal" AND "discountAmount" = "discountValue" AND "discountReason" IS NOT NULL AND length(trim("discountReason")) > 0 AND "discountApprovedById" IS NOT NULL AND "discountApprovedAt" IS NOT NULL) OR
   ("discountType" = 'PERCENTAGE' AND "discountValue" > 0 AND "discountValue" <= 100 AND "discountAmount" = round("subtotal" * "discountValue" / 100, 2) AND "discountReason" IS NOT NULL AND length(trim("discountReason")) > 0 AND "discountApprovedById" IS NOT NULL AND "discountApprovedAt" IS NOT NULL)) AND
  (("creditRecordedAt" IS NULL AND "creditReceiptNumber" IS NULL AND "creditRecordedById" IS NULL AND "customerId" IS NULL) OR
   ("creditRecordedAt" IS NOT NULL AND "creditReceiptNumber" IS NOT NULL AND "creditRecordedById" IS NOT NULL AND "customerId" IS NOT NULL))
);
CREATE UNIQUE INDEX "PendingCheckout_billNumber_key" ON "PendingCheckout"("billNumber");
CREATE INDEX "PendingCheckout_businessId_status_createdAt_idx" ON "PendingCheckout"("businessId", "status", "createdAt");
CREATE INDEX "PendingCheckout_customerId_status_idx" ON "PendingCheckout"("customerId", "status");
CREATE UNIQUE INDEX "PendingCheckout_businessId_creditReceiptNumber_key" ON "PendingCheckout"("businessId", "creditReceiptNumber");

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "checkoutId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "cashReceived" DECIMAL(12,2),
  "changeGiven" DECIMAL(12,2),
  "transactionReference" TEXT,
  "cashierId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_nonnegative" CHECK ("amount" > 0),
  CONSTRAINT "Payment_cash_values_valid" CHECK (
    ("method" = 'CASH' AND "cashReceived" IS NOT NULL AND "changeGiven" IS NOT NULL
      AND "cashReceived" >= "amount" AND "changeGiven" = "cashReceived" - "amount") OR
    ("method" = 'QR' AND "cashReceived" IS NULL AND "changeGiven" IS NULL)
  )
);
CREATE UNIQUE INDEX "Payment_businessId_receiptNumber_key" ON "Payment"("businessId", "receiptNumber");
CREATE INDEX "Payment_businessId_createdAt_idx" ON "Payment"("businessId", "createdAt");
CREATE INDEX "Payment_businessId_method_createdAt_idx" ON "Payment"("businessId", "method", "createdAt");
CREATE INDEX "Payment_checkoutId_createdAt_idx" ON "Payment"("checkoutId", "createdAt");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_discountApprovedById_fkey" FOREIGN KEY ("discountApprovedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_creditRecordedById_fkey" FOREIGN KEY ("creditRecordedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "PendingCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION phase3_checkout_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid TEXT; s "SnookerSession"%ROWTYPE; c "PendingCheckout"%ROWTYPE; pending_count INT; open_count INT; expected_total NUMERIC(12,2);
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
      IF NOT EXISTS (SELECT 1 FROM "SessionAdjustment" WHERE "sessionId" = sid AND status = 'APPROVED' AND "approvedAmount" = s."approvedFinalAmount" AND "reviewedById" = s."adjustmentApprovedById" AND "reviewedAt" = s."adjustmentApprovedAt" AND "reviewReason" = s."adjustmentReason") THEN RAISE EXCEPTION 'Approval record mismatch'; END IF;
    ELSIF EXISTS (SELECT 1 FROM "SessionAdjustment" WHERE "sessionId" = sid AND status = 'APPROVED') THEN RAISE EXCEPTION 'Missing approved session amount'; END IF;
    IF s.status = 'PENDING_REVIEW' THEN
      IF c.status <> 'AWAITING_APPROVAL' OR c.amount IS NOT NULL OR pending_count <> 1 THEN RAISE EXCEPTION 'Pending review must retain its obligation'; END IF;
    ELSE
      expected_total := COALESCE(s."approvedFinalAmount", s."calculatedAmount") + c."cafeSubtotal" - c."discountAmount";
      IF c.status NOT IN ('PENDING','PARTIALLY_PAID','CREDIT','PAID') OR c.amount IS DISTINCT FROM expected_total OR c."subtotal" IS DISTINCT FROM COALESCE(s."approvedFinalAmount", s."calculatedAmount") + c."cafeSubtotal" OR pending_count <> 0 THEN RAISE EXCEPTION 'Checkout amount/status mismatch'; END IF;
    END IF;
  END IF;
  RETURN NULL;
END; $$;

UPDATE "PendingCheckout" SET "amount" = CASE WHEN status = 'AWAITING_APPROVAL' THEN NULL ELSE "subtotal" - "discountAmount" END
WHERE "sessionId" IS NOT NULL;

CREATE FUNCTION phase5_payment_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid TEXT; c "PendingCheckout"%ROWTYPE; paid NUMERIC(12,2); payment_count INT;
BEGIN
  cid := CASE WHEN TG_OP = 'DELETE' THEN OLD."checkoutId" ELSE NEW."checkoutId" END;
  SELECT * INTO c FROM "PendingCheckout" WHERE id = cid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c."sessionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SnookerSession" WHERE id = c."sessionId" AND "businessId" = c."businessId") THEN RAISE EXCEPTION 'Checkout session belongs to another business'; END IF;
  IF c."cafeOrderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CafeOrder" WHERE id = c."cafeOrderId" AND "businessId" = c."businessId") THEN RAISE EXCEPTION 'Checkout order belongs to another business'; END IF;
  IF c."customerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Customer" WHERE id = c."customerId" AND "businessId" = c."businessId") THEN RAISE EXCEPTION 'Checkout customer belongs to another business'; END IF;
  IF c."discountApprovedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Staff" WHERE id = c."discountApprovedById" AND "businessId" = c."businessId" AND role IN ('OWNER','ADMIN')) THEN RAISE EXCEPTION 'Discount approver is not authorized'; END IF;
  IF c."creditRecordedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Staff" WHERE id = c."creditRecordedById" AND "businessId" = c."businessId") THEN RAISE EXCEPTION 'Credit recorder belongs to another business'; END IF;
  IF c.status IN ('PENDING','PARTIALLY_PAID','CREDIT','PAID') AND c.amount IS DISTINCT FROM c."subtotal" - c."discountAmount" THEN RAISE EXCEPTION 'Bill total does not match subtotal and discount'; END IF;
  SELECT COALESCE(sum(amount),0), count(*) INTO paid, payment_count FROM "Payment" WHERE "checkoutId" = cid;
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "checkoutId" = cid AND "businessId" <> c."businessId") THEN RAISE EXCEPTION 'Payment belongs to another business'; END IF;
  IF EXISTS (SELECT 1 FROM "Payment" AS payment JOIN "Staff" AS staff ON staff.id = payment."cashierId" WHERE payment."checkoutId" = cid AND staff."businessId" <> c."businessId") THEN RAISE EXCEPTION 'Cashier belongs to another business'; END IF;
  IF paid > COALESCE(c.amount,0) THEN RAISE EXCEPTION 'Payments exceed bill amount'; END IF;
  IF c.status = 'PENDING' AND (payment_count <> 0 OR c."creditRecordedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Pending bill cannot have payments or credit'; END IF;
  IF c.status = 'CREDIT' AND (paid <> 0 OR c."creditRecordedAt" IS NULL) THEN RAISE EXCEPTION 'Credit bill state mismatch'; END IF;
  IF c.status = 'PARTIALLY_PAID' AND (paid <= 0 OR paid >= c.amount OR c."creditRecordedAt" IS NULL) THEN RAISE EXCEPTION 'Partial payment state mismatch'; END IF;
  IF c.status = 'PAID' AND paid <> c.amount THEN RAISE EXCEPTION 'Paid bill must be fully collected'; END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER payment_checkout_consistency AFTER INSERT OR UPDATE OR DELETE ON "Payment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase5_payment_consistency();
CREATE CONSTRAINT TRIGGER checkout_payment_consistency AFTER INSERT OR UPDATE ON "PendingCheckout" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION phase5_payment_consistency();

CREATE FUNCTION phase5_payment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payment records are immutable'; END; $$;
CREATE TRIGGER phase5_payment_immutable BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION phase5_payment_immutable();

CREATE OR REPLACE FUNCTION phase3_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.action IN ('SESSION_STARTED','SESSION_PAUSED','SESSION_RESUMED','PRICING_SEGMENT_CLOSED','PLAY_TYPE_SWITCHED','SEGMENT_FRAMES_RECORDED','SESSION_FINALIZED','CHECKOUT_ENTRY_CREATED','FINAL_CHARGE_PROPOSED','ADJUSTMENT_APPROVED','ADJUSTMENT_REJECTED','ADJUSTMENT_CANCELLED','TABLE_CREATE','TABLE_UPDATE','MENU_CREATE','MENU_UPDATE','PRICING_SET','BILL_DISCOUNT_APPROVED','BILL_PAYMENT_RECORDED','BILL_SETTLED','CUSTOMER_CREATED_FOR_CREDIT','CUSTOMER_CREDIT_REPAID','CANCELLED_ORDER_CHECKOUT_VOIDED','PAYMENT_METHODS_UPDATED','BILLING_CONTACT_UPDATED') THEN RAISE EXCEPTION 'Financial and security audit records are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

-- Preserve one checkout per unique snooker session/order while allowing multiple payment rows for splits and repayments.
-- Payment rows remain append-only through application authorization and are never updated/deleted by runtime code.
