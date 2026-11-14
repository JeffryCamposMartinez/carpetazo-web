-- «Tienda verificada»: solicitudes con fotos cifradas que revisa Moderación
CREATE TABLE "StoreVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "facadeKey" TEXT NOT NULL,
    "documentKey" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreVerification_userId_createdAt_idx" ON "StoreVerification"("userId", "createdAt");
CREATE INDEX "StoreVerification_status_createdAt_idx" ON "StoreVerification"("status", "createdAt");
ALTER TABLE "StoreVerification" ADD CONSTRAINT "StoreVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreProfile" ADD COLUMN "verifiedAt" TIMESTAMP(3);
