import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateDemand } from '../core/storeDemand.js';

test('aggregateDemand cuenta personas distintas, exige 2 o más y no expone quiénes', () => {
  const items = [
    { userId: 'a', productId: 'tcgcsv:3:111', categoryId: 3, name: 'Charizard' },
    { userId: 'a', productId: 'tcgcsv:3:111~reverse-holofoil', categoryId: 3, name: 'Charizard' },
    { userId: 'b', productId: 'tcgcsv:3:111', categoryId: 3, name: 'Charizard' },
    { userId: 'c', productId: 'tcgcsv:3:222', categoryId: 3, name: 'Pikachu' },
    { userId: 'store', productId: 'tcgcsv:3:222', categoryId: 3, name: 'Pikachu' }
  ];
  const r = aggregateDemand(items, 'store');
  assert.deepEqual(r.map((e) => [e.tcgId, e.count]), [['111', 2]]);
  assert.equal(JSON.stringify(r).includes('"a"'), false);
});
