// Contadores de actividad por día, sin datos de personas: solo «qué pasó» y «cuántas veces» (ni usuario, ni IP, ni cookie).
// Sirven para saber qué se busca y no existe, cuánto interés hay en los planes y si Google ya recorre el catálogo.
import { prisma } from './db.js';
import { PLANS, PLAN_KEYS } from './plans.js';

// Lo que puede registrar la web (POST /api/metrics): nombre -> cómo se valida la clave que lo acompaña
const CLIENT_METRICS = {
  plans_view: () => '',                                  // abrió la página de planes
  plan_cta: (key) => (PLAN_KEYS.includes(key) && key !== 'free' && !PLANS[key].adminOnly ? key : null), // pulsó «elegir» en un plan de pago
  share_card: () => '',                                  // compartió una carta
  share_folder: () => '',                                // compartió una carpeta
};
export const clientMetricKey = (name, key) => (Object.hasOwn(CLIENT_METRICS, name) ? CLIENT_METRICS[name](typeof key === 'string' ? key : '') : null);

// Una búsqueda se guarda solo si parece el nombre de una carta: sin correos, teléfonos ni textos largos
export const searchKey = (value) => {
  const text = String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (text.length < 3 || text.length > 60 || /@|https?:|\d{6,}/.test(text)) return null;
  return text;
};

// Suma 1 al contador de hoy. Nunca falla ni demora a quien lo llama.
export const bumpMetric = (name, key = '', db = prisma) => {
  db.$executeRaw`INSERT INTO "MetricDay" ("day","name","key","count") VALUES ((now() AT TIME ZONE 'UTC')::date, ${name}, ${key}, 1)
    ON CONFLICT ("day","name","key") DO UPDATE SET "count" = "MetricDay"."count" + 1`.catch((error) => console.warn('No se pudo registrar la métrica:', error?.message || error));
};

// Familia del rastreador (para saber si Google ya recorre el catálogo); cualquier otro agente cuenta como «otro»
export const botFamily = (userAgent) => (/googlebot/i.test(userAgent || '') ? 'google' : /bingbot/i.test(userAgent || '') ? 'bing' : /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|discordbot|slackbot|linkedinbot/i.test(userAgent || '') ? 'mensajería' : 'otro');
