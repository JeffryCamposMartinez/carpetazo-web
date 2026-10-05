-- Evidencia de aceptación de Términos y Política: anulación en vez de borrado, método de ingreso, navegador y huella del correo
ALTER TABLE "TermsAcceptance" ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "method" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "emailHash" TEXT;

CREATE INDEX "TermsAcceptance_emailHash_idx" ON "TermsAcceptance"("emailHash");
