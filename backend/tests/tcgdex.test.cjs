// Corrida de cartas en español (TCGdex): juego aparte, ids propios, solo cartas con imagen, idempotente. TCGdex y R2 son simulados.
const path = require('path');
const { pathToFileURL } = require('url');
const { prisma, ok } = require('./fixtures.cjs');

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);
const card = (n, extra = {}) => ({ id: `cztest-${n}`, localId: String(n), name: `Carta ${n}`, image: `https://assets.tcgdex.net/es/cz/cztest/${n}`, ...extra });

(async () => {
  const t0 = new Date();
  const { runTcgdexSync, TCGDEX_CATEGORY } = await load('core/tcgSync/tcgdex.js');
  const remote = { cards: [card(1), card(2), card(3, { image: undefined })] };
  const uploads = new Map();
  const getJson = async (p) => (p === '/sets' ? [{ id: 'cztest', name: 'CZTEST Edición' }] : { id: 'cztest', name: 'CZTEST Edición', releaseDate: '2026-01-01', cards: remote.cards });
  const run = (extra = {}) => runTcgdexSync({ db: prisma, getJson, upload: async (key, body) => { uploads.set(key, body); }, getImages: async () => ({ large: Buffer.from('g'), thumb: Buffer.from('m') }), log: () => {}, ...extra });
  const wipe = async () => {
    await prisma.catalogCard.deleteMany({ where: { categoryId: TCGDEX_CATEGORY, attributes: { path: ['TcgdexId'], string_starts_with: 'cztest-' } } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: TCGDEX_CATEGORY, abbreviation: 'cztest' } });
    await prisma.catalogSyncRun.deleteMany({ where: { source: 'tcgdex', startedAt: { gte: t0 } } });
  };
  try {
    await wipe();
    const dry = await run({ dryRun: true });
    ok('modo prueba: cuenta y no escribe', dry.newCards === 2 && uploads.size === 0 && (await prisma.catalogSet.count({ where: { abbreviation: 'cztest' } })) === 0);
    const first = await run();
    const rows = await prisma.catalogCard.findMany({ where: { categoryId: TCGDEX_CATEGORY, groupId: { gte: 9000000 }, attributes: { path: ['TcgdexId'], string_starts_with: 'cztest-' } }, orderBy: { number: 'asc' } });
    ok('guarda solo las cartas con imagen, con ids propios y rutas de Pokemon_Espanol', first.status === 'ok' && rows.length === 2 && rows.every((r) => r.productId > 900000000 && r.groupId >= 9000000 && r.imageKey.startsWith('Carpetazo.cl/Pokemon_Espanol/Pokemon_Espanol_DB/')) && uploads.size === 6);
    ok('la imagen de origen es la de TCGdex', rows[0].sourceImageUrl === 'https://assets.tcgdex.net/es/cz/cztest/1/high.webp');
    remote.cards.push(card(4));
    uploads.clear();
    const second = await run();
    ok('segunda corrida: solo agrega la carta nueva', second.newCards === 1 && second.newSets === 0 && (await prisma.catalogCard.count({ where: { attributes: { path: ['TcgdexId'], string_starts_with: 'cztest-' } } })) === 3);
  } catch (error) {
    ok('la corrida de TCGdex no lanzó errores inesperados', false, error.stack);
  } finally {
    await wipe();
    await prisma.$disconnect();
  }
})();
