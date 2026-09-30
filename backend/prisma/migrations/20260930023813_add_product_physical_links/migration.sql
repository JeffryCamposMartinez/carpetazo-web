-- CreateTable
CREATE TABLE "TcgProductPhysicalProduct" (
    "productId" TEXT NOT NULL,
    "physicalProductId" INTEGER NOT NULL,

    CONSTRAINT "TcgProductPhysicalProduct_pkey" PRIMARY KEY ("productId","physicalProductId")
);

-- CreateIndex
CREATE INDEX "TcgProductPhysicalProduct_physicalProductId_idx" ON "TcgProductPhysicalProduct"("physicalProductId");

-- AddForeignKey
ALTER TABLE "TcgProductPhysicalProduct" ADD CONSTRAINT "TcgProductPhysicalProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "TcgProduct"("productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TcgProductPhysicalProduct" ADD CONSTRAINT "TcgProductPhysicalProduct_physicalProductId_fkey" FOREIGN KEY ("physicalProductId") REFERENCES "TcgPhysicalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
