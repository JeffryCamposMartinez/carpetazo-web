// Cambia la dirección pública de las imágenes guardadas en la base (por ejemplo, de https://pub-xxxx.r2.dev a https://img.carpetazo.cl).
// Por defecto SOLO CUENTA lo que cambiaría; con --apply lo cambia (hacer antes un respaldo: node scripts/db/backup_db.cjs).
// Uso:  node scripts/db/rewrite_image_host.cjs <direccion_vieja> <direccion_nueva> [--apply]
// Revisa todas las columnas de texto y JSON de la base; los archivos en R2 no se tocan (solo las direcciones).
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try { require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true }); } catch (_) { /* dotenv es opcional */ }

const [oldBase, newBase] = process.argv.slice(2, 4).map((value) => String(value || '').replace(/\/+$/, ''));
const apply = process.argv.includes('--apply');
if (!/^https:\/\/[^\s/]+$/.test(oldBase || '') || !/^https:\/\/[^\s/]+$/.test(newBase || '') || oldBase === newBase) {
  console.error('Uso: node scripts/db/rewrite_image_host.cjs https://vieja.example https://nueva.example [--apply]');
  process.exit(2);
}

const prisma = new PrismaClient();
const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;

(async () => {
  const columns = await prisma.$queryRawUnsafe(`SELECT table_name AS t, column_name AS c, data_type AS d FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'jsonb', 'json') AND table_name NOT LIKE '\_prisma%' ORDER BY 1, 2`);
  let total = 0;
  for (const { t, c, d } of columns) {
    const like = `${oldBase}%`;
    const contains = `%${oldBase}%`;
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${quote(t)} WHERE ${quote(c)}::text LIKE $1`, contains);
    if (!n) continue;
    total += n;
    console.log(`${apply ? 'cambia' : 'cambiaría'} ${String(n).padStart(7)}  ${t}.${c} (${d})`);
    if (apply) {
      const expression = d.startsWith('json') ? `replace(${quote(c)}::text, $1, $2)::${d}` : `replace(${quote(c)}, $1, $2)`;
      await prisma.$executeRawUnsafe(`UPDATE ${quote(t)} SET ${quote(c)} = ${expression} WHERE ${quote(c)}::text LIKE $3`, oldBase, newBase, contains);
    }
    void like;
  }
  console.log(`\n${apply ? 'Filas cambiadas' : 'Filas que cambiarían'}: ${total}${apply ? '' : '  (no se tocó nada; agrega --apply para aplicar)'}`);
  await prisma.$disconnect();
})().catch(async (error) => { console.error('Error:', error.message); await prisma.$disconnect(); process.exit(1); });
