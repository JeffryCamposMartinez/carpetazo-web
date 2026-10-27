// Corrida de cartas en español (TCGdex): juego aparte, ids propios, solo cartas con imagen, idempotente y enlazada con las inglesas. TCGdex y R2 son simulados.
const path = require('path');
const { pathToFileURL } = require('url');
const { prisma, ok } = require('./fixtures.cjs');

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);
const card = (n, extra = {}) => ({ id: `cztest-${n}`, localId: String(n), name: `Carta ${n}`, image: `https://assets.tcgdex.net/es/cz/cztest/${n}`, ...extra });

(async () => {
  const t0 = new Date();
  const { runTcgdexSync, TCGDEX_CATEGORY } = await load('core/tcgSync/tcgdex.js');
  const EN = 98003; // juego inglés de prueba
  const remote = { cards: [card(1), card(2), card(3, { image: undefined })] };
  const tcgplayerIds = { 'cztest-1': 98000311, 'cztest-2': 98000312 }; // las demás se enlazan por número
  const uploads = new Map();
  const getJson = async (p) => {
    if (p === '/sets') return [{ id: 'cztest', name: 'CZTEST Edición' }];
    if (p.startsWith('/cards/')) return { thirdParty: { tcgplayer: tcgplayerIds[decodeURIComponent(p.split('/').pop())] } };
    return { id: 'cztest', name: 'CZTEST Edición', releaseDate: '2026-01-01', cards: remote.cards };
  };
  const run = (extra = {}) => runTcgdexSync({ db: prisma, getJson, upload: async (key, body) => { uploads.set(key, body); }, getImages: async () => ({ large: Buffer.from('g'), thumb: Buffer.from('m') }), log: () => {}, ...extra });
  const spanishRows = () => prisma.catalogCard.findMany({ where: { categoryId: TCGDEX_CATEGORY, attributes: { path: ['TcgdexId'], string_starts_with: 'cztest-' } }, orderBy: { number: 'asc' } });
  const wipe = async () => {
    await prisma.catalogCard.deleteMany({ where: { categoryId: TCGDEX_CATEGORY, attributes: { path: ['TcgdexId'], string_starts_with: 'cztest-' } } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: TCGDEX_CATEGORY, abbreviation: 'cztest' } });
    await prisma.catalogSyncRun.deleteMany({ where: { source: 'tcgdex', startedAt: { gte: t0 } } });
    await prisma.catalogCard.deleteMany({ where: { categoryId: EN } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: EN } });
    await prisma.catalogGame.deleteMany({ where: { categoryId: EN } });
  };
  try {
    await wipe();
    await prisma.catalogGame.create({ data: { categoryId: EN, name: 'CZTEST EN', folder: 'CZTEST_EN' } });
    await prisma.catalogSet.create({ data: { groupId: 98000301, categoryId: EN, name: 'CZTEST EN Set', folder: 'CZTEST EN Set' } });
    const en = (n, number) => ({ productId: 98000310 + n, categoryId: EN, groupId: 98000301, kind: 'card', name: `EN ${n}`, cleanName: `en ${n}`, number, folder: `EN ${n}` });
    await prisma.catalogCard.createMany({ data: [en(1, '001/100'), en(2, '002/100'), en(3, '003/100'), en(4, '004/100')] });

    const dry = await run({ dryRun: true });
    ok('modo prueba: cuenta y no escribe', dry.newCards === 2 && uploads.size === 0 && (await prisma.catalogSet.count({ where: { abbreviation: 'cztest' } })) === 0);
    const first = await run();
    const rows = await spanishRows();
    ok('guarda solo las cartas con imagen, con ids propios y rutas de Pokemon_Espanol', first.status === 'ok' && rows.length === 2 && rows.every((r) => r.productId > 900000000 && r.groupId >= 9000000 && r.imageKey.startsWith('Carpetazo.cl/Pokemon_Espanol/Pokemon_Espanol_DB/')) && uploads.size === 6);
    ok('la imagen de origen es la de TCGdex', rows[0].sourceImageUrl === 'https://assets.tcgdex.net/es/cz/cztest/1/high.webp');
    ok('enlaza por el id de TCGplayer', rows[0].attributes.TcgplayerProductId === '98000311' && rows[0].attributes.TcgplayerGroupId === '98000301' && rows[1].attributes.TcgplayerProductId === '98000312');

    remote.cards.push(card(4), card(9));
    uploads.clear();
    const second = await run();
    const after = new Map((await spanishRows()).map((r) => [r.number, r.attributes]));
    ok('segunda corrida: solo agrega las nuevas y no repite imágenes', second.newCards === 2 && second.newSets === 0 && after.size === 4 && uploads.size === 6);
    ok('enlaza por edición + número con los votos de las ya enlazadas', after.get('4').TcgplayerProductId === '98000314' && after.get('4').TcgplayerGroupId === '98000301');
    ok('sin carta inglesa: queda marcada como solo en español', after.get('9').TcgplayerLinked === '0' && !after.get('9').TcgplayerProductId);
  } catch (error) {
    ok('la corrida de TCGdex no lanzó errores inesperados', false, error.stack);
  } finally {
    await wipe();
    await prisma.$disconnect();
  }
})();
