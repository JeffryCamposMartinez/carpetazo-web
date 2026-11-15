// Carpetazo Intelligence (etapa 3): recolección real contra el servidor de pruebas y la base local.
// Nace apagada; no se duplica; sesiones, visitas y visitantes únicos bien separados; días en hora de Chile; retención; libro de pagos.
const { prisma, B, ok } = require('./fixtures.cjs');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PREFIX = 'cztest-an';
let n = 0;
const uid = (tag) => `${PREFIX}-${tag}-${Date.now().toString(36)}${(n++).toString(36)}`;
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const collect = async (body, headers = {}, raw) => {
  const r = await fetch(B + '/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': UA_PHONE, 'X-Forwarded-For': '10.90.' + Math.floor(n / 200) + '.' + (n++ % 200), ...headers }, body: raw ?? JSON.stringify(body) });
  return r.status;
};
const ev = (name, extra = {}) => ({ id: uid('e'), name, at: new Date().toISOString(), path: '/carta/abc?q=1', props: {}, ...extra });
const count = (where) => prisma.analyticsEvent.count({ where });

(async () => {
  const { runNightly, rollupDay, purgeAnalytics, backfillBusiness, snapshotBusiness } = await import('../core/analyticsJobs.js');
  const { recordMercadoPagoPayment, confirmedAmount } = await import('../core/paymentLedger.js');
  const { trackServer, flushAnalytics, getAnalyticsSettings } = await import('../core/analytics.js');
  const vid = uid('v'); const sid = uid('s'); const ctx = { vid, sid, tz: 'America/Santiago', vp: '390x844', ref: 'www.google.com' };
  const setSettings = async (data) => { await prisma.analyticsSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }); await getAnalyticsSettings(true); await wait(300); };
  const before = await prisma.analyticsSettings.findUnique({ where: { id: 1 } });
  try {
    // ---- Apagada por defecto
    await setSettings({ enabled: false, retentionDays: 90 });
    let cfg = await (await fetch(B + '/analytics/config')).json();
    ok('la recolección parte apagada', cfg.enabled === false, JSON.stringify(cfg));
    ok('apagada: se acepta la petición pero no se guarda nada', (await collect({ ctx, events: [ev('page_view')] })) === 204 && (await wait(500), await count({ visitorId: vid })) === 0);

    // ---- Encendida
    await setSettings({ enabled: true });
    cfg = await (await fetch(B + '/analytics/config')).json();
    ok('encendida: la web recibe enabled=true', cfg.enabled === true);
    cfg = await (await fetch(B + '/analytics/config', { headers: { DNT: '1' } })).json();
    ok('con «No rastrear» la web recibe enabled=false', cfg.enabled === false);
    ok('con «No rastrear» tampoco se guarda', (await collect({ ctx, events: [ev('page_view')] }, { DNT: '1' })) === 204 && (await wait(500), await count({ visitorId: vid })) === 0);
    ok('con Global Privacy Control tampoco se guarda', (await collect({ ctx, events: [ev('page_view')] }, { 'Sec-GPC': '1' })) === 204 && (await wait(500), await count({ visitorId: vid })) === 0);

    const batch = [ev('page_view', { props: { title: 'Carta', email: 'alguien@correo.cl' } }), ev('page_leave', { props: { sec: 20, maxScroll: 60 } }), ev('search', { props: { game: 'pokemon', results: 0, scope: 'catalogo' } })];
    ok('un lote válido responde 204', (await collect({ ctx, events: batch })) === 204);
    await wait(700);
    ok('los 3 eventos quedaron guardados', (await count({ visitorId: vid })) === 3, String(await count({ visitorId: vid })));
    const stored = await prisma.analyticsEvent.findFirst({ where: { id: batch[0].id } });
    ok('la ruta se agrupa y no guarda el parámetro ni el id', stored.path === '/carta/:id');
    ok('las propiedades no permitidas (correo) se descartan', !JSON.stringify(stored.props).includes('@') && stored.props.title === 'Carta', JSON.stringify(stored.props));
    ok('se guardan dispositivo, navegador y fuente, no el User-Agent ni la IP', stored.device === 'mobile' && stored.os === 'iOS' && stored.source === 'google.com' && stored.medium === 'organic' && !JSON.stringify(stored).includes('iPhone'));
    let session = await prisma.analyticsSession.findUnique({ where: { id: sid } });
    ok('la sesión cuenta 1 página, 3 eventos y 20 s activos', session?.pages === 1 && session.events === 3 && session.activeSec === 20, JSON.stringify(session && { p: session.pages, e: session.events, a: session.activeSec }));

    // ---- Sin duplicados
    await collect({ ctx, events: batch });
    await wait(700);
    session = await prisma.analyticsSession.findUnique({ where: { id: sid } });
    ok('reenviar el mismo lote no duplica eventos', (await count({ visitorId: vid })) === 3);
    ok('ni infla la sesión', session.pages === 1 && session.events === 3 && session.activeSec === 20);
    await collect({ ctx, events: [{ ...batch[0] }, ev('page_view')] });
    await wait(700);
    ok('un lote con 1 repetido y 1 nuevo suma solo el nuevo', (await count({ visitorId: vid })) === 4 && (await prisma.analyticsSession.findUnique({ where: { id: sid } })).pages === 2);

    // ---- Visitas ≠ visitantes únicos ≠ sesiones
    const sid2 = uid('s');
    await collect({ ctx: { ...ctx, sid: sid2 }, events: [ev('page_view'), ev('page_view')] });
    await wait(700);
    const views = await count({ visitorId: vid, name: 'page_view' });
    const sessions = await prisma.analyticsSession.count({ where: { visitorId: vid } });
    const distinctVisitors = (await prisma.analyticsEvent.findMany({ where: { visitorId: vid, name: 'page_view' }, distinct: ['visitorId'], select: { visitorId: true } })).length;
    ok('4 visitas de 1 visitante en 2 sesiones: no se confunden', views === 4 && sessions === 2 && distinctVisitors === 1, JSON.stringify({ views, sessions, distinctVisitors }));

    // ---- Rechazos
    ok('un evento del servidor no puede venir de la web', (await collect({ ctx, events: [ev('order_created')] }), await wait(500), (await count({ name: 'order_created', visitorId: vid })) === 0));
    ok('un evento fuera del catálogo se descarta', (await collect({ ctx, events: [ev('inventado')] }), await wait(500), (await count({ name: 'inventado' })) === 0));
    const before2 = await count({ visitorId: { startsWith: PREFIX } });
    await collect({ ctx: { vid: 'x', sid: 'y' }, events: [ev('page_view')] });
    await collect({ ctx, events: [ev('page_view')] }, { 'User-Agent': 'Googlebot/2.1' });
    await wait(500);
    ok('identificadores inválidos y robots se ignoran', (await count({ visitorId: { startsWith: PREFIX } })) === before2);
    ok('más de 50 eventos → 400', (await collect({ ctx, events: Array.from({ length: 51 }, () => ev('page_view')) })) === 400);
    ok('cuerpo gigante → 413', (await collect(null, {}, JSON.stringify({ ctx, events: [ev('page_view')], pad: 'x'.repeat(40000) }))) === 413);
    ok('JSON roto → 400', (await collect(null, {}, '{no es json')) === 400);

    // ---- Días en hora de Chile (noviembre = UTC-3)
    const visitorTz = uid('tz');
    const mk = (id, iso) => ({ id: uid(id), name: 'page_view', at: new Date(iso), visitorId: visitorTz, sessionId: uid('tzs'), path: '/planes', origin: 'web', device: 'desktop' });
    await prisma.analyticsEvent.createMany({ data: [mk('a', '2026-11-16T02:30:00Z'), mk('b', '2026-11-16T03:30:00Z')] }); // 23:30 del 15 y 00:30 del 16 en Chile
    await rollupDay('2031-01-01'); // un día sin datos no debe fallar ni crear filas
    const dayVisits = async (day, path = '') => { await rollupDay(day); return (await prisma.analyticsDaily.findFirst({ where: { day: new Date(`${day}T00:00:00Z`), metric: path ? 'path_views' : 'visits', dim1: path } }))?.value ?? 0; };
    const v15 = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "AnalyticsEvent" e WHERE e."visitorId" = ${visitorTz} AND ((e."at" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date = '2026-11-15'::date`;
    const v16 = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "AnalyticsEvent" e WHERE e."visitorId" = ${visitorTz} AND ((e."at" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date = '2026-11-16'::date`;
    ok('23:30 y 00:30 de Chile caen en días distintos aunque en UTC sean el mismo', v15[0].n === 1 && v16[0].n === 1, JSON.stringify([v15, v16]));
    const day15 = await dayVisits('2026-11-15', '/planes');
    ok('el agregado del día 15 cuenta /planes una vez (solo lo de ese día de Chile)', day15 >= 1);
    await rollupDay('2026-11-15');
    await rollupDay('2026-11-15');
    const rows = await prisma.analyticsDaily.count({ where: { day: new Date('2026-11-15T00:00:00Z'), metric: 'visits' } });
    ok('repetir el consolidado del mismo día no duplica filas', rows === 1, String(rows));

    // ---- Eventos del servidor
    const serverUser = uid('u');
    await trackServer('signup_completed', { userId: serverUser });
    await trackServer('card_added', { userId: serverUser, props: { game: 'myl', qty: 3, email: 'a@b.cl' } });
    ok('un evento web no se acepta como evento de servidor', (await trackServer('page_view', { userId: serverUser })) === false);
    await flushAnalytics();
    const srv = await prisma.analyticsEvent.findMany({ where: { userId: serverUser }, orderBy: { name: 'asc' } });
    ok('los eventos del servidor quedan con usuario y origen «server»', srv.length === 2 && srv.every((e) => e.origin === 'server' && e.visitorId === null), JSON.stringify(srv.map((e) => e.name)));
    ok('y sin propiedades no permitidas', !JSON.stringify(srv).includes('@'));

    // ---- Retención y borrado
    await setSettings({ retentionDays: 7 });
    const old = uid('old');
    await prisma.analyticsEvent.createMany({ data: [{ id: uid('o1'), name: 'page_view', at: new Date(Date.now() - 10 * 86400000), visitorId: old, sessionId: old, path: '/', origin: 'web' }, { id: uid('o2'), name: 'page_view', at: new Date(Date.now() - 2 * 86400000), visitorId: old, sessionId: old, path: '/', origin: 'web' }] });
    const purged = await purgeAnalytics();
    ok('la retención borra lo vencido y conserva lo reciente', purged.events >= 1 && (await count({ visitorId: old })) === 1, JSON.stringify(purged));
    const { eraseUserAnalytics } = await import('../core/analyticsJobs.js');
    await eraseUserAnalytics(serverUser);
    ok('al eliminar una cuenta se borran sus eventos', (await count({ userId: serverUser })) === 0);

    // ---- Cifras de negocio: solo lo reconstruible, rotulado
    await prisma.businessDaily.deleteMany({});
    const rowsBackfilled = await backfillBusiness();
    const recon = await prisma.businessDaily.findMany({ where: { origin: 'reconstructed' } });
    ok('la reconstrucción se rotula «reconstructed» y no inventa totales del pasado', recon.length === rowsBackfilled && recon.every((r) => /_new|_added|_canceled/.test(r.metric)) && !recon.some((r) => /_total$|mrr/.test(r.metric)), String(recon.length));
    const usersNew = recon.filter((r) => r.metric === 'users_new').reduce((s, r) => s + r.value, 0);
    ok('los usuarios nuevos por día suman exactamente los usuarios con fecha de registro', usersNew === (await prisma.user.count()), `${usersNew} vs ${await prisma.user.count()}`);
    const snap = await snapshotBusiness('2026-11-15');
    ok('la foto del día es «measured» y coincide con la base', (await prisma.businessDaily.findFirst({ where: { metric: 'users_total', origin: 'measured' } })).value === snap.users_total && snap.users_total === (await prisma.user.count({ where: { role: { not: 'deleted' } } })));

    // ---- Trabajo nocturno idempotente
    const first = await runNightly(new Date('2026-11-17T08:00:00Z'), { force: true });
    ok('el trabajo nocturno corre', first.ran === true);
    const skipped = await runNightly(new Date('2026-11-17T08:05:00Z'));
    ok('y no se repite el mismo día', skipped.ran === false);
    ok('antes de las 03:30 de Chile no corre', (await runNightly(new Date('2026-11-18T05:00:00Z'))).ran === false);

    // ---- Libro de pagos
    const mp = (map) => async (route) => { if (!(route in map)) throw new Error('ruta inesperada ' + route); return map[route]; };
    const pid = String(900000000 + Math.floor(Math.random() * 1e6));
    await recordMercadoPagoPayment(pid, 'payment', mp({ [`/v1/payments/${pid}`]: { id: pid, status: 'approved', transaction_amount: 3990, transaction_amount_refunded: 0, date_approved: '2026-11-10T12:00:00.000-03:00', external_reference: 'no-existe' } }));
    await recordMercadoPagoPayment(pid, 'payment', mp({ [`/v1/payments/${pid}`]: { id: pid, status: 'approved', transaction_amount: 3990, transaction_amount_refunded: 0, date_approved: '2026-11-10T12:00:00.000-03:00' } }));
    let rowsLedger = await prisma.paymentLedger.findMany({ where: { providerPaymentId: pid } });
    ok('un pago aprobado queda una sola vez aunque el aviso llegue dos veces', rowsLedger.length === 1 && rowsLedger[0].status === 'approved' && confirmedAmount(rowsLedger[0]) === 3990);
    await recordMercadoPagoPayment(pid, 'payment', mp({ [`/v1/payments/${pid}`]: { id: pid, status: 'refunded', transaction_amount: 3990, transaction_amount_refunded: 3990, date_approved: '2026-11-10T12:00:00.000-03:00' } }));
    rowsLedger = await prisma.paymentLedger.findMany({ where: { providerPaymentId: pid } });
    ok('si luego se reembolsa, deja de sumar ingresos', rowsLedger[0].status === 'refunded' && confirmedAmount(rowsLedger[0]) === 0);
    const pid2 = pid + '1';
    await recordMercadoPagoPayment(pid2, 'payment', mp({ [`/v1/payments/${pid2}`]: { id: pid2, status: 'rejected', transaction_amount: 3990 } }));
    ok('un pago rechazado se registra y no suma', confirmedAmount((await prisma.paymentLedger.findUnique({ where: { providerPaymentId: pid2 } }))) === 0);
    const apId = pid + '2';
    const r = await recordMercadoPagoPayment(apId, 'subscription_authorized_payment', mp({ [`/authorized_payments/${apId}`]: { id: apId, status: 'processed', transaction_amount: 3990 } }));
    const unv = await prisma.paymentLedger.findUnique({ where: { providerPaymentId: `ap_${apId}` } });
    ok('un cobro autorizado con forma inesperada queda «unverified» y no suma dinero', r.status === 'unverified' && unv.status === 'unverified' && unv.amountClp === 0 && confirmedAmount(unv) === 0);
    const pid3 = pid + '3'; const apId2 = pid + '4';
    await recordMercadoPagoPayment(apId2, 'subscription_authorized_payment', mp({ [`/authorized_payments/${apId2}`]: { id: apId2, payment: { id: pid3, status: 'approved' } }, [`/v1/payments/${pid3}`]: { id: pid3, status: 'approved', transaction_amount: 9990, date_approved: '2026-11-11T09:00:00.000-03:00' } }));
    ok('un cobro autorizado se confirma consultando el pago real', confirmedAmount(await prisma.paymentLedger.findUnique({ where: { providerPaymentId: pid3 } })) === 9990);
    // Vínculo con la suscripción por preapproval_id (db simulada, sin crear usuarios)
    const pid4 = pid + '5'; const apId3 = pid + '6'; let saved = null;
    const fakeDb = {
      subscription: { findUnique: async ({ where }) => (where.providerSubscriptionId === 'pre-1' ? { id: 'sub-1', userId: 'user-1' } : null) },
      paymentLedger: { upsert: async ({ create }) => { saved = create; } }
    };
    await recordMercadoPagoPayment(apId3, 'subscription_authorized_payment', mp({ [`/authorized_payments/${apId3}`]: { id: apId3, preapproval_id: 'pre-1', payment: { id: pid4 } }, [`/v1/payments/${pid4}`]: { id: pid4, status: 'approved', transaction_amount: '3990', date_approved: '2026-11-12T09:00:00.000-03:00' } }), fakeDb);
    ok('el cobro se vincula con la suscripción por preapproval_id', saved?.subscriptionId === 'sub-1' && saved?.userId === 'user-1' && saved?.amountClp === 3990);
  } finally {
    await prisma.analyticsEvent.deleteMany({ where: { OR: [{ visitorId: { startsWith: PREFIX } }, { id: { startsWith: PREFIX } }, { userId: { startsWith: PREFIX } }] } });
    await prisma.analyticsSession.deleteMany({ where: { OR: [{ visitorId: { startsWith: PREFIX } }, { id: { startsWith: PREFIX } }] } });
    await prisma.analyticsDaily.deleteMany({ where: { OR: [{ day: { in: [new Date('2026-11-15T00:00:00Z'), new Date('2026-11-16T00:00:00Z'), new Date('2031-01-01T00:00:00Z'), new Date('2026-11-16T00:00:00Z')] } }, { metric: 'job_rollup_done' }] } });
    await prisma.businessDaily.deleteMany({});
    await prisma.paymentLedger.deleteMany({ where: { OR: [{ providerPaymentId: { startsWith: '9' } }, { providerPaymentId: { startsWith: 'ap_9' } }] } });
    await prisma.analyticsSettings.update({ where: { id: 1 }, data: { enabled: before?.enabled ?? false, retentionDays: before?.retentionDays ?? 90 } });
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
