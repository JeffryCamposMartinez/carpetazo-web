-- Fotos que la comunidad propone para cartas del catálogo sin imagen (Moderación las aprueba o rechaza)
CREATE TABLE "CatalogImageProposal" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogImageProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogImageProposal_productId_userId_key" ON "CatalogImageProposal"("productId", "userId");
CREATE INDEX "CatalogImageProposal_status_createdAt_idx" ON "CatalogImageProposal"("status", "createdAt");
CREATE INDEX "CatalogImageProposal_productId_status_idx" ON "CatalogImageProposal"("productId", "status");
CREATE INDEX "CatalogImageProposal_userId_createdAt_idx" ON "CatalogImageProposal"("userId", "createdAt");
