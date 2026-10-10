-- Historial del precio de mercado de TCGplayer (en pesos) de las cartas de Pokémon a la venta
CREATE TABLE "CardMarketSnapshot" (
    "id" TEXT NOT NULL,
    "tcgId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "clp" DOUBLE PRECISION NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CardMarketSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardMarketSnapshot_tcgId_day_key" ON "CardMarketSnapshot"("tcgId", "day");

CREATE INDEX "CardMarketSnapshot_day_idx" ON "CardMarketSnapshot"("day");
