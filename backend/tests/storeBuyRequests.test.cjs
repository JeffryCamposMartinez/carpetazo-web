// «Vende tu colección»: solo a tiendas con plan; cada parte solo hace sus cambios; estados en orden; nada ajeno se ve.
const { prisma, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.73.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());
const list = { game: 'Pokémon', items: [{ name: 'Charizard ex', quantity: 1, condition: 'NM' }, { name: 'Pikachu', quantity: 4 }], note: 'Todas en fundas' };

(async () => {
  const restorePlans = await snapshotPlans(['nobuyer', 'ignacio']);
  const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
  const store = await id('nobuyer');
  try {
    await prisma.storeBuyRequest.deleteMany({ where: { storeId: store } });
    let r;
    await plan('nobuyer', 'free');
    r = await call('POST', '/stores/' + NAMES.nobuyer + '/buy-requests', 'ignacio', list, ip());
    ok('no se envía a una cuenta sin plan Tienda → 404', r.status === 404, String(r.status));
    await plan('nobuyer', 'store');
    r = await call('POST', '/stores/' + NAMES.nobuyer + '/buy-requests', 'nobuyer', list, ip());
    ok('la tienda no se envía a sí misma → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/' + NAMES.nobuyer + '/buy-requests', 'ignacio', { items: [] }, ip());
    ok('lista vacía → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/' + NAMES.nobuyer + '/buy-requests', 'ignacio', list, ip());
    ok('una persona envía su colección', r.status === 200 && r.j.request.status === 'pending', JSON.stringify(r.j));
    const reqId = r.j.request.id;

    r = await call('GET', '/stores/me/buy-requests', 'nobuyer', null, ip());
    const got = r.j.requests?.find((x) => x.id === reqId);
    ok('la tienda la ve con nombre y usuario (sin correo)', r.status === 200 && got?.seller?.username === NAMES.ignacio && !JSON.stringify(got).includes('@test'), JSON.stringify(got?.seller));
    r = await call('GET', '/stores/me/buy-requests', 'jerry', null, ip());
    ok('otra cuenta no ve solicitudes ajenas', r.status === 200 && !r.j.requests.some((x) => x.id === reqId));

    r = await call('POST', '/buy-requests/' + reqId + '/accept', 'ignacio', {}, ip());
    ok('no se acepta sin oferta → 409', r.status === 409, String(r.status));
    r = await call('POST', '/stores/me/buy-requests/' + reqId + '/offer', 'jerry', { offerClp: 1000 }, ip());
    ok('otra cuenta no oferta → 404', r.status === 404, String(r.status));
    r = await call('POST', '/stores/me/buy-requests/' + reqId + '/offer', 'nobuyer', { offerClp: -5 }, ip());
    ok('oferta negativa → 400', r.status === 400, String(r.status));
    r = await call('POST', '/stores/me/buy-requests/' + reqId + '/offer', 'nobuyer', { offerClp: 45000, offerNote: 'Pago por transferencia' }, ip());
    ok('la tienda oferta', r.status === 200 && r.j.request.status === 'offered' && r.j.request.offerClp === 45000, JSON.stringify(r.j));
    r = await call('POST', '/buy-requests/' + reqId + '/accept', 'nobuyer', {}, ip());
    ok('la tienda no acepta su propia oferta → 404', r.status === 404, String(r.status));
    r = await call('GET', '/buy-requests/mine', 'ignacio', null, ip());
    ok('la persona ve la oferta en sus solicitudes', r.j.requests?.find((x) => x.id === reqId)?.offerClp === 45000);
    r = await call('POST', '/buy-requests/' + reqId + '/accept', 'ignacio', {}, ip());
    ok('la persona acepta', r.status === 200 && r.j.request.status === 'accepted', JSON.stringify(r.j));
    r = await call('POST', '/buy-requests/' + reqId + '/cancel', 'ignacio', {}, ip());
    ok('una aceptada no se cancela → 409', r.status === 409, String(r.status));
    r = await call('POST', '/stores/me/buy-requests/' + reqId + '/offer', 'nobuyer', { offerClp: 1 }, ip());
    ok('una aceptada no se vuelve a ofertar → 409', r.status === 409, String(r.status));

    for (let i = 0; i < 3; i++) await call('POST', '/stores/' + NAMES.nobuyer + '/buy-requests', 'ignacio', list, ip());
    r = await call('POST', '/stores/' + NAMES.nobuyer + '/buy-requests', 'ignacio', list, ip());
    ok('máximo 3 solicitudes abiertas por tienda → 400', r.status === 400, String(r.status));
  } finally {
    await prisma.storeBuyRequest.deleteMany({ where: { storeId: store } });
    await restorePlans();
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
