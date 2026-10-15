// Carga del catálogo de TCGplayer desde cartas_incrementales_tcg_*.json: permisos, validación, vista previa, carga y correcciones.
const { prisma, call, ok } = require('./fixtures.cjs');

const PATH = '/admin/tcg-catalog-import';
const FILE = 'cartas_incrementales_tcg_prueba_001.json';
const GAME_ID = 98001;
const GAME = 'CZTEST_TCG';
const SET_ID = 98000101;
const IDS = [98000111, 98000112, 98000113, 98000114];
const key = (tree, edition, item, file) => `Carpetazo.cl/${GAME}/${GAME}_DB/${GAME}_${tree}/${edition}/${item}/${file}`;

const card = (n, extra = {}) => {
  const folder = extra.folder ?? `Carta ${n} (00${n})`;
  return {
    productId: IDS[n], categoryId: GAME_ID, groupId: SET_ID, kind: 'card', name: `CZTEST Carta ${n}`, number: `00${n}/100`, rarity: 'Rare', folder,
    imageKey: key('Images', 'Edicion Uno', folder, `${folder}.webp`), thumbKey: key('Thumbs', 'Edicion Uno', folder, `${folder}.webp`), dataKey: key('Data', 'Edicion Uno', folder, 'data.json'),
    sourceImageUrl: `https://tcgplayer-cdn.tcgplayer.com/product/${IDS[n]}_200w.jpg`, tcgplayerUrl: `https://www.tcgplayer.com/product/${IDS[n]}/carta`, modifiedOn: '2026-10-01T10:00:00',
    attributes: { Rarity: 'Rare', Number: `00${n}/100`, Description: 'Hace daño.\n"Cita" <b>con etiqueta</b>' }, ...extra,
  };
};
const file = (cards, extra = {}) => ({
  format: 'carpetazo-tcg-catalog-incremental', version: 1, generatedAt: '2026-10-15T12:00:00Z',
  games: [{ categoryId: GAME_ID, name: 'CZTEST TCG', folder: GAME }],
  sets: [{ groupId: SET_ID, categoryId: GAME_ID, name: 'CZTEST Edición Uno', folder: 'Edicion Uno', abbreviation: 'CZ1', publishedOn: '2026-01-01T00:00:00', modifiedOn: '2026-09-01T00:00:00' }],
  cards, ...extra,
});

