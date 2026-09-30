// Restaura un respaldo de backup_db.cjs en la base indicada por DATABASE_URL (solo bases VACÍAS de desarrollo).
// Uso: DATABASE_URL=... node restore_db.cjs <carpeta_respaldo>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PrismaClient, Prisma } = require('@prisma/client');

const dir = process.argv[2];
if (!dir) throw new Error('Uso: node restore_db.cjs <carpeta_respaldo>');
if (/carpetazo\.cl|185\.173\.110\.158|srbo9ybophgpkdgqfr3vtfqh/.test(process.env.DATABASE_URL || '')) throw new Error('Se niega a restaurar sobre producción');

const prisma = new PrismaClient();
const ORDER = ['TcgCategory', 'TcgBlock', 'TcgPhysicalProduct', 'TcgGroup', 'TcgProduct', 'TcgProductPhysicalProduct', 'User', 'Folder', 'Card', 'Message', 'Order', 'WishlistItem'];
const models = Object.fromEntries(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

(async () => {
  for (const name of ORDER) {
    const file = path.join(dir, `${name}.json.gz`);
    if (!fs.existsSync(file)) { console.log(`${name}: sin archivo en este respaldo (se omite)`); continue; }
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
    const fields = models[name].fields.filter((f) => f.kind === 'scalar');
    const dates = fields.filter((f) => f.type === 'DateTime').map((f) => f.name);
    const bigs = fields.filter((f) => f.type === 'BigInt').map((f) => f.name);
    const jsons = fields.filter((f) => f.type === 'Json').map((f) => f.name);
    const data = rows.map((r) => {
      for (const k of dates) if (r[k] != null) r[k] = new Date(r[k]);
      for (const k of bigs) if (r[k] != null) r[k] = BigInt(r[k]);
      for (const k of jsons) if (r[k] === null) r[k] = Prisma.DbNull;
      return r;
    });
    const model = name[0].toLowerCase() + name.slice(1);
    let n = 0;
    for (let i = 0; i < data.length; i += 1000) {
      const res = await prisma[model].createMany({ data: data.slice(i, i + 1000), skipDuplicates: true });
      n += res.count;
    }
    console.log(`${name}: ${n}/${rows.length}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
