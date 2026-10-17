-- Separa la identidad de las cartas de Mitos de los ids numéricos de TCGplayer.
-- El catálogo TcgProduct conserva sus ids internos; solo se namespacean las
-- referencias que usa la aplicación para publicar y comparar cartas.

UPDATE "Card" c
SET "tcgId" = 'myl:' || c."tcgId"
FROM "Folder" f
WHERE c."folderId" = f."id"
  AND f."tcg" = 'Mitos y Leyendas'
  AND c."tcgId" ~ '^[0-9]+$';

UPDATE "CardPriceSnapshot"
SET "tcgId" = 'myl:' || "tcgId"
WHERE "tcg" = 'Mitos y Leyendas'
  AND "tcgId" ~ '^[0-9]+$';

UPDATE "WishlistItem"
SET "productId" = 'myl:' || "productId"
WHERE "categoryId" = 99
  AND "productId" ~ '^[0-9]+$';

-- Los pedidos guardan una copia del tcgId en items. Se actualizan solo los
-- pedidos de carpetas Mitos y únicamente los ids numéricos.
UPDATE "Order" o
SET "items" = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(item) = 'object' AND item->>'tcgId' ~ '^[0-9]+$'
        THEN jsonb_set(item, '{tcgId}', to_jsonb('myl:' || (item->>'tcgId')))
      ELSE item
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(o."items"::jsonb) WITH ORDINALITY AS entries(item, ord)
)
FROM "Folder" f
WHERE o."folderId" = f."id"
  AND f."tcg" = 'Mitos y Leyendas'
  AND jsonb_typeof(o."items"::jsonb) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(o."items"::jsonb) AS entries(item)
    WHERE jsonb_typeof(item) = 'object' AND item->>'tcgId' ~ '^[0-9]+$'
  );
