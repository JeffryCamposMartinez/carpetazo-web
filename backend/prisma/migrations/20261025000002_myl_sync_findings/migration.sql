CREATE TABLE "MylSyncFinding" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blockName" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MylSyncFinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MylSyncFinding_kind_productId_digest_key" ON "MylSyncFinding"("kind", "productId", "digest");
CREATE INDEX "MylSyncFinding_kind_createdAt_idx" ON "MylSyncFinding"("kind", "createdAt");