(async () => {
  try {
    const good = file([card(0), card(1), { ...card(2), kind: 'product', number: null, rarity: null, name: 'CZTEST Caja', folder: 'Caja', imageKey: null, thumbKey: null, dataKey: key('Productos_Data', 'Edicion Uno', 'Caja', 'data.json') }]);

    // Permisos y forma de la petición
    ok('sin sesión → 401', (await call('POST', PATH + '/preview', null, { fileName: FILE, data: good })).status === 401);
    ok('cuenta normal → 403', (await call('POST', PATH + '/preview', 'seller', { fileName: FILE, data: good })).status === 403);
    ok('nombre de archivo distinto → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: 'cartas_incrementales.json', data: good })).status === 400);
    ok('contenido que no es objeto → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: [1] })).status === 400);
    ok('formato desconocido → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: { format: 'x', version: 1 } })).status === 400);
    ok('archivo sin cartas → 400', (await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([]) })).status === 400);
    ok('apply sin sesión → 401', (await call('POST', PATH + '/apply', null, { fileName: FILE, data: good, digest: 'a'.repeat(64) })).status === 401);

    // Vista previa: no escribe nada
    let r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: good });
    ok('vista previa válida → 3 nuevas, 1 juego y 1 edición nuevos', r.status === 200 && r.j.counts.new === 3 && r.j.counts.newGames === 1 && r.j.counts.newSets === 1 && r.j.errors.length === 0 && r.j.canApply === true, JSON.stringify(r.j?.counts) + JSON.stringify(r.j?.errors));
    ok('vista previa: sin correo ni datos internos', !JSON.stringify(r.j).match(/firebaseUid|email/i));
    ok('vista previa: la imagen sale con la dirección pública de R2', r.j.cards.some((item) => /^https:\/\/pub-cztest\.r2\.dev\/Carpetazo\.cl\/CZTEST_TCG\//.test(item.imageUrl || '')), JSON.stringify(r.j?.cards?.[0]));
    const digest = r.j.digest;
    ok('la vista previa no creó nada', (await prisma.catalogCard.count({ where: { productId: { in: IDS } } })) === 0 && !(await prisma.catalogGame.findUnique({ where: { categoryId: GAME_ID } })));

    // El apóstrofe y los paréntesis del nombre no rompen la dirección (se usa dentro de CSS)
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: file([card(0, { folder: "Kak'Na (001)" })]) });
    const url = r.j?.cards?.[0]?.imageUrl || '';
    ok('direcciones con apóstrofe y paréntesis quedan codificadas', r.status === 200 && url.includes('Kak%27Na%20%28001%29') && !/['()"\\<> ]/.test(url), url);

    // Errores que impiden cargar
    const bad = async (label, data, pattern) => {
      const res = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data });
      ok(label, res.status === 200 && res.j.errors.length >= 1 && res.j.canApply === false && (!pattern || pattern.test(JSON.stringify(res.j.errors))), JSON.stringify(res.j?.errors) || String(res.status));
    };
    await bad('Mitos y Leyendas (juego 99) no se carga por aquí', file([card(0)], { games: [{ categoryId: 99, name: 'MyL', folder: 'MyL' }] }));
    await bad('edición que no viene en el archivo → error', file([{ ...card(0), groupId: 123 }]));
    await bad('ruta de R2 con ".." → error', file([{ ...card(0), imageKey: `Carpetazo.cl/${GAME}/../otro/x.webp` }]), /imageKey/);
    await bad('ruta de R2 de otro juego → error', file([{ ...card(0), imageKey: 'Carpetazo.cl/OTRO/OTRO_DB/OTRO_Images/e/c/c.webp' }]), /imageKey/);
    await bad('ruta de R2 fuera de Carpetazo.cl → error', file([{ ...card(0), thumbKey: `Otra/${GAME}/a/b/c.webp` }]), /thumbKey/);
    await bad('imagen de origen en otro dominio → error', file([{ ...card(0), sourceImageUrl: 'https://evil.example.com/a.jpg' }]), /direcci/i);
    await bad('dirección http de TCGplayer → error', file([{ ...card(0), tcgplayerUrl: 'http://www.tcgplayer.com/x' }]), /direcci/i);
    await bad('tipo desconocido → error', file([{ ...card(0), kind: 'otra-cosa' }]), /tipo/i);
    await bad('id repetido en el archivo → error', file([card(0), card(0)]), /repetido/);
    await bad('id que no es entero → error', file([{ ...card(0), productId: '12abc' }]));
    await bad('datos con demasiadas claves → error', file([{ ...card(0), attributes: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`k${i}`, 'v'])) }]), /datos/i);
    await bad('nombre más largo de 200 caracteres → error', file([{ ...card(0), name: 'x'.repeat(201) }]));

    // Cargar
    ok('apply sin digest → 400', (await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good })).status === 400);
    ok('apply con digest de otra revisión → 409', (await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good, digest: 'b'.repeat(64) })).status === 409);
    ok('apply con errores en el archivo → 409', (await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: file([card(0), card(0)]), digest: digest })).status === 409);
    ok('nada se creó con los intentos fallidos', (await prisma.catalogCard.count({ where: { productId: { in: IDS } } })) === 0);

    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good, digest });
    ok('apply válido → 3 creadas, 1 juego y 1 edición', r.status === 200 && r.j.created === 3 && r.j.updated === 0 && r.j.newGames === 1 && r.j.newSets === 1, JSON.stringify(r.j));
    const stored = await prisma.catalogCard.findUnique({ where: { productId: IDS[0] } });
    ok('la carta quedó con sus datos limpios y su ruta de R2', stored.categoryId === GAME_ID && stored.groupId === SET_ID && stored.cleanName === 'cztest carta 0' && stored.imageKey === good.cards[0].imageKey && stored.attributes.Description.includes('Hace daño.') && stored.kind === 'card', JSON.stringify(stored));
    const box = await prisma.catalogCard.findUnique({ where: { productId: IDS[2] } });
    ok('el producto quedó como producto y sin imagen', box.kind === 'product' && box.imageKey === null && box.dataKey.includes('Productos_Data'));
    ok('quedó el juego y la edición', (await prisma.catalogGame.findUnique({ where: { categoryId: GAME_ID } }))?.folder === GAME && (await prisma.catalogSet.findUnique({ where: { groupId: SET_ID } }))?.abbreviation === 'CZ1');
    ok('quedó registro en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'tcgcatalog.import', targetId: digest.slice(0, 16) } })) === 1);

    // Repetir la carga no duplica nada
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: good });
    ok('después de cargar, todo figura como existente y no hay nada que cargar', r.j.counts.exists === 3 && r.j.counts.new === 0 && r.j.canApply === false, JSON.stringify(r.j?.counts));
    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: good, digest: r.j.digest });
    ok('cargar otra vez no crea nada', r.status === 200 && r.j.created === 0 && r.j.existing === 3);
    ok('sigue habiendo 3 cartas', (await prisma.catalogCard.count({ where: { productId: { in: IDS } } })) === 3);

    // Correcciones de lo que ya existe
    const fixed = file([{ ...card(0), name: 'CZTEST Carta Cero Corregida', rarity: 'Mythic' }, card(1), good.cards[2]]);
    r = await call('POST', PATH + '/preview', 'admin', { fileName: FILE, data: fixed });
    ok('nombre y rareza corregidos → se marca 1 corrección con el nombre anterior', r.status === 200 && r.j.counts.updated === 1 && r.j.counts.exists === 2 && r.j.cards[0].previousName === 'CZTEST Carta 0' && r.j.canApply === true, JSON.stringify(r.j?.counts) + JSON.stringify(r.j?.cards?.[0]));
    r = await call('POST', PATH + '/apply', 'admin', { fileName: FILE, data: fixed, digest: r.j.digest });
    const updated = await prisma.catalogCard.findUnique({ where: { productId: IDS[0] } });
    ok('apply de la corrección actualiza la carta', r.status === 200 && r.j.updated === 1 && r.j.created === 0 && updated.name === 'CZTEST Carta Cero Corregida' && updated.rarity === 'Mythic' && updated.cleanName === 'cztest carta cero corregida', JSON.stringify(r.j));

    // Otra edición con el mismo id de carta en otro juego: no se mezcla
    await prisma.catalogGame.create({ data: { categoryId: GAME_ID + 1, name: 'CZTEST TCG 2', folder: 'CZTEST_TCG2' } });
    await bad('el id de una carta de otro juego no se mezcla', { ...file([card(0)]), games: [{ categoryId: GAME_ID + 1, name: 'CZTEST TCG 2', folder: 'CZTEST_TCG2' }], sets: [{ groupId: 98000102, categoryId: GAME_ID + 1, name: 'Otra', folder: 'Otra' }], cards: [{ ...card(0), categoryId: GAME_ID + 1, groupId: 98000102, imageKey: null, thumbKey: null, dataKey: null }] }, /otro juego/);
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.message);
  } finally {
    await prisma.catalogCard.deleteMany({ where: { productId: { in: IDS } } }).catch(() => {});
    await prisma.catalogSet.deleteMany({ where: { groupId: { in: [SET_ID, 98000102] } } }).catch(() => {});
    await prisma.catalogGame.deleteMany({ where: { categoryId: { in: [GAME_ID, GAME_ID + 1] } } }).catch(() => {});
    await prisma.moderationAudit.deleteMany({ where: { action: 'tcgcatalog.import', note: { startsWith: 'Catálogo TCG: ' }, meta: { path: ['games'], array_contains: ['CZTEST TCG'] } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
