// Suscripciones: cancelar con confirmación y conservando lo pagado, cambiar de plan sin pagar dos veces, y el aviso de Mercado Pago (simulado en tests/run.cjs).
const { prisma, call, ok, B } = require('./fixtures.cjs');

const MP = `http://127.0.0.1:${process.env.CZ_MP_PORT || '8991'}`;
const DAY = 24 * 60 * 60 * 1000;
const mpLog = async () => (await fetch(`${MP}/__log`)).json();
const mpSet = (id, state) => fetch(`${MP}/__set/${id}`, { method: 'POST', body: JSON.stringify(state) });
// El aviso de Mercado Pago sin firma solo se acepta en modo de prueba local, con esta cabecera
const webhook = (id) => fetch(`${B}/billing/mercadopago/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-billing-test': '1' }, body: JSON.stringify({ type: 'subscription_preapproval', data: { id }, id: `evt-${id}-${Date.now()}-${Math.random()}` }) });

(async () => {
  const userId = (await prisma.user.findUnique({ where: { firebaseUid: 'cztest-nobuyer' }, select: { id: true } })).id;
  const reset = async () => {
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.planGrant.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  };
  const sub = (data) => prisma.subscription.create({ data: { userId, planKey: 'enthusiast', status: 'active', priceClp: 990, providerSubscriptionId: 'cz-pre-' + Math.random().toString(36).slice(2, 10), currentPeriodEnd: new Date(Date.now() + 20 * DAY), nextPaymentAt: new Date(Date.now() + 20 * DAY), ...data } });
  try {
    await reset();
    let r;

    // ----- Cancelar -----
    let s1 = await sub();
    r = await call('POST', '/billing/cancel', 'nobuyer', {});
    ok('cancelar sin confirmar → 400 y la suscripción sigue', r.status === 400 && r.j.code === 'confirm_required' && (await prisma.subscription.findUnique({ where: { id: s1.id } })).status === 'active', JSON.stringify(r.j));
    r = await call('POST', '/billing/cancel', 'jerry', { confirm: true });
    ok('otra persona no cancela mi suscripción (no tiene ninguna) → 404', r.status === 404, String(r.status));
    r = await call('POST', '/billing/cancel', 'nobuyer', { confirm: 'true' });
    ok('la confirmación debe ser exactamente true', r.status === 400, String(r.status));
    r = await call('POST', '/billing/cancel', 'nobuyer', { confirm: true });
    const after = await prisma.subscription.findUnique({ where: { id: s1.id } });
    ok('cancelar corta el cobro en Mercado Pago', (await mpLog()).some((e) => e.method === 'PUT' && e.path === `/preapproval/${s1.providerSubscriptionId}` && e.body.status === 'cancelled'));
    ok('cancelar conserva el plan hasta el fin del período pagado', r.status === 200 && after.status === 'active' && after.cancelAtPeriodEnd === true && r.j.plan?.key === 'enthusiast' && r.j.endsAt, JSON.stringify(r.j).slice(0, 160));
    r = await call('POST', '/billing/cancel', 'nobuyer', { confirm: true });
    ok('cancelar dos veces no hace nada más → 404', r.status === 404, String(r.status));
    r = await call('POST', '/billing/change-plan', 'nobuyer', { planKey: 'pro' });
    ok('una suscripción ya cancelada no se puede cambiar de plan → 409', r.status === 409, String(r.status));
    await prisma.subscription.update({ where: { id: s1.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('al terminar el período pagado vuelve a Free', r.status === 200 && r.j.plan?.key === 'free' && r.j.source === 'default', JSON.stringify(r.j.plan));

    // Contratar de nuevo no choca con la cancelación programada
    await prisma.subscription.update({ where: { id: s1.id }, data: { currentPeriodEnd: new Date(Date.now() + 5 * DAY) } });
    r = await call('POST', '/billing/checkout', 'nobuyer', { planKey: 'premium' });
    ok('con una cancelación programada se puede contratar de nuevo', r.status !== 409, String(r.status) + ' ' + JSON.stringify(r.j).slice(0, 120));

    // ----- Cancelada desde Mercado Pago -----
    await reset();
    s1 = await sub();
    await mpSet(s1.providerSubscriptionId, { status: 'cancelled', next_payment_date: null });
    r = await webhook(s1.providerSubscriptionId);
    const viaMp = await prisma.subscription.findUnique({ where: { id: s1.id } });
    ok('cancelada desde Mercado Pago también conserva lo pagado', r.status === 200 && viaMp.status === 'active' && viaMp.cancelAtPeriodEnd === true && viaMp.currentPeriodEnd > new Date(), JSON.stringify({ s: viaMp.status, c: viaMp.cancelAtPeriodEnd }));

    // ----- Cambiar de plan -----
    await reset();
    s1 = await sub();
    r = await call('POST', '/billing/change-plan', 'jerry', { planKey: 'pro' });
    ok('sin suscripción no se cambia de plan → 409', r.status === 409 && r.j.code === 'no_active_subscription', String(r.status));
    for (const planKey of ['free', 'oro', '', null, 7, 'test']) {
      r = await call('POST', '/billing/change-plan', 'nobuyer', { planKey });
      ok('plan no válido (' + String(planKey) + ') → 400 o 404', r.status === 400 || r.status === 404, String(r.status));
    }
    r = await call('POST', '/billing/change-plan', 'nobuyer', { planKey: 'pro' });
    ok('cambiar a Pro: responde 200 y avisa la fecha del cambio', r.status === 200 && !!r.j.effectiveAt, JSON.stringify(r.j).slice(0, 140));
    ok('el nuevo precio se envía a Mercado Pago para el próximo cobro', (await mpLog()).some((e) => e.method === 'PUT' && e.path === `/preapproval/${s1.providerSubscriptionId}` && e.body.auto_recurring?.transaction_amount === 3990));
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('hasta el próximo cobro se mantiene el plan pagado', r.status === 200 && r.j.plan?.key === 'enthusiast' && r.j.scheduledChange?.planKey === 'pro' && r.j.scheduledChange?.priceClp === 3990, JSON.stringify({ plan: r.j.plan?.key, sc: r.j.scheduledChange }));
    ok('la fila del cambio programado no aparece como suscripción', !(r.j.subscriptions || []).some((row) => row.status === 'scheduled'));
    r = await call('POST', '/billing/checkout', 'nobuyer', { planKey: 'pro' });
    ok('no se paga una segunda suscripción: se usa «cambiar de plan» → 409', r.status === 409 && r.j.code === 'subscription_exists', String(r.status));

    // Elegir otro plan reemplaza al programado; elegir el actual lo deshace y devuelve el precio
    r = await call('POST', '/billing/change-plan', 'nobuyer', { planKey: 'premium' });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('un segundo cambio reemplaza al programado (solo queda uno)', r.j.scheduledChange?.planKey === 'premium' && (await prisma.subscription.count({ where: { userId, status: 'scheduled' } })) === 1);
    r = await call('POST', '/billing/change-plan', 'nobuyer', { planKey: 'enthusiast' });
    const log = await mpLog();
    ok('elegir el plan actual deshace el cambio y restaura el precio', r.status === 200 && (await prisma.subscription.count({ where: { userId, status: 'scheduled' } })) === 0 && log.filter((e) => e.method === 'PUT' && e.body.auto_recurring?.transaction_amount === 990).length >= 1);

    // El cambio rige en el siguiente cobro (el aviso de Mercado Pago trae la fecha nueva)
    await call('POST', '/billing/change-plan', 'nobuyer', { planKey: 'pro' });
    const oldEnd = (await prisma.subscription.findUnique({ where: { id: s1.id } })).currentPeriodEnd;
    r = await call('GET', '/billing/me', 'nobuyer');
    await prisma.subscription.update({ where: { id: s1.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('pasada la fecha de cobro rige el plan programado aunque el aviso se demore', r.status === 200 && r.j.plan?.key === 'pro', JSON.stringify(r.j.plan?.key));
    await prisma.subscription.update({ where: { id: s1.id }, data: { currentPeriodEnd: oldEnd } });
    await mpSet(s1.providerSubscriptionId, { status: 'authorized', next_payment_date: new Date(oldEnd.getTime() + 30 * DAY).toISOString() });
    r = await webhook(s1.providerSubscriptionId);
    const renewed = await prisma.subscription.findUnique({ where: { id: s1.id } });
    ok('con el nuevo cobro la suscripción pasa a Pro a $3.990 y se limpia el cambio', r.status === 200 && renewed.planKey === 'pro' && renewed.priceClp === 3990 && (await prisma.subscription.count({ where: { userId, status: 'scheduled' } })) === 0, JSON.stringify({ k: renewed.planKey, p: renewed.priceClp }));
    ok('el período avanza al nuevo cobro', renewed.currentPeriodEnd.getTime() === oldEnd.getTime() + 30 * DAY);

    // Mora sin pagar: no se cambia de plan
    await prisma.subscription.update({ where: { id: s1.id }, data: { status: 'past_due' } });
    r = await call('POST', '/billing/change-plan', 'nobuyer', { planKey: 'premium' });
    ok('con un pago pendiente no se cambia de plan → 409', r.status === 409, String(r.status));

    // La suscripción nueva reemplaza a la que solo esperaba terminar
    await reset();
    const old = await sub({ cancelAtPeriodEnd: true });
    const fresh = await sub({ planKey: 'premium', status: 'pending', priceClp: 1990, cancelAtPeriodEnd: false, currentPeriodEnd: null, nextPaymentAt: null });
    await mpSet(fresh.providerSubscriptionId, { status: 'authorized', next_payment_date: new Date(Date.now() + 30 * DAY).toISOString() });
    r = await webhook(fresh.providerSubscriptionId);
    ok('al autorizarse la nueva, la anterior (ya cancelada) caduca', r.status === 200 && (await prisma.subscription.findUnique({ where: { id: fresh.id } })).status === 'active' && (await prisma.subscription.findUnique({ where: { id: old.id } })).status === 'expired');
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('el plan vigente es el de la suscripción nueva', r.j.plan?.key === 'premium');

    // Una concesión «Free» del equipo no tapa una suscripción pagada
    await reset();
    await sub();
    await prisma.planGrant.create({ data: { userId, planKey: 'free', reason: 'Plan Free asignado por error' } });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('una concesión Free no tapa la suscripción pagada', r.status === 200 && r.j.plan?.key === 'enthusiast' && r.j.source === 'subscription', JSON.stringify({ k: r.j.plan?.key, s: r.j.source }));
    r = await call('POST', '/admin/users/cztest_nobuyer/plan', 'admin', { planKey: 'free', reason: 'intento de dejar en Free' });
    ok('el equipo no puede asignar «Free» (se usa «Quitar plan asignado») → 400', r.status === 400, String(r.status));

    // Al volver de Mercado Pago el plan se activa aunque el aviso no llegue
    await reset();
    const waiting = await sub({ status: 'pending', currentPeriodEnd: null, nextPaymentAt: null });
    await mpSet(waiting.providerSubscriptionId, { status: 'authorized', next_payment_date: new Date(Date.now() + 30 * DAY).toISOString() });
    r = await call('GET', '/billing/me', 'nobuyer');
    ok('antes de sincronizar sigue en Free', r.j.plan?.key === 'free');
    r = await call('POST', '/billing/sync', 'nobuyer', {});
    ok('sincronizar activa la suscripción sin esperar el aviso', r.status === 200 && r.j.plan?.key === 'enthusiast' && r.j.source === 'subscription', JSON.stringify({ k: r.j.plan?.key, s: r.j.source }));
    r = await call('POST', '/billing/sync', 'jerry', {});
    ok('sincronizar sin suscripción propia no falla ni toca la de otra persona', r.status === 200, String(r.status));
  } finally {
    await prisma.subscription.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
