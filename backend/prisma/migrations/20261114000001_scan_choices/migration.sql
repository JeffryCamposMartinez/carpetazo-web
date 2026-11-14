-- Elecciones de la gente en «Selecciona tu carta» del escáner (solo se registran, todavía no se aprende de ellas)
CREATE TABLE "ScanChoice" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "games" TEXT NOT NULL DEFAULT '',
    "topCategoryId" INTEGER,
    "topProductId" INTEGER,
    "topScore" DOUBLE PRECISION,
    "chosenCategoryId" INTEGER,
    "chosenProductId" INTEGER,
    "chosenFinish" TEXT NOT NULL DEFAULT '',
    "rank" INTEGER,
    "quick" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanChoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScanChoice_createdAt_idx" ON "ScanChoice"("createdAt");
CREATE INDEX "ScanChoice_kind_createdAt_idx" ON "ScanChoice"("kind", "createdAt");
