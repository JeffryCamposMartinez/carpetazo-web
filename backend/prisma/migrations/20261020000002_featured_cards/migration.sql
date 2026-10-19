-- Cartas destacadas en el perfil público (máximo según el plan)
ALTER TABLE "Card" ADD COLUMN "featuredAt" TIMESTAMP(3);
CREATE INDEX "Card_featuredAt_idx" ON "Card"("featuredAt");
