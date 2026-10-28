-- Verificación de identidad: la insignia de verificado depende de User.identityVerifiedAt
ALTER TABLE "User" ADD COLUMN "identityVerifiedAt" TIMESTAMP(3);

CREATE TABLE "IdentityVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rut" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "frontKey" TEXT NOT NULL,
    "backKey" TEXT NOT NULL,
    "selfieKey" TEXT NOT NULL,
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdentityVerification_userId_createdAt_idx" ON "IdentityVerification"("userId", "createdAt");
CREATE INDEX "IdentityVerification_status_createdAt_idx" ON "IdentityVerification"("status", "createdAt");
CREATE INDEX "IdentityVerification_rut_idx" ON "IdentityVerification"("rut");
-- Una sola solicitud pendiente por persona (también si envía dos a la vez)
CREATE UNIQUE INDEX "IdentityVerification_one_pending" ON "IdentityVerification"("userId") WHERE "status" = 'pending';

ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
