// Horario de las tiendas en hora de Chile. Copia de isOpenAt de backend/core/storeProfile.js: mantener ambas iguales.
export const STORE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_NAMES = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
export const PAYMENT_NAMES = { cash: 'Efectivo', transfer: 'Transferencia', debit: 'Débito', credit: 'Crédito' };
export const STORE_GAMES = ['Pokémon', 'Mitos y Leyendas', 'Magic', 'Yu-Gi-Oh!', 'One Piece', 'Lorcana', 'Digimon', 'Riftbound'];

const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
const chileParts = (date) => {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, day: p.weekday.slice(0, 3).toLowerCase(), minutes: Number(p.hour) * 60 + Number(p.minute) };
};
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const prevDay = (ymd) => new Date(Date.parse(`${ymd}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const rangesFor = (hours, exceptions, ymd, day) => {
  const ex = (exceptions || []).find((e) => e.date === ymd);
  if (ex) return ex.closed ? [] : ex.ranges || [];
  return (hours && hours[day]) || [];
};

export const chileToday = (date = new Date()) => chileParts(date).ymd;

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
  const yDay = STORE_DAYS[(STORE_DAYS.indexOf(now.day) + 6) % 7];
  for (const r of rangesFor(hours, exceptions, prevDay(now.ymd), yDay)) {
    const o = toMin(r.open), c = toMin(r.close);
    if (c <= o && now.minutes < c) return { open: true, closesAt: r.close, opensAt: null };
  }
  const next = today.map((r) => r.open).filter((t) => toMin(t) > now.minutes).sort()[0] || null;
  return { ...closed, opensAt: next };
};

const rangeText = (ranges) => (ranges?.length ? ranges.map((r) => `${r.open}–${r.close}`).join(' y ') : 'Cerrado');

export const formatHours = (hours) => STORE_DAYS.map((day) => ({ day: DAY_NAMES[day], key: day, text: rangeText(hours?.[day]) }));

export const formatException = (e) => (e.closed ? 'Cerrado' : rangeText(e.ranges)) + (e.note ? ` · ${e.note}` : '');

export const openLabel = (state) => {
  if (state.open) return `Abierto ahora · cierra a las ${state.closesAt}`;
  return state.opensAt ? `Cerrado · abre a las ${state.opensAt}` : 'Cerrado ahora';
};

export const mapLinks = (store) => {
  const q = encodeURIComponent([store.address, store.comuna, 'Chile'].filter(Boolean).join(', '));
  return { google: `https://www.google.com/maps/search/?api=1&query=${q}`, waze: `https://waze.com/ul?q=${q}` };
};
