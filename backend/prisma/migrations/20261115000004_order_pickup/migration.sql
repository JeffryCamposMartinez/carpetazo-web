-- Reserva con retiro en tienda: los pedidos guardan cómo se hicieron, el código de retiro, el plazo y cuándo quedaron listos
ALTER TABLE "Order" ADD COLUMN "via" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "pickupCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupBy" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "pickupReadyAt" TIMESTAMP(3);
CREATE INDEX "Order_via_status_pickupBy_idx" ON "Order"("via", "status", "pickupBy");
