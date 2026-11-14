import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoreProfile, isOpenAt, toPublicStore } from '../core/storeProfile.js';
import { regionOfComuna } from '../core/chileData.js';

test('parseStoreProfile acepta una ficha válida y deduce la región', () => {
  const r = parseStoreProfile({ enabled: true, address: 'Arauco 123', comuna: 'Chillán', hours: { mon: [{ open: '10:00', close: '20:00' }] }, paymentMethods: ['cash', 'debit'], buyGames: ['Pokémon'], photos: [], policy: 'Cambios\nen 7 días' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.region, regionOfComuna('Chillán'));
  assert.deepEqual(r.data.hours.tue, []);
});

test('rechaza horas imposibles, tramos de más, comuna inventada, pagos o juegos desconocidos, fotos ajenas, excepciones de más y textos con control', () => {
  const bads = [
    { hours: { mon: [{ open: '25:00', close: '20:00' }] } },
    { hours: { mon: [1, 2, 3].map(() => ({ open: '10:00', close: '11:00' })) } },
    { hours: { funday: [] } },
    { comuna: 'Gotham' },
    { paymentMethods: ['bitcoin'] },
    { buyGames: ['Fortnite'] },
    { photos: ['javascript:alert(1)'] },
    { photos: ['https://evil.example.com/a.webp'] },
    { exceptions: Array.from({ length: 31 }, (_, i) => ({ date: `2099-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, closed: true })) },
    { address: 'x'.repeat(151) },
    { address: 'a\nb' },
    { policy: '<b>\u0000</b>' },
    { enabled: true, address: '' },
    { pickupHours: 5 },
    'texto'
  ];
  for (const bad of bads) {
    const body = typeof bad === 'string' ? bad : { comuna: 'Chillán', ...bad };
    assert.equal(parseStoreProfile(body).ok, false, JSON.stringify(bad));
  }
});

test('isOpenAt: dentro, fuera, cruzando medianoche y día cerrado por excepción', () => {
  const hours = { fri: [{ open: '18:00', close: '01:00' }], sat: [], mon: [{ open: '10:00', close: '20:00' }] };
  // 2026-11-13 es viernes; hora de Chile en noviembre = UTC-3
  assert.equal(isOpenAt(hours, [], new Date('2026-11-13T22:00:00Z')).open, true); // vie 19:00
  assert.equal(isOpenAt(hours, [], new Date('2026-11-14T03:30:00Z')).open, true); // sáb 00:30, tramo del viernes
  assert.equal(isOpenAt(hours, [], new Date('2026-11-14T05:00:00Z')).open, false); // sáb 02:00
  assert.equal(isOpenAt(hours, [{ date: '2026-11-16', closed: true }], new Date('2026-11-16T15:00:00Z')).open, false); // lunes feriado
  assert.equal(isOpenAt(hours, [], new Date('2026-11-16T15:00:00Z')).closesAt, '20:00');
  assert.equal(isOpenAt(hours, [], new Date('2026-11-16T11:00:00Z')).opensAt, '10:00'); // lun 08:00
  assert.equal(isOpenAt(null, [], new Date()).open, false);
});

test('toPublicStore no devuelve nada si la ficha está apagada y nunca expone campos internos', () => {
  assert.equal(toPublicStore({ enabled: false, address: 'x' }), null);
  const pub = toPublicStore({ id: 'i', userId: 'u', enabled: true, address: 'Arauco 123', comuna: 'Chillán', hours: {}, exceptions: [{ date: '2000-01-01', closed: true }], paymentMethods: [], buyGames: [], sellGames: [], photos: [], policy: '', buyNote: '', reference: '', region: 'Ñuble', createdAt: new Date() });
  for (const key of ['id', 'userId', 'enabled', 'createdAt']) assert.equal(key in pub, false, key);
  assert.deepEqual(pub.exceptions, []);
});
