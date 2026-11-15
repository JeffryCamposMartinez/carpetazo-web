// Carpetazo Intelligence — consultas de solo lectura para los paneles de Moderación.
// Todo sale de datos reales: eventos y sesiones propios (90 días), agregados diarios, foto de negocio y libro de pagos.
// Nunca se inventa una cifra: si no hay datos del periodo, el valor es null y la respuesta indica desde cuándo se mide.
// Los días son de Chile (America/Santiago). `from`/`to` son «YYYY-MM-DD» inclusivos.
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { EVENT_NAMES } from './analyticsCatalog.js';

const TZ = 'America/Santiago';
export const MAX_RANGE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
export const chileToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const spanDays = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
export const previousRange = (from, to) => { const n = spanDays(from, to); return { from: addDays(from, -n), to: addDays(from, -1) }; };

// Rango en hora de Chile -> condiciones sobre una columna timestamp en UTC
const lo = (from) => Prisma.sql`(((${from}::date)::timestamp AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC')`;
const hi = (to) => Prisma.sql`((((${to}::date) + 1)::timestamp AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC')`;
const within = (col, from, to) => Prisma.sql`${col} >= ${lo(from)} AND ${col} < ${hi(to)}`;
const chileDay = (col) => Prisma.sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date`;
const dayStr = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
const num = (value) => (value === null || value === undefined ? 0 : Number(value));

const E = Prisma.sql`"AnalyticsEvent" e`;

// Desde cuándo hay datos propios (null = aún no se mide)
export const coverage = async () => {
  const [ev, ledger, biz, settings] = await Promise.all([
    prisma.$queryRaw`SELECT min(${chileDay(Prisma.sql`e."at"`)}) AS d FROM ${E}`,
    prisma.paymentLedger.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.$queryRaw`SELECT min("day") AS d FROM "BusinessDaily" WHERE "origin" = 'measured'`,
    prisma.analyticsSettings.findUnique({ where: { id: 1 } })
  ]);
  return {
    enabled: Boolean(settings?.enabled),
    retentionDays: settings?.retentionDays ?? 90,
    eventsSince: ev[0]?.d ? dayStr(ev[0].d) : null,
    ledgerSince: ledger ? chileToday(ledger.createdAt) : null,
    businessMeasuredSince: biz[0]?.d ? dayStr(biz[0].d) : null
  };
};

const delta = (value, prev) => (value === null || prev === null || prev === 0 ? null : Math.round(((value - prev) / prev) * 1000) / 10);

// ---------- Resumen ejecutivo ----------
const BIZ = { users_new: 'Usuarios nuevos', folders_new_surviving: 'Carpetas nuevas', cards_added_surviving: 'Cartas agregadas', orders_new: 'Pedidos', subscriptions_new: 'Suscripciones nuevas' };

const eventStats = async (from, to) => {
  const [row] = await prisma.$queryRaw`
    SELECT count(*) FILTER (WHERE e."name" = 'page_view')::float AS visits,
           count(DISTINCT e."visitorId") FILTER (WHERE e."name" = 'page_view')::float AS visitors,
           count(DISTINCT e."sessionId") FILTER (WHERE e."name" = 'page_view')::float AS sessions,
           count(DISTINCT e."userId")::float AS users_active,
           count(*) FILTER (WHERE e."name" = 'search')::float AS searches,
           count(*) FILTER (WHERE e."name" = 'scan_succeeded')::float AS scans
    FROM ${E} WHERE ${within(Prisma.sql`e."at"`, from, to)}`;
  const [ses] = await prisma.$queryRaw`
    SELECT count(*)::float AS n, coalesce(avg(s."activeSec"), 0)::float AS avg_sec,
           count(*) FILTER (WHERE s."pages" <= 1 AND s."activeSec" < 10)::float AS bounces
    FROM "AnalyticsSession" s WHERE ${within(Prisma.sql`s."startedAt"`, from, to)}`;
  return { ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, num(v)])), avgSessionSec: num(ses.avg_sec), bounceRate: num(ses.n) ? num(ses.bounces) / num(ses.n) : null };
};

const bizSums = async (from, to) => {
  const rows = await prisma.$queryRaw`SELECT "metric", sum("value")::float AS v, count(*) FILTER (WHERE "origin" = 'measured')::int AS measured FROM "BusinessDaily" WHERE "day" >= ${from}::date AND "day" <= ${to}::date AND "metric" IN (${Prisma.join(Object.keys(BIZ))}) GROUP BY "metric"`;
  return Object.fromEntries(rows.map((r) => [r.metric, num(r.v)]));
};

export const revenueBetween = async (from, to) => {
  const rows = await prisma.$queryRaw`
    SELECT coalesce(sum(greatest(l."amountClp" - l."refundedClp", 0)), 0)::float AS revenue, count(*)::int AS payments, count(DISTINCT l."userId")::int AS payers
    FROM "PaymentLedger" l WHERE l."status" = 'approved' AND l."paidAt" IS NOT NULL AND ${within(Prisma.sql`l."paidAt"`, from, to)}`;
  return { revenue: num(rows[0].revenue), payments: num(rows[0].payments), payers: num(rows[0].payers) };
};

export const dailyVisits = async (from, to) => {
  const rows = await prisma.$queryRaw`
    SELECT ${chileDay(Prisma.sql`e."at"`)} AS d, count(*)::float AS visits, count(DISTINCT e."visitorId")::float AS visitors, count(DISTINCT e."sessionId")::float AS sessions
    FROM ${E} WHERE e."name" = 'page_view' AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ day: dayStr(r.d), visits: num(r.visits), visitors: num(r.visitors), sessions: num(r.sessions) }));
};

