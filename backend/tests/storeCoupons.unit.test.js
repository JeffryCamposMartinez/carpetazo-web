import test from 'node:test';
import assert from 'node:assert/strict';
import { couponProblem, discountFor, parseCoupon } from '../core/storeCoupons.js';

test('parseCoupon normaliza y valida', () => {
  const r = parseCoupon({ code: ' verano10 ', kind: 'percent', value: 10 });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.code, 'VERANO10');
  for (const bad of [{ code: 'a b', kind: 'percent', value: 10 }, { code: 'OK1', kind: 'percent', value: 95 }, { code: 'OK1', kind: 'fixed', value: 0 }, { code: 'OK1', kind: 'gratis', value: 5 }, { code: 'OK1', kind: 'percent', value: 10, startsAt: '2026-12-01', endsAt: '2026-11-01' }, { code: 'OK1', kind: 'percent', value: 10, maxPerUser: 0 }]) {
    assert.equal(parseCoupon(bad).ok, false, JSON.stringify(bad));
  }
});

test('discountFor nunca pasa del total', () => {
  assert.equal(discountFor({ kind: 'percent', value: 10 }, 15000), 1500);
  assert.equal(discountFor({ kind: 'fixed', value: 5000 }, 3000), 3000);
  assert.equal(discountFor({ kind: 'percent', value: 33 }, 1001), 330);
});

test('couponProblem: vigencia, mínimo, usos totales y por persona', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const base = { active: true, startsAt: null, endsAt: null, minTotal: 10000, maxUses: 2, maxPerUser: 1 };
  assert.equal(couponProblem(base, { total: 12000, now }), null);
  assert.match(couponProblem({ ...base, active: false }, { total: 12000, now }), /no existe/);
  assert.match(couponProblem({ ...base, endsAt: new Date('2026-11-01') }, { total: 12000, now }), /venció/);
  assert.match(couponProblem({ ...base, startsAt: new Date('2026-12-01') }, { total: 12000, now }), /todavía/);
  assert.match(couponProblem(base, { total: 9999, now }), /mínima/);
  assert.match(couponProblem(base, { total: 12000, now, usesAll: 2 }), /usos/);
  assert.match(couponProblem(base, { total: 12000, now, usesMine: 1 }), /Ya usaste/);
  assert.match(couponProblem(null, { total: 1, now }), /no existe/);
});
