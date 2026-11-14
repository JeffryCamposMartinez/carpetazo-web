// Caja y stock: solo plan Tienda; la venta en persona guarda el medio de pago; cierre por día; alertas de poco stock y sin movimiento.
const { prisma, call, ok, snapshotPlans, fixtures } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.75.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());

(async () => {
  const { folderId, cardId } = fixtures();
  const restorePlans = await snapshotPlans(['seller', 'jerry']);
  const seller = (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-seller' }, select: { id: true } })).id;
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { stock: true, price: true } });
  const saleIds = [];
  try {
    await prisma.card.update({ where: { id: cardId }, data: { stock: 3, price: card.price ?? 1000 } });
    let r;
    await plan('seller', 'free');
    r = await call('GET', '/stores/me/cash', 'seller', null, ip());
    ok('Free no ve la caja → 403', r.status === 403 && r.j.feature === 'storeTools', String(r.status));
    await plan('seller', 'store');
    await plan('jerry', 'free');

    const sell = (body) => call('POST', '/folders/' + folderId + '/in-person-sales', 'seller', { requestId: 'cztestcash' + Date.now() + Math.random().toString(36).slice(2, 8), items: [{ cardId, quantity: 1, unitPrice: 2500 }], ...body }, ip());
    r = await sell({ paymentMethod: 'bitcoin' });
    ok('medio de pago desconocido → 400', r.status === 400, String(r.status));
    r = await sell({ paymentMethod: 'debit' });
    ok('venta en persona con débito', r.status === 201 && r.j.sale.paymentMethod === 'debit', JSON.stringify(r.j.sale));
    saleIds.push(r.j.sale?.id);

    r = await call('GET', '/stores/me/cash?days=1', 'seller', null, ip());
    ok('el cierre de hoy suma el débito', r.status === 200 && r.j.days[0].byMethod.debit >= 2500, JSON.stringify(r.j.days?.[0]));
    r = await call('GET', '/stores/me/cash?days=99', 'seller', null, ip());
    ok('rango fuera de 1..31 → 400', r.status === 400, String(r.status));
    r = await call('GET', '/stores/me/cash', 'jerry', null, ip());
    ok('otra cuenta sin plan no ve caja → 403', r.status === 403, String(r.status));

    r = await call('PUT', '/stores/me/stock-settings', 'seller', { lowStockAt: 5, staleDays: 3 }, ip());
    ok('días sin movimiento < 7 → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/stores/me/stock-settings', 'seller', { lowStockAt: 5, staleDays: 30 }, ip());
    ok('guarda los umbrales', r.status === 200, String(r.status));
    r = await call('GET', '/stores/me/stock-alerts', 'seller', null, ip());
    ok('la carta con 2 unidades sale en poco stock', r.status === 200 && r.j.low.some((c) => c.id === cardId), JSON.stringify(r.j.low?.map((c) => c.stock)));
    await prisma.$executeRaw`UPDATE "Card" SET "updatedAt" = NOW() - INTERVAL '40 days' WHERE "id" = ${cardId}`;
    r = await call('GET', '/stores/me/stock-alerts', 'seller', null, ip());
    ok('la carta sin cambios hace 40 días sale como sin movimiento', r.j.stale.some((c) => c.id === cardId));
    r = await call('GET', '/stores/me/stock-alerts', 'jerry', null, ip());
    ok('otra cuenta no ve las alertas → 403', r.status === 403, String(r.status));
  } finally {
    await prisma.inPersonSale.deleteMany({ where: { id: { in: saleIds.filter(Boolean) } } });
    await prisma.card.update({ where: { id: cardId }, data: { stock: card.stock, price: card.price } });
    await prisma.storeProfile.deleteMany({ where: { userId: seller } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
