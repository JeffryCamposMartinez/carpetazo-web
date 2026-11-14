// «Vende tu colección»: validación de la lista de cartas, la oferta y los cambios de estado permitidos.
import { hasDeceptiveChars, isAllowedStoredImageUrl } from './validation.js';
import { STORE_GAMES } from './storeProfile.js';

export const MAX_ITEMS = 200;
export const MAX_PHOTOS = 6;
export const MAX_OPEN_PER_STORE = 3;
export const OPEN_STATUSES = ['pending', 'offered'];
const CONDITIONS = ['', 'NM', 'LP', 'MP', 'HP', 'DMG'];

const badText = (value, max, multiline = false) => typeof value !== 'string' || value.length > max || hasDeceptiveChars(value)
  || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value);

export const parseBuyRequest = (body) => {
  const fail = (error) => ({ ok: false, error });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Datos inválidos.');
  const game = body.game ?? '';
  if (game !== '' && !STORE_GAMES.includes(game)) return fail('Juego inválido.');
  if (!Array.isArray(body.items) || body.items.length === 0) return fail('Agrega al menos una carta.');
  if (body.items.length > MAX_ITEMS) return fail(`Máximo ${MAX_ITEMS} cartas por solicitud.`);
  const items = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object') return fail('Carta inválida.');
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name || badText(name, 120)) return fail('Cada carta necesita un nombre (máximo 120 caracteres).');
    const quantity = raw.quantity === undefined ? 1 : Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return fail('La cantidad debe ser entre 1 y 999.');
    const condition = raw.condition ?? '';
    if (!CONDITIONS.includes(condition)) return fail('Estado de carta inválido.');
    const set = raw.set ?? '';
    if (badText(set, 80)) return fail('Edición inválida.');
    items.push({ name, quantity, condition, set: set.trim() });
  }
  const photos = body.photos ?? [];
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS || photos.some((p) => typeof p !== 'string' || !isAllowedStoredImageUrl(p))) return fail(`Fotos inválidas (máximo ${MAX_PHOTOS}).`);
  const note = body.note ?? '';
  if (badText(note, 1000, true)) return fail('La nota no es válida (máximo 1000 caracteres).');
  return { ok: true, data: { game, items, photos: [...new Set(photos)], note: note.trim() } };
};

export const parseOffer = (body) => {
  const offerClp = Number(body?.offerClp);
  if (!Number.isInteger(offerClp) || offerClp < 0 || offerClp > 100000000) return { ok: false, error: 'La oferta debe ser un monto en pesos entre $0 y $100.000.000.' };
  const offerNote = body?.offerNote ?? '';
  if (badText(offerNote, 1000, true)) return { ok: false, error: 'La nota de la oferta no es válida (máximo 1000 caracteres).' };
  return { ok: true, data: { offerClp, offerNote: offerNote.trim() } };
};

// Quién puede pasar de qué estado a cuál
const TRANSITIONS = {
  store: { offer: ['pending', 'offered'], decline: ['pending', 'offered'] },
  seller: { accept: ['offered'], reject: ['offered'], cancel: ['pending', 'offered'] }
};
const RESULT = { offer: 'offered', decline: 'rejected', accept: 'accepted', reject: 'rejected', cancel: 'cancelled' };
export const nextStatus = (role, action, current) => (TRANSITIONS[role]?.[action]?.includes(current) ? RESULT[action] : null);

export const toBuyRequestView = (r) => ({
  id: r.id,
  game: r.game,
  items: r.items,
  photos: r.photos,
  note: r.note,
  offerClp: r.offerClp,
  offerNote: r.offerNote,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  ...(r.user ? { seller: { name: r.user.name, username: r.user.username } } : {}),
  ...(r.store ? { store: { name: r.store.name, username: r.store.username } } : {})
});
