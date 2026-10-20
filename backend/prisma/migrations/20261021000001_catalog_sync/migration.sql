-- Sincronización nocturna del catálogo de TCGplayer: historial/candado de corridas y correcciones por revisar
CREATE TABLE "CatalogSyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB,

    CONSTRAINT "CatalogSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogChange" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogChange_productId_digest_key" ON "CatalogChange"("productId", "digest");
CREATE INDEX "CatalogChange_status_createdAt_idx" ON "CatalogChange"("status", "createdAt");
