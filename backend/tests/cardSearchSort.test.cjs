// Búsqueda pública de cartas: orden «Más vendidos» (por unidades vendidas en pedidos confirmados) y «Última edición» (por la fecha de la edición del catálogo).
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  let folder = null;
  let editionFolder = null;
  const orders = [];
  try {
    const seller = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-seller' }, select: { id: true } });
    // Tres cartas reales del catálogo de Pokémon, de tres ediciones con fechas distintas: vieja, media y nueva
    // Las ediciones con la fecha de carga masiva de TCGplayer no cuentan como «la más nueva»: se parte de ediciones con fecha real
    const bulkDays = (await prisma.$queryRaw`SELECT to_char("publishedOn", 'YYYY-MM-DD') AS day FROM "CatalogSet" WHERE "publishedOn" IS NOT NULL GROUP BY 1 HAVING count(*) >= 20`).map((row) => row.day);
    const groups = await prisma.catalogSet.findMany({ where: { categoryId: 3, publishedOn: { not: null }, cards: { some: { kind: 'card' } } }, orderBy: { publishedOn: 'asc' }, select: { groupId: true, publishedOn: true } }).then((rows) => rows.filter((group) => !bulkDays.includes(group.publishedOn.toISOString().slice(0, 10))));
    const picks = [groups[0], groups[Math.floor(groups.length / 2)], groups[groups.length - 1]];
    ok('hay ediciones con fechas distintas en el catálogo para probar', picks[0].publishedOn < picks[1].publishedOn && picks[1].publishedOn < picks[2].publishedOn, JSON.stringify(picks.map((g) => g.publishedOn)));
    const products = [];
    for (const group of picks) { const card = await prisma.catalogCard.findFirst({ where: { groupId: group.groupId, kind: 'card' }, select: { productId: true } }); products.push({ productId: String(card.productId) }); }

    folder = await prisma.folder.create({ data: { name: 'TEST orden de búsqueda', userId: seller.id, tcg: 'Pokemon', isPublic: true } });
    const names = ['ORDENTEST vieja', 'ORDENTEST media', 'ORDENTEST nueva'];
    const cards = [];
    for (let i = 0; i < 3; i += 1) cards.push(await prisma.card.create({ data: { folderId: folder.id, tcgId: products[i].productId, name: names[i], price: 1000 + i, stock: 1, data: { language: 'English', set: 'Prueba' } } }));
    // Ventas confirmadas: la «vieja» vendió 5 unidades (3 + 2), la «media» 1 y la «nueva» ninguna. Un pedido pendiente no cuenta.
    const sale = (card, quantity, status = 'completed') => prisma.order.create({ data: { sellerId: seller.id, buyerName: 'Prueba', folderId: folder.id, folderName: folder.name, items: [{ id: card.id, tcgId: card.tcgId, name: card.name, quantity, q: quantity, price: card.price }], total: card.price * quantity, status } }).then((o) => orders.push(o.id));
    await sale(cards[0], 3); await sale(cards[0], 2); await sale(cards[1], 1); await sale(cards[2], 50, 'pending');

    const names2 = (r) => (r.j.cards || []).map((c) => c.name);
    let r = await call('GET', '/cards/search?q=ORDENTEST&sort=best_selling');
    ok('«Más vendidos»: primero la que más unidades vendió, y el pedido pendiente no cuenta', r.status === 200 && JSON.stringify(names2(r)) === JSON.stringify(['ORDENTEST vieja', 'ORDENTEST media', 'ORDENTEST nueva']), JSON.stringify(names2(r)));
    r = await call('GET', '/cards/search?q=ORDENTEST&sort=latest_edition');
    ok('«Última edición»: primero la de la edición más nueva', r.status === 200 && JSON.stringify(names2(r)) === JSON.stringify(['ORDENTEST nueva', 'ORDENTEST media', 'ORDENTEST vieja']), JSON.stringify(names2(r)));
    r = await call('GET', '/cards/search?q=ORDENTEST&sort=recent');
    ok('«Más recientes» sigue ordenando por fecha de carga', r.status === 200 && names2(r)[0] === 'ORDENTEST nueva', JSON.stringify(names2(r)));
    r = await call('GET', '/cards/search?q=ORDENTEST&sort=price_asc');
    ok('«Precio» sigue funcionando', r.status === 200 && names2(r)[0] === 'ORDENTEST vieja', JSON.stringify(names2(r)));

    r = await call('GET', '/cards/search?q=ORDENTEST&sort=best_selling');
    ok('la respuesta trae el total, las páginas y solo campos públicos', r.j.total === 3 && r.j.pages === 1 && r.j.cards.every((c) => 'language' in c && 'set' in c && !('data' in c)), JSON.stringify(Object.keys(r.j.cards[0] || {})));
    r = await call('GET', '/cards/search?q=ORDENTEST&sort=best_selling&page=2');
    ok('una página más allá del final viene vacía, sin error', r.status === 200 && r.j.cards.length === 0, String(r.status));
    r = await call('GET', '/cards/search?q=ORDENTEST&sort=best_selling&tcg=Magic');
    ok('los filtros siguen aplicando con el orden por ventas', r.status === 200 && r.j.cards.length === 0, JSON.stringify(names2(r)));
    for (const sort of ['inventado', 'best_selling;DROP', 'LATEST_EDITION', '']) {
      r = await call('GET', '/cards/search?q=ORDENTEST&sort=' + encodeURIComponent(sort));
      ok('un orden inválido (' + sort + ') → 400 o el orden por defecto, nunca error del servidor', r.status === 400 || r.status === 200, String(r.status));
    }
    r = await call('GET', '/cards/search?sort=best_selling');
    ok('sin texto de búsqueda también ordena por ventas', r.status === 200 && Array.isArray(r.j.cards), String(r.status));

    // Coincidencias del catálogo (sin oferta): mismo orden por ventas; un orden desconocido se ignora
    const sold = await prisma.catalogCard.findUnique({ where: { productId: Number(products[0].productId) }, select: { name: true } });
    r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(sold.name) + '&sort=best_selling');
    ok('catálogo «Más vendidos»: la carta con ventas va primero', r.status === 200 && String(r.j.cards?.[0]?.productId) === products[0].productId, JSON.stringify((r.j.cards || []).slice(0, 2).map((c) => c.productId)));
    r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(sold.name) + '&sort=latest_edition');
    ok('catálogo «Última edición» responde con cartas', r.status === 200 && r.j.cards.length > 0, String(r.status));
    r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(sold.name) + '&sort=inventado');
    ok('catálogo con orden desconocido usa el orden por defecto', r.status === 200 && r.j.cards.length > 0, String(r.status));

    // Filtro de juego del catálogo: uno o varios nombres separados por coma (así «Pokémon» incluye inglés y japonés); nada raro pasa
    const soldGame = (await prisma.catalogCard.findUnique({ where: { productId: Number(products[0].productId) }, select: { game: { select: { name: true } } } })).game.name;
    r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(sold.name) + '&game=' + encodeURIComponent(soldGame + ',NoExiste'));
    ok('catálogo: varios juegos separados por coma → trae los de esos juegos', r.status === 200 && r.j.cards.length > 0 && r.j.cards.every((c) => c.game === soldGame), String(r.status));
    r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(sold.name) + '&game=NoExiste');
    ok('catálogo: un juego sin cartas no mezcla otros', r.status === 200 && r.j.cards.length === 0, JSON.stringify(r.j.cards?.length));
    for (const bad of ["Magic,';--", 'a,b,c,d,e', 'Magic,<img src=x>', 'Magic,%00', ',,,,,,']) {
      r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(sold.name) + '&game=' + encodeURIComponent(bad));
      ok('catálogo: filtro de juego inválido (' + bad.slice(0, 20) + ') → 400', r.status === 400, String(r.status));
    }

    // Código de carta con «/» final (así lo deja el buscador al escribir números): encuentra la carta cuyo número no lleva «/»
    const code = await prisma.catalogCard.findFirst({ where: { kind: 'card', number: { not: null }, NOT: { number: { contains: '/' } }, set: { name: { not: '' } } }, select: { productId: true, number: true } });
    r = await call('GET', '/tcg/search-index?q=' + encodeURIComponent(code.number + '/'));
    ok('catálogo: «' + code.number + '/» pone primero el número exacto', r.status === 200 && r.j.cards.length > 0 && r.j.cards[0].number === code.number, JSON.stringify(r.j.cards.slice(0, 2).map((c) => c.number)));
    r = await call('GET', '/cards/search?q=' + encodeURIComponent('ORDENTEST/'));
    ok('cartas a la venta: un texto con «/» no rompe la búsqueda', r.status === 200, String(r.status));

    // El apóstrofo no cuenta: «Boss's Orders» se encuentra con y sin él
    await prisma.card.create({ data: { folderId: folder.id, tcgId: products[0].productId, name: "APOSTEST Boss's Orders", price: 500, stock: 1, data: { language: 'English' } } });
    for (const text of ["APOSTEST Boss's Orders", 'APOSTEST Bosss Orders', 'APOSTEST Boss Orders', 'APOSTEST Boss’s Orders', "APOSTEST boss's"]) {
      r = await call('GET', '/cards/search?q=' + encodeURIComponent(text));
      ok('búsqueda «' + text + '» encuentra Boss Orders', r.status === 200 && r.j.total === 1, String(r.j.total));
    }
    r = await call('GET', '/cards/search?q=' + encodeURIComponent("'"));
    ok('un texto solo de apóstrofos busca ese símbolo y no falla', r.status === 200 && r.j.cards.every((c) => /['’‘´`]/.test(c.name)), String(r.j.total));

    // «¿Quisiste decir…?»: corrige palabras mal escritas y calla cuando el texto ya existe
    r = await call('GET', '/tcg/suggest?q=lucaro');
    ok('sugerencia: «lucaro» → un nombre de carta («Lucario»)', r.status === 200 && r.j.suggestion === 'Lucario', JSON.stringify(r.j));
    r = await call('GET', '/tcg/suggest?q=' + encodeURIComponent('boss orderer'));
    ok("sugerencia: «boss orderer» → Boss Orders", r.status === 200 && r.j.suggestion === "Boss's Orders", JSON.stringify(r.j));
    for (const nonsense of ['zzqqxx', 'asdfgh', 'qwertyuiop']) {
      r = await call('GET', '/tcg/suggest?q=' + nonsense);
      ok('texto sin parecido («' + nonsense + '») no sugiere nada', r.status === 200 && r.j.suggestion === null, JSON.stringify(r.j));
    }
    for (const typo of ['charizrd', 'mewtoo', 'bulbasur', 'miraidom', 'professor reserch']) {
      r = await call('GET', '/tcg/suggest?q=' + encodeURIComponent(typo));
      const found = r.j.suggestion ? await call('GET', '/tcg/search-index?q=' + encodeURIComponent(r.j.suggestion)) : null;
      ok('«' + typo + '» sugiere un nombre que existe en el catálogo (' + r.j.suggestion + ')', Boolean(r.j.suggestion) && found.j.cards.some((c) => c.name.toLowerCase().replace(/['’]/g, '').startsWith(r.j.suggestion.toLowerCase().replace(/['’]/g, ''))), JSON.stringify(r.j));
    }
    r = await call('GET', '/tcg/suggest?q=' + encodeURIComponent("boss's orders"));
    ok('sin sugerencia cuando el texto ya existe', r.status === 200 && r.j.suggestion === null, JSON.stringify(r.j));
    r = await call('GET', '/tcg/suggest?q=ab');
    ok('sugerencia con texto muy corto → 400', r.status === 400, String(r.status));

    // Carpeta del dueño: unidades vendidas y fecha de edición para ordenar su inventario; el público solo recibe la fecha de la edición
    r = await call('GET', '/folders/' + folder.id, 'seller');
    const mine = Object.fromEntries((r.j.folder?.cards || []).map((c) => [c.name, c]));
    ok('el dueño recibe las unidades vendidas de cada carta (5, 1 y 0; el pedido pendiente no cuenta)', r.status === 200 && mine['ORDENTEST vieja']?.soldUnits === 5 && mine['ORDENTEST media']?.soldUnits === 1 && mine['ORDENTEST nueva']?.soldUnits === 0, JSON.stringify(Object.values(mine).map((c) => c.soldUnits)));
    ok('cada carta trae la fecha de su edición, en orden cronológico', mine['ORDENTEST vieja']?.editionDate && new Date(mine['ORDENTEST vieja'].editionDate) < new Date(mine['ORDENTEST media'].editionDate) && new Date(mine['ORDENTEST media'].editionDate) < new Date(mine['ORDENTEST nueva'].editionDate), JSON.stringify(Object.values(mine).map((c) => c.editionDate)));
    for (const who of [undefined, 'jerry']) {
      r = await call('GET', '/folders/' + folder.id, who);
      ok('quien no es el dueño no recibe las ventas de las cartas' + (who ? ' (' + who + ')' : ' (visitante)'), r.status === 200 && r.j.folder.cards.every((c) => !('soldUnits' in c)) && r.j.folder.cards.every((c) => 'editionDate' in c), JSON.stringify(Object.keys(r.j.folder.cards[0] || {})));
    }

    // Fechas de carga masiva: TCGplayer pone el mismo día a decenas de ediciones sueltas (promos…). Esas cartas no deben quedar como «las más nuevas».
    const EDITION_GAME = 98077;
    await prisma.catalogGame.deleteMany({ where: { categoryId: EDITION_GAME } });
    await prisma.catalogGame.create({ data: { categoryId: EDITION_GAME, name: 'CZTEST Edicion', folder: 'CZTEST_EDICION' } });
    const bulkDay = new Date('2031-01-01T00:00:00Z');
    await prisma.catalogSet.createMany({ data: Array.from({ length: 22 }, (_, i) => ({ groupId: 98077000 + i, categoryId: EDITION_GAME, name: 'CZTEST masiva ' + i, folder: 'masiva' + i, publishedOn: bulkDay })) });
    await prisma.catalogSet.create({ data: { groupId: 98077100, categoryId: EDITION_GAME, name: 'CZTEST real', folder: 'real', publishedOn: new Date('2020-05-05T00:00:00Z') } });
    const cardData = (productId, groupId, name) => ({ productId, categoryId: EDITION_GAME, groupId, kind: 'card', name, cleanName: name.toLowerCase(), folder: 'x' });
    await prisma.catalogCard.createMany({ data: [cardData(98077001, 98077100, 'EDICIONTEST real'), cardData(98077002, 98077000, 'EDICIONTEST masiva'), cardData(98077003, 98077100, 'EDICIONTEST real dos')] });
    r = await call('GET', '/tcg/search-index?q=EDICIONTEST&game=CZTEST%20Edicion&sort=latest_edition');
    ok('catálogo «Última edición»: la edición con fecha real va antes que la de carga masiva (aunque esta tenga fecha más nueva)', r.status === 200 && r.j.cards.length === 3 && r.j.cards.slice(0, 2).every((c) => c.name.startsWith('EDICIONTEST real')) && r.j.cards[2].name === 'EDICIONTEST masiva', JSON.stringify((r.j.cards || []).map((c) => c.name)));
    r = await call('GET', '/tcg/search-index?q=EDICIONTEST&game=CZTEST%20Edicion&sort=latest_edition&page=2');
    ok('catálogo «Última edición»: una página más allá del final viene vacía', r.status === 200 && r.j.cards.length === 0, String(r.status));
    r = await call('GET', '/tcg/search-index?q=EDICIONTEST&game=CZTEST%20Edicion');
    ok('catálogo sin orden: sigue por nombre', r.status === 200 && r.j.cards.length === 3, String(r.status));
    // Lo mismo en las cartas a la venta y en el inventario del dueño
    editionFolder = await prisma.folder.create({ data: { name: 'TEST edición masiva', userId: seller.id, tcg: 'Pokemon', isPublic: true } });
    const sellerCard = (tcgId, name, ageHours) => prisma.card.create({ data: { folderId: editionFolder.id, tcgId, name, price: 1000, stock: 1, createdAt: new Date(Date.now() - ageHours * 3600 * 1000), data: { language: 'English' } } });
    await sellerCard('98077002', 'EDICIONVENTA masiva', 1); await sellerCard('98077001', 'EDICIONVENTA real', 5);
    r = await call('GET', '/cards/search?q=EDICIONVENTA&sort=latest_edition');
    ok('cartas a la venta «Última edición»: la de edición con fecha real va primero', r.status === 200 && JSON.stringify(names2(r)) === JSON.stringify(['EDICIONVENTA real', 'EDICIONVENTA masiva']), JSON.stringify(names2(r)));
    r = await call('GET', '/folders/' + editionFolder.id, 'seller');
    const ed = Object.fromEntries((r.j.folder?.cards || []).map((c) => [c.name, c]));
    ok('inventario del dueño: la fecha de la edición de carga masiva no se entrega (queda sin fecha)', ed['EDICIONVENTA masiva']?.editionDate === null && Boolean(ed['EDICIONVENTA real']?.editionDate), JSON.stringify(Object.values(ed).map((c) => [c.name, c.editionDate])));
  } finally {
    await prisma.catalogGame.deleteMany({ where: { categoryId: 98077 } }).catch(() => {});
    if (editionFolder) await prisma.folder.delete({ where: { id: editionFolder.id } }).catch(() => {});
    if (orders.length) await prisma.order.deleteMany({ where: { id: { in: orders } } }).catch(() => {});
    if (folder) await prisma.folder.delete({ where: { id: folder.id } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
