-- Ficha del local de las tiendas (plan Tienda)
CREATE TABLE "StoreProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "comuna" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "hours" JSONB,
    "exceptions" JSONB,
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyGames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sellGames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyNote" TEXT NOT NULL DEFAULT '',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policy" TEXT NOT NULL DEFAULT '',
    "pickupHours" INTEGER NOT NULL DEFAULT 48,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreProfile_userId_key" ON "StoreProfile"("userId");
CREATE INDEX "StoreProfile_enabled_comuna_idx" ON "StoreProfile"("enabled", "comuna");

ALTER TABLE "StoreProfile" ADD CONSTRAINT "StoreProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
