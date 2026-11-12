import test from 'node:test';
import assert from 'node:assert/strict';
import { mixSlots } from '../core/listingMix.js';

test('la prioridad es una probabilidad: la primera página mezcla niveles y nunca es solo de Tienda', () => {
  for (let run = 0; run < 200; run += 1) {
    const { kinds } = mixSlots(`semilla${run}`, 0, 24, { 0: 500, 1: 500, 2: 500 });
    assert.equal(kinds.length, 24);
    assert.ok(kinds.includes(0), `semilla${run}: debe haber cartas de vendedores normales`);
  }
  const share = (level) => Array.from({ length: 300 }, (_, i) => mixSlots(`p${i}`, 0, 24, { 0: 999, 1: 999, 2: 999 }).kinds).flat().filter((kind) => kind === level).length / (300 * 24);
  assert.ok(Math.abs(share(2) - 0.4) < 0.05 && Math.abs(share(1) - 0.2) < 0.05);
});

test('las páginas se encadenan sin repetir ni perder cartas y respetan lo que hay', () => {
  const counts = { 0: 30, 1: 2, 2: 7 };
  const used = { 0: 0, 1: 0, 2: 0 };
  for (let page = 0; page < 3; page += 1) {
    const { kinds, offsets } = mixSlots('x', page * 24, 24, counts);
    for (const level of [0, 1, 2]) assert.equal(offsets[level], used[level], `página ${page + 1}, nivel ${level}`);
    kinds.forEach((kind) => { used[kind] += 1; });
  }
  assert.deepEqual(used, counts); // 39 cartas en total, todas mostradas una sola vez
});
