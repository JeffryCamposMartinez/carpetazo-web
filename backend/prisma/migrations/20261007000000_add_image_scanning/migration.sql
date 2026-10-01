-- AlterTable
ALTER TABLE "ImageHash" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "verdict" TEXT;

-- CreateTable
CREATE TABLE "ScanUsage" (
    "provider" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanUsage_pkey" PRIMARY KEY ("provider","month")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "ms" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanEvent_createdAt_idx" ON "ScanEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ImageHash_sha256_idx" ON "ImageHash"("sha256");
