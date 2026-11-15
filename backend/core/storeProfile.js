// Ficha del local de las tiendas (plan Tienda): validación, horario «abierto ahora» en hora de Chile y serialización pública.
// frontend/src/utils/storeHours.js tiene una copia de isOpenAt: mantener ambas iguales.
import { isAllowedStoredImageUrl, hasDeceptiveChars } from './validation.js';
import { isValidComuna, regionOfComuna } from './chileData.js';

export const STORE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const STORE_PAYMENTS = ['cash', 'transfer', 'debit', 'credit'];
export const STORE_GAMES = ['Pokémon', 'Mitos y Leyendas', 'Magic', 'Yu-Gi-Oh!', 'One Piece', 'Lorcana', 'Digimon', 'Riftbound'];
const MAX_RANGES = 2;
const MAX_EXCEPTIONS = 30;
const MAX_PHOTOS = 6;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = 'America/Santiago';

// Texto libre: permite saltos de línea y tabulaciones (política), nada más de control
const badText = (value, max) => typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || hasDeceptiveChars(value);
const oneLine = (value, max) => badText(value, max) || /[\r\n\t]/.test(value);

const parseRanges = (ranges) => {
  if (!Array.isArray(ranges) || ranges.length > MAX_RANGES) return null;
  const out = [];
  for (const r of ranges) {
    if (!r || typeof r !== 'object' || !TIME_RE.test(r.open) || !TIME_RE.test(r.close) || r.open === r.close) return null;
    out.push({ open: r.open, close: r.close });
  }
  return out;
};

const pickList = (value, allowed, max) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some((v) => !allowed.includes(v))) return null;
  return [...new Set(value)];
};

export const chileToday = (date = new Date()) => chileParts(date).ymd;

export const parseStoreProfile = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Datos de la tienda inválidos.' };
  const fail = (error) => ({ ok: false, error });
  const text = (key, max, single = true) => {
    const v = body[key] ?? '';
    return (single ? oneLine(v, max) : badText(v, max)) ? null : v.trim();
  };
  const address = text('address', 150);
  if (address === null) return fail('La dirección no es válida (máximo 150 caracteres).');
  const reference = text('reference', 150);
  if (reference === null) return fail('La referencia no es válida (máximo 150 caracteres).');
  const buyNote = text('buyNote', 300);
  if (buyNote === null) return fail('La nota de compra no es válida (máximo 300 caracteres).');
  const policy = text('policy', 2000, false);
  if (policy === null) return fail('La política de cambios no es válida (máximo 2000 caracteres).');

  const comuna = body.comuna ?? '';
  if (comuna !== '' && !isValidComuna(comuna)) return fail('Elige una comuna válida.');
  const enabled = body.enabled === true;
  if (enabled && (!address || !comuna)) return fail('Para mostrar tu local escribe la dirección y la comuna.');

  let hours = null;
  if (body.hours !== undefined && body.hours !== null) {
    if (typeof body.hours !== 'object' || Array.isArray(body.hours) || Object.keys(body.hours).some((k) => !STORE_DAYS.includes(k))) return fail('Horario inválido.');
    hours = {};
    for (const day of STORE_DAYS) {
      const ranges = parseRanges(body.hours[day] ?? []);
      if (!ranges) return fail('Horario inválido: hasta 2 tramos por día con horas HH:MM.');
      hours[day] = ranges;
    }
  }

  const today = chileToday();
  let exceptions = [];
  if (body.exceptions !== undefined && body.exceptions !== null) {
    if (!Array.isArray(body.exceptions)) return fail('Días especiales inválidos.');
    const seen = new Set();
    for (const e of body.exceptions) {
      if (!e || typeof e !== 'object' || !DATE_RE.test(e.date) || Number.isNaN(Date.parse(`${e.date}T00:00:00Z`)) || seen.has(e.date)) return fail('Días especiales inválidos.');
      seen.add(e.date);
      if (e.date < today) continue; // las pasadas se descartan solas
      const note = e.note ?? '';
      if (oneLine(note, 80)) return fail('La nota del día especial no es válida (máximo 80 caracteres).');
      const closed = e.closed === true;
      const ranges = closed ? [] : parseRanges(e.ranges ?? []);
      if (!ranges || (!closed && ranges.length === 0)) return fail('Día especial inválido: marca cerrado o escribe su horario.');
      exceptions.push({ date: e.date, closed, ranges, note: note.trim() });
    }
    if (exceptions.length > MAX_EXCEPTIONS) return fail(`Máximo ${MAX_EXCEPTIONS} días especiales.`);
    exceptions.sort((a, b) => a.date.localeCompare(b.date));
  }

  const paymentMethods = pickList(body.paymentMethods, STORE_PAYMENTS, STORE_PAYMENTS.length);
  if (!paymentMethods) return fail('Medio de pago inválido.');
  const buyGames = pickList(body.buyGames, STORE_GAMES, STORE_GAMES.length);
  const sellGames = pickList(body.sellGames, STORE_GAMES, STORE_GAMES.length);
  if (!buyGames || !sellGames) return fail('Juego inválido.');

  const photos = body.photos ?? [];
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS || photos.some((p) => typeof p !== 'string' || !isAllowedStoredImageUrl(p))) return fail(`Fotos inválidas (máximo ${MAX_PHOTOS}).`);

  const pickupHours = body.pickupHours ?? 48;
  if (![24, 48, 72].includes(pickupHours)) return fail('Plazo de retiro inválido.');

  return {
    ok: true,
    data: { enabled, address, reference, comuna, region: comuna ? regionOfComuna(comuna) : '', hours, exceptions, paymentMethods, buyGames, sellGames, buyNote, photos: [...new Set(photos)], policy, pickupHours }
  };
};

