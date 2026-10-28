-- Galería de una carta: fotos extra de esa copia (hasta 5)
CREATE TABLE "CardPhoto" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CardPhoto_cardId_position_idx" ON "CardPhoto"("cardId", "position");

ALTER TABLE "CardPhoto" ADD CONSTRAINT "CardPhoto_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