export const overview = async (from, to) => {
  const prev = previousRange(from, to);
  const cov = await coverage();
  const [cur, old, bizCur, bizOld, revCur, revOld, spark] = await Promise.all([
    eventStats(from, to), eventStats(prev.from, prev.to), bizSums(from, to), bizSums(prev.from, prev.to),
    revenueBetween(from, to), revenueBetween(prev.from, prev.to), dailyVisits(from, to)
  ]);
  const hasEvents = cov.eventsSince !== null;
  const partialEvents = hasEvents && from < cov.eventsSince;
  const evKpi = (key, label, value, prevValue, unit = 'n') => ({
    key, label, unit, source: 'eventos',
    value: hasEvents ? value : null, prev: hasEvents && prev.to >= cov.eventsSince ? prevValue : null,
    change: hasEvents && prev.to >= cov.eventsSince ? delta(value, prevValue) : null, partial: partialEvents
  });
  const bizKpi = (key, label) => ({ key, label, unit: 'n', source: 'negocio (reconstruido de fechas de registro)', value: bizCur[key] ?? 0, prev: bizOld[key] ?? 0, change: delta(bizCur[key] ?? 0, bizOld[key] ?? 0), partial: false });
  const hasLedger = cov.ledgerSince !== null;
  const revKpi = { key: 'revenue', label: 'Ingresos confirmados', unit: 'clp', source: 'libro de pagos (solo pagos aprobados)', value: hasLedger ? revCur.revenue : null, prev: hasLedger ? revOld.revenue : null, change: hasLedger ? delta(revCur.revenue, revOld.revenue) : null, partial: hasLedger && from < cov.ledgerSince };
  return {
    from, to, previous: prev, coverage: cov,
    kpis: [
      evKpi('visits', 'Visitas', cur.visits, old.visits), evKpi('visitors', 'Visitantes únicos', cur.visitors, old.visitors),
      evKpi('sessions', 'Sesiones', cur.sessions, old.sessions), evKpi('users_active', 'Usuarios activos', cur.users_active, old.users_active),
      evKpi('avg_session', 'Tiempo activo por sesión (s)', Math.round(cur.avgSessionSec), Math.round(old.avgSessionSec), 's'),
      evKpi('bounce', 'Rebote', cur.bounceRate === null ? null : Math.round(cur.bounceRate * 1000) / 10, old.bounceRate === null ? null : Math.round(old.bounceRate * 1000) / 10, 'pct'),
      evKpi('searches', 'Búsquedas', cur.searches, old.searches), evKpi('scans', 'Escaneos exitosos', cur.scans, old.scans),
      bizKpi('users_new', BIZ.users_new), bizKpi('folders_new_surviving', BIZ.folders_new_surviving), bizKpi('cards_added_surviving', BIZ.cards_added_surviving),
      bizKpi('orders_new', BIZ.orders_new), bizKpi('subscriptions_new', BIZ.subscriptions_new), revKpi
    ],
    series: spark
  };
};

