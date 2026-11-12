// Importar cartas desde un CSV: solo el dueño, filas validadas, búsqueda por id y por nombre + número, suma de cantidad y límites del plan.
const { prisma, call, ok } = require('./fixtures.cjs');

const GAME_ID = 68; // One Piece
const SET_ID = 989000001;
const IDS = { a: 989000011, b: 989000012, c: 989000013, d: 989000014 };

(async () => {
  let createdGame = false;
  let createdCategory = false;
  try {
    createdGame = !(await prisma.catalogGame.findUnique({ where: { categoryId: GAME_ID } }));
    if (createdGame) await prisma.catalogGame.create({ data: { categoryId: GAME_ID, name: 'CZTEST One Piece', folder: 'One_Piece' } });
    await prisma.catalogSet.create({ data: { groupId: SET_ID, categoryId: GAME_ID, name: 'CZTEST Edición Importar', folder: 'Edicion Importar' } });
    const card = (productId, name, number) => ({ productId, categoryId: GAME_ID, groupId: SET_ID, kind: 'card', name, cleanName: name.toLowerCase(), number, folder: 'x' });
    await prisma.catalogCard.createMany({ data: [card(IDS.a, 'CZTEST Luffy - 001/100', '001/100'), card(IDS.b, 'CZTEST Zoro - 002/100', '002/100'), card(IDS.c, 'CZTEST Nami - 003/100', '003/100'), card(IDS.d, 'CZTEST Nami - 004/100', '004/100')] });

    const mk = async (who, name, tcg = 'OnePiece') => (await call('POST', '/folders', who, { name, tcg, color: 'blue', isPublic: false })).j.folder.id;
    const fid = await mk('seller', 'TEST importar');
    const foreign = await mk('jerry', 'TEST importar ajena');
    const myl = await mk('seller', 'TEST importar MyL', 'Mitos y Leyendas');
    let r;
    const stored = () => prisma.card.findMany({ where: { folderId: fid }, orderBy: { tcgId: 'asc' } });

    // Mitos y Leyendas: catálogo propio, siempre en español y con id «myl:»
    createdCategory = !(await prisma.tcgCategory.findUnique({ where: { categoryId: 99 } }));
    if (createdCategory) await prisma.tcgCategory.create({ data: { categoryId: 99, name: 'Mitos y Leyendas', modifiedOn: new Date() } });
    await prisma.tcgGroup.create({ data: { groupId: 989000002, name: 'CZTEST Edición MyL', categoryId: 99, publishedOn: new Date(), modifiedOn: new Date() } });
    const ext = (number) => [{ name: 'Edition', value: 'CZTEST Edición MyL' }, { name: 'Number', value: number }, { name: 'Frequency', value: 'Rara' }];
    await prisma.tcgProduct.createMany({ data: [['989000021', 'CZTEST Cid', '001'], ['989000022', 'CZTEST Arturo', '002']].map(([productId, name, number]) => ({ productId, groupId: 989000002, categoryId: 99, name, cleanName: name.toLowerCase().replace(/[^a-z0-9 ]/g, ''), imageUrl: 'https://example.com/x.webp', extData: ext(number) })) });
    r = await call('POST', '/folders/' + myl + '/cards-import', 'seller', { rows: [{ line: 2, productId: 989000021, quantity: 2, language: 'English' }, { line: 3, name: 'CZTEST Arturo', number: '002', quantity: 1 }, { line: 4, name: 'CZTEST Nadie' }] });
    const mylCards = await prisma.card.findMany({ where: { folderId: myl }, orderBy: { tcgId: 'asc' } });
    ok('importar a Mitos y Leyendas: por id y por nombre, id «myl:», español y datos de la edición', r.j.created === 2 && r.j.skippedCount === 1 && mylCards.length === 2 && mylCards[0].tcgId === 'myl:989000021' && mylCards.every((c) => c.language === 'Spanish') && mylCards[1].data.set === 'CZTEST Edición MyL' && mylCards[1].data.rarity === 'Rara', JSON.stringify([r.j, mylCards]));
    const csv = await fetch(require('./fixtures.cjs').B + '/inventory/export?folderId=' + myl, { headers: { Authorization: 'Bearer test-cztest-seller', 'X-Forwarded-For': '10.9.8.7' } });
    ok('la exportación de Mitos y Leyendas trae edición, número, rareza e id', csv.status === 403 || (await csv.text()).includes('CZTEST Edición MyL,001'), String(csv.status));

    // Por id de TCGplayer y por nombre + número
    r = await call('POST', '/folders/' + fid + '/cards-import', 'seller', { rows: [
      { line: 2, productId: IDS.a, quantity: 2, condition: 5, finish: 'Foil', price: 1500 },
      { line: 3, name: 'CZTEST Zoro', number: '002/100', quantity: 1, language: 'Spanish' },
      { line: 4, name: 'CZTEST Nami', quantity: 1 },
      { line: 5, name: 'CZTEST Nadie', quantity: 1 },
      { line: 6, productId: 'abc', quantity: 1 },
    ] });
    ok('importar filas → 200', r.status === 200 && r.j.success, JSON.stringify(r.j));
    ok('...crea dos cartas', r.j.created === 2 && r.j.merged === 0, JSON.stringify(r.j));
    ok('...Nami sin número es ambigua, la inexistente no se encuentra y el id malo es inválido', r.j.skippedCount === 3
      && r.j.skipped.find((s) => s.line === 4)?.reason === 'ambiguous' && r.j.skipped.find((s) => s.line === 5)?.reason === 'notFound' && r.j.skipped.find((s) => s.line === 6)?.reason === 'invalid', JSON.stringify(r.j.skipped));
    let cards = await stored();
    ok('...guarda nombre, cantidad, estado, acabado, precio e idioma', cards.length === 2 && cards[0].name.startsWith('CZTEST Luffy') && cards[0].stock === 2 && cards[0].condition === 5 && cards[0].data.finish === 'Foil' && cards[0].price === 1500 && cards[1].language === 'Spanish', JSON.stringify(cards));

    // Repetir suma cantidad en vez de duplicar
    r = await call('POST', '/folders/' + fid + '/cards-import', 'seller', { rows: [{ line: 2, productId: IDS.a, quantity: 3, condition: 5, finish: 'Foil' }] });
    cards = await stored();
    ok('repetir la misma carta suma cantidad', r.j.created === 0 && r.j.merged === 1 && cards.length === 2 && cards[0].stock === 5, JSON.stringify(r.j));

    // Propiedad y validación
    r = await call('POST', '/folders/' + foreign + '/cards-import', 'seller', { rows: [{ productId: IDS.a, quantity: 1 }] });
    ok('carpeta ajena → 403 y no importa nada', r.status === 403 && (await prisma.card.count({ where: { folderId: foreign } })) === 0, String(r.status));
    r = await call('POST', '/folders/' + fid + '/cards-import', 'jerry', { rows: [{ productId: IDS.a, quantity: 1 }] });
    ok('otra persona importando a mi carpeta → 403', r.status === 403, String(r.status));
    r = await call('POST', '/folders/' + fid + '/cards-import', 'seller', { rows: [] });
    ok('sin filas → 400', r.status === 400, String(r.status));
    r = await call('POST', '/folders/' + fid + '/cards-import', 'seller', { rows: Array.from({ length: 301 }, () => ({ productId: IDS.a })) });
    ok('más de 300 filas → 400', r.status === 400, String(r.status));
    r = await call('POST', '/folders/' + fid + '/cards-import', 'seller', { rows: [{ productId: IDS.b, quantity: -1 }, { productId: IDS.b, quantity: 1, price: -5 }, { productId: IDS.b, quantity: 1, condition: 9 }, { productId: IDS.b, quantity: 1, language: 'Klingon' }] });
    ok('cantidad, precio, estado o idioma inválidos se omiten', r.status === 200 && r.j.created === 0 && r.j.skippedCount === 4 && r.j.skipped.every((s) => s.reason === 'invalid'), JSON.stringify(r.j));
  } finally {
    await prisma.card.deleteMany({ where: { tcgId: { in: Object.values(IDS).map(String) } } });
    await prisma.card.deleteMany({ where: { tcgId: { startsWith: 'myl:98900002' } } });
    await prisma.tcgProduct.deleteMany({ where: { groupId: 989000002 } });
    await prisma.tcgGroup.deleteMany({ where: { groupId: 989000002 } });
    if (createdCategory) await prisma.tcgCategory.deleteMany({ where: { categoryId: 99 } });
    await prisma.catalogCard.deleteMany({ where: { groupId: SET_ID } });
    await prisma.catalogSet.deleteMany({ where: { groupId: SET_ID } });
    if (createdGame) await prisma.catalogGame.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.$disconnect();
  }
})();
