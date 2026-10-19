-- Ventas presenciales registradas por el dueño de una carpeta (descuentan stock; no alimentan el precio de mercado)
CREATE TABLE "InPersonSale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "units" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InPersonSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InPersonSale_userId_requestId_key" ON "InPersonSale"("userId", "requestId");
CREATE INDEX "InPersonSale_userId_createdAt_idx" ON "InPersonSale"("userId", "createdAt");
CREATE INDEX "InPersonSale_folderId_createdAt_idx" ON "InPersonSale"("folderId", "createdAt");

ALTER TABLE "InPersonSale" ADD CONSTRAINT "InPersonSale_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