const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
const chileParts = (date) => {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, day: p.weekday.slice(0, 3).toLowerCase(), minutes: Number(p.hour) * 60 + Number(p.minute) };
};
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const prevDay = (ymd) => new Date(Date.parse(`${ymd}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

// Tramos de una fecha: la excepción manda sobre el horario semanal
const rangesFor = (hours, exceptions, ymd, day) => {
  const ex = (exceptions || []).find((e) => e.date === ymd);
  if (ex) return ex.closed ? [] : ex.ranges || [];
  return (hours && hours[day]) || [];
};

// Un tramo con cierre <= apertura cruza la medianoche y termina al día siguiente
export const isOpenAt = (hours, exceptions, date = new Date()) => {
  const closed = { open: false, closesAt: null, opensAt: null };
  if (!hours) return closed;
  const now = chileParts(date);
  const today = rangesFor(hours, exceptions, now.ymd, now.day);
  for (const r of today) {
    const o = toMin(r.open), c = toMin(r.close);
    if (c > o ? now.minutes >= o && now.minutes < c : now.minutes >= o) return { open: true, closesAt: r.close, opensAt: null };
  }
  const yYmd = prevDay(now.ymd);
  const yDay = STORE_DAYS[(STORE_DAYS.indexOf(now.day) + 6) % 7];
  for (const r of rangesFor(hours, exceptions, yYmd, yDay)) {
    const o = toMin(r.open), c = toMin(r.close);
    if (c <= o && now.minutes < c) return { open: true, closesAt: r.close, opensAt: null };
  }
  const next = today.map((r) => r.open).filter((t) => toMin(t) > now.minutes).sort()[0] || null;
  return { ...closed, opensAt: next };
};

export const toPublicStore = (profile, date = new Date()) => {
  if (!profile || !profile.enabled) return null;
  const today = chileToday(date);
  const exceptions = (Array.isArray(profile.exceptions) ? profile.exceptions : []).filter((e) => e.date >= today);
  return {
    address: profile.address,
    reference: profile.reference,
    comuna: profile.comuna,
    region: profile.region,
    hours: profile.hours || null,
    exceptions,
    paymentMethods: profile.paymentMethods || [],
    buyGames: profile.buyGames || [],
    sellGames: profile.sellGames || [],
    buyNote: profile.buyNote,
    photos: profile.photos || [],
    policy: profile.policy,
    pickupHours: profile.pickupHours,
    verified: Boolean(profile.verifiedAt),
    openNow: isOpenAt(profile.hours, exceptions, date)
  };
};

// Ficha pública de una cuenta: solo con plan Tienda vigente y ficha activa (si baja de plan, se oculta sin borrarse)
export const loadPublicStore = async (db, userId, getEffectivePlan) => {
  const profile = await db.storeProfile.findUnique({ where: { userId } });
  if (!profile?.enabled) return null;
  // El local solo se publica con la identidad de la cuenta verificada
  const owner = await db.user.findUnique({ where: { id: userId }, select: { identityVerifiedAt: true } });
  if (!owner?.identityVerifiedAt) return null;
  const { plan } = await getEffectivePlan(db, userId);
  return plan.storeTools ? toPublicStore(profile) : null;
};
