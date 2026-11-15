// Carpetazo Intelligence — trabajos de fondo: consolidar el día anterior, foto de negocio, reconstrucción histórica honesta y retención.
// Días en hora de Chile (America/Santiago). Todo es idempotente: repetirlo para el mismo día reemplaza, nunca duplica.
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { getAnalyticsSettings } from './analytics.js';

const TZ = 'America/Santiago';
const dayOf = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
const DAY_ROLLUP_METRICS = ['visits', 'visitors', 'sessions', 'users_active', 'path_views', 'path_visitors', 'event_count', 'event_game', 'sessions_device', 'sessions_browser', 'sessions_os', 'sessions_source', 'entries', 'exits', 'bounces', 'active_sec_sum', 'sessions_n'];
const evDay = Prisma.sql`((e."at" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date`;
const seDay = Prisma.sql`((s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date`;

// Consolida un día (YYYY-MM-DD, hora de Chile) desde los eventos y las sesiones crudas
export const rollupDay = async (day) => {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "AnalyticsDaily" WHERE "day" = ${day}::date AND "metric" IN (${Prisma.join(DAY_ROLLUP_METRICS)})`;
    const ins = (metric, select) => tx.$executeRaw(Prisma.sql`INSERT INTO "AnalyticsDaily" ("day","metric","dim1","dim2","value") ${select}`);
    const E = (metric, d1, d2, agg, where, group) => ins(metric, Prisma.sql`SELECT ${day}::date, ${metric}, ${d1}, ${d2}, ${agg} FROM "AnalyticsEvent" e WHERE ${evDay} = ${day}::date AND ${where} ${group}`);
    await E('visits', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`e."name" = 'page_view'`, Prisma.empty);
    await E('visitors', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`count(DISTINCT e."visitorId")::float`, Prisma.sql`e."name" = 'page_view' AND e."visitorId" IS NOT NULL`, Prisma.empty);
    await E('sessions', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`count(DISTINCT e."sessionId")::float`, Prisma.sql`e."name" = 'page_view' AND e."sessionId" IS NOT NULL`, Prisma.empty);
    await E('users_active', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`count(DISTINCT e."userId")::float`, Prisma.sql`e."userId" IS NOT NULL`, Prisma.empty);
    await E('path_views', Prisma.sql`e."path"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`e."name" = 'page_view'`, Prisma.sql`GROUP BY e."path"`);
    await E('path_visitors', Prisma.sql`e."path"`, Prisma.sql`''`, Prisma.sql`count(DISTINCT e."visitorId")::float`, Prisma.sql`e."name" = 'page_view' AND e."visitorId" IS NOT NULL`, Prisma.sql`GROUP BY e."path"`);
    await E('event_count', Prisma.sql`e."name"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`true`, Prisma.sql`GROUP BY e."name"`);
    await E('event_game', Prisma.sql`e."name"`, Prisma.sql`e."props"->>'game'`, Prisma.sql`count(*)::float`, Prisma.sql`e."props"->>'game' IS NOT NULL`, Prisma.sql`GROUP BY e."name", e."props"->>'game'`);
    const S = (metric, d1, d2, agg, where, group) => ins(metric, Prisma.sql`SELECT ${day}::date, ${metric}, ${d1}, ${d2}, ${agg} FROM "AnalyticsSession" s WHERE ${seDay} = ${day}::date AND ${where} ${group}`);
    await S('sessions_device', Prisma.sql`s."device"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`true`, Prisma.sql`GROUP BY s."device"`);
    await S('sessions_browser', Prisma.sql`s."browser"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`true`, Prisma.sql`GROUP BY s."browser"`);
    await S('sessions_os', Prisma.sql`s."os"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`true`, Prisma.sql`GROUP BY s."os"`);
    await S('sessions_source', Prisma.sql`s."source"`, Prisma.sql`s."medium"`, Prisma.sql`count(*)::float`, Prisma.sql`true`, Prisma.sql`GROUP BY s."source", s."medium"`);
    await S('entries', Prisma.sql`s."entryPath"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`s."entryPath" <> ''`, Prisma.sql`GROUP BY s."entryPath"`);
    await S('exits', Prisma.sql`s."exitPath"`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`s."exitPath" <> ''`, Prisma.sql`GROUP BY s."exitPath"`);
    await S('bounces', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`s."pages" <= 1 AND s."activeSec" < 10`, Prisma.empty);
    await S('active_sec_sum', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`coalesce(sum(s."activeSec"), 0)::float`, Prisma.sql`true`, Prisma.empty);
    await S('sessions_n', Prisma.sql`''`, Prisma.sql`''`, Prisma.sql`count(*)::float`, Prisma.sql`true`, Prisma.empty);
  });
};

// ---------- Cifras de negocio ----------
const upsertBiz = (day, metric, dim, value, origin) => prisma.$executeRaw`
  INSERT INTO "BusinessDaily" ("day","metric","dim","value","origin") VALUES (${day}::date, ${metric}, ${dim}, ${value}, ${origin})
  ON CONFLICT ("day","metric","dim") DO UPDATE SET "value" = EXCLUDED."value", "origin" = EXCLUDED."origin"`;

const grouped = (table, column) => prisma.$queryRaw(Prisma.sql`SELECT (((${Prisma.raw(`"${column}"`)}) AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date AS d, count(*)::int AS n FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} IS NOT NULL GROUP BY d`);

// Reconstrucción: SOLO hechos que dejaron una fila con fecha. Se rotulan «reconstructed».
// Las cartas y carpetas cuentan únicamente las que siguen existiendo (las eliminadas no dejan rastro): por eso son «_surviving».
export const backfillBusiness = async () => {
  const sources = [
    ['users_new', 'User', 'createdAt'], ['folders_new_surviving', 'Folder', 'createdAt'], ['cards_added_surviving', 'Card', 'createdAt'],
    ['wishlist_items_new_surviving', 'WishlistItem', 'createdAt'], ['orders_new', 'Order', 'createdAt'], ['subscriptions_new', 'Subscription', 'createdAt'],
    ['subscriptions_canceled', 'Subscription', 'canceledAt']
  ];
  let rows = 0;
  for (const [metric, table, column] of sources) {
    for (const row of await grouped(table, column)) { await upsertBiz(dayOf(row.d instanceof Date ? row.d : new Date(row.d)), metric, '', row.n, 'reconstructed'); rows += 1; }
  }
  return rows;
};

// Foto del día (medida): totales actuales. Del pasado no se inventa nada.
export const snapshotBusiness = async (day = dayOf(new Date())) => {
  const one = async (sql) => Number((await prisma.$queryRaw(sql))[0]?.n || 0);
  const totals = {
    users_total: await one(Prisma.sql`SELECT count(*)::int AS n FROM "User" WHERE "role" <> 'deleted'`),
    folders_total: await one(Prisma.sql`SELECT count(*)::int AS n FROM "Folder"`),
    folders_public: await one(Prisma.sql`SELECT count(*)::int AS n FROM "Folder" WHERE "isPublic" = true`),
    cards_total: await one(Prisma.sql`SELECT count(*)::int AS n FROM "Card"`),
    wishlist_items_total: await one(Prisma.sql`SELECT count(*)::int AS n FROM "WishlistItem"`)
  };
  for (const [metric, value] of Object.entries(totals)) await upsertBiz(day, metric, '', value, 'measured');
  const subs = await prisma.$queryRaw(Prisma.sql`SELECT "planKey" AS plan, count(*)::int AS n, coalesce(sum("priceClp"), 0)::int AS mrr FROM "Subscription" WHERE "status" IN ('active','past_due') GROUP BY "planKey"`);
  for (const row of subs) { await upsertBiz(day, 'subscribers', row.plan, row.n, 'measured'); await upsertBiz(day, 'mrr_estimated', row.plan, row.mrr, 'measured'); }
  return totals;
};

// ---------- Retención ----------
export const purgeAnalytics = async (now = new Date()) => {
  const { retentionDays } = await getAnalyticsSettings(true);
  const cutoff = new Date(now.getTime() - Math.max(7, retentionDays) * 24 * 3600 * 1000);
  const events = await prisma.analyticsEvent.deleteMany({ where: { at: { lt: cutoff } } });
  const sessions = await prisma.analyticsSession.deleteMany({ where: { lastAt: { lt: cutoff } } });
  const old = new Date(now.getTime() - 25 * 31 * 24 * 3600 * 1000);
  const daily = await prisma.analyticsDaily.deleteMany({ where: { day: { lt: old } } });
  return { events: events.count, sessions: sessions.count, daily: daily.count };
};

// Borra todo rastro de una persona (al eliminar su cuenta): sus eventos y sesiones
export const eraseUserAnalytics = async (userId) => {
  const events = await prisma.analyticsEvent.deleteMany({ where: { userId } });
  const sessions = await prisma.analyticsSession.updateMany({ where: { userId }, data: { userId: null } });
  return { events: events.count, sessions: sessions.count };
};

// ---------- Programación: una vez al día, pasadas las 03:30 de Chile ----------
const chileClock = (now) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute) };
};
export const runNightly = async (now = new Date(), { force = false } = {}) => {
  const clock = chileClock(now);
  if (!force && !(clock.hour > 3 || (clock.hour === 3 && clock.minute >= 30))) return { ran: false };
  const yesterday = dayOf(new Date(now.getTime() - 24 * 3600 * 1000));
  const done = await prisma.analyticsDaily.findFirst({ where: { day: new Date(`${yesterday}T00:00:00Z`), metric: 'job_rollup_done' }, select: { day: true } });
  if (done && !force) return { ran: false };
  await rollupDay(yesterday);
  if ((await prisma.businessDaily.count({ where: { origin: 'reconstructed' } })) === 0) await backfillBusiness();
  await snapshotBusiness(dayOf(now));
  const purged = await purgeAnalytics(now);
  await prisma.$executeRaw`INSERT INTO "AnalyticsDaily" ("day","metric","dim1","dim2","value") VALUES (${yesterday}::date, 'job_rollup_done', '', '', 1) ON CONFLICT ("day","metric","dim1","dim2") DO UPDATE SET "value" = 1`;
  return { ran: true, day: yesterday, purged };
};

let nightlyTimer = null;
export const startAnalyticsJobs = () => {
  if (nightlyTimer || process.env.TEST_AUTH_STUB === '1') return;
  const tick = () => runNightly().catch((error) => console.warn('Trabajo nocturno de analítica:', error?.message || error));
  nightlyTimer = setInterval(tick, 10 * 60 * 1000);
  nightlyTimer.unref?.();
  setTimeout(tick, 2 * 60 * 1000).unref?.();
};
