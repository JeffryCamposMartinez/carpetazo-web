// Siembra el catálogo TCG exportado de la base local durante el build de producción.
// En desarrollo y CI (base localhost) no se ejecuta. El archivo comprimido contiene
// únicamente datos del catálogo y rutas públicas de R2; nunca variables de entorno.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { PrismaClient } = require('@prisma/client');

const BUNDLE = path.join(__dirname, '..', '..', 'data', 'tcg-catalog-bundle.json.gz');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const CHUNK_SIZE = 2000;

const chunks = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const databaseHost = () => {
  try { return new URL(process.env.DATABASE_URL || '').hostname.toLowerCase(); } catch { return ''; }
};

const toDate = (value) => (value ? new Date(value) : null);

const loadBundle = () => {
  if (!fs.existsSync(BUNDLE)) throw new Error(`No existe el paquete de catálogo: ${BUNDLE}`);
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(BUNDLE), { finishFlush: zlib.constants.Z_SYNC_FLUSH }));
  if (!raw || raw.version !== 1 || !Array.isArray(raw.games) || !Array.isArray(raw.sets) || !Array.isArray(raw.cards)) {
    throw new Error('El paquete de catálogo no tiene el formato esperado.');
  }
  return raw;
};

const normalized = (raw) => ({
  games: raw.games.map(({ categoryId, name, folder }) => ({ categoryId, name, folder })),
  sets: raw.sets.map(({ groupId, categoryId, name, folder, abbreviation, publishedOn, modifiedOn }) => ({
    groupId, categoryId, name, folder, abbreviation: abbreviation || null, publishedOn: toDate(publishedOn), modifiedOn: toDate(modifiedOn),
  })),
  cards: raw.cards.map(({ productId, categoryId, groupId, kind, name, cleanName, number, rarity, folder, imageKey, thumbKey, dataKey, sourceImageUrl, tcgplayerUrl, attributes, modifiedOn }) => ({
    productId, categoryId, groupId, kind, name, cleanName, number: number || null, rarity: rarity || null, folder,
    imageKey: imageKey || null, thumbKey: thumbKey || null, dataKey: dataKey || null,
    sourceImageUrl: sourceImageUrl || null, tcgplayerUrl: tcgplayerUrl || null, attributes: attributes || null,
    modifiedOn: toDate(modifiedOn),
  })),
});

const shouldRun = () => {
  if (process.env.SEED_TCG_CATALOG === '0') return false;
  const host = databaseHost();
  // Localhost covers development and the CI PostgreSQL service. Production Coolify
  // uses an internal service hostname or a remote host. Only CI may opt in to
  // seeding its disposable local database.
  if (LOCAL_HOSTS.has(host)) return process.env.CI === 'true' && process.env.SEED_TCG_CATALOG === '1';
  return true;
};

(async () => {
  if (!shouldRun()) {
    console.log(`Catálogo TCG: se omite en base local/CI (${databaseHost() || 'sin host'}).`);
    return;
  }

  const raw = loadBundle();
  const data = normalized(raw);
  const prisma = new PrismaClient();
  try {
    const [gamesBefore, setsBefore, cardsBefore] = await Promise.all([
      prisma.catalogGame.count(),
      prisma.catalogSet.count(),
      prisma.catalogCard.count(),
    ]);
    if (gamesBefore >= data.games.length && setsBefore >= data.sets.length && cardsBefore >= data.cards.length) {
      console.log(`Catálogo TCG: ya está cargado (${cardsBefore.toLocaleString('es-CL')} cartas); no se repite.`);
      return;
    }

    for (const game of data.games) {
      await prisma.catalogGame.upsert({ where: { categoryId: game.categoryId }, create: game, update: { name: game.name, folder: game.folder } });
    }
    for (const set of data.sets) {
      await prisma.catalogSet.upsert({ where: { groupId: set.groupId }, create: set, update: { categoryId: set.categoryId, name: set.name, folder: set.folder, abbreviation: set.abbreviation, publishedOn: set.publishedOn, modifiedOn: set.modifiedOn } });
    }
    let done = 0;
    for (const batch of chunks(data.cards, CHUNK_SIZE)) {
      await prisma.catalogCard.createMany({ data: batch, skipDuplicates: true });
      done += batch.length;
      if (done % 20000 === 0 || done === data.cards.length) console.log(`Catálogo TCG: ${done.toLocaleString('es-CL')} de ${data.cards.length.toLocaleString('es-CL')} cartas.`);
    }
    const cardsAfter = await prisma.catalogCard.count();
    if (cardsAfter < data.cards.length) throw new Error(`La verificación quedó en ${cardsAfter} cartas; se esperaban ${data.cards.length}.`);
    console.log(`Catálogo TCG cargado: ${data.games.length} juegos, ${data.sets.length} ediciones y ${cardsAfter.toLocaleString('es-CL')} cartas/productos.`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(`ERROR cargando catálogo TCG: ${error.message}`);
  process.exitCode = 1;
});
