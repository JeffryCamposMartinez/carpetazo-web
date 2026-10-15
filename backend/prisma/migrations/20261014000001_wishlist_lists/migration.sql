-- Varias listas de deseos por persona: una activa (la del perfil) y la misma carta puede estar en listas distintas
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Wishlist_userId_createdAt_idx" ON "Wishlist"("userId", "createdAt");
-- Una sola lista activa por persona
CREATE UNIQUE INDEX "Wishlist_one_active_per_user" ON "Wishlist"("userId") WHERE "isActive";
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quien ya tenía cartas recibe una lista activa con todas ellas
INSERT INTO "Wishlist" ("id", "userId", "name", "isActive")
SELECT gen_random_uuid()::text, "userId", 'Mi lista', true FROM "WishlistItem" GROUP BY "userId";

ALTER TABLE "WishlistItem" ADD COLUMN "wishlistId" TEXT;
UPDATE "WishlistItem" i SET "wishlistId" = w."id" FROM "Wishlist" w WHERE w."userId" = i."userId";
ALTER TABLE "WishlistItem" ALTER COLUMN "wishlistId" SET NOT NULL;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "WishlistItem_userId_productId_key";
CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_key" ON "WishlistItem"("wishlistId", "productId");
