// Eventos y torneos de las tiendas: validación, inscripción con lista de espera y serialización pública.
import { hasDeceptiveChars } from './validation.js';
import { STORE_GAMES } from './storeProfile.js';

export const EVENT_STATUSES = ['scheduled', 'cancelled', 'finished'];
export const MAX_UPCOMING_EVENTS = 50;
const DAY = 24 * 60 * 60 * 1000;

const badText = (value, max, multiline = false) => typeof value !== 'string' || value.length > max || hasDeceptiveChars(value)
  || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value);

const parseDate = (value) => {
  if (typeof value !== 'string' || value.length > 40) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// creating: exige fecha futura. Devuelve { ok, data } o { ok: false, error }
export const parseStoreEvent = (body, { creating = true, now = new Date() } = {}) => {
  const fail = (error) => ({ ok: false, error });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Datos del evento inválidos.');
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 3 || badText(title, 80)) return fail('El nombre del evento debe tener entre 3 y 80 caracteres.');
  if (!STORE_GAMES.includes(body.game)) return fail('Elige el juego del evento.');
  const startsAt = parseDate(body.startsAt);
  if (!startsAt) return fail('Fecha de inicio inválida.');
  if (creating && startsAt.getTime() < now.getTime() - 60 * 60 * 1000) return fail('La fecha del evento ya pasó.');
  if (startsAt.getTime() > now.getTime() + 366 * DAY) return fail('El evento puede programarse hasta con un año de anticipación.');
  let endsAt = null;
  if (body.endsAt !== undefined && body.endsAt !== null && body.endsAt !== '') {
    endsAt = parseDate(body.endsAt);
    if (!endsAt || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 7 * DAY) return fail('La hora de término debe ser después del inicio (máximo 7 días).');
  }
  let capacity = null;
  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== '') {
    capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return fail('Los cupos deben ser entre 1 y 1000.');
  }
  const feeClp = body.feeClp === undefined || body.feeClp === '' ? 0 : Number(body.feeClp);
  if (!Number.isInteger(feeClp) || feeClp < 0 || feeClp > 1000000) return fail('La inscripción debe ser un monto en pesos entre $0 y $1.000.000.');
  const format = body.format ?? '';
  if (badText(format, 60)) return fail('El formato no es válido (máximo 60 caracteres).');
  const description = body.description ?? '';
  if (badText(description, 1500, true)) return fail('La descripción no es válida (máximo 1500 caracteres).');
  const data = { title, game: body.game, startsAt, endsAt, capacity, feeClp, format: format.trim(), description: description.trim() };
  if (!creating) {
    const status = body.status ?? 'scheduled';
    if (!EVENT_STATUSES.includes(status)) return fail('Estado del evento inválido.');
    const resultNote = body.resultNote ?? '';
    if (badText(resultNote, 1000, true)) return fail('La nota de resultados no es válida (máximo 1000 caracteres).');
    data.status = status;
    data.resultNote = resultNote.trim();
  }
  return { ok: true, data };
};

// Lugar al inscribirse: con cupos llenos va a la lista de espera
export const signupStatusFor = (capacity, registered) => (capacity !== null && capacity !== undefined && registered >= capacity ? 'waitlist' : 'registered');

// Cuántas personas de la lista de espera suben si se liberan cupos
export const promotableCount = (capacity, registered, waiting) => (capacity === null || capacity === undefined ? waiting : Math.max(0, Math.min(waiting, capacity - registered)));

export const toPublicEvent = (event, counts = {}, mine = null) => {
  const registered = counts.registered || 0;
  return {
    id: event.id,
    title: event.title,
    game: event.game,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    capacity: event.capacity,
    feeClp: event.feeClp,
    format: event.format,
    description: event.description,
    status: event.status,
    resultNote: event.status === 'finished' ? event.resultNote : '',
    registered,
    waitlist: counts.waitlist || 0,
    spotsLeft: event.capacity === null ? null : Math.max(0, event.capacity - registered),
    mine
  };
};
