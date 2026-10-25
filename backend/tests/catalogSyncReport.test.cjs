// Reporte de la sincronización del catálogo en Moderación: permisos, qué entró en cada corrida y que no expone nada de más.
const { prisma, U, call, ok } = require('./fixtures.cjs');

const GAME_ID = 98004;
const SET_ID = 98000401;
const IDS = { carta: 98000411, otraCarta: 98000412, producto: 98000413, completada: 98000414, antigua: 98000415 };
const ALL = Object.values(IDS);
const T = (iso) => new Date(iso);
const START = T('2031-10-01T04:00:00Z');
const END = T('2031-10-01T04:09:00Z');

(async () => {
  let role;
  const runs = [];
  try {
    await prisma.catalogGame.create({ data: { categoryId: GAME_ID, name: 'CZTEST Reporte', folder: 'CZTEST_Reporte' } });
    await prisma.catalogSet.create({ data: { groupId: SET_ID, categoryId: GAME_ID, name: 'CZTEST Edición Reporte', folder: 'Edicion Reporte' } });
    const row = (productId, name, extra = {}) => ({ productId, categoryId: GAME_ID, groupId: SET_ID, kind: 'card', name, cleanName: name.toLowerCase(), number: String(productId % 100), rarity: 'Rare', folder: `${name} (${productId % 100})`, ...extra });
    const inside = T('2031-10-01T04:03:00Z');
    await prisma.catalogCard.createMany({ data: [
      row(IDS.carta, 'CZTEST Carta Nueva', { createdAt: inside, updatedAt: inside, imageKey: `Carpetazo.cl/CZTEST_Reporte/CZTEST_Reporte_DB/CZTEST_Reporte_Images/Edicion Reporte/a/a.webp`, thumbKey: `Carpetazo.cl/CZTEST_Reporte/CZTEST_Reporte_DB/CZTEST_Reporte_Thumbs/Edicion Reporte/a/a.webp` }),
      row(IDS.otraCarta, 'CZTEST Carta Sin Imagen', { createdAt: inside, updatedAt: inside }),
      row(IDS.producto, 'CZTEST Caja Nueva', { kind: 'product', createdAt: inside, updatedAt: inside }),
      row(IDS.completada, 'CZTEST Imagen Completada', { createdAt: T('2026-09-01T00:00:00Z'), updatedAt: inside, imageKey: 'Carpetazo.cl/CZTEST_Reporte/x/x.webp', thumbKey: 'Carpetazo.cl/CZTEST_Reporte/x/xt.webp' }),
      row(IDS.antigua, 'CZTEST Carta Antigua', { createdAt: T('2026-09-01T00:00:00Z'), updatedAt: T('2026-09-01T00:00:00Z') }),
    ] });
    const run = await prisma.catalogSyncRun.create({ data: { startedAt: START, finishedAt: END, status: 'ok', summary: { newCards: 2, newProducts: 1, imagesUploaded: 1, seconds: 540 } } });
    const dry = await prisma.catalogSyncRun.create({ data: { startedAt: T('2031-10-02T04:00:00Z'), finishedAt: T('2031-10-02T04:01:00Z'), status: 'ok', dryRun: true } });
    runs.push(run.id, dry.id);
    await prisma.catalogChange.create({ data: { productId: IDS.antigua, categoryId: GAME_ID, groupId: SET_ID, digest: 'cztest-digest', createdAt: inside, before: { name: 'CZTEST Carta Antigua' }, after: { name: 'CZTEST Carta Antigua v2' } } });
    role = (await prisma.user.findUnique({ where: { firebaseUid: U.jeffry } })).role;

    const base = '/admin/catalog-sync';
    ok('sin sesión → 401', (await call('GET', base, null)).status === 401);
    ok('cuenta normal → 403', (await call('GET', base, 'seller')).status === 403);
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'support' } });
    ok('soporte → 403', (await call('GET', base, 'jeffry')).status === 403);
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'moderator' } });

    let r = await call('GET', `${base}?run=${run.id}`, 'jeffry');
    ok('el moderador ve las corridas y las cifras de la elegida', r.status === 200 && r.j.selectedId === run.id && r.j.counts.cards === 2 && r.j.counts.products === 1 && r.j.counts.filled === 1 && r.j.counts.changes === 1, JSON.stringify(r.j.counts));
    ok('las corridas de prueba (en seco) no aparecen', !r.j.runs.some((item) => item.id === dry.id));
    ok('trae el resumen de la corrida', r.j.runs.find((item) => item.id === run.id)?.summary?.seconds === 540);
    ok('el administrador también puede verlo', (await call('GET', base, 'admin')).status === 200);

    r = await call('GET', `${base}/${run.id}/cards`, 'jeffry');
    ok('cartas nuevas: solo las creadas en la corrida, con su edición y su imagen', r.status === 200 && r.j.total === 2 && r.j.items.some((item) => item.name === 'CZTEST Carta Nueva' && item.edition === 'CZTEST Edición Reporte' && item.game === 'CZTEST Reporte' && item.imageUrl?.startsWith('https://pub-cztest.r2.dev/')) && r.j.items.some((item) => item.name === 'CZTEST Carta Sin Imagen' && item.imageUrl === null) && !r.j.items.some((item) => item.productId === IDS.antigua), JSON.stringify(r.j.items?.map((i) => i.name)));
    r = await call('GET', `${base}/${run.id}/products`, 'jeffry');
    ok('productos nuevos: solo el sellado', r.j.total === 1 && r.j.items[0].name === 'CZTEST Caja Nueva' && r.j.items[0].kind === 'product');
    r = await call('GET', `${base}/${run.id}/filled`, 'jeffry');
    ok('imágenes completadas: la carta que ya existía y recibió imagen', r.j.total === 1 && r.j.items[0].name === 'CZTEST Imagen Completada');
    r = await call('GET', `${base}/${run.id}/changes`, 'jeffry');
    ok('correcciones: el antes, el después y la carta', r.j.total === 1 && r.j.items[0].before.name === 'CZTEST Carta Antigua' && r.j.items[0].after.name === 'CZTEST Carta Antigua v2' && r.j.items[0].card?.name === 'CZTEST Carta Antigua');
    ok('no expone usuarios, correos ni rutas internas de R2', !/@test\.local|firebaseUid|"imageKey"|"thumbKey"|"dataKey"/.test(JSON.stringify((await call('GET', `${base}/${run.id}/cards`, 'jeffry')).j)));
    // --- Filtro por juego
    r = await call('GET', `${base}?run=${run.id}&game=${GAME_ID}`, 'jeffry');
    ok('el filtro por juego conserva las cifras del juego y lista los juegos', r.j.counts.cards === 2 && r.j.games.some((g) => g.categoryId === GAME_ID));
    r = await call('GET', `${base}?run=${run.id}&game=1`, 'jeffry');
    ok('otro juego no ve las cartas de este', r.j.counts.cards === 0 && r.j.counts.changes === 0);
    r = await call('GET', `${base}/${run.id}/cards?game=${GAME_ID}`, 'jeffry');
    ok('la lista también se filtra por juego', r.j.total === 2);
    r = await call('GET', `${base}/${run.id}/cards?game=1`, 'jeffry');
    ok('la lista de otro juego queda vacía', r.j.total === 0);
    r = await call('GET', `${base}/${run.id}/cards?game=abc`, 'jeffry');
    ok('un juego inválido se ignora (sin filtro)', r.status === 200 && r.j.total === 2);
    ok('sección inválida → 400', (await call('GET', `${base}/${run.id}/usuarios`, 'jeffry')).status === 400);
    ok('id inválido → 400', (await call('GET', `${base}/nope/cards`, 'jeffry')).status === 400);
    ok('página fuera de rango → 400', (await call('GET', `${base}/${run.id}/cards?page=0`, 'jeffry')).status === 400 || (await call('GET', `${base}/${run.id}/cards?page=99999`, 'jeffry')).status === 400);
    ok('corrida que no existe → 404', (await call('GET', `${base}/00000000-0000-4000-8000-000000000000/cards`, 'jeffry')).status === 404);
    ok('una corrida de prueba no se puede consultar → 404', (await call('GET', `${base}/${dry.id}/cards`, 'jeffry')).status === 404);
    ok('es solo lectura: no hay rutas de escritura', (await call('POST', `${base}/${run.id}/cards`, 'jeffry', {})).status === 404);
  } catch (error) {
    ok('el reporte no lanzó errores inesperados', false, error.stack);
  } finally {
    await prisma.catalogChange.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSyncRun.deleteMany({ where: { id: { in: runs } } });
    await prisma.catalogCard.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogGame.deleteMany({ where: { categoryId: GAME_ID } });
    if (role) await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
