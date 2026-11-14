-- «Vende tu colección»: solicitudes de compra de cartas a tiendas
CREATE TABLE "StoreBuyRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "offerClp" INTEGER,
    "offerNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBuyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreBuyRequest_storeId_status_createdAt_idx" ON "StoreBuyRequest"("storeId", "status", "createdAt");
CREATE INDEX "StoreBuyRequest_userId_createdAt_idx" ON "StoreBuyRequest"("userId", "createdAt");

ALTER TABLE "StoreBuyRequest" ADD CONSTRAINT "StoreBuyRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreBuyRequest" ADD CONSTRAINT "StoreBuyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