// ---------- Audiencia ----------
const topBy = async (column, from, to, limit = 10) => {
  const rows = await prisma.$queryRaw(Prisma.sql`SELECT s.${Prisma.raw(`"${column}"`)} AS k, count(*)::float AS n FROM "AnalyticsSession" s WHERE ${within(Prisma.sql`s."startedAt"`, from, to)} GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`);
  const total = rows.reduce((a, r) => a + num(r.n), 0);
  return rows.map((r) => ({ key: r.k || '(directo / desconocido)', sessions: num(r.n), share: total ? num(r.n) / total : 0 }));
};

export const traffic = async (from, to) => {
  const [series, device, browser, os, source, medium, tz, newVsReturning] = await Promise.all([
    dailyVisits(from, to), topBy('device', from, to), topBy('browser', from, to), topBy('os', from, to), topBy('source', from, to), topBy('medium', from, to), topBy('tz', from, to, 8),
    prisma.$queryRaw`
      WITH v AS (SELECT s."visitorId", min(s."startedAt") AS first_at FROM "AnalyticsSession" s GROUP BY 1)
      SELECT count(DISTINCT s."visitorId") FILTER (WHERE v.first_at >= ${lo(from)})::float AS new_visitors, count(DISTINCT s."visitorId") FILTER (WHERE v.first_at < ${lo(from)})::float AS returning_visitors
      FROM "AnalyticsSession" s JOIN v ON v."visitorId" = s."visitorId" WHERE ${within(Prisma.sql`s."startedAt"`, from, to)}`
  ]);
  return { from, to, series, device, browser, os, source, medium, country: tz, newVisitors: num(newVsReturning[0]?.new_visitors), returningVisitors: num(newVsReturning[0]?.returning_visitors) };
};

export const pages = async (from, to, limit = 60) => {
  const views = await prisma.$queryRaw`
    SELECT e."path" AS path, count(*)::float AS views, count(DISTINCT e."visitorId")::float AS visitors FROM ${E}
    WHERE e."name" = 'page_view' AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}`;
  const entries = await prisma.$queryRaw`SELECT s."entryPath" AS p, count(*)::float AS n FROM "AnalyticsSession" s WHERE ${within(Prisma.sql`s."startedAt"`, from, to)} AND s."entryPath" <> '' GROUP BY 1`;
  const exits = await prisma.$queryRaw`SELECT s."exitPath" AS p, count(*)::float AS n FROM "AnalyticsSession" s WHERE ${within(Prisma.sql`s."startedAt"`, from, to)} AND s."exitPath" <> '' GROUP BY 1`;
  const leave = await prisma.$queryRaw`
    SELECT e."path" AS p, avg((e."props"->>'sec')::float)::float AS sec, avg((e."props"->>'maxScroll')::float)::float AS scroll
    FROM ${E} WHERE e."name" = 'page_leave' AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1`;
  const en = new Map(entries.map((r) => [r.p, num(r.n)])); const ex = new Map(exits.map((r) => [r.p, num(r.n)])); const lv = new Map(leave.map((r) => [r.p, r]));
  return {
    from, to,
    rows: views.map((r) => {
      const views_ = num(r.views); const exits_ = ex.get(r.path) || 0; const l = lv.get(r.path);
      return { path: r.path || '/', views: views_, visitors: num(r.visitors), entries: en.get(r.path) || 0, exits: exits_, exitRate: views_ ? Math.min(1, exits_ / views_) : null, avgSec: l?.sec != null ? Math.round(num(l.sec)) : null, avgScroll: l?.scroll != null ? Math.round(num(l.scroll)) : null };
    })
  };
};

// ---------- Producto ----------
const BIZ_SERIES = ['users_new', 'folders_new_surviving', 'cards_added_surviving', 'wishlist_items_new_surviving', 'orders_new', 'users_total', 'folders_total', 'folders_public', 'cards_total', 'wishlist_items_total'];

