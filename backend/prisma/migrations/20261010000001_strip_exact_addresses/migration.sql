-- Ya no se pide ni se guarda la dirección exacta: de las direcciones guardadas solo se conservan región y comuna
UPDATE "User"
SET "addresses" = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', 'ubicacion', 'name', 'Mi ubicación', 'region', a->>'region', 'comuna', a->>'comuna', 'isDefault', true)), '[]'::jsonb)
  FROM (
    SELECT a
    FROM jsonb_array_elements("User"."addresses"::jsonb) a
    WHERE coalesce(a->>'comuna', '') <> ''
    ORDER BY ((a->>'isDefault') = 'true') DESC
    LIMIT 1
  ) first_address
)
WHERE "addresses" IS NOT NULL AND jsonb_typeof("User"."addresses"::jsonb) = 'array';
