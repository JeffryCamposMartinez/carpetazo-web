// Planes: catálogo público, selección local y cuotas atómicas de carpetas, cartas, idioma y copias.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    let r = await call('GET', '/plans');
    const byKey = Object.fromEntries((r.j?.plans || []).map((plan) => [plan.key, plan]));
    ok('catálogo público de cinco planes', r.status === 200 && Object.keys(byKey).length === 5);
    ok('Free y Entusiasta tienen 54 cartas', byKey.free?.uniqueCardsPerFolder === 54 && byKey.enthusiast?.uniqueCardsPerFolder === 54);
    ok('los planes tienen 1, 3, 8 y 20 carpetas', byKey.free?.folders === 1 && byKey.enthusiast?.folders === 3 && byKey.premium?.folders === 8 && byKey.pro?.folders === 20);
    ok('Premium tiene 72 cartas y Pro cuesta $4.990', byKey.premium?.uniqueCardsPerFolder === 72 && byKey.premium?.priceClp === 2990 && byKey.pro?.priceClp === 4990);
    ok('Tienda es ilimitado', byKey.store?.folders === null && byKey.store?.copiesPerCard === null);

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'free' });
    ok('activar Free en modo local', r.status === 200 && r.j.plan?.key === 'free', JSON.stringify(r.j));
    const mkFolder = (name, tcg) => call('POST', '/folders', 'nobuyer', { name, tcg, color: 'blue', isPublic: false });
    const pokemon = await mkFolder('TEST Free Pokemon', 'Pokemon');
    ok('Free crea primera carpeta Pokemon', pokemon.status === 200, JSON.stringify(pokemon.j));
    r = await mkFolder('TEST Free Pokemon 2', 'Pokemon');
    ok('Free bloquea una segunda carpeta', r.status === 409 && r.j.code === 'plan_folder_limit', JSON.stringify(r.j));

    const fid = pokemon.j.folder.id;
    const userId = (await prisma.user.findUnique({ where: { firebaseUid: 'cztest-nobuyer' }, select: { id: true } })).id;
    await prisma.card.createMany({ data: Array.from({ length: 53 }, (_, index) => ({ folderId: fid, tcgId: `plan-seed-${index}`, name: `Carta ${index}`, stock: 1, language: 'English', data: { language: 'English' } })) });
    const add = (folderId, tcgId, stock = 1, language = 'English') => call('POST', `/folders/${folderId}/cards`, 'nobuyer', { tcgId, name: tcgId, price: 100, stock, data: { language } });
    r = await add(fid, 'plan-last');
    ok('Free permite la carta única 54', r.status === 200, JSON.stringify(r.j));
    const lastCardId = r.j.card.id;
    r = await add(fid, 'plan-over');
    ok('Free bloquea la carta única 55', r.status === 409 && r.j.code === 'plan_unique_card_limit', JSON.stringify(r.j));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 25 });
    ok('Free permite 25 copias', r.status === 200 && r.j.card.stock === 25, JSON.stringify(r.j));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 26 });
    ok('Free bloquea 26 copias', r.status === 409 && r.j.code === 'plan_copy_limit', JSON.stringify(r.j));

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'enthusiast' });
    ok('activar Entusiasta', r.status === 200 && r.j.plan?.folders === 3 && r.j.plan?.foldersPerTcg === 2);
    r = await mkFolder('TEST Entusiasta Pokemon 2', 'Pokemon');
    ok('Entusiasta permite segunda carpeta del mismo TCG', r.status === 200, JSON.stringify(r.j));
    r = await mkFolder('TEST Entusiasta Pokemon 3', 'Pokemon');
    ok('Entusiasta bloquea una tercera carpeta del mismo TCG', r.status === 409 && r.j.code === 'plan_tcg_folder_limit', JSON.stringify(r.j));
    const magic = await mkFolder('TEST Entusiasta Magic', 'Magic');
    ok('Entusiasta permite tres carpetas totales', magic.status === 200, JSON.stringify(magic.j));
    r = await mkFolder('TEST Entusiasta One Piece', 'OnePiece');
    ok('Entusiasta bloquea la cuarta carpeta total', r.status === 409 && r.j.code === 'plan_folder_limit', JSON.stringify(r.j));

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'premium' });
    ok('activar Premium con 8 carpetas y 72/50', r.status === 200 && r.j.plan?.folders === 8 && r.j.plan?.uniqueCardsPerFolder === 72 && r.j.plan?.copiesPerCard === 50);
    const publicProfile = await call('GET', '/users/cztest_nobuyer');
    ok('el perfil público muestra la insignia Premium sin datos de cobro', publicProfile.status === 200 && publicProfile.j.user?.planBadge?.key === 'premium' && !/subscription|grant|priceClp/i.test(JSON.stringify(publicProfile.j.user)));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 50 });
    ok('Premium permite 50 copias', r.status === 200 && r.j.card.stock === 50, JSON.stringify(r.j));

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'pro' });
    ok('activar Pro con 20 carpetas por $4.990', r.status === 200 && r.j.plan?.folders === 20 && r.j.plan?.priceClp === 4990);

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'store' });
    ok('activar Tienda ilimitado', r.status === 200 && r.j.plan?.folders === null && r.j.plan?.copiesPerCard === null);
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 1000 });
    ok('Tienda permite stock comercialmente ilimitado', r.status === 200 && r.j.card.stock === 1000, JSON.stringify(r.j));
    await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'free' });
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 900 });
    ok('al bajar de plan se puede reducir contenido excedido', r.status === 200 && r.j.card.stock === 900, JSON.stringify(r.j));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 901 });
    ok('al bajar de plan no se puede aumentar sobre el tope', r.status === 409 && r.j.code === 'plan_copy_limit', JSON.stringify(r.j));

    const languageFolder = magic.j.folder.id;
    const english = await add(languageFolder, 'same-card', 1, 'English');
    const spanish = await add(languageFolder, 'same-card', 1, 'Spanish');
    ok('idiomas distintos se guardan como cartas separadas', english.status === 200 && spanish.status === 200 && english.j.card.id !== spanish.j.card.id);
    r = await add(languageFolder, 'invalid-language', 1, 'Klingon');
    ok('un idioma fuera del catálogo se rechaza', r.status === 400);
    r = await add(languageFolder, 'same-card', 1, 'English');
    ok('misma carta e idioma se rechaza como duplicado', r.status === 409 && r.j.code === 'card_identity_conflict', JSON.stringify(r.j));

    const state = await call('GET', '/billing/me', 'nobuyer');
    ok('estado propio incluye uso sin secretos', state.status === 200 && state.j.usage?.folders >= 2 && !/access.token|webhook.secret/i.test(JSON.stringify(state.j)));
    ok('las concesiones pertenecen al usuario de prueba', (await prisma.planGrant.count({ where: { userId } })) >= 2);

    await prisma.planGrant.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    const overdue = await prisma.subscription.create({ data: { userId, planKey: 'premium', status: 'past_due', priceClp: 2990, currentPeriodEnd: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('una mora vencida vuelve a Free', r.status === 200 && r.j.plan?.key === 'free' && r.j.source === 'default');
    await prisma.subscription.update({ where: { id: overdue.id }, data: { currentPeriodEnd: new Date() } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('la mora conserva siete días de gracia', r.status === 200 && r.j.plan?.key === 'premium' && r.j.subscription?.graceUntil);
    r = await call('POST', '/billing/checkout', 'nobuyer', { planKey: 'pro' });
    ok('no se crean dos suscripciones simultáneas', r.status === 409 && r.j.code === 'subscription_exists');
  } finally {
    await prisma.$disconnect();
  }
})();