export const product = async (from, to) => {
  const [biz, byGame, searches, scans, social] = await Promise.all([
    prisma.$queryRaw`SELECT "day", "metric", "value"::float AS v, "origin" FROM "BusinessDaily" WHERE "day" >= ${from}::date AND "day" <= ${to}::date AND "dim" = '' AND "metric" IN (${Prisma.join(BIZ_SERIES)}) ORDER BY "day"`,
    prisma.$queryRaw`
      SELECT e."name" AS name, coalesce(e."props"->>'game', 'otro') AS game, count(*)::float AS n FROM ${E}
      WHERE e."name" IN ('search', 'card_added', 'folder_created', 'folder_viewed', 'wishlist_item_added', 'card_viewed', 'cart_add') AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1, 2`,
    prisma.$queryRaw`
      SELECT coalesce(e."props"->>'game', 'otro') AS game, count(*)::float AS n, avg((e."props"->>'results')::float)::float AS avg_results,
             count(*) FILTER (WHERE (e."props"->>'results')::float = 0)::float AS empty
      FROM ${E} WHERE e."name" = 'search' AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw`
      SELECT count(*) FILTER (WHERE e."name" = 'scan_started')::float AS started, count(*) FILTER (WHERE e."name" = 'scan_succeeded')::float AS ok, count(*) FILTER (WHERE e."name" = 'scan_failed')::float AS failed
      FROM ${E} WHERE e."name" IN ('scan_started', 'scan_succeeded', 'scan_failed') AND ${within(Prisma.sql`e."at"`, from, to)}`,
    prisma.$queryRaw`
      SELECT e."name" AS name, count(*)::float AS n FROM ${E} WHERE e."name" IN ('profile_viewed', 'store_followed', 'store_event_signup', 'folder_shared', 'card_shared') AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1`
  ]);
  const series = {};
  for (const r of biz) (series[r.metric] ||= []).push({ day: dayStr(r.day), value: num(r.v), origin: r.origin });
  return {
    from, to, business: series,
    eventsByGame: byGame.map((r) => ({ name: r.name, game: r.game, count: num(r.n) })),
    searches: searches.map((r) => ({ game: r.game, count: num(r.n), avgResults: r.avg_results === null ? null : Math.round(num(r.avg_results) * 10) / 10, emptyRate: num(r.n) ? num(r.empty) / num(r.n) : null })),
    scanner: { started: num(scans[0]?.started), succeeded: num(scans[0]?.ok), failed: num(scans[0]?.failed) },
    social: social.map((r) => ({ name: r.name, count: num(r.n) }))
  };
};

// ---------- Negocio (ingresos reales) ----------
export const revenue = async (from, to) => {
  const [daily, byPlan, statuses, snapshot, subsFlow] = await Promise.all([
    prisma.$queryRaw`
      SELECT ${chileDay(Prisma.sql`l."paidAt"`)} AS d, sum(greatest(l."amountClp" - l."refundedClp", 0))::float AS revenue, count(*)::int AS payments
      FROM "PaymentLedger" l WHERE l."status" = 'approved' AND l."paidAt" IS NOT NULL AND ${within(Prisma.sql`l."paidAt"`, from, to)} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw`
      SELECT coalesce(s."planKey", 'sin suscripción vinculada') AS plan, sum(greatest(l."amountClp" - l."refundedClp", 0))::float AS revenue, count(*)::int AS payments
      FROM "PaymentLedger" l LEFT JOIN "Subscription" s ON s."id" = l."subscriptionId"
      WHERE l."status" = 'approved' AND l."paidAt" IS NOT NULL AND ${within(Prisma.sql`l."paidAt"`, from, to)} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw`SELECT l."status" AS status, count(*)::int AS n, coalesce(sum(l."amountClp"), 0)::float AS amount FROM "PaymentLedger" l WHERE ${within(Prisma.sql`l."createdAt"`, from, to)} GROUP BY 1`,
    prisma.$queryRaw`SELECT "metric", "dim", "value"::float AS v, "day" FROM "BusinessDaily" WHERE "origin" = 'measured' AND "metric" IN ('subscribers', 'mrr_estimated') AND "day" = (SELECT max("day") FROM "BusinessDaily" WHERE "metric" = 'subscribers' AND "origin" = 'measured')`,
    prisma.$queryRaw`SELECT "metric", sum("value")::float AS v FROM "BusinessDaily" WHERE "metric" IN ('subscriptions_new', 'subscriptions_canceled') AND "day" >= ${from}::date AND "day" <= ${to}::date GROUP BY 1`
  ]);
  const cov = await coverage();
  const total = daily.reduce((a, r) => a + num(r.revenue), 0); const payments = daily.reduce((a, r) => a + num(r.payments), 0);
  const subs = snapshot.filter((r) => r.metric === 'subscribers'); const mrr = snapshot.filter((r) => r.metric === 'mrr_estimated');
  const subscribers = subs.reduce((a, r) => a + num(r.v), 0);
  const flow = Object.fromEntries(subsFlow.map((r) => [r.metric, num(r.v)]));
  return {
    from, to, coverage: cov,
    confirmed: cov.ledgerSince ? { revenue: total, payments, avgTicket: payments ? Math.round(total / payments) : null } : null,
    daily: daily.map((r) => ({ day: dayStr(r.d), revenue: num(r.revenue), payments: num(r.payments) })),
    byPlan: byPlan.map((r) => ({ plan: r.plan, revenue: num(r.revenue), payments: num(r.payments) })),
    statuses: statuses.map((r) => ({ status: r.status, count: num(r.n), amount: num(r.amount) })),
    subscribers: subs.length ? { asOf: dayStr(snapshot.find((r) => r.metric === 'subscribers').day), total: subscribers, byPlan: subs.map((r) => ({ plan: r.dim || 'otro', count: num(r.v) })) } : null,
    // Estimado desde precios de suscripciones activas (no es dinero cobrado): el ingreso real es «confirmed»
    mrrEstimated: mrr.length ? { value: mrr.reduce((a, r) => a + num(r.v), 0), arrEstimated: mrr.reduce((a, r) => a + num(r.v), 0) * 12 } : null,
    subscriptionsNew: flow.subscriptions_new ?? 0, subscriptionsCanceled: flow.subscriptions_canceled ?? 0
  };
};

// ---------- Embudos ----------
export const FUNNELS = {
  registro: { label: 'Registro', steps: [['page_view', 'Visita'], ['signup_started', 'Inicia registro'], ['signup_completed', 'Cuenta creada']] },
  primera_carpeta: { label: 'Primera carpeta', steps: [['signup_completed', 'Cuenta creada'], ['folder_created', 'Carpeta creada'], ['card_added', 'Carta agregada']] },
  escaner: { label: 'Escáner', steps: [['scan_started', 'Abre el escáner'], ['scan_succeeded', 'Reconoce una carta'], ['card_added', 'Agrega la carta']] },
  compra: { label: 'Compra', steps: [['cart_add', 'Agrega al carrito'], ['checkout_started', 'Inicia el pedido'], ['order_created', 'Pedido creado']] },
  plan: { label: 'Suscripción', steps: [['plans_viewed', 'Ve los planes'], ['plan_checkout_started', 'Elige un plan'], ['subscription_confirmed', 'Suscripción confirmada']] }
};

// Cada persona se identifica por su cuenta si la tiene (o si el mismo navegador inició sesión), y si no por su navegador.
// Un paso cuenta solo si ocurrió después del anterior.
export const funnel = async (key, from, to) => {
  const def = FUNNELS[key];
  if (!def) return null;
  const names = def.steps.map((s) => s[0]);
  const rows = await prisma.$queryRaw(Prisma.sql`
    WITH ident AS (SELECT e."visitorId" AS v, max(e."userId") AS u FROM ${E} WHERE e."userId" IS NOT NULL AND e."visitorId" IS NOT NULL AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1),
    ev AS (
      SELECT coalesce(i.u, e."userId", e."visitorId") AS actor, e."name" AS name, e."at" AS at
      FROM ${E} LEFT JOIN ident i ON i.v = e."visitorId"
      WHERE e."name" IN (${Prisma.join(names)}) AND ${within(Prisma.sql`e."at"`, from, to)} AND coalesce(i.u, e."userId", e."visitorId") IS NOT NULL
    )
    SELECT ev.actor AS actor, ev.name AS name, min(ev.at) AS first_at FROM ev GROUP BY 1, 2`);
  const byActor = new Map();
  for (const r of rows) { if (!byActor.has(r.actor)) byActor.set(r.actor, {}); byActor.get(r.actor)[r.name] = new Date(r.first_at).getTime(); }
  const counts = names.map(() => 0);
  for (const marks of byActor.values()) {
    let last = -Infinity;
    for (let i = 0; i < names.length; i += 1) {
      const t = marks[names[i]];
      if (t === undefined || t < last) break;
      counts[i] += 1; last = t;
    }
  }
  return {
    key, label: def.label, from, to,
    steps: def.steps.map(([name, label], i) => ({ name, label, count: counts[i], fromStart: counts[0] ? counts[i] / counts[0] : null, fromPrevious: i === 0 ? null : counts[i - 1] ? counts[i] / counts[i - 1] : null }))
  };
};

// ---------- Retención ----------
// Cohorte = día en que se vio por primera vez a la persona (dentro de lo medido). D1/D7/D30 = volvió exactamente ese día después.
export const retention = async (days = 30) => {
  const today = chileToday();
  const from = addDays(today, -Math.min(Math.max(days, 7), 90));
  const rows = await prisma.$queryRaw`
    WITH ident AS (SELECT e."visitorId" AS v, max(e."userId") AS u FROM ${E} WHERE e."userId" IS NOT NULL AND e."visitorId" IS NOT NULL GROUP BY 1),
    act AS (
      SELECT DISTINCT coalesce(i.u, e."userId", e."visitorId") AS actor, ${chileDay(Prisma.sql`e."at"`)} AS d
      FROM ${E} LEFT JOIN ident i ON i.v = e."visitorId" WHERE e."name" = 'page_view' AND coalesce(i.u, e."userId", e."visitorId") IS NOT NULL
    ),
    first AS (SELECT actor, min(d) AS c FROM act GROUP BY 1)
    SELECT f.c AS cohort, count(*)::int AS size,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM act a WHERE a.actor = f.actor AND a.d = f.c + 1))::int AS d1,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM act a WHERE a.actor = f.actor AND a.d = f.c + 7))::int AS d7,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM act a WHERE a.actor = f.actor AND a.d = f.c + 30))::int AS d30
    FROM first f WHERE f.c >= ${from}::date GROUP BY 1 ORDER BY 1`;
  const cohorts = rows.map((r) => {
    const c = dayStr(r.cohort); const size = num(r.size);
    const mature = (n) => addDays(c, n) <= today; // solo se calcula si ya pasó ese día
    return { cohort: c, size, d1: mature(1) ? { n: num(r.d1), rate: size ? num(r.d1) / size : null } : null, d7: mature(7) ? { n: num(r.d7), rate: size ? num(r.d7) / size : null } : null, d30: mature(30) ? { n: num(r.d30), rate: size ? num(r.d30) / size : null } : null };
  });
  const pool = (k) => { const ok = cohorts.filter((c) => c[k]); const size = ok.reduce((a, c) => a + c.size, 0); return size ? { size, rate: ok.reduce((a, c) => a + c[k].n, 0) / size } : null; };
  return { from, to: today, cohorts, overall: { d1: pool('d1'), d7: pool('d7'), d30: pool('d30') } };
};

// ---------- Salud técnica ----------
export const health = async (from, to) => {
  const [api, vitals, errors, errorSessions] = await Promise.all([
    prisma.$queryRaw`
      SELECT a."dim1" AS route,
        sum(CASE WHEN a."metric" = 'api_count' THEN a."value" ELSE 0 END)::float AS n, sum(CASE WHEN a."metric" = 'api_ms_sum' THEN a."value" ELSE 0 END)::float AS ms,
        max(CASE WHEN a."metric" = 'api_ms_max' THEN a."value" ELSE 0 END)::float AS max_ms, sum(CASE WHEN a."metric" = 'api_slow' THEN a."value" ELSE 0 END)::float AS slow,
        sum(CASE WHEN a."metric" = 'api_4xx' THEN a."value" ELSE 0 END)::float AS e4, sum(CASE WHEN a."metric" = 'api_5xx' THEN a."value" ELSE 0 END)::float AS e5
      FROM "AnalyticsDaily" a WHERE a."metric" LIKE 'api\_%' AND a."day" >= ${from}::date AND a."day" <= ${to}::date GROUP BY 1 HAVING sum(CASE WHEN a."metric" = 'api_count' THEN a."value" ELSE 0 END) > 0 ORDER BY 3 DESC LIMIT 40`,
    prisma.$queryRaw`
      SELECT e."props"->>'name' AS name, count(*)::int AS n, percentile_cont(0.75) WITHIN GROUP (ORDER BY (e."props"->>'value')::float)::float AS p75,
             count(*) FILTER (WHERE e."props"->>'rating' = 'good')::int AS good, count(*) FILTER (WHERE e."props"->>'rating' = 'poor')::int AS poor
      FROM ${E} WHERE e."name" = 'web_vital' AND ${within(Prisma.sql`e."at"`, from, to)} AND e."props"->>'value' IS NOT NULL GROUP BY 1`,
    prisma.$queryRaw`
      SELECT e."props"->>'message' AS message, e."path" AS path, count(*)::int AS n, count(DISTINCT e."sessionId")::int AS sessions, max(e."at") AS last_at
      FROM ${E} WHERE e."name" = 'js_error' AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 25`,
    prisma.$queryRaw`SELECT count(DISTINCT e."sessionId")::int AS n FROM ${E} WHERE e."name" = 'js_error' AND ${within(Prisma.sql`e."at"`, from, to)}`
  ]);
  const [sessions] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "AnalyticsSession" s WHERE ${within(Prisma.sql`s."startedAt"`, from, to)}`;
  return {
    from, to,
    api: api.map((r) => ({ route: r.route, requests: num(r.n), avgMs: num(r.n) ? Math.round(num(r.ms) / num(r.n)) : null, maxMs: Math.round(num(r.max_ms)), slow: num(r.slow), errors4xx: num(r.e4), errors5xx: num(r.e5), errorRate: num(r.n) ? num(r.e5) / num(r.n) : null })),
    vitals: vitals.map((r) => ({ name: r.name, samples: num(r.n), p75: Math.round(num(r.p75) * 1000) / 1000, goodRate: num(r.n) ? num(r.good) / num(r.n) : null, poorRate: num(r.n) ? num(r.poor) / num(r.n) : null })),
    jsErrors: errors.map((r) => ({ message: r.message || '(sin mensaje)', path: r.path, count: num(r.n), sessions: num(r.sessions), lastAt: r.last_at })),
    sessionsWithErrors: { n: num(errorSessions[0]?.n), of: num(sessions?.n) }
  };
};

