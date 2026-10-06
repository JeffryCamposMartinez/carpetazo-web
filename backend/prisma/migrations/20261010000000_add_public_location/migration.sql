-- Ubicación general del vendedor (región y comuna) para mostrarla en su perfil y poder filtrar por ella
ALTER TABLE "User" ADD COLUMN "publicRegion" TEXT,
ADD COLUMN "publicComuna" TEXT;

CREATE INDEX "User_publicComuna_idx" ON "User"("publicComuna");

-- Usuarios que ya guardaron direcciones: se toma la principal (o la primera); solo región y comuna, nunca calle ni número
UPDATE "User" u
SET "publicRegion" = s.region, "publicComuna" = s.comuna
FROM (
  SELECT u2."id", x.a->>'region' AS region, x.a->>'comuna' AS comuna
  FROM "User" u2
  CROSS JOIN LATERAL (
    SELECT a
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(u2."addresses"::jsonb) = 'array' THEN u2."addresses"::jsonb ELSE '[]'::jsonb END) a
    ORDER BY ((a->>'isDefault') = 'true') DESC
    LIMIT 1
  ) x
) s
WHERE u."id" = s."id" AND s.region IS NOT NULL AND s.comuna IS NOT NULL AND s.comuna <> '';
