// Carpetazo Intelligence (etapa 4): las cifras de los paneles coinciden con los datos fuente, permisos, rangos, lista blanca y auditoría.
// Usa fechas de marzo/febrero de 2026 (sin otros datos) para comparar contra cifras exactas.
const { prisma, B, U, call, ok } = require('./fixtures.cjs');

const P = 'cztest-int';
const at = (iso) => new Date(iso);
const ev = (id, name, iso, extra = {}) => ({ id: `${P}-${id}`, name, at: at(iso), path: '/', props: {}, ...extra });
const get = (path, who) => call('GET', '/admin/intelligence' + path, who);

(async () => {
  const settingsBefore = await prisma.analyticsSettings.findUnique({ where: { id: 1 } });
  try {
    // ---- Permisos
    let r = await get('/overview?from=2026-03-10&to=2026-03-10');
    ok('sin sesión → 401', r.status === 401, String(r.status));
    r = await get('/overview?from=2026-03-10&to=2026-03-10', 'seller');
    ok('quien no es administrador → 403', r.status === 403, String(r.status));
    r = await get('/overview?from=2026-03-09&to=2026-03-09', 'admin');
    ok('administrador → 200', r.status === 200 && r.j.success === true, String(r.status));

    // ---- Rangos inválidos
    for (const [label, qs] of [['formato', '?from=10-03-2026&to=2026-03-10'], ['invertido', '?from=2026-03-11&to=2026-03-10'], ['demasiado largo', '?from=2024-01-01&to=2026-03-10'], ['inyección', "?from=2026-03-10';DROP TABLE x;--&to=2026-03-10"]]) {
      r = await get('/traffic' + qs, 'admin');
      ok(`rango rechazado (${label})`, r.status === 400, String(r.status));
    }

    // ---- Cifras exactas: visitas ≠ visitantes ≠ sesiones
    await prisma.analyticsSession.createMany({ data: [
      { id: `${P}-s1`, visitorId: `${P}-vA`, startedAt: at('2026-03-10T15:00:00Z'), lastAt: at('2026-03-10T15:10:00Z'), pages: 2, events: 3, activeSec: 120, device: 'mobile', source: 'google.com', medium: 'organic', entryPath: '/', exitPath: '/catalogo' },
      { id: `${P}-s2`, visitorId: `${P}-vA`, startedAt: at('2026-03-10T20:00:00Z'), lastAt: at('2026-03-10T20:01:00Z'), pages: 1, events: 1, activeSec: 3, device: 'mobile', source: '', entryPath: '/', exitPath: '/' },
      { id: `${P}-s3`, visitorId: `${P}-vB`, startedAt: at('2026-03-10T16:00:00Z'), lastAt: at('2026-03-10T16:05:00Z'), pages: 1, events: 1, activeSec: 60, device: 'desktop', source: 'google.com', medium: 'organic', entryPath: '/catalogo', exitPath: '/catalogo' }
    ] });
    await prisma.analyticsEvent.createMany({ data: [
      ev('a1', 'page_view', '2026-03-10T15:00:00Z', { visitorId: `${P}-vA`, sessionId: `${P}-s1`, path: '/', device: 'mobile', source: 'google.com' }),
      ev('a2', 'page_view', '2026-03-10T15:05:00Z', { visitorId: `${P}-vA`, sessionId: `${P}-s1`, path: '/catalogo' }),
      ev('a3', 'page_view', '2026-03-10T20:00:00Z', { visitorId: `${P}-vA`, sessionId: `${P}-s2`, path: '/' }),
      ev('b1', 'page_view', '2026-03-10T16:00:00Z', { visitorId: `${P}-vB`, sessionId: `${P}-s3`, path: '/catalogo' }),
      ev('b2', 'search', '2026-03-10T16:01:00Z', { visitorId: `${P}-vB`, sessionId: `${P}-s3`, props: { game: 'pokemon', results: 0, scope: 'catalogo' } }),
      ev('b3', 'search', '2026-03-10T16:02:00Z', { visitorId: `${P}-vB`, sessionId: `${P}-s3`, props: { game: 'pokemon', results: 10, scope: 'catalogo' } }),
      // Frontera de día en hora de Chile (UTC-3 en marzo): 23:30 del 10 y 00:30 del 11
      ev('z1', 'page_view', '2026-03-11T02:30:00Z', { visitorId: `${P}-vC`, sessionId: `${P}-s4`, path: '/' }),
      ev('z2', 'page_view', '2026-03-11T03:30:00Z', { visitorId: `${P}-vD`, sessionId: `${P}-s5`, path: '/' })
    ] });
    r = await get('/overview?from=2026-03-10&to=2026-03-10', 'admin');
    const k = Object.fromEntries((r.j.data?.kpis || []).map((x) => [x.key, x]));
    ok('visitas = 5 (las del 10 de marzo en Chile, incluida la de las 23:30)', k.visits?.value === 5, JSON.stringify(k.visits));
    ok('visitantes únicos = 3 (no se confunden con visitas)', k.visitors?.value === 3, JSON.stringify(k.visitors));
    ok('sesiones = 4', k.sessions?.value === 4, JSON.stringify(k.sessions));
    ok('búsquedas = 2', k.searches?.value === 2, JSON.stringify(k.searches));
    r = await get('/overview?from=2026-03-11&to=2026-03-11', 'admin');
    ok('la visita de las 00:30 de Chile cae en el día siguiente', Object.fromEntries(r.j.data.kpis.map((x) => [x.key, x])).visits.value === 1);
    r = await get('/overview?from=2025-12-01&to=2025-12-10', 'admin');
    ok('un periodo anterior a lo medido se marca como parcial, no como dato completo', r.j.data.kpis.find((x) => x.key === 'visits').partial === true && r.j.data.coverage.eventsSince !== null);

    // ---- Tráfico y páginas
    r = await get('/traffic?from=2026-03-10&to=2026-03-10', 'admin');
    const src = r.j.data?.source || [];
    ok('fuentes: google.com tiene 2 sesiones y el resto directo', src.find((s) => s.key === 'google.com')?.sessions === 2 && src.find((s) => s.key.startsWith('(directo'))?.sessions === 1, JSON.stringify(src));
    r = await get('/pages?from=2026-03-10&to=2026-03-10', 'admin');
    const home = r.j.data?.rows?.find((x) => x.path === '/');
    ok('explorador de páginas: «/» tiene 3 vistas y 2 visitantes del día', home?.views === 3 && home?.visitors === 2, JSON.stringify(home));

    // ---- Producto: búsquedas por juego
    r = await get('/product?from=2026-03-10&to=2026-03-10', 'admin');
    const pk = r.j.data?.searches?.find((x) => x.game === 'pokemon');
    ok('búsquedas por juego: 2, promedio 5 resultados, 50% sin resultados', pk?.count === 2 && pk.avgResults === 5 && pk.emptyRate === 0.5, JSON.stringify(pk));

    // ---- Embudo ordenado: el segundo paso debe ocurrir después del primero y se une el navegador con la cuenta
    const uid = U.seller ? 'cztest-int-user' : 'cztest-int-user';
    await prisma.analyticsEvent.createMany({ data: [
      ev('f1', 'plans_viewed', '2026-03-12T14:00:00Z', { visitorId: `${P}-vF`, path: '/planes' }),
      ev('f2', 'plan_checkout_started', '2026-03-12T14:02:00Z', { visitorId: `${P}-vF`, userId: uid, props: { plan: 'premium' } }),
      ev('f3', 'subscription_confirmed', '2026-03-12T14:10:00Z', { userId: uid, origin: 'server', props: { plan: 'premium' } }),
      // Otra persona: confirma antes de ver los planes → no cuenta como embudo completo
      ev('g1', 'subscription_confirmed', '2026-03-12T10:00:00Z', { userId: `${uid}-2`, origin: 'server' }),
      ev('g2', 'plans_viewed', '2026-03-12T11:00:00Z', { userId: `${uid}-2` }),
      // Otra persona: solo vio los planes
      ev('h1', 'plans_viewed', '2026-03-12T12:00:00Z', { visitorId: `${P}-vH` })
    ] });
    r = await get('/funnels?from=2026-03-12&to=2026-03-12', 'admin');
    const plan = r.j.data?.funnels?.find((f) => f.key === 'plan');
    ok('embudo de suscripción respeta el orden: 3 ven planes, 1 elige, 1 confirma', plan?.steps.map((s) => s.count).join() === '3,1,1', JSON.stringify(plan?.steps));
    ok('el embudo da conversión desde el inicio', Math.abs(plan.steps[2].fromStart - 1 / 3) < 1e-9);

    // ---- Ingresos: solo pagos aprobados, menos reembolsos
    await prisma.paymentLedger.createMany({ data: [
      { providerPaymentId: 'cztest-int-p1', status: 'approved', amountClp: 3990, paidAt: at('2026-02-10T15:00:00Z') },
      { providerPaymentId: 'cztest-int-p2', status: 'approved', amountClp: 9990, refundedClp: 4000, paidAt: at('2026-02-11T15:00:00Z') },
      { providerPaymentId: 'cztest-int-p3', status: 'rejected', amountClp: 3990, paidAt: null },
      { providerPaymentId: 'cztest-int-p4', status: 'refunded', amountClp: 3990, refundedClp: 3990, paidAt: at('2026-02-12T15:00:00Z') },
      { providerPaymentId: 'cztest-int-p5', status: 'unverified', amountClp: 0 }
    ] });
    r = await get('/revenue?from=2026-02-01&to=2026-02-28', 'admin');
    ok('ingreso confirmado = 3.990 + (9.990 − 4.000) = 9.980; rechazados, reembolsados y no verificados no suman', r.j.data?.confirmed?.revenue === 9980 && r.j.data.confirmed.payments === 2, JSON.stringify(r.j.data?.confirmed));
    ok('el ticket promedio sale de los pagos confirmados', r.j.data?.confirmed?.avgTicket === 4990);

    // ---- Salud técnica
    await prisma.analyticsEvent.createMany({ data: [
      ev('v1', 'web_vital', '2026-03-13T14:00:00Z', { visitorId: `${P}-vV`, props: { name: 'LCP', value: 1000, rating: 'good' } }),
      ev('v2', 'web_vital', '2026-03-13T14:01:00Z', { visitorId: `${P}-vV`, props: { name: 'LCP', value: 3000, rating: 'poor' } }),
      ev('e1', 'js_error', '2026-03-13T14:02:00Z', { visitorId: `${P}-vV`, sessionId: `${P}-s9`, props: { message: 'fallo de prueba' } })
    ] });
    r = await get('/health?from=2026-03-13&to=2026-03-13', 'admin');
    const lcp = r.j.data?.vitals?.find((x) => x.name === 'LCP');
    ok('Web Vitals: 2 muestras, percentil 75 entre 1000 y 3000', lcp?.samples === 2 && lcp.p75 >= 1000 && lcp.p75 <= 3000 && lcp.goodRate === 0.5, JSON.stringify(lcp));
    ok('errores de JavaScript agrupados', r.j.data?.jsErrors?.[0]?.message === 'fallo de prueba' && r.j.data.jsErrors[0].count === 1);

    // ---- Retención
    r = await call('GET', '/admin/intelligence/retention?days=30', 'admin');
    ok('retención responde con cohortes y totales', r.status === 200 && Array.isArray(r.j.data?.cohorts) && 'overall' in r.j.data, String(r.status));
    r = await call('GET', '/admin/intelligence/retention?days=5', 'admin');
    ok('retención con periodo inválido → 400', r.status === 400);

    // ---- Explorador con lista blanca
    r = await get('/explore?event=page_view&groupBy=day&measure=visitors&from=2026-03-10&to=2026-03-11', 'admin');
    ok('explorador: visitantes por día coincide con los datos', r.j.data?.rows?.find((x) => x.key === '2026-03-10')?.value === 3, JSON.stringify(r.j.data?.rows));
    for (const qs of ['event=DROP%20TABLE&groupBy=day&measure=events', 'event=page_view&groupBy=userId&measure=events', 'event=page_view&groupBy=day&measure=sum(1)']) {
      r = await get('/explore?' + qs + '&from=2026-03-10&to=2026-03-11', 'admin');
      ok('explorador rechaza lo que no está en la lista blanca', r.status === 400, qs);
    }

    // ---- CSV: neutraliza fórmulas y deja registro de auditoría
    await prisma.analyticsEvent.create({ data: ev('c1', 'page_view', '2026-03-14T14:00:00Z', { visitorId: `${P}-vX`, source: '=HYPERLINK("http://x")' }) });
    const before = await prisma.moderationAudit.count({ where: { action: 'intelligence.export' } });
    const csv = await fetch(B + '/admin/intelligence/explore.csv?event=page_view&groupBy=source&measure=events&from=2026-03-14&to=2026-03-14', { headers: { Authorization: 'Bearer test-' + U.admin } });
    const text = await csv.text();
    ok('el CSV neutraliza celdas que Excel leería como fórmula', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type')) && text.includes(`"'=HYPERLINK`) && !/^=/m.test(text), text.slice(0, 120));
    ok('exportar queda en el registro de auditoría', (await prisma.moderationAudit.count({ where: { action: 'intelligence.export' } })) === before + 1);
    const denied = await fetch(B + '/admin/intelligence/explore.csv?event=page_view&groupBy=day&measure=events', { headers: { Authorization: 'Bearer test-' + U.seller } });
    ok('el CSV exige ser administrador', denied.status === 403);

    // ---- Encendido de la recolección
    r = await call('PUT', '/admin/intelligence/settings', 'seller', { enabled: true });
    ok('solo el administrador cambia el encendido', r.status === 403);
    r = await call('PUT', '/admin/intelligence/settings', 'admin', { enabled: 'si' });
    ok('el encendido valida el tipo', r.status === 400);
    r = await call('PUT', '/admin/intelligence/settings', 'admin', { enabled: true });
    const on = await prisma.analyticsSettings.findUnique({ where: { id: 1 } });
    ok('el administrador enciende y queda auditado', r.status === 200 && on.enabled === true && (await prisma.moderationAudit.count({ where: { action: 'intelligence.enabled' } })) >= 1);
    r = await call('PUT', '/admin/intelligence/settings', 'admin', { enabled: false });
    ok('y puede apagarla', r.status === 200 && (await prisma.analyticsSettings.findUnique({ where: { id: 1 } })).enabled === false);
  } finally {
    await prisma.analyticsEvent.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.analyticsSession.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.paymentLedger.deleteMany({ where: { providerPaymentId: { startsWith: 'cztest-int-' } } });
    await prisma.moderationAudit.deleteMany({ where: { action: { in: ['intelligence.export', 'intelligence.enabled', 'intelligence.disabled'] } } });
    await prisma.analyticsSettings.update({ where: { id: 1 }, data: { enabled: settingsBefore?.enabled ?? false } });
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
