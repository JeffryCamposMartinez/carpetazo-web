-- Avisos de la lista de deseos: preferencia de correo, último estado visto de cada carta deseada y dispositivos con notificaciones del navegador
ALTER TABLE "User" ADD COLUMN "notifyWishlistEmail" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "WishlistAlertState" (
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastPrice" DOUBLE PRECISION,
    "notifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistAlertState_pkey" PRIMARY KEY ("itemId")
);

CREATE INDEX "WishlistAlertState_userId_notifiedAt_idx" ON "WishlistAlertState"("userId", "notifiedAt");

ALTER TABLE "WishlistAlertState" ADD CONSTRAINT "WishlistAlertState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
