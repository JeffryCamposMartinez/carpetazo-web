// Avisos de la lista de deseos: cuando una carta deseada aparece a la venta (dentro del precio máximo) o baja de precio, se avisa por correo y por
// notificación del navegador. Cada cierto rato se compara el precio más bajo publicado con el último estado visto de cada carta deseada.
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { sendUserEmail } from './mail.js';
import { isCurrentAcceptance, latestAcceptance } from './legal.js';
import { sendPushToUser } from './push.js';
import { alertEmailHtml } from './alertEmail.js';

const SITE = 'https://carpetazo.cl';
const API = process.env.PUBLIC_API_URL || 'https://api.carpetazo.cl';
const RUN_EVERY_MS = 10 * 60 * 1000;
const ITEM_COOLDOWN_MS = 12 * 60 * 60 * 1000; // una misma carta no se avisa más de dos veces al día
const USER_GAP_MS = 2 * 60 * 60 * 1000; // entre un aviso y otro a la misma persona pasan al menos dos horas (los cambios se juntan en un solo aviso)
const DROP_RATIO = 0.95; // se avisa de una baja desde un 5 %
const SHOWN = 8; // novedades que se detallan en un aviso
const ITEMS_MAX = 20000;
const CHUNK = 400;
const WISH_TCG = { 1: 'Pokemon', 99: 'Mitos y Leyendas', 68: 'OnePiece', 89: 'Riftbound', 1001: 'Magic', 2: 'YuGiOh' };
const clp = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;

