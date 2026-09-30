# Base de datos (PostgreSQL + Prisma)

El esquema se versiona con **migraciones** (`prisma/migrations`). El deploy ejecuta `prisma migrate deploy`,
que solo aplica migraciones pendientes y **nunca borra datos por su cuenta** (antes se usaba `db push --accept-data-loss`).

## Cambiar el esquema

1. Edita `schema.prisma`.
2. Genera el SQL de la diferencia contra la base actual y revísalo:

   ```bash
   mkdir prisma/migrations/<AAAAMMDDHHMMSS>_<nombre>
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<AAAAMMDDHHMMSS>_<nombre>/migration.sql
   ```

   Si el SQL trae `DROP` o `ALTER ... TYPE`, no lo apliques sin un respaldo y un plan de datos.
3. Antes de aplicar: `npm run db:backup` (o un `pg_dump` en el servidor).
4. Aplica: `npx prisma migrate deploy`. Estado: `npm run db:status`.

Prefiere cambios **aditivos** (columna nueva, índice, tabla) y migra los datos en un paso aparte.

## Historial

- `20260929000000_baseline`: estado inicial (ya existía en producción; marcada como aplicada).
- `20260929010000_add_indexes`: índices en claves foráneas y consultas frecuentes (cartas por carpeta, carpetas públicas,
  mensajes, pedidos y catálogo TCG). Solo `CREATE INDEX`, no modifica datos.

## Modelo de cartas (sirve para cualquier TCG)

Juego (`TcgCategory`) → bloque (`TcgBlock`, opcional) → edición/set (`TcgGroup`) → carta (`TcgProduct`).
Los productos físicos (`TcgPhysicalProduct`: kits, displays, colecciones…) pertenecen a un juego (`categoryId`) y,
si el juego los usa, a un bloque. Una carta puede venir en varios productos: el enlace vive en
`TcgProductPhysicalProduct` (una carta, muchos productos). `TcgProduct.physicalProductId` queda como producto principal.

Importar un bloque desde carpetas con `data.json` (el nombre de cada subcarpeta es el nombre del producto):

    node import_tcg_block.cjs --game myl --block "Primer Bloque" --dir "<...>/Primer_Bloque_DB"           # simula
    node import_tcg_block.cjs --game myl --block "Primer Bloque" --dir "<...>/Primer_Bloque_DB" --apply   # escribe

Otro juego: agregar un adaptador en `ADAPTERS` de `import_tcg_block.cjs`.
