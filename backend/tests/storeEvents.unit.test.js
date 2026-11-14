import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoreEvent, promotableCount, signupStatusFor, toPublicEvent } from '../core/storeEvents.js';

const now = new Date('2026-11-14T15:00:00Z');
const base = { title: 'Torneo Pokémon Estándar', game: 'Pokémon', startsAt: '2026-11-21T18:00:00.000Z', capacity: 16, feeClp: 3000, format: 'Estándar', description: 'Premios para el top 4' };

test('parseStoreEvent acepta un evento válido', () => {
  const r = parseStoreEvent(base, { now });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.capacity, 16);
  assert.ok(r.data.startsAt instanceof Date);
});

test('parseStoreEvent rechaza datos malos', () => {
  for (const bad of [{ title: 'ab' }, { game: 'Fortnite' }, { startsAt: 'mañana' }, { startsAt: '2026-11-01T10:00:00Z' }, { startsAt: '2028-01-01T10:00:00Z' }, { endsAt: '2026-11-21T17:00:00Z' }, { capacity: 0 }, { capacity: 2.5 }, { feeClp: -1 }, { feeClp: 1.5 }, { format: 'x'.repeat(61) }, { title: 'Torneo‮' }]) {
    assert.equal(parseStoreEvent({ ...base, ...bad }, { now }).ok, false, JSON.stringify(bad));
  }
  assert.equal(parseStoreEvent({ ...base, status: 'raro' }, { creating: false, now }).ok, false);
});

test('al editar se permite una fecha pasada (para marcar terminado)', () => {
  const r = parseStoreEvent({ ...base, startsAt: '2026-11-01T10:00:00Z', status: 'finished', resultNote: '1° Ana' }, { creating: false, now });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.status, 'finished');
});

test('cupos y lista de espera', () => {
  assert.equal(signupStatusFor(2, 1), 'registered');
  assert.equal(signupStatusFor(2, 2), 'waitlist');
  assert.equal(signupStatusFor(null, 500), 'registered');
  assert.equal(promotableCount(4, 2, 5), 2);
  assert.equal(promotableCount(4, 4, 5), 0);
  assert.equal(promotableCount(null, 4, 3), 3);
});

test('toPublicEvent calcula cupos y oculta resultados de eventos no terminados', () => {
  const e = toPublicEvent({ id: 'e', storeId: 's', title: 'T', game: 'Pokémon', startsAt: now, endsAt: null, capacity: 8, feeClp: 0, format: '', description: '', status: 'scheduled', resultNote: 'x', reminderSentAt: null }, { registered: 3, waitlist: 0 });
  assert.equal(e.spotsLeft, 5);
  assert.equal(e.resultNote, '');
  assert.equal('storeId' in e || 'reminderSentAt' in e, false);
});
