-- Búsqueda rápida de cartas: contiene, similitud y filtro de cartas individuales.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "CatalogCard_cards_cleanName_trgm_idx"
  ON "CatalogCard" USING GIN ("cleanName" gin_trgm_ops)
  WHERE "kind" = 'card';

CREATE INDEX IF NOT EXISTS "CatalogCard_cards_name_trgm_idx"
  ON "CatalogCard" USING GIN ("name" gin_trgm_ops)
  WHERE "kind" = 'card';

CREATE INDEX IF NOT EXISTS "CatalogCard_cards_number_trgm_idx"
  ON "CatalogCard" USING GIN ("number" gin_trgm_ops)
  WHERE "kind" = 'card';

CREATE INDEX IF NOT EXISTS "CatalogCard_cards_category_cleanName_idx"
  ON "CatalogCard" ("categoryId", "cleanName", "productId")
  WHERE "kind" = 'card';
