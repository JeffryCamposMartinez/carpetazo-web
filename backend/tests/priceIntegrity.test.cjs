// Integridad de precios: el ataque de publicar una carta a $1 y comprársela uno mismo no mueve la referencia, el historial ni las ventas;
// y las publicaciones y ventas sospechosas llegan al equipo de moderación.
const { prisma, call, ok } = require('./fixtures.cjs');

const TCG_ID = '980000801';
const MYL = 'Mitos y Leyendas';

(async () => {
  try {
    const { recordPriceSnapshots } = await import('../core/priceHistory.js');
    const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
    const users = { seller: await id('seller'), jerry: await id('jerry'), ignacio: await id('ignacio'), attacker: await id('jeffry'), ale: await id('ale'), admin: await id('admin') };

    // Tres vendedores honestos piden entre $1.000 y $1.200
    const honest = [['seller', 1000], ['jerry', 1100], ['ignacio', 1200]];
    const cards = {};
    for (const [who, price] of honest) {
      const folder = (await call('POST', '/folders', who, { name: 'TEST integridad ' + who, tcg: MYL, color: 'blue', isPublic: true })).j.folder;
      cards[who] = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST integridad', price, stock: 3, folderId: folder.id } });
    }
    // El atacante (cuenta nueva) pide $1 por la misma carta y se la "compran" desde otras cuentas
    const attackerFolder = (await call('POST', '/folders', 'jeffry', { name: 'TEST integridad atacante', tcg: MYL, color: 'blue', isPublic: true })).j.folder;
    const attackerCard = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST integridad', price: 1, stock: 9, folderId: attackerFolder.id } });
    const order = (sellerId, buyerId, folder, unit, quantity = 1) => prisma.order.create({ data: { sellerId, buyerId, buyerName: 'CZTEST comprador', folderId: folder.id, folderName: folder.name, items: [{ id: attackerCard.id, tcgId: TCG_ID, name: 'CZTEST integridad', price: unit, quantity }], total: unit * quantity, status: 'completed', createdIpHash: 'h-' + buyerId.slice(0, 6), completedIpHash: 'h-x' } });
    for (const buyer of ['ale', 'admin', 'seller']) await order(users.attacker, users[buyer], attackerFolder, 1);

    // Referencia: las ventas a $1 y la publicación a $1 no cuentan
    let r = await call('GET', '/cards/reference-prices?ids=' + TCG_ID);
    ok('el ataque no baja la referencia: queda en lo que piden los 3 vendedores honestos', r.status === 200 && r.j.prices?.[TCG_ID]?.clp === 1100 && r.j.prices[TCG_ID].sellers === 3, JSON.stringify(r.j));

    // Últimas ventas de la carta: las de $1 se descartan
    r = await call('GET', '/cards/' + cards.seller.id + '/offers');
    ok('las ventas a $1 no aparecen en "Últimas ventas"', r.status === 200 && Array.isArray(r.j.sales) && r.j.sales.length === 0, JSON.stringify(r.j.sales));

    // Una autoventa (el comprador es el mismo vendedor) tampoco cuenta
    const selfFolder = await prisma.folder.findUnique({ where: { id: cards.seller.folderId } });
    await prisma.order.create({ data: { sellerId: users.seller, buyerId: users.seller, buyerName: 'CZTEST comprador', folderId: selfFolder.id, folderName: selfFolder.name, items: [{ id: cards.seller.id, tcgId: TCG_ID, price: 1050, quantity: 1 }], total: 1050, status: 'completed' } });
    r = await call('GET', '/cards/' + cards.seller.id + '/offers');
    ok('una autoventa no cuenta', r.j.sales.length === 0, JSON.stringify(r.j.sales));

    // Ventas reales: 3 vendedores y 3 compradores distintos dan una referencia basada en ventas
    const realSales = [['seller', 'ale', 1000], ['jerry', 'admin', 1100], ['ignacio', 'attacker', 1200]];
    for (const [who, buyer, unit] of realSales) {
      const folder = await prisma.folder.findUnique({ where: { id: cards[who].folderId } });
      await prisma.order.create({ data: { sellerId: users[who], buyerId: users[buyer], buyerName: 'CZTEST comprador', folderId: folder.id, folderName: folder.name, items: [{ id: cards[who].id, tcgId: TCG_ID, price: unit, quantity: 1 }], total: unit, status: 'completed', createdIpHash: 'h-' + buyer, completedIpHash: 'h-x' } });
    }
    r = await call('GET', '/cards/reference-prices?ids=' + TCG_ID);
    ok('con ventas de 3 vendedores y 3 compradores distintos la referencia sale de las ventas', r.j.prices?.[TCG_ID]?.sales === 3 && r.j.prices[TCG_ID].clp === 1100, JSON.stringify(r.j.prices));
    r = await call('GET', '/cards/' + cards.seller.id + '/offers');
    ok('las ventas reales sí aparecen y las de $1 no', r.j.sales.length === 3 && r.j.sales.every((sale) => sale.price >= 1000), JSON.stringify(r.j.sales));

    // Solo un vendedor y un comprador: no alcanza para una referencia por ventas
    await prisma.order.deleteMany({ where: { sellerId: { in: [users.jerry, users.ignacio] }, buyerName: 'CZTEST comprador' } });
    r = await call('GET', '/cards/reference-prices?ids=' + TCG_ID);
    ok('con ventas de un solo vendedor no se usa la referencia por ventas', r.j.prices?.[TCG_ID] && r.j.prices[TCG_ID].sales === undefined && r.j.prices[TCG_ID].sellers === 3, JSON.stringify(r.j.prices));

    // Historial: el precio más bajo del día no cuenta la publicación a $1
    await recordPriceSnapshots();
    const snapshot = await prisma.cardPriceSnapshot.findFirst({ where: { tcg: MYL, tcgId: TCG_ID } });
    ok('el historial guarda $1.000 y no $1', snapshot?.lowest === 1000, JSON.stringify(snapshot));

    // Moderación: la publicación sospechosa y las ventas baratas del atacante llegan a la cola
    await prisma.order.deleteMany({ where: { buyerName: 'CZTEST comprador' } });
    for (const buyer of ['ale', 'admin', 'seller']) await order(users.attacker, users[buyer], attackerFolder, 1);
    r = await call('POST', '/admin/price-watch/run', 'admin');
    ok('el equipo puede ejecutar la vigilancia', r.status === 200 && r.j.success === true, JSON.stringify(r.j));
    const listing = await prisma.report.findMany({ where: { reasonCode: 'auto.price_listing', targetId: attackerCard.id } });
    const manipulation = await prisma.report.findMany({ where: { reasonCode: 'auto.price_manipulation', targetId: users.attacker } });
    ok('la publicación a $1 de una cuenta nueva se reporta una vez', listing.length === 1 && listing[0].reporterId === null && listing[0].targetOwnerId === users.attacker, JSON.stringify(listing.length));
    ok('las ventas muy baratas entre cuentas nuevas se reportan contra el vendedor', manipulation.length === 1 && manipulation[0].severity === 'S2', JSON.stringify(manipulation.length));
    ok('las publicaciones honestas no se reportan', (await prisma.report.count({ where: { reasonCode: 'auto.price_listing', targetId: { in: Object.values(cards).map((card) => card.id) } } })) === 0);
    r = await call('POST', '/admin/price-watch/run', 'admin');
    ok('repetir la vigilancia no duplica los reportes', r.j.created === 0 && (await prisma.report.count({ where: { reasonCode: { in: ['auto.price_listing', 'auto.price_manipulation'] }, OR: [{ targetId: attackerCard.id }, { targetId: users.attacker }] } })) === 2, JSON.stringify(r.j));

    r = await call('POST', '/admin/price-watch/run', 'seller');
    ok('una persona sin permiso de moderación no puede ejecutarla', r.status === 403, String(r.status));
    r = await call('POST', '/admin/price-watch/run');
    ok('sin sesión → 401', r.status === 401, String(r.status));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.report.deleteMany({ where: { reasonCode: { in: ['auto.price_listing', 'auto.price_manipulation'] } } }).catch(() => {});
    await prisma.order.deleteMany({ where: { buyerName: 'CZTEST comprador' } }).catch(() => {});
    await prisma.cardPriceSnapshot.deleteMany({ where: { tcgId: TCG_ID } }).catch(() => {});
    await prisma.card.deleteMany({ where: { name: 'CZTEST integridad' } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST integridad' } } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
})();