// ---------- Explorador con lista blanca ----------
export const EXPLORE_GROUPS = { day: Prisma.sql`${chileDay(Prisma.sql`e."at"`)}::text`, path: Prisma.sql`e."path"`, device: Prisma.sql`e."device"`, browser: Prisma.sql`e."browser"`, os: Prisma.sql`e."os"`, source: Prisma.sql`e."source"`, game: Prisma.sql`coalesce(e."props"->>'game', '')`, origin: Prisma.sql`e."origin"` };
export const EXPLORE_MEASURES = { events: Prisma.sql`count(*)::float`, visitors: Prisma.sql`count(DISTINCT e."visitorId")::float`, sessions: Prisma.sql`count(DISTINCT e."sessionId")::float`, users: Prisma.sql`count(DISTINCT e."userId")::float` };
export const EXPLORE_EVENTS = new Set(EVENT_NAMES);

export const explore = async ({ event, groupBy, measure, from, to, limit = 200 }) => {
  if (!EXPLORE_EVENTS.has(event) || !(groupBy in EXPLORE_GROUPS) || !(measure in EXPLORE_MEASURES)) return null;
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT ${EXPLORE_GROUPS[groupBy]} AS k, ${EXPLORE_MEASURES[measure]} AS v FROM ${E}
    WHERE e."name" = ${event} AND ${within(Prisma.sql`e."at"`, from, to)} GROUP BY 1 ORDER BY ${groupBy === 'day' ? Prisma.sql`1 ASC` : Prisma.sql`2 DESC`} LIMIT ${limit}`);
  return { event, groupBy, measure, from, to, rows: rows.map((r) => ({ key: r.k === '' ? '(vacío)' : String(r.k), value: num(r.v) })) };
};
