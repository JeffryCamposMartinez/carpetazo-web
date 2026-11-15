// Reserva con retiro en tienda: solo tiendas con plan y ficha activa; reserva stock; código y plazo; lista para retirar; vence y libera; el comprador cancela.
const { prisma, call, ok, snapshotPlans, fixtures } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.74.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());

(async () => {
  const { folderId, cardId } = fixtures();
  const restorePlans = await snapshotPlans(['seller']);
  const seller = (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-seller' }, select: { id: true } })).id;
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { stock: true } });
  const created = [];
  const verifiedBefore = (await prisma.user.findUnique({ where: { id: seller }, select: { identityVerifiedAt: true } })).identityVerifiedAt;
  await prisma.user.update({ where: { id: seller }, data: { identityVerifiedAt: new Date() } }); // el local público exige la cuenta verificada
  try {
    await prisma.card.update({ where: { id: cardId }, data: { stock: 2 } });
    await prisma.storeProfile.deleteMany({ where: { userId: seller } });
    const reserve = (who, quantity = 1) => call('POST', '/orders/create', who, { folderId, via: 'pickup', items: [{ id: cardId, quantity }] }, ip());
    let r;

    await plan('seller', 'free');
    r = await reserve('jerry');
    ok('sin plan Tienda no hay retiro → 400', r.status === 400, String(r.status));
    await plan('seller', 'store');
    r = await reserve('jerry');
    ok('con plan pero sin ficha activa no hay retiro → 400', r.status === 400, String(r.status));
    await prisma.storeProfile.create({ data: { userId: seller, enabled: true, address: 'Arauco 1', comuna: 'Chillán', region: 'Ñuble', pickupHours: 24 } });
    r = await reserve(null);
    ok('sin sesión no se reserva → 401', r.status === 401, String(r.status));
    r = await reserve('seller');
    ok('la tienda no se reserva a sí misma → 400', r.status === 400, String(r.status));

    r = await reserve('jerry');
    ok('se reserva con código y plazo de 24 h', r.status === 200 && /^[A-Z2-9]{6}$/.test(r.j.pickup?.code || '') && Math.abs(new Date(r.j.pickup.until) - Date.now() - 24 * 3600 * 1000) < 120000, JSON.stringify(r.j.pickup));
    ok('la respuesta no trae datos bancarios', r.j.payment === null);
    const first = r.j.order.id; created.push(first);
    r = await reserve('ale');
    created.push(r.j.order?.id);
    r = await reserve('ignacio');
    ok('la reserva aparta el stock (no queda para un tercero) → 409', r.status === 409, String(r.status));

    r = await call('GET', '/orders/mine/pickups', 'seller', null, ip());
    const mine = r.j.pickups?.find((p) => p.id === first);
    ok('la tienda ve sus retiros con código', r.status === 200 && mine?.pickupCode && mine.ready === false, JSON.stringify(mine));
    r = await call('GET', '/orders/mine/pickups', 'ale', null, ip());
    ok('otra cuenta no ve los retiros de la tienda', r.status === 200 && !r.j.pickups.some((p) => p.id === first));
    r = await call('POST', '/orders/mine/' + first + '/pickup-ready', 'ale', {}, ip());
    ok('otra cuenta no marca lista una reserva ajena → 404', r.status === 404, String(r.status));
    r = await call('POST', '/orders/mine/' + first + '/pickup-ready', 'seller', {}, ip());
    ok('la tienda marca la reserva lista', r.status === 200 && r.j.pickup.ready === true, JSON.stringify(r.j));

    r = await call('GET', '/orders/pickups/mine', 'jerry', null, ip());
    ok('el comprador ve su reserva lista con el nombre de la tienda', r.j.pickups?.find((p) => p.id === first)?.ready === true && r.j.pickups[0].store?.username);
    r = await call('POST', '/orders/pickups/' + first + '/cancel', 'ale', {}, ip());
    ok('otra persona no cancela la reserva ajena → 404', r.status === 404, String(r.status));
    r = await call('POST', '/orders/pickups/' + first + '/cancel', 'jerry', {}, ip());
    ok('el comprador cancela su reserva', r.status === 200 && r.j.pickup.status === 'cancelled', JSON.stringify(r.j));
    r = await reserve('ignacio');
    ok('al cancelar se libera el stock', r.status === 200, String(r.status));
    created.push(r.j.order?.id);

    // Vencimiento: la de ale pasa su plazo
    await prisma.order.update({ where: { id: created[1] }, data: { pickupBy: new Date(Date.now() - 60000) } });
    const { runPickupExpiry } = await import('../core/storePickups.js');
    const res = await runPickupExpiry();
    const expired = await prisma.order.findUnique({ where: { id: created[1] } });
    ok('la reserva vencida queda «expired»', res.expired >= 1 && expired.status === 'expired', expired.status);
    r = await call('POST', '/orders/mine/' + created[1] + '/status', 'seller', { status: 'completed' }, ip());
    ok('una reserva vencida no se puede completar → 409', r.status === 409, String(r.status));
  } finally {
    await prisma.order.deleteMany({ where: { id: { in: created.filter(Boolean) } } });
    await prisma.message.deleteMany({ where: { receiverId: seller, content: { contains: 'Código de retiro' } } });
    await prisma.storeProfile.deleteMany({ where: { userId: seller } });
    await prisma.user.update({ where: { id: seller }, data: { identityVerifiedAt: verifiedBefore } });
    await prisma.card.update({ where: { id: cardId }, data: { stock: card.stock } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
