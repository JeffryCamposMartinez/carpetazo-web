-- Caja y stock de las tiendas: medio de pago de cada venta en persona y umbrales de alertas de stock
ALTER TABLE "InPersonSale" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoreProfile" ADD COLUMN "lowStockAt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StoreProfile" ADD COLUMN "staleDays" INTEGER NOT NULL DEFAULT 60;
