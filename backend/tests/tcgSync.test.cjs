// Sincronización nocturna del catálogo de TCGplayer: solo agrega lo nuevo, mismas rutas que TcgplayerUpdate, correcciones a revisión,
// candado, tope de imágenes y reintento de lo que falló. TCGCSV y R2 son simulados; la base es la local de pruebas.
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const { prisma, ok } = require('./fixtures.cjs');

const root = path.join(__dirname, '..');
const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const GAME_ID = 98002;
const GAME_FOLDER = 'CZTEST_Sync'; // gameFolderName("CZTEST Sync")
const GROUP = 98000201;
const ids = (n) => 98000210 + n;

const product = (n, extra = {}) => ({
  productId: ids(n), name: `CZTEST Carta ${n}`, cleanName: `cztest carta ${n}`, imageUrl: `https://tcgplayer-cdn.tcgplayer.com/product/${ids(n)}_200w.jpg`,
  categoryId: GAME_ID, groupId: GROUP, url: `https://www.tcgplayer.com/product/${ids(n)}/carta`, modifiedOn: '2026-10-01T10:00:00', imageCount: 1,
  extendedData: [{ name: 'Number', displayName: 'Number', value: `00${n}/100` }, { name: 'Rarity', displayName: 'Rarity', value: 'Rare' }, { name: 'CardText', displayName: 'Text', value: 'Hace <b>daño</b>.' }],
  ...extra,
});

