// Planes: catálogo público, selección local y cuotas atómicas de carpetas, cartas, idioma y copias.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    let r = await call('GET', '/plans');
    const byKey = Object.fromEntries((r.j?.plans || []).map((plan) => [plan.key, plan]));
    ok('catálogo público de cinco planes', r.status === 200 && Object.keys(byKey).length === 5);
    ok('Free tiene 45 cartas y Entusiasta 54', byKey.free?.uniqueCardsPerFolder === 45 && byKey.enthusiast?.uniqueCardsPerFolder === 54);
    ok('copias por carta: 10, 20, 40, 80 e ilimitadas', byKey.free?.copiesPerCard === 10 && byKey.enthusiast?.copiesPerCard === 20 && byKey.premium?.copiesPerCard === 40 && byKey.pro?.copiesPerCard === 80 && byKey.store?.copiesPerCard === null);
    ok('los planes tienen 1, 3, 8 y 20 carpetas', byKey.free?.folders === 1 && byKey.enthusiast?.folders === 3 && byKey.premium?.folders === 8 && byKey.pro?.folders === 20);
    ok('Premium cuesta $1.990 y Pro $3.990', byKey.premium?.uniqueCardsPerFolder === 72 && byKey.premium?.priceClp === 1990 && byKey.pro?.priceClp === 3990);
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
    await prisma.card.createMany({ data: Array.from({ length: 44 }, (_, index) => ({ folderId: fid, tcgId: `plan-seed-${index}`, name: `Carta ${index}`, stock: 1, language: 'English', data: { language: 'English' } })) });
    const add = (folderId, tcgId, stock = 1, language = 'English') => call('POST', `/folders/${folderId}/cards`, 'nobuyer', { tcgId, name: tcgId, price: 100, stock, data: { language } });
    r = await add(fid, 'plan-last');
    ok('Free permite la carta única 45', r.status === 200, JSON.stringify(r.j));
    const lastCardId = r.j.card.id;
    r = await add(fid, 'plan-over');
    ok('Free bloquea la carta única 46', r.status === 409 && r.j.code === 'plan_unique_card_limit', JSON.stringify(r.j));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 10 });
    ok('Común permite 10 copias', r.status === 200 && r.j.card.stock === 10, JSON.stringify(r.j));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 11 });
    ok('Común bloquea 11 copias', r.status === 409 && r.j.code === 'plan_copy_limit', JSON.stringify(r.j));

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'enthusiast' });
    ok('activar Entusiasta', r.status === 200 && r.j.plan?.folders === 3 && !('foldersPerTcg' in r.j.plan));
    r = await mkFolder('TEST Entusiasta Pokemon 2', 'Pokemon');
    ok('Entusiasta permite una segunda carpeta del mismo TCG', r.status === 200, JSON.stringify(r.j));
    const third = await mkFolder('TEST Entusiasta Pokemon 3', 'Pokemon');
    ok('Entusiasta permite tres carpetas totales aunque sean del mismo TCG (sin límite por TCG)', third.status === 200, JSON.stringify(third.j));
    r = await mkFolder('TEST Entusiasta One Piece', 'OnePiece');
    ok('Entusiasta bloquea la cuarta carpeta total', r.status === 409 && r.j.code === 'plan_folder_limit', JSON.stringify(r.j));

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'premium' });
    ok('activar Premium con 8 carpetas y 72/40', r.status === 200 && r.j.plan?.folders === 8 && r.j.plan?.uniqueCardsPerFolder === 72 && r.j.plan?.copiesPerCard === 40);
    const publicProfile = await call('GET', '/users/cztest_nobuyer');
    ok('el perfil público muestra la insignia Premium sin datos de cobro', publicProfile.status === 200 && publicProfile.j.user?.planBadge?.key === 'premium' && !/subscription|grant|priceClp/i.test(JSON.stringify(publicProfile.j.user)));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 40 });
    ok('Épico permite 40 copias', r.status === 200 && r.j.card.stock === 40, JSON.stringify(r.j));

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'pro' });
    ok('activar Legendario con 20 carpetas, 80 copias y $3.990', r.status === 200 && r.j.plan?.folders === 20 && r.j.plan?.copiesPerCard === 80 && r.j.plan?.priceClp === 3990);

    r = await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'store' });
    ok('activar Tienda ilimitado', r.status === 200 && r.j.plan?.folders === null && r.j.plan?.copiesPerCard === null);
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 1000 });
    ok('Tienda permite stock comercialmente ilimitado', r.status === 200 && r.j.card.stock === 1000, JSON.stringify(r.j));
    await call('POST', '/billing/test-plan', 'nobuyer', { planKey: 'free' });
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 900 });
    ok('al bajar de plan se puede reducir contenido excedido', r.status === 200 && r.j.card.stock === 900, JSON.stringify(r.j));
    r = await call('PUT', `/folders/${fid}/cards/${lastCardId}`, 'nobuyer', { stock: 901 });
    ok('al bajar de plan no se puede aumentar sobre el tope', r.status === 409 && r.j.code === 'plan_copy_limit', JSON.stringify(r.j));

    const languageFolder = third.j.folder.id;
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
    const overdue = await prisma.subscription.create({ data: { userId, planKey: 'premium', status: 'past_due', priceClp: 1990, currentPeriodEnd: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('una mora vencida vuelve a Free', r.status === 200 && r.j.plan?.key === 'free' && r.j.source === 'default');
    await prisma.subscription.update({ where: { id: overdue.id }, data: { currentPeriodEnd: new Date() } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('la mora conserva siete días de gracia', r.status === 200 && r.j.plan?.key === 'premium' && r.j.subscription?.graceUntil);
    r = await call('POST', '/billing/checkout', 'nobuyer', { planKey: 'pro' });
    ok('no se crean dos suscripciones simultáneas', r.status === 409 && r.j.code === 'subscription_exists');

    // Cambio de plan desde Moderación
    const target = 'cztest_nobuyer';
    r = await call('POST', `/admin/users/${target}/plan`, 'seller', { planKey: 'pro', reason: 'prueba sin permiso' });
    ok('un usuario sin rol de equipo no puede cambiar planes', r.status === 403 || r.status === 401, String(r.status));
    r = await call('POST', `/admin/users/${target}/plan`, 'admin', { planKey: 'oro', reason: 'plan inventado' });
    ok('el administrador no puede asignar un plan inexistente', r.status === 400);
    r = await call('POST', `/admin/users/${target}/plan`, 'admin', { planKey: 'pro', reason: 'no' });
    ok('el motivo es obligatorio (mínimo 5 caracteres)', r.status === 400);
    r = await call('POST', `/admin/users/${target}/plan`, 'admin', { planKey: 'pro', reason: 'cuenta antigua con varias carpetas', days: 0 });
    ok('los días deben ser válidos', r.status === 400);
    r = await call('POST', `/admin/users/nadie_existe_xyz/plan`, 'admin', { planKey: 'pro', reason: 'persona inexistente' });
    ok('persona inexistente da 404', r.status === 404);
    r = await call('POST', `/admin/users/${target}/plan`, 'admin', { planKey: 'pro', reason: 'cuenta antigua con varias carpetas', days: 30 });
    ok('el administrador asigna Pro por 30 días', r.status === 200 && r.j.plan?.key === 'pro' && r.j.source === 'grant' && r.j.grant?.endsAt, JSON.stringify(r.j).slice(0, 200));
    r = await call('GET', `/billing/me`, 'nobuyer');
    ok('la persona ve de inmediato su nuevo plan', r.status === 200 && r.j.plan?.key === 'pro');
    r = await call('GET', `/admin/users/${target}/plan`, 'admin');
    ok('la ficha lista las concesiones', r.status === 200 && r.j.grants?.length >= 1 && r.j.plan?.key === 'pro');
    r = await call('POST', `/admin/users/${target}/plan`, 'admin', { planKey: 'auto', reason: 'vuelve a su suscripción' });
    ok('quitar el plan asignado vuelve al plan automático', r.status === 200 && r.j.source !== 'grant');
    const audits = await prisma.moderationAudit.count({ where: { targetId: userId, action: { in: ['plan.granted', 'plan.revoked'] } } });
    ok('cada cambio de plan queda en la auditoría con quién lo hizo', audits === 2 && (await prisma.moderationAudit.count({ where: { targetId: userId, action: { startsWith: 'plan.' }, actorId: null } })) === 0);
  } finally {
    await prisma.$disconnect();
  }
})();
