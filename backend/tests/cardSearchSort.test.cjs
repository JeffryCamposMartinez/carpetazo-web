// Búsqueda pública de cartas: orden «Más vendidos» (por unidades vendidas en pedidos confirmados) y «Última edición» (por la fecha de la edición del catálogo).
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  let folder = null;
  const orders = [];
  try {
    const seller = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-seller' }, select: { id: true } });
    // Tres cartas reales del catálogo de Pokémon, de tres ediciones con fechas distintas: vieja, media y nueva
    const groups = await prisma.catalogSet.findMany({ where: { categoryId: 3, publishedOn: { not: null }, cards: { some: { kind: 'card' } } }, orderBy: { publishedOn: 'asc' }, select: { groupId: true, publishedOn: true } });
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

    // Carpeta del dueño: unidades vendidas y fecha de edición para ordenar su inventario; el público solo recibe la fecha de la edición
    r = await call('GET', '/folders/' + folder.id, 'seller');
    const mine = Object.fromEntries((r.j.folder?.cards || []).map((c) => [c.name, c]));
    ok('el dueño recibe las unidades vendidas de cada carta (5, 1 y 0; el pedido pendiente no cuenta)', r.status === 200 && mine['ORDENTEST vieja']?.soldUnits === 5 && mine['ORDENTEST media']?.soldUnits === 1 && mine['ORDENTEST nueva']?.soldUnits === 0, JSON.stringify(Object.values(mine).map((c) => c.soldUnits)));
    ok('cada carta trae la fecha de su edición, en orden cronológico', mine['ORDENTEST vieja']?.editionDate && new Date(mine['ORDENTEST vieja'].editionDate) < new Date(mine['ORDENTEST media'].editionDate) && new Date(mine['ORDENTEST media'].editionDate) < new Date(mine['ORDENTEST nueva'].editionDate), JSON.stringify(Object.values(mine).map((c) => c.editionDate)));
    for (const who of [undefined, 'jerry']) {
      r = await call('GET', '/folders/' + folder.id, who);
      ok('quien no es el dueño no recibe las ventas de las cartas' + (who ? ' (' + who + ')' : ' (visitante)'), r.status === 200 && r.j.folder.cards.every((c) => !('soldUnits' in c)) && r.j.folder.cards.every((c) => 'editionDate' in c), JSON.stringify(Object.keys(r.j.folder.cards[0] || {})));
    }
  } finally {
    if (orders.length) await prisma.order.deleteMany({ where: { id: { in: orders } } }).catch(() => {});
    if (folder) await prisma.folder.delete({ where: { id: folder.id } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