// --- Baja de los avisos por correo: enlace firmado en cada correo ---
const unsubscribeToken = (userId) => crypto.createHmac('sha256', process.env.IP_HASH_SALT || 'carpetazo').update(`wishlist-email-unsubscribe|${userId}`).digest('hex').slice(0, 40);
export const isValidUnsubscribeToken = (userId, token) => {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(String(token || ''));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};
export const unsubscribeLink = (userId) => `${API}/api/notifications/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;

// --- Qué cambió en cada carta deseada ---
// Devuelve las novedades y los cambios de estado que hay que guardar (sin tocar la base)
export const planWishlistChanges = (items, bestByItem, now) => {
  const events = [];
  const saves = [];
  for (const item of items) {
    const best = bestByItem.get(item.id) || null;
    const state = item.alertState;
    const price = best ? best.price : null;
    if (!state) { saves.push({ itemId: item.id, userId: item.userId, lastPrice: price }); continue; } // primera vez que se ve: solo queda como punto de partida
    const cooled = !state.notifiedAt || now - state.notifiedAt >= ITEM_COOLDOWN_MS;
    if (state.lastPrice == null && best) {
      if (cooled) events.push({ item, best, kind: 'available' });
      else saves.push({ itemId: item.id, userId: item.userId, lastPrice: price });
    } else if (state.lastPrice != null && !best) {
      saves.push({ itemId: item.id, userId: item.userId, lastPrice: null });
    } else if (state.lastPrice != null && best) {
      if (price <= state.lastPrice * DROP_RATIO && cooled) events.push({ item, best, kind: 'drop', previous: state.lastPrice });
      else if (price !== state.lastPrice) saves.push({ itemId: item.id, userId: item.userId, lastPrice: price });
    }
  }
  return { events, saves };
};

const cardUrl = (event) => `${SITE}/carta/${event.best.cardId}`;
const line = (event) => (event.kind === 'drop' ? `${event.item.name}: bajó de ${clp(event.previous)} a ${clp(event.best.price)}` : `${event.item.name}: disponible desde ${clp(event.best.price)}`);

// Texto del aviso (correo y notificación) para las novedades de una persona
export const buildAlertMessage = (userId, events) => {
  const shown = events.slice(0, SHOWN);
  const extra = events.length - shown.length;
  const one = events.length === 1 ? events[0] : null;
  const subject = one ? (one.kind === 'drop' ? `Bajó el precio de ${one.item.name}` : `¡Apareció ${one.item.name}!`) : `${events.length} novedades en tus cartas deseadas`;
  const listUrl = `${SITE}/dashboard?tab=deseadas`;
  const unsubscribe = unsubscribeLink(userId);
  const text = `${shown.map((event) => `- ${line(event)} (${event.best.seller}) ${cardUrl(event)}`).join('\n')}${extra > 0 ? `\n... y ${extra} más` : ''}\n\nVer mi lista: ${listUrl}\n\nRecibes este correo porque tienes estas cartas en tu lista de deseos. Dejar de recibir avisos: ${unsubscribe}`;
  const html = alertEmailHtml({ events, shown, extra, listUrl, unsubscribe, subject });
  return {
    subject, text, html,
    headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    push: { title: one ? subject : 'Novedades en tus cartas deseadas', body: one ? `${line(one)} · ${one.best.seller}` : shown.map((event) => event.item.name).join(', ').slice(0, 140), url: one ? `/carta/${one.best.cardId}` : '/dashboard?tab=deseadas', tag: 'wishlist-alert' }
  };
};

// Envío real: correo (si la persona no lo apagó) y notificación a sus dispositivos. Las cuentas sin términos vigentes no reciben nada.
const deliverToUser = async (user, message) => {
  if (!isCurrentAcceptance(await latestAcceptance(user.id))) { console.log(`Aviso de deseadas sin enviar (${user.id}): términos no vigentes`); return { email: false, push: 0 }; }
  const emailResult = user.notifyWishlistEmail ? await sendUserEmail(user.id, { subject: message.subject, text: message.text, html: message.html, headers: message.headers }) : { sent: false, reason: 'turned_off' };
  const push = await sendPushToUser(user.id, message.push);
  console.log(`Aviso de deseadas (${user.id}): correo ${emailResult.sent ? 'enviado' : `no (${emailResult.reason})`}, notificaciones a ${push} dispositivo(s)`);
  return { email: emailResult.sent, push };
};

// Una pasada completa. `deliver` y `now` se pueden cambiar en las pruebas.
export const runWishlistAlerts = async ({ deliver = deliverToUser, now = new Date(), userIds = null } = {}) => {
  const items = await prisma.wishlistItem.findMany({
    where: { productId: { not: null }, moderationState: 'visible', user: { role: { not: 'deleted' } }, ...(userIds ? { userId: { in: userIds } } : {}) },
    take: ITEMS_MAX,
    select: { id: true, userId: true, name: true, categoryId: true, productId: true, maxPrice: true, alertState: { select: { lastPrice: true, notifiedAt: true } } }
  });
  // El código de la carta es el id del producto (las del catálogo de Pokémon se guardan como `tcgcsv:<cat>:<id>`)
  const wanted = items.map((item) => ({ item, tcg: WISH_TCG[item.categoryId], tcgId: String(item.productId).replace(/^tcgcsv:\d+:/, '') })).filter((entry) => entry.tcg && /^\d{1,12}$/.test(entry.tcgId));
  const ids = [...new Set(wanted.map((entry) => entry.tcgId))];
  const cards = [];
  for (let at = 0; at < ids.length; at += CHUNK) {
    cards.push(...await prisma.card.findMany({
      where: { stock: { gt: 0 }, price: { gt: 0 }, moderationState: 'visible', tcgId: { in: ids.slice(at, at + CHUNK) }, folder: { isPublic: true, moderationState: 'visible' } },
      orderBy: { price: 'asc' },
      select: { id: true, tcgId: true, price: true, imageUrl: true, folder: { select: { tcg: true, userId: true, user: { select: { name: true, username: true } } } } }
    }));
  }
  const byKey = new Map();
  for (const card of cards) {
    const key = `${card.folder.tcg}|${card.tcgId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(card);
  }
  const bestByItem = new Map();
  for (const { item, tcg, tcgId } of wanted) {
    const best = (byKey.get(`${tcg}|${tcgId}`) || []).find((card) => card.folder.userId !== item.userId && (item.maxPrice == null || card.price <= item.maxPrice));
    if (best) bestByItem.set(item.id, { cardId: best.id, price: best.price, imageUrl: best.imageUrl, seller: best.folder.user?.name || best.folder.user?.username || 'un vendedor' });
  }

  const { events, saves } = planWishlistChanges(wanted.map((entry) => entry.item), bestByItem, now);
  const save = (entry, notified) => prisma.wishlistAlertState.upsert({
    where: { itemId: entry.itemId },
    create: { itemId: entry.itemId, userId: entry.userId, lastPrice: entry.lastPrice, notifiedAt: notified ? now : null },
    update: { lastPrice: entry.lastPrice, ...(notified ? { notifiedAt: now } : {}) }
  });
  for (const entry of saves) await save(entry, false).catch((error) => console.error('Error guardando el estado de un aviso:', error.message));

  // Novedades por persona; si ya se le avisó hace poco, se esperan a la próxima pasada (no se pierden: el estado anterior sigue igual)
  const byUser = new Map();
  for (const event of events) {
    if (!byUser.has(event.item.userId)) byUser.set(event.item.userId, []);
    byUser.get(event.item.userId).push(event);
  }
  let notified = 0;
  for (const [userId, userEvents] of byUser) {
    const recent = await prisma.wishlistAlertState.findFirst({ where: { userId, notifiedAt: { gte: new Date(now - USER_GAP_MS) } }, select: { itemId: true } });
    if (recent) continue;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, notifyWishlistEmail: true } });
    if (!user) continue;
    let result = { email: false, push: 0 };
    try { result = await deliver(user, buildAlertMessage(userId, userEvents)); } catch (error) { console.error('Error enviando un aviso de deseadas:', error.message); continue; }
    const reached = Boolean(result.email || result.push > 0);
    for (const event of userEvents) await save({ itemId: event.item.id, userId, lastPrice: event.best.price }, reached).catch(() => {});
    if (reached) notified += 1;
  }
  return { items: items.length, events: events.length, notified };
};

let running = false;
export const startWishlistAlerts = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas lo ejecutan a mano
  const tick = async () => {
    if (running) return;
    running = true;
    try { const result = await runWishlistAlerts(); if (result.events) console.log(`Avisos de deseadas: ${result.events} novedad(es), ${result.notified} persona(s) avisada(s)`); } catch (error) { console.error('Error en los avisos de la lista de deseos:', error.message); } finally { running = false; }
  };
  setTimeout(tick, 60 * 1000).unref();
  setInterval(tick, RUN_EVERY_MS).unref();
};
