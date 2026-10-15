-- Catálogo de TCGplayer (todos los juegos menos Mitos y Leyendas): juegos, ediciones y cartas/productos cargados desde TcgplayerUpdate
-- CreateTable
CREATE TABLE "CatalogGame" (
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogGame_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "CatalogSet" (
    "groupId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "abbreviation" TEXT,
    "publishedOn" TIMESTAMP(3),
    "modifiedOn" TIMESTAMP(3),

    CONSTRAINT "CatalogSet_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "CatalogCard" (
    "productId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cleanName" TEXT NOT NULL,
    "number" TEXT,
    "rarity" TEXT,
    "folder" TEXT NOT NULL,
    "imageKey" TEXT,
    "thumbKey" TEXT,
    "dataKey" TEXT,
    "sourceImageUrl" TEXT,
    "tcgplayerUrl" TEXT,
    "attributes" JSONB,
    "modifiedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCard_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "CatalogSet_categoryId_idx" ON "CatalogSet"("categoryId");

-- CreateIndex
CREATE INDEX "CatalogCard_categoryId_groupId_idx" ON "CatalogCard"("categoryId", "groupId");

-- CreateIndex
CREATE INDEX "CatalogCard_groupId_idx" ON "CatalogCard"("groupId");

-- CreateIndex
CREATE INDEX "CatalogCard_categoryId_kind_cleanName_idx" ON "CatalogCard"("categoryId", "kind", "cleanName");

-- AddForeignKey
ALTER TABLE "CatalogSet" ADD CONSTRAINT "CatalogSet_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogGame"("categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCard" ADD CONSTRAINT "CatalogCard_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogGame"("categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCard" ADD CONSTRAINT "CatalogCard_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CatalogSet"("groupId") ON DELETE CASCADE ON UPDATE CASCADE;

