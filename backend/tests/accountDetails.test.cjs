// Ficha completa de una cuenta en Moderación: detalle, edición de datos y de planes, cancelación y aviso personalizado a la persona.
const { prisma, call, ok } = require('./fixtures.cjs');

const MP = `http://127.0.0.1:${process.env.CZ_MP_PORT || '8991'}`;
const DAY = 24 * 60 * 60 * 1000;
const U = 'cztest_nobuyer';

(async () => {
  const user = await prisma.user.findUnique({ where: { username: U } });
  const admin = await prisma.user.findUnique({ where: { username: 'cztest_admin' } });
  const textOf = (message) => JSON.parse(message.content).text;
  // Se filtra por el texto de cada prueba: otros avisos del equipo a la misma cuenta (de pruebas anteriores) no cuentan
  const noticesFor = async (since, marker) => (await prisma.message.findMany({ where: { receiverId: user.id, senderId: admin.id, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } })).filter((message) => marker.test(textOf(message)));
  try {
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.planGrant.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    let r;

    // ----- Permisos y contenido de la ficha -----
    r = await call('GET', `/admin/users/${U}/details`, 'jerry');
    ok('una persona sin rol de equipo no ve la ficha → 403', r.status === 403, String(r.status));
    r = await call('GET', `/admin/users/${U}/details`, 'ale');
    ok('quien no es administrador no ve la ficha completa', r.status === 403, String(r.status));
    r = await call('GET', `/admin/users/${U}/details`, 'admin');
    const text = JSON.stringify(r.j);
    ok('la ficha trae cuenta, actividad, plan, concesiones, suscripciones e historial', r.status === 200 && r.j.account?.email && r.j.activity && r.j.plan?.key && Array.isArray(r.j.grants) && Array.isArray(r.j.subscriptions) && Array.isArray(r.j.history), JSON.stringify(Object.keys(r.j)));
    ok('la ficha no expone datos sensibles (firebaseUid, RUT, banco, direcciones)', !/firebaseUid|bankDetails|"rut"|addresses|cztest-nobuyer"/.test(text), text.slice(0, 120));
    r = await call('GET', '/admin/users/nadie_existe_xyz/details', 'admin');
    ok('persona inexistente → 404', r.status === 404, String(r.status));

    // ----- Asignar plan con fecha de inicio, mensaje personalizado y aviso -----
    let since = new Date(Date.now() - 1000);
    r = await call('POST', `/admin/users/${U}/plan`, 'admin', { planKey: 'premium', reason: 'regalo por ayudar a probar', days: 30, message: 'Gracias por probar la plataforma' });
    let notices = await noticesFor(since, /Gracias por probar/);
    ok('asignar un plan avisa a la persona con el mensaje personalizado', r.status === 200 && r.j.notified?.chat === true && notices.length === 1 && /Premium/.test(textOf(notices[0])) && /Gracias por probar la plataforma/.test(textOf(notices[0])), JSON.stringify(r.j.notified));
    const beforeSilent = (await noticesFor(new Date(0), /Tu plan ahora es Pro/)).length;
    r = await call('POST', `/admin/users/${U}/plan`, 'admin', { planKey: 'pro', reason: 'cambio silencioso', days: 5, notify: false });
    ok('con «no avisar» no se envía el mensaje', r.status === 200 && r.j.notified === null && (await noticesFor(new Date(0), /Tu plan ahora es Pro/)).length === beforeSilent);
    r = await call('POST', `/admin/users/${U}/plan`, 'admin', { planKey: 'premium', reason: 'mensaje largo', message: 'x'.repeat(601) });
    ok('un mensaje de más de 600 caracteres se rechaza → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/users/${U}/plan`, 'admin', { planKey: 'premium', reason: 'mensaje engañoso', message: 'hola‮atrás' });
    ok('un mensaje con caracteres de dirección de texto se rechaza → 400', r.status === 400, String(r.status));
    const future = new Date(Date.now() + 10 * DAY);
    r = await call('POST', `/admin/users/${U}/plan`, 'admin', { planKey: 'store', reason: 'plan con inicio futuro', days: 20, startsAt: future.toISOString(), notify: false });
    const futureGrant = await prisma.planGrant.findFirst({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    ok('el plan puede empezar en una fecha futura y dura desde ahí', r.status === 200 && Math.abs(futureGrant.startsAt - future) < 2000 && Math.abs(futureGrant.endsAt - (future.getTime() + 20 * DAY)) < 2000, JSON.stringify({ s: futureGrant.startsAt, e: futureGrant.endsAt }));
    r = await call('POST', `/admin/users/${U}/plan`, 'admin', { planKey: 'store', reason: 'inicio inválido', startsAt: 'no-es-fecha' });
    ok('una fecha de inicio inválida → 400', r.status === 400, String(r.status));

    // ----- Editar la concesión: plan, inicio y término -----
    r = await call('PUT', `/admin/users/${U}/grants/${futureGrant.id}`, 'admin', { endsAt: new Date(Date.now() - DAY).toISOString(), reason: 'término antes del inicio' });
    ok('término anterior al inicio → 400', r.status === 400, String(r.status));
    r = await call('PUT', `/admin/users/${U}/grants/${futureGrant.id}`, 'admin', { planKey: 'free', reason: 'plan free no vale' });
    ok('no se edita una concesión a «Free» → 400', r.status === 400, String(r.status));
    r = await call('PUT', `/admin/users/${U}/grants/${futureGrant.id}`, 'jerry', { endsAt: null, reason: 'sin permiso para editar' });
    ok('sin permisos no edita concesiones → 403', r.status === 403, String(r.status));
    const otherGrant = await prisma.planGrant.findFirst({ where: { userId: { not: user.id } } });
    r = await call('PUT', `/admin/users/${U}/grants/${otherGrant.id}`, 'admin', { endsAt: null, reason: 'concesión de otra persona' });
    ok('la concesión de otra persona no se edita desde esta ficha → 404', r.status === 404, String(r.status));
    since = new Date();
    const start = new Date(Date.now() - DAY);
    const end = new Date(Date.now() + 90 * DAY);
    r = await call('PUT', `/admin/users/${U}/grants/${futureGrant.id}`, 'admin', { planKey: 'pro', startsAt: start.toISOString(), endsAt: end.toISOString(), reason: 'ajuste de fechas acordado', message: 'Extendimos tu plan por tu ayuda' });
    const edited = await prisma.planGrant.findUnique({ where: { id: futureGrant.id } });
    notices = await noticesFor(since, /Extendimos tu plan/);
    ok('editar la concesión cambia plan, inicio y término y avisa', r.status === 200 && edited.planKey === 'pro' && Math.abs(edited.endsAt - end) < 2000 && Math.abs(edited.startsAt - start) < 2000 && r.j.plan?.key === 'pro' && notices.length === 1 && /Extendimos tu plan/.test(textOf(notices[0])), JSON.stringify({ k: edited.planKey, n: notices.length }));
    r = await call('PUT', `/admin/users/${U}/grants/${futureGrant.id}`, 'admin', { endsAt: null, reason: 'sin fecha de término' });
    ok('se puede quitar la fecha de término', r.status === 200 && (await prisma.planGrant.findUnique({ where: { id: futureGrant.id } })).endsAt === null);
    const audit = await prisma.moderationAudit.count({ where: { targetId: user.id, action: 'plan.grant_edited' } });
    ok('cada edición de concesión queda en la auditoría', audit === 2, String(audit));

    // ----- Editar datos de la cuenta -----
    r = await call('PUT', `/admin/users/${U}/profile`, 'admin', { name: 'Nombre Nuevo', reason: 'x' });
    ok('editar datos sin motivo suficiente → 400', r.status === 400, String(r.status));
    r = await call('PUT', `/admin/users/${U}/profile`, 'admin', { username: 'cztest_seller', reason: 'usuario repetido' });
    ok('un usuario ya usado → 409', r.status === 409, String(r.status));
    r = await call('PUT', `/admin/users/${U}/profile`, 'admin', { username: 'admin', reason: 'usuario reservado' });
    ok('un usuario reservado → 400', r.status === 400, String(r.status));
    r = await call('PUT', `/admin/users/${U}/profile`, 'admin', { name: 'abc​def', reason: 'nombre con caracteres ocultos' });
    ok('un nombre con caracteres ocultos → 400', r.status === 400, String(r.status));
    r = await call('PUT', `/admin/users/${U}/profile`, 'admin', { reason: 'sin cambios que guardar' });
    ok('sin cambios → 400', r.status === 400, String(r.status));
    r = await call('PUT', `/admin/users/${U}/profile`, 'jerry', { name: 'Intruso Total', reason: 'sin permiso para editar' });
    ok('sin permisos no edita datos → 403', r.status === 403, String(r.status));
    since = new Date();
    r = await call('PUT', `/admin/users/${U}/profile`, 'admin', { name: 'Nombre Corregido', bio: 'Coleccionista de cartas', reason: 'corrección pedida por la persona', message: 'Corregimos tu nombre como pediste' });
    const edit = await prisma.user.findUnique({ where: { id: user.id } });
    notices = await noticesFor(since, /Corregimos tu nombre/);
    ok('editar nombre y presentación los guarda, avisa y deja auditoría', r.status === 200 && edit.name === 'Nombre Corregido' && edit.bio === 'Coleccionista de cartas' && notices.length === 1 && /Corregimos tu nombre/.test(textOf(notices[0])) && (await prisma.moderationAudit.count({ where: { targetId: user.id, action: 'user.profile_edited' } })) === 1, JSON.stringify(r.j));

    // ----- Cancelar la suscripción de otra persona -----
    await prisma.planGrant.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    r = await call('POST', `/admin/users/${U}/subscription/cancel`, 'admin', { reason: 'sin suscripción activa' });
    ok('sin suscripción activa → 404', r.status === 404, String(r.status));
    const sub = await prisma.subscription.create({ data: { userId: user.id, planKey: 'enthusiast', status: 'active', priceClp: 990, providerSubscriptionId: 'cz-staff-' + Math.random().toString(36).slice(2, 8), currentPeriodEnd: new Date(Date.now() + 15 * DAY), nextPaymentAt: new Date(Date.now() + 15 * DAY) } });
    r = await call('POST', `/admin/users/${U}/subscription/cancel`, 'jerry', { reason: 'sin permiso para cancelar' });
    ok('sin permisos no cancela suscripciones ajenas → 403', r.status === 403, String(r.status));
    since = new Date();
    r = await call('POST', `/admin/users/${U}/subscription/cancel`, 'admin', { reason: 'pedido de la persona por soporte', message: 'Cancelamos como nos pediste' });
    const canceled = await prisma.subscription.findUnique({ where: { id: sub.id } });
    const mpLog = await (await fetch(`${MP}/__log`)).json();
    notices = await noticesFor(since, /Cancelamos como nos pediste/);
    ok('el equipo cancela la suscripción: corta el cobro, conserva lo pagado y avisa', r.status === 200 && canceled.cancelAtPeriodEnd === true && canceled.status === 'active' && r.j.endsAt && mpLog.some((e) => e.method === 'PUT' && e.path.endsWith(sub.providerSubscriptionId) && e.body.status === 'cancelled') && notices.length === 1 && /Cancelamos como nos pediste/.test(textOf(notices[0])), JSON.stringify({ c: canceled.cancelAtPeriodEnd, n: notices.length }));

    // ----- Aviso suelto -----
    r = await call('POST', `/admin/users/${U}/notify`, 'admin', { message: 'hola' });
    ok('un aviso vacío o muy corto → 400', r.status === 400, String(r.status));
    since = new Date();
    r = await call('POST', `/admin/users/${U}/notify`, 'admin', { message: 'Hola, revisa tu perfil público por favor' });
    notices = await noticesFor(since, /revisa tu perfil público/);
    ok('un aviso suelto llega a la persona', r.status === 200 && r.j.notified?.chat === true && notices.length === 1 && /revisa tu perfil público/.test(textOf(notices[0])), JSON.stringify(r.j));
    r = await call('POST', `/admin/users/${U}/notify`, 'jerry', { message: 'Intento sin permiso de aviso' });
    ok('sin permisos no envía avisos → 403', r.status === 403, String(r.status));

    // ----- Cambio de rol con mensaje -----
    since = new Date();
    r = await call('POST', `/admin/users/${U}/role`, 'admin', { role: 'support', message: 'Bienvenida al equipo de soporte' });
    notices = await noticesFor(since, /Bienvenida al equipo/);
    ok('cambiar el rol avisa a la persona con el mensaje', r.status === 200 && notices.length === 1 && /Bienvenida al equipo/.test(textOf(notices[0])) && /Soporte/.test(textOf(notices[0])), JSON.stringify(r.j));
    await call('POST', `/admin/users/${U}/role`, 'admin', { role: 'user', notify: false });

    // ----- La ficha refleja todo -----
    r = await call('GET', `/admin/users/${U}/details`, 'admin');
    ok('la ficha muestra las concesiones, la suscripción cancelada y el historial con quién actuó', r.j.grants?.length >= 3 && r.j.subscriptions?.some((row) => row.cancelAtPeriodEnd) && r.j.history?.some((row) => row.by && /plan\.|user\.|subscription\./.test(row.action)), JSON.stringify({ g: r.j.grants?.length, h: r.j.history?.length }));
  } finally {
    await prisma.subscription.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