(async () => {
  const t0 = new Date();
  let lockId = '-';
  const { runSync } = await load('core/tcgSync/sync.js');
  const naming = await load('core/tcgSync/naming.js');
  const remote = { groupModified: '2026-10-10T10:00:00', products: [] };
  const uploads = new Map();
  const failing = new Set();
  const client = {
    categories: async () => [{ categoryId: GAME_ID, name: 'CZTEST Sync', displayName: 'CZTEST Sync' }],
    groups: async () => [{ groupId: GROUP, name: 'CZTEST Edición Uno', abbreviation: 'CZ1', publishedOn: '2026-01-01T00:00:00', modifiedOn: remote.groupModified }],
    products: async () => remote.products,
  };
  const upload = async (key, body, type) => { uploads.set(key, { size: body.length, type, body }); };
  const getImages = async (url) => {
    if ([...failing].some((id) => url.includes(String(id)))) throw new Error('HTTP 500');
    if (url.includes('SINIMAGEN')) throw Object.assign(new Error('Sin imagen en TCGplayer'), { noImage: true });
    return { large: Buffer.from('grande'), thumb: Buffer.from('mini') };
  };
  const logs = [];
  const run = (extra = {}) => { uploads.clear(); return runSync({ db: prisma, client, upload, getImages, categories: [GAME_ID], log: (line) => logs.push(line), ...extra }); };
  const cards = () => prisma.catalogCard.findMany({ where: { categoryId: GAME_ID }, orderBy: { productId: 'asc' } });
  const wipe = async () => {
    await prisma.catalogChange.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogCard.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogGame.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSyncRun.deleteMany({ where: { OR: [{ startedAt: { gte: t0 } }, { id: lockId }] } });
  };

  try {
    await wipe();

    // --- Nombres y rutas: los mismos de TcgplayerUpdate
    ok('nombre de carpeta con número: «Crustle (052-086)»', naming.itemBaseName('Crustle', '052/086') === 'Crustle (052-086)');
    ok('caracteres de Windows y largo máximo de 45', naming.itemBaseName('A:B*C?', '') === 'A_B_C_' && naming.itemBaseName('x'.repeat(80), '').length === 45);
    ok('nombres repetidos llevan el id al final', [...naming.uniqueNames([{ id: 1, base: 'Igual' }, { id: 2, base: 'IGUAL' }, { id: 3, base: 'Otro' }]).values()].join('|') === 'Igual [1]|IGUAL [2]|Otro');
    ok('Lorcana usa la carpeta Disney_Lorcana y los 6 juegos conocidos su nombre', naming.gameFolderName({ categoryId: 71, displayName: 'Disney Lorcana' }) === 'Disney_Lorcana' && naming.gameFolderName({ categoryId: 85 }) === 'Pokemon_Japan' && naming.gameFolderName({ categoryId: 2 }) === 'YuGiOh');
    const keys = naming.itemKeys('Magic', 'product', 'Edicion', 'Caja');
    ok('rutas de R2 de cartas y productos', keys.imageKey === 'Carpetazo.cl/Magic/Magic_DB/Magic_Productos_Images/Edicion/Caja/Caja.webp' && keys.dataKey.endsWith('Magic_Productos_Data/Edicion/Caja/data.json') && naming.itemKeys('Magic', 'card', 'E', 'C').thumbKey === 'Carpetazo.cl/Magic/Magic_DB/Magic_Thumbs/E/C/C.webp');

    // --- Prueba en seco: cuenta pero no escribe
    remote.products = [product(1), product(2), product(3, { name: 'CZTEST Booster Box', extendedData: [], imageCount: 1 })];
    const dry = await run({ dryRun: true });
    ok('modo prueba: cuenta lo nuevo y no escribe nada', dry.newCards === 2 && dry.newProducts === 1 && uploads.size === 0 && (await cards()).length === 0 && (await prisma.catalogGame.count({ where: { categoryId: GAME_ID } })) === 0);

    // --- Primera corrida: sube a R2 y guarda
    remote.products = [product(1), product(2), product(3, { name: 'CZTEST Booster Box', extendedData: [], imageCount: 1 }), product(4, { imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/SINIMAGEN_200w.jpg' }), product(5, { imageCount: 0 })];
    const first = await run();
    const rows = await cards();
    const byId = new Map(rows.map((row) => [row.productId, row]));
    ok('primera corrida: crea el juego, la edición y 4 cartas + 1 producto', first.status === 'ok' && rows.length === 5 && first.newCards === 4 && first.newProducts === 1 && (await prisma.catalogGame.findUnique({ where: { categoryId: GAME_ID } }))?.folder === GAME_FOLDER);
    const c1 = byId.get(ids(1));
    ok('rutas idénticas a TcgplayerUpdate (imagen, miniatura y data.json)', c1.imageKey === `Carpetazo.cl/${GAME_FOLDER}/${GAME_FOLDER}_DB/${GAME_FOLDER}_Images/CZTEST Edición Uno/CZTEST Carta 1 (001-100)/CZTEST Carta 1 (001-100).webp`
      && c1.thumbKey.includes('_Thumbs/') && c1.dataKey.endsWith('_Data/CZTEST Edición Uno/CZTEST Carta 1 (001-100)/data.json'), c1.imageKey);
    ok('esas mismas rutas se subieron a R2 con su tipo', uploads.get(c1.imageKey)?.type === 'image/webp' && uploads.get(c1.thumbKey)?.type === 'image/webp' && uploads.get(c1.dataKey)?.type === 'application/json');
    const sealed = byId.get(ids(3));
    ok('el producto sellado va al árbol de productos', sealed.kind === 'product' && sealed.imageKey.includes('_Productos_Images/') && uploads.has(sealed.imageKey));
    const data = JSON.parse(uploads.get(c1.dataKey).body.toString());
    ok('data.json trae el formato de TcgplayerUpdate (sin HTML en los atributos)', data.schema === 1 && data.source === 'tcgcsv' && data.kind === 'card' && data.productId === ids(1) && data.attributes.CardText === 'Hace daño.' && data.classification.version === 2 && data.game === GAME_FOLDER);
    ok('sin imagen en TCGplayer: se guarda sin imagen y no cuenta como fallo', byId.get(ids(4)).imageKey === null && byId.get(ids(5)).imageKey === null && uploads.has(byId.get(ids(4)).dataKey) && first.noImage === 1 && first.failed === 0);
    const set = await prisma.catalogSet.findUnique({ where: { groupId: GROUP } });
    ok('la edición queda con su fecha de modificación (ya revisada)', set.modifiedOn?.toISOString() === '2026-10-10T10:00:00.000Z' && set.folder === 'CZTEST Edición Uno');

    // --- Segunda corrida: nada cambió → se salta la edición entera
    const second = await run();
    ok('segunda corrida: edición sin cambios, no sube ni escribe nada', second.groupsSkipped === 1 && second.newCards === 0 && uploads.size === 0 && (await cards()).length === 5);

    // --- Imagen que faltaba: TCGplayer ya la tiene y la carta existe sin imagen → se completa solo la imagen
    remote.products = remote.products.map((p) => (p.productId === ids(5) ? { ...p, imageCount: 1 } : p));
    const sweep = await run({ allEditions: true });
    const filledCard = await prisma.catalogCard.findUnique({ where: { productId: ids(5) } });
    ok('revisando todas las ediciones se completa la imagen que faltaba (sin tocar el resto)', sweep.imagesFilled === 1 && sweep.newCards === 0 && filledCard.imageKey?.includes('_Images/CZTEST Edición Uno/CZTEST Carta 5 (005-100)/') && filledCard.thumbKey?.includes('_Thumbs/') && uploads.has(filledCard.imageKey) && uploads.has(filledCard.thumbKey) && !uploads.has(filledCard.dataKey), JSON.stringify(sweep));
    ok('lo que TCGplayer aún no tiene (sin imagen en el CDN) sigue sin imagen y no es un fallo', (await prisma.catalogCard.findUnique({ where: { productId: ids(4) } })).imageKey === null && sweep.failed === 0);
    ok('sin esa opción, una edición sin cambios no se vuelve a mirar', (await run()).groupsSkipped === 1);

    // --- TCGplayer corrige una carta y agrega otra: lo nuevo entra, lo existente no se toca y la diferencia va a revisión
    remote.groupModified = '2026-10-11T10:00:00';
    remote.products = [product(1, { name: 'CZTEST Carta 1 corregida', extendedData: product(1).extendedData.map((e) => (e.name === 'Rarity' ? { ...e, value: 'Mythic' } : e)) }), product(2), product(3, { name: 'CZTEST Booster Box', extendedData: [] }), product(5), product(6)];
    const third = await run();
    const after = await prisma.catalogCard.findUnique({ where: { productId: ids(1) } });
    const changes = await prisma.catalogChange.findMany({ where: { categoryId: GAME_ID } });
    ok('la carta nueva entra y la existente NO se modifica', third.newCards === 1 && (await cards()).length === 6 && after.name === 'CZTEST Carta 1' && after.rarity === 'Rare');
    ok('la corrección queda pendiente de revisión con el antes y el después', changes.length === 1 && changes[0].status === 'pending' && changes[0].productId === ids(1) && changes[0].before.name === 'CZTEST Carta 1' && changes[0].after.name === 'CZTEST Carta 1 corregida' && changes[0].after.rarity === 'Mythic' && third.changes === 1);
    remote.groupModified = '2026-10-12T10:00:00';
    await run();
    ok('la misma corrección no se vuelve a registrar', (await prisma.catalogChange.count({ where: { categoryId: GAME_ID } })) === 1);

    // --- Una imagen que falla: la carta no se guarda, la edición sigue pendiente y mañana se reintenta
    remote.groupModified = '2026-10-13T10:00:00';
    remote.products = [...remote.products, product(7), product(8)];
    failing.add(ids(7));
    const failed = await run();
    ok('imagen que falla: esa carta no se guarda y queda para mañana', failed.status === 'partial' && failed.failed === 1 && failed.pending === 1 && !(await prisma.catalogCard.findUnique({ where: { productId: ids(7) } })) && Boolean(await prisma.catalogCard.findUnique({ where: { productId: ids(8) } })));
    ok('la edición no se marca como revisada mientras falte algo', (await prisma.catalogSet.findUnique({ where: { groupId: GROUP } })).modifiedOn.toISOString() === '2026-10-12T10:00:00.000Z');
    failing.clear();
    const retry = await run();
    ok('al día siguiente se reintenta y entra', retry.newCards === 1 && Boolean(await prisma.catalogCard.findUnique({ where: { productId: ids(7) } })) && retry.failed === 0);
    ok('ahora sí queda revisada', (await prisma.catalogSet.findUnique({ where: { groupId: GROUP } })).modifiedOn.toISOString() === '2026-10-13T10:00:00.000Z');

    // --- Tope de imágenes por corrida: el resto sigue la próxima noche
    remote.groupModified = '2026-10-14T10:00:00';
    remote.products = [...remote.products, product(9), product(10), product(11)];
    const capped = await run({ imageCap: 2 });
    ok('tope de imágenes: sube hasta el tope y deja el resto para mañana', capped.imagesUploaded === 2 && capped.pending === 1 && capped.stopped === 'tope de imágenes' && (await cards()).length === 10);
    const resumed = await run();
    ok('la siguiente corrida termina lo que faltaba', resumed.newCards === 1 && (await cards()).length === 11);

    // --- Candado: no corren dos a la vez
    remote.groupModified = '2026-10-15T10:00:00';
    remote.products = [...remote.products, product(12)];
    const lock = await prisma.catalogSyncRun.create({ data: { status: 'running' } });
    lockId = lock.id;
    const blocked = await run();
    ok('con otra corrida en curso no hace nada', blocked.skipped === true && uploads.size === 0 && !(await prisma.catalogCard.findUnique({ where: { productId: ids(12) } })));
    await prisma.catalogSyncRun.update({ where: { id: lock.id }, data: { startedAt: new Date(Date.now() - 4 * 3600 * 1000) } });
    const unlocked = await run();
    ok('una corrida "en curso" de hace más de 3 horas se considera muerta', unlocked.newCards === 1, JSON.stringify(unlocked) + logs.slice(-4).join(' | '));
    ok('cada corrida deja su resumen en el historial', (await prisma.catalogSyncRun.count({ where: { startedAt: { gte: t0 }, status: 'ok' } })) >= 3);

    // --- Datos inválidos: se rechazan antes de subir nada
    remote.groupModified = '2026-10-16T10:00:00';
    remote.products = [...remote.products, product(13, { name: '' }), product(14, { url: 'https://evil.example.com/x' })];
    const bad = await run();
    ok('datos inválidos: se rechazan sin subir nada', bad.rejected === 2 && bad.newCards === 0 && ![...uploads.keys()].some((key) => key.includes(String(ids(13)))));

    // --- Una edición que ya tiene carpeta propia en la base la conserva
    await prisma.catalogSet.update({ where: { groupId: GROUP }, data: { folder: 'Carpeta Antigua', modifiedOn: null } });
    remote.products = [...remote.products, product(15)];
    await run();
    ok('una edición ya cargada conserva su carpeta aunque el nombre cambie', (await prisma.catalogCard.findUnique({ where: { productId: ids(15) } })).imageKey.includes('_Images/Carpeta Antigua/'));

    // --- Interruptor de apagado y modo prueba por línea de comandos
    const off = spawnSync(process.execPath, ['scripts/catalog/sync_tcgcsv.cjs'], { cwd: root, env: { ...process.env, TCG_SYNC_ENABLED: '0' }, encoding: 'utf8' });
    ok('TCG_SYNC_ENABLED=0 apaga la tarea sin error', off.status === 0 && /desactivada/.test(off.stdout));
  } catch (error) {
    ok('la sincronización no lanzó errores inesperados', false, error.stack);
  } finally {
    await wipe();
    await prisma.$disconnect();
  }
})();
