CREATE TABLE "Business" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BusinessSettings" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessSettings_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE UNIQUE INDEX "BusinessSettings_businessId_version_key" ON "BusinessSettings"("businessId", "version");
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
