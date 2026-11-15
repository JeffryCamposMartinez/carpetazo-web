// Equipo de la tienda: invitar → aceptar → revocar; caja vende y entrega retiros; stock cambia cantidades; nadie del equipo ve plan, informes ni datos del dueño.
const { prisma, B, U, NAMES, call, ok, snapshotPlans, fixtures } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.78.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());

(async () => {
  const { folderId, cardId } = fixtures();
  const restorePlans = await snapshotPlans(['seller']);
  const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
  const store = await id('seller');
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { stock: true, price: true } });
  const created = { orders: [], sales: [] };
  try {
    await prisma.storeMember.deleteMany({ where: { storeId: store } });
    await prisma.card.update({ where: { id: cardId }, data: { stock: 10, price: 3000 } });
    let r;
    await plan('seller', 'free');
    r = await call('POST', '/stores/me/team', 'seller', { username: NAMES.jerry, role: 'cashier' }, ip());
    ok('sin plan Tienda no invita → 403', r.status === 403, String(r.status));
    await plan('seller', 'store');
    r = await call('POST', '/stores/me/team', 'seller', { username: NAMES.jerry, role: 'admin' }, ip());
    ok('rol inventado → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/me/team', 'seller', { username: NAMES.seller, role: 'cashier' }, ip());
    ok('no se invita a sí mismo → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/me/team', 'seller', { username: NAMES.jerry, role: 'cashier' }, ip());
    ok('invita a jerry como caja', r.status === 200 && r.j.member.status === 'invited', JSON.stringify(r.j));
    const cashierInvite = r.j.member.id;
    r = await call('POST', '/stores/me/team', 'seller', { username: NAMES.ale, role: 'stock' }, ip());
    const stockInvite = r.j.member?.id;

    // Invitado sin aceptar no puede nada
    const sale = (who) => call('POST', '/folders/' + folderId + '/in-person-sales', who, { requestId: 'cztestteam' + Date.now() + Math.random().toString(36).slice(2, 8), paymentMethod: 'cash', items: [{ cardId, quantity: 1 }] }, ip());
    r = await sale('jerry');
    ok('invitado sin aceptar no vende → 404', r.status === 404, String(r.status));
    r = await call('POST', '/staff/invitations/' + cashierInvite + '/accept', 'ale', {}, ip());
    ok('otra persona no acepta la invitación ajena → 404', r.status === 404, String(r.status));
    r = await call('POST', '/staff/invitations/' + cashierInvite + '/accept', 'jerry', {}, ip());
    ok('jerry acepta', r.status === 200, String(r.status));
    await call('POST', '/staff/invitations/' + stockInvite + '/accept', 'ale', {}, ip());

    // Caja
    r = await sale('jerry');
    created.sales.push(r.j.sale?.id);
    const stored = r.j.sale?.id ? await prisma.inPersonSale.findUnique({ where: { id: r.j.sale.id } }) : null;
    ok('caja registra una venta a nombre de la tienda', r.status === 201 && stored?.userId === store, String(r.status));
    r = await sale('ale');
    ok('stock no registra ventas → 404', r.status === 404, String(r.status));
    r = await call('GET', '/staff/stores/' + store + '/folders', 'jerry', null, ip());
    ok('caja ve las carpetas y cartas de la tienda', r.status === 200 && r.j.folders.some((f) => f.id === folderId), String(r.status));
    ok('sin datos de la cuenta del dueño', !/bank|rut|email|phone/i.test(JSON.stringify(r.j)));

    // Retiros con caja
    await prisma.storeProfile.upsert({ where: { userId: store }, create: { userId: store, enabled: true, address: 'Calle 1', comuna: 'Chillán', region: 'Ñuble' }, update: { enabled: true } });
    r = await call('POST', '/orders/create', 'ignacio', { folderId, via: 'pickup', items: [{ id: cardId, quantity: 1 }] }, ip());
    const pickupId = r.j.order?.id; created.orders.push(pickupId);
    r = await call('GET', '/staff/stores/' + store + '/pickups', 'jerry', null, ip());
    ok('caja ve los retiros', r.status === 200 && r.j.pickups.some((p) => p.id === pickupId), String(r.status));
    r = await call('GET', '/staff/stores/' + store + '/pickups', 'ale', null, ip());
    ok('stock no ve retiros → 404', r.status === 404, String(r.status));
    const before = (await prisma.card.findUnique({ where: { id: cardId } })).stock;
    r = await call('POST', '/staff/stores/' + store + '/pickups/' + pickupId + '/deliver', 'jerry', {}, ip());
    const after = (await prisma.card.findUnique({ where: { id: cardId } })).stock;
    ok('caja entrega el retiro y baja el stock una vez', r.status === 200 && r.j.pickup.status === 'completed' && after === before - 1, `${before}→${after}`);
    r = await call('POST', '/staff/stores/' + store + '/pickups/' + pickupId + '/deliver', 'jerry', {}, ip());
    ok('no se entrega dos veces → 409', r.status === 409, String(r.status));

    // Stock
    r = await call('PUT', '/staff/stores/' + store + '/cards/' + cardId, 'ale', { stock: 7, price: 3500 }, ip());
    ok('stock cambia cantidad y precio', r.status === 200 && (await prisma.card.findUnique({ where: { id: cardId } })).stock === 7, String(r.status));
    r = await call('PUT', '/staff/stores/' + store + '/cards/' + cardId, 'jerry', { stock: 0, price: 1 }, ip());
    ok('caja no cambia stock → 404', r.status === 404, String(r.status));
    r = await call('PUT', '/staff/stores/' + store + '/cards/' + cardId, 'ale', { stock: -3, price: 1 }, ip());
    ok('cantidad negativa → 400', r.status === 400, String(r.status));

    // Lo que el equipo nunca ve
    for (const path of ['/stores/me/report.csv?from=2026-11-01&to=2026-11-15', '/stores/me/cash', '/stores/me/coupons']) {
      r = await call('GET', path, 'jerry', null, ip());
      ok('caja no ve datos de la tienda en ' + path.split('?')[0], r.status !== 200 || !JSON.stringify(r.j).includes(store), String(r.status));
    }

    // Informe del dueño
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const res = await fetch(B + '/stores/me/report.csv?from=' + today + '&to=' + today, { headers: { Authorization: 'Bearer test-' + U.seller } });
    const text = await res.text();
    ok('el dueño descarga el informe CSV con la venta y el retiro', res.status === 200 && /text\/csv/.test(res.headers.get('content-type')) && text.includes('Venta en persona') && text.includes('Retiro en tienda'), String(res.status));
    r = await call('GET', '/stores/me/report.csv?from=2026-11-15&to=2026-11-01', 'seller', null, ip());
    ok('rango al revés → 400', r.status === 400, String(r.status));

    // Revocar: pierde el acceso al instante
    r = await call('DELETE', '/stores/me/team/' + cashierInvite, 'ale', null, ip());
    ok('alguien del equipo no revoca a otro → 404', r.status === 404, String(r.status));
    r = await call('DELETE', '/stores/me/team/' + cashierInvite, 'seller', null, ip());
    ok('el dueño revoca', r.status === 200, String(r.status));
    r = await sale('jerry');
    ok('revocado ya no vende → 404', r.status === 404, String(r.status));

    // Sin plan Tienda, el equipo no puede actuar
    await plan('seller', 'free');
    r = await call('PUT', '/staff/stores/' + store + '/cards/' + cardId, 'ale', { stock: 5, price: 3500 }, ip());
    ok('si la tienda baja de plan, el equipo no actúa → 404', r.status === 404, String(r.status));

    // Resumen semanal: una vez
    await plan('seller', 'store');
    const { runWeeklySummaries } = await import('../core/storeReport.js');
    const first = await runWeeklySummaries(new Date(), { force: true });
    const second = await runWeeklySummaries(new Date(), { force: true });
    ok('el resumen semanal sale una vez por semana', first.sent >= 1 && second.sent === 0, JSON.stringify([first, second]));
  } finally {
    await prisma.inPersonSale.deleteMany({ where: { id: { in: created.sales.filter(Boolean) } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orders.filter(Boolean) } } });
    await prisma.message.deleteMany({ where: { receiverId: store, content: { contains: 'Código de retiro' } } });
    await prisma.storeMember.deleteMany({ where: { storeId: store } });
    await prisma.storeProfile.deleteMany({ where: { userId: store } });
    await prisma.card.update({ where: { id: cardId }, data: { stock: card.stock, price: card.price } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
