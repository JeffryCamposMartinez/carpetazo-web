-- Los productos físicos (kits, displays, colecciones…) pasan a pertenecer a un juego, para servir a cualquier TCG.
-- Los existentes se completan desde su bloque (o, si no tuviera, desde sus cartas); ninguna fila se borra.

-- 1) Columna nueva, primero opcional para poder completar los datos existentes
ALTER TABLE "TcgPhysicalProduct" ADD COLUMN "categoryId" INTEGER;

-- 2) Juego a partir del bloque; si no hay bloque, a partir de sus cartas
UPDATE "TcgPhysicalProduct" pp
SET "categoryId" = b."categoryId"
FROM "TcgBlock" b
WHERE b."id" = pp."blockId";

UPDATE "TcgPhysicalProduct" pp
SET "categoryId" = (SELECT pr."categoryId" FROM "TcgProduct" pr WHERE pr."physicalProductId" = pp."id" LIMIT 1)
WHERE pp."categoryId" IS NULL;

-- Hasta ahora solo Mitos y Leyendas (juego 99) usaba productos físicos
UPDATE "TcgPhysicalProduct" pp
SET "categoryId" = 99
WHERE pp."categoryId" IS NULL
  AND EXISTS (SELECT 1 FROM "TcgCategory" c WHERE c."categoryId" = 99);

-- 3) Bloques inexistentes se dejan sin bloque en vez de romper la clave foránea
UPDATE "TcgPhysicalProduct"
SET "blockId" = NULL
WHERE "blockId" IS NOT NULL
  AND "blockId" NOT IN (SELECT "id" FROM "TcgBlock");

ALTER TABLE "TcgPhysicalProduct" ALTER COLUMN "categoryId" SET NOT NULL;

-- 4) Índices, unicidad por juego + bloque + nombre, y claves foráneas
CREATE INDEX "TcgPhysicalProduct_categoryId_idx" ON "TcgPhysicalProduct"("categoryId");
CREATE INDEX "TcgPhysicalProduct_blockId_idx" ON "TcgPhysicalProduct"("blockId");
CREATE UNIQUE INDEX "TcgPhysicalProduct_categoryId_blockId_name_key" ON "TcgPhysicalProduct"("categoryId", "blockId", "name");

ALTER TABLE "TcgPhysicalProduct" ADD CONSTRAINT "TcgPhysicalProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TcgCategory"("categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TcgPhysicalProduct" ADD CONSTRAINT "TcgPhysicalProduct_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "TcgBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
