-- CreateEnum
CREATE TYPE "CafeOrderStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CheckoutStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Other';

-- AlterTable
ALTER TABLE "PendingCheckout" ADD COLUMN     "cafeOrderId" TEXT,
ADD COLUMN     "cafeSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "sessionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CafeOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "CafeOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CafeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CafeOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CafeOrder_businessId_status_createdAt_idx" ON "CafeOrder"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CafeOrder_sessionId_idx" ON "CafeOrder"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeOrder_businessId_orderNumber_key" ON "CafeOrder"("businessId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CafeOrderItem_orderId_productId_key" ON "CafeOrderItem"("orderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingCheckout_cafeOrderId_key" ON "PendingCheckout"("cafeOrderId");

-- AddForeignKey
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SnookerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOrderItem" ADD CONSTRAINT "CafeOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CafeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_cafeOrderId_fkey" FOREIGN KEY ("cafeOrderId") REFERENCES "CafeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
