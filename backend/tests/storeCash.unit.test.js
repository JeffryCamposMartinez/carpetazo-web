import test from 'node:test';
import assert from 'node:assert/strict';
import { chileDay, summarizeCash } from '../core/storeCash.js';

test('chileDay usa la hora de Chile (UTC-3 en noviembre)', () => {
  assert.equal(chileDay('2026-11-15T02:30:00Z'), '2026-11-14');
  assert.equal(chileDay('2026-11-15T03:30:00Z'), '2026-11-15');
});

test('summarizeCash agrupa por día y medio de pago', () => {
  const now = new Date('2026-11-15T15:00:00Z');
  const r = summarizeCash(
    [{ total: 5000, paymentMethod: 'cash', createdAt: '2026-11-15T14:00:00Z' }, { total: 3000, paymentMethod: 'debit', createdAt: '2026-11-15T13:00:00Z' }, { total: 1000, paymentMethod: '', createdAt: '2026-11-14T13:00:00Z' }, { total: 99, paymentMethod: 'cash', createdAt: '2026-10-01T13:00:00Z' }],
    [{ total: 12000, updatedAt: '2026-11-15T12:00:00Z' }],
    7, now
  );
  assert.equal(r.days.length, 7);
  assert.equal(r.days[0].date, '2026-11-15');
  assert.equal(r.days[0].total, 20000);
  assert.equal(r.days[0].byMethod.cash, 5000);
  assert.equal(r.days[0].byMethod.orders, 12000);
  assert.equal(r.days[1].byMethod.unspecified, 1000);
  assert.equal(r.totals.total, 21000); // la venta de octubre queda fuera del rango
  assert.equal(r.totals.count, 4);
});
