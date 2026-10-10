-- Historial de precios: el precio más bajo publicado de cada carta, una vez al día
CREATE TABLE "CardPriceSnapshot" (
    "id" TEXT NOT NULL,
    "tcg" TEXT NOT NULL,
    "tcgId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "lowest" DOUBLE PRECISION NOT NULL,
    "offers" INTEGER NOT NULL,

    CONSTRAINT "CardPriceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardPriceSnapshot_tcg_tcgId_day_key" ON "CardPriceSnapshot"("tcg", "tcgId", "day");

CREATE INDEX "CardPriceSnapshot_day_idx" ON "CardPriceSnapshot"("day");
