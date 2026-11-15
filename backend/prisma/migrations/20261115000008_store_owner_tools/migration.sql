-- Herramientas del dueño: resumen semanal y empleados de la tienda
ALTER TABLE "StoreProfile" ADD COLUMN "lastSummaryAt" TIMESTAMP(3);
CREATE TABLE "StoreMember" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreMember_storeId_userId_key" ON "StoreMember"("storeId", "userId");
CREATE INDEX "StoreMember_userId_status_idx" ON "StoreMember"("userId", "status");
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
