// Historial de precios: solo señales de Carpetazo; no se expone el historial de mercado de TCGplayer.
const { prisma, call, ok } = require('./fixtures.cjs');

const TCG_ID = '980000701';

(async () => {
  try {
    const { recordPriceSnapshots } = await import('../core/priceHistory.js');
    const pub = (await call('POST', '/folders', 'seller', { name: 'TEST historial publica', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const priv = (await call('POST', '/folders', 'seller', { name: 'TEST historial privada', tcg: 'Pokemon', color: 'blue', isPublic: false })).j.folder;
    const cheap = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST historial', price: 2000, stock: 1, folderId: pub.id } });
    const dear = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST historial', price: 3500, stock: 2, folderId: pub.id } });
    await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST historial', price: 100, stock: 1, folderId: priv.id } }); // privada: no cuenta
    const hidden = await prisma.card.create({ data: { tcgId: '980000702', name: 'CZTEST historial privada', price: 900, stock: 1, folderId: priv.id } });

    await recordPriceSnapshots();
    let rows = await prisma.cardPriceSnapshot.findMany({ where: { tcgId: TCG_ID } });
    ok('se guarda un punto del día con el precio más bajo público', rows.length === 1 && rows[0].lowest === 2000 && rows[0].offers === 2, JSON.stringify(rows));
    ok('una carta solo en carpeta privada no se guarda', (await prisma.cardPriceSnapshot.count({ where: { tcgId: '980000702' } })) === 0);

    // Dos veces el mismo día: no se duplica, queda el último precio
    await prisma.card.update({ where: { id: cheap.id }, data: { price: 1800 } });
    await recordPriceSnapshots();
    rows = await prisma.cardPriceSnapshot.findMany({ where: { tcgId: TCG_ID } });
    ok('el mismo día no se duplica y queda el último precio', rows.length === 1 && rows[0].lowest === 1800, JSON.stringify(rows));

    // Días anteriores para el gráfico
    const day = (daysAgo) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    await prisma.cardPriceSnapshot.createMany({ data: [{ tcg: 'Pokemon', tcgId: TCG_ID, day: day(10), lowest: 2500, offers: 1 }, { tcg: 'Pokemon', tcgId: TCG_ID, day: day(3), lowest: 2200, offers: 2 }, { tcg: 'Pokemon', tcgId: TCG_ID, day: day(400), lowest: 9999, offers: 1 }] });

    let r = await call('GET', '/cards/' + dear.id + '/price-history');
    const points = r.j?.points || [];
    ok('el historial viene ordenado por día, sin lo más antiguo de 180 días', r.status === 200 && points.length === 3 && points[0].lowest === 2500 && points[2].lowest === 1800 && points.every((p, i) => i === 0 || p.day > points[i - 1].day), JSON.stringify(points));
    ok('solo trae día, precio y cantidad de ofertas', points.every((p) => Object.keys(p).sort().join() === 'day,lowest,offers'));
    // Las ventas completadas de Carpetazo se incluyen; los snapshots de mercado externos no se exponen.
    const seller = await prisma.user.findFirst({ where: { folders: { some: { id: pub.id } } }, select: { id: true } });
    await prisma.cardMarketSnapshot.createMany({ data: [{ tcgId: TCG_ID, day: day(10), clp: 2400, usd: 2.6 }, { tcgId: TCG_ID, day: day(0), clp: 2100, usd: 2.3 }] });
    await prisma.order.create({ data: { sellerId: seller.id, buyerName: 'CZTEST comprador', folderId: pub.id, folderName: 'TEST historial publica', items: [{ id: cheap.id, tcgId: TCG_ID, name: 'CZTEST historial', price: 2300, quantity: 2 }], total: 4600, status: 'completed' } });
    await prisma.order.create({ data: { sellerId: seller.id, buyerName: 'CZTEST comprador', folderId: pub.id, folderName: 'TEST historial publica', items: [{ id: cheap.id, tcgId: TCG_ID, name: 'CZTEST historial', price: 1, quantity: 1 }], total: 1, status: 'pending' } });
    r = await call('GET', '/cards/' + dear.id + '/price-history');
    ok('no expone el historial de mercado de TCGplayer', !Object.prototype.hasOwnProperty.call(r.j, 'market'));
    ok('trae las ventas completadas (no las pendientes), sin datos del comprador ni del vendedor', r.j.sales?.length === 1 && r.j.sales[0].price === 2300 && r.j.sales[0].quantity === 2 && Object.keys(r.j.sales[0]).sort().join() === 'day,price,quantity,source' && r.j.sales[0].source === 'confirmada', JSON.stringify(r.j.sales));
    const magicFolder = (await call('POST', '/folders', 'seller', { name: 'TEST historial magic', tcg: 'Magic', color: 'blue', isPublic: true })).j.folder;
    const magicCard = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST historial magic', price: 1200, stock: 1, folderId: magicFolder.id } });
    r = await call('GET', '/cards/' + magicCard.id + '/price-history');
    ok('el historial no mezcla ventas de otro juego ni incluye mercado externo', r.status === 200 && !Object.prototype.hasOwnProperty.call(r.j, 'market') && r.j.sales.length === 0, JSON.stringify(r.j));

    r = await call('GET', '/cards/' + hidden.id + '/price-history');
    ok('carta de carpeta privada → 404', r.status === 404, String(r.status));
    r = await call('GET', '/cards/00000000-0000-4000-8000-000000000000/price-history');
    ok('carta inexistente → 404', r.status === 404, String(r.status));
    r = await call('GET', '/cards/no-valido/price-history');
    ok('id inválido → 400', r.status === 400, String(r.status));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.order.deleteMany({ where: { buyerName: 'CZTEST comprador' } }).catch(() => {});
    await prisma.cardMarketSnapshot.deleteMany({ where: { tcgId: TCG_ID } }).catch(() => {});
    await prisma.cardPriceSnapshot.deleteMany({ where: { tcgId: { in: [TCG_ID, '980000702'] } } }).catch(() => {});
    await prisma.card.deleteMany({ where: { name: { startsWith: 'CZTEST historial' } } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST historial' } } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
})();
