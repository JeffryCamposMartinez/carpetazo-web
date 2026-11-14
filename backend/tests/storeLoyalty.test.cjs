// Fidelización: seguir solo tiendas con plan; aviso 1 vez al día; cupón calculado en el servidor, con usos contados y sin abuso; demanda sin nombres.
const { prisma, NAMES, call, ok, snapshotPlans, fixtures } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.76.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());

(async () => {
  const { folderId, cardId } = fixtures();
  const restorePlans = await snapshotPlans(['seller', 'jerry']);
  const seller = (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-seller' }, select: { id: true } })).id;
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { stock: true, price: true } });
  const orders = [];
  try {
    await prisma.card.update({ where: { id: cardId }, data: { stock: 20, price: 10000 } });
    await prisma.storeFollow.deleteMany({ where: { storeId: seller } });
    await prisma.storeCoupon.deleteMany({ where: { storeId: seller } });
    let r;
    await plan('seller', 'free');
    await plan('jerry', 'free');
    r = await call('POST', '/stores/' + NAMES.seller + '/follow', 'jerry', {}, ip());
    ok('no se sigue a una cuenta sin plan Tienda → 404', r.status === 404, String(r.status));
    await plan('seller', 'store');
    r = await call('POST', '/stores/' + NAMES.seller + '/follow', 'seller', {}, ip());
    ok('la tienda no se sigue a sí misma → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/' + NAMES.seller + '/follow', 'jerry', {}, ip());
    ok('jerry sigue a la tienda', r.status === 200 && r.j.following && r.j.followers === 1, JSON.stringify(r.j));
    r = await call('POST', '/stores/' + NAMES.seller + '/follow', 'jerry', {}, ip());
    ok('seguir dos veces no duplica', r.j.followers === 1, String(r.j.followers));
    r = await call('GET', '/stores/' + NAMES.seller + '/follow', 'jerry', null, ip());
    ok('estado público: siguiendo y cantidad, sin lista de seguidores', r.j.following === true && r.j.followers === 1 && !('list' in r.j));

    r = await call('POST', '/stores/me/announce', 'seller', { message: 'Llegó la nueva colección' }, ip());
    ok('primer aviso del día sale a 1 seguidor', r.status === 200 && r.j.sent === 1, JSON.stringify(r.j));
    r = await call('POST', '/stores/me/announce', 'seller', { message: 'Otro aviso más hoy' }, ip());
    ok('segundo aviso el mismo día → 429', r.status === 429, String(r.status));
    r = await call('POST', '/stores/me/announce', 'jerry', { message: 'Aviso falso de jerry' }, ip());
    ok('sin plan Tienda no se avisa → 403', r.status === 403, String(r.status));

    // Cupones
    r = await call('POST', '/stores/me/coupons', 'seller', { code: 'MAL CODE', kind: 'percent', value: 10 }, ip());
    ok('código con espacio → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/me/coupons', 'seller', { code: 'cztest10', kind: 'percent', value: 10, minTotal: 15000, maxUses: 2, maxPerUser: 1 }, ip());
    ok('crea cupón 10 % (mín. $15.000, 2 usos)', r.status === 200 && r.j.coupon.code === 'CZTEST10', JSON.stringify(r.j));
    const couponId = r.j.coupon?.id;
    r = await call('POST', '/stores/me/coupons', 'seller', { code: 'CZTEST10', kind: 'fixed', value: 1000 }, ip());
    ok('código repetido → 400', r.status === 400, String(r.status));

    const order = (who, quantity, coupon, via = 'message') => call('POST', '/orders/create', who, { folderId, via, coupon, items: [{ id: cardId, quantity }] }, ip());
    r = await call('POST', '/stores/coupons/check', 'jerry', { folderId, code: 'cztest10', items: [{ id: cardId, quantity: 1 }] }, ip());
    ok('revisar: no cumple el mínimo', r.status === 200 && r.j.valid === false && /mínima/.test(r.j.message), JSON.stringify(r.j));
    r = await call('POST', '/stores/coupons/check', 'jerry', { folderId, code: 'cztest10', items: [{ id: cardId, quantity: 2, price: 1 }] }, ip());
    ok('revisar: el total sale de la base (precio del cliente ignorado)', r.j.valid === true && r.j.discount === 2000 && r.j.total === 18000, JSON.stringify(r.j));
    r = await order(null, 2, 'CZTEST10', 'whatsapp');
    ok('sin cuenta no se usa cupón → 401', r.status === 401, String(r.status));
    r = await order('jerry', 2, 'NOEXISTE');
    ok('cupón inexistente → 400', r.status === 400, String(r.status));
    r = await order('jerry', 2, 'cztest10');
    orders.push(r.j.order?.id);
    ok('pedido con cupón: total con descuento calculado en el servidor', r.status === 200 && r.j.order.total === 18000 && r.j.order.discountClp === 2000 && r.j.order.couponCode === 'CZTEST10', JSON.stringify({ total: r.j.order?.total, d: r.j.order?.discountClp }));
    r = await order('jerry', 2, 'CZTEST10');
    ok('la misma persona no lo usa dos veces → 400', r.status === 400 && /Ya usaste/.test(r.j.message), JSON.stringify(r.j));
    await call('POST', '/orders/mine/' + orders[0] + '/status', 'seller', { status: 'rejected' }, ip());
    r = await order('jerry', 2, 'CZTEST10');
    orders.push(r.j.order?.id);
    ok('si el pedido se rechaza, el uso se libera', r.status === 200 && r.j.order.discountClp === 2000, String(r.status));
    r = await order('ale', 2, 'CZTEST10');
    orders.push(r.j.order?.id);
    ok('segunda persona lo usa (2 de 2)', r.status === 200, String(r.status));
    r = await order('ignacio', 2, 'CZTEST10');
    ok('sin usos disponibles → 400', r.status === 400 && /usos/.test(r.j.message), JSON.stringify(r.j));
    r = await call('PUT', '/stores/me/coupons/' + couponId, 'jerry', { active: false }, ip());
    ok('otra cuenta no pausa el cupón → 404', r.status === 404, String(r.status));
    r = await call('PUT', '/stores/me/coupons/' + couponId, 'seller', { active: false }, ip());
    ok('la tienda pausa el cupón', r.status === 200 && r.j.active === false);
    r = await call('GET', '/stores/me/coupons', 'seller', null, ip());
    ok('la tienda ve sus cupones con usos', r.j.coupons?.find((c) => c.id === couponId)?.uses === 2, JSON.stringify(r.j.coupons?.map((c) => c.uses)));

    // Demanda
    r = await call('GET', '/stores/me/demand', 'seller', null, ip());
    ok('demanda: solo conteos, sin usuarios', r.status === 200 && Array.isArray(r.j.demand) && !JSON.stringify(r.j).includes('cztest_'), String(r.status));
    r = await call('GET', '/stores/me/demand', 'jerry', null, ip());
    ok('sin plan no ve la demanda → 403', r.status === 403, String(r.status));

    r = await call('DELETE', '/stores/' + NAMES.seller + '/follow', 'jerry', null, ip());
    ok('dejar de seguir', r.status === 200 && (await prisma.storeFollow.count({ where: { storeId: seller } })) === 0);
  } finally {
    const ids = orders.filter(Boolean);
    await prisma.storeCouponUse.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.message.deleteMany({ where: { receiverId: seller, content: { contains: 'CZTEST10' } } });
    await prisma.storeCoupon.deleteMany({ where: { storeId: seller } });
    await prisma.storeFollow.deleteMany({ where: { storeId: seller } });
    await prisma.storeProfile.deleteMany({ where: { userId: seller } });
    await prisma.card.update({ where: { id: cardId }, data: { stock: card.stock, price: card.price } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
