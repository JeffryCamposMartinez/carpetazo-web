-- Fidelización de tiendas: seguidores, cupones (con usos) y descuento guardado en el pedido
CREATE TABLE "StoreFollow" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreFollow_storeId_userId_key" ON "StoreFollow"("storeId", "userId");
CREATE INDEX "StoreFollow_userId_idx" ON "StoreFollow"("userId");
ALTER TABLE "StoreFollow" ADD CONSTRAINT "StoreFollow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreFollow" ADD CONSTRAINT "StoreFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreCoupon" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'percent',
    "value" INTEGER NOT NULL,
    "minTotal" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "maxPerUser" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreCoupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreCoupon_storeId_code_key" ON "StoreCoupon"("storeId", "code");
ALTER TABLE "StoreCoupon" ADD CONSTRAINT "StoreCoupon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreCouponUse" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreCouponUse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreCouponUse_orderId_key" ON "StoreCouponUse"("orderId");
CREATE INDEX "StoreCouponUse_couponId_userId_idx" ON "StoreCouponUse"("couponId", "userId");
ALTER TABLE "StoreCouponUse" ADD CONSTRAINT "StoreCouponUse_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "StoreCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "discountClp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StoreProfile" ADD COLUMN "lastAnnouncedAt" TIMESTAMP(3);
