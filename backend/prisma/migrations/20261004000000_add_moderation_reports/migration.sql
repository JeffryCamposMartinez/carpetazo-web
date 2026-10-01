-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "moderationState" TEXT NOT NULL DEFAULT 'visible';

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "moderationState" TEXT NOT NULL DEFAULT 'visible';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "moderationState" TEXT NOT NULL DEFAULT 'visible';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "moderationHidden" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "WishlistItem" ADD COLUMN     "moderationState" TEXT NOT NULL DEFAULT 'visible';

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetOwnerId" TEXT,
    "reasonCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "comment" TEXT,
    "extra" JSONB,
    "reporterId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "decision" TEXT,
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "autoActioned" BOOLEAN NOT NULL DEFAULT false,
    "createdIpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "reportId" TEXT,
    "note" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_shortCode_key" ON "Report"("shortCode");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_targetOwnerId_createdAt_idx" ON "Report"("targetOwnerId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_severity_createdAt_idx" ON "Report"("status", "severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_reasonCode_key" ON "Report"("reporterId", "targetType", "targetId", "reasonCode");

-- CreateIndex
CREATE INDEX "ModerationAudit_createdAt_idx" ON "ModerationAudit"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationAudit_targetType_targetId_idx" ON "ModerationAudit"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAudit_reportId_idx" ON "ModerationAudit"("reportId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
