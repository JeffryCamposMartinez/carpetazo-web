import test from 'node:test';
import assert from 'node:assert/strict';
import { searchFragments, similarCardName } from '../core/cardSearch.js';

test('coincidencias exactas, parciales y errores de una letra', () => {
  for (const query of ['hammer', 'hummer', 'hamer', 'hammmer', 'crushing hummer']) {
    assert.equal(similarCardName('Crushing Hammer', query), true, query);
    assert.ok(searchFragments(query).some((fragment) => 'crushing hammer'.includes(fragment)), query);
  }
  assert.equal(similarCardName('Enhanced Hammer', 'hummer'), true);
  assert.equal(similarCardName('Pikachu', 'hummer'), false);
  assert.equal(similarCardName('Hammer', 'crushing hummer'), false);
});

test('evita aproximaciones de textos cortos y normaliza tildes', () => {
  assert.deepEqual(searchFragments('ha'), []);
  assert.equal(similarCardName('Mew', 'new'), false);
  assert.equal(similarCardName('Dragón Dorado', 'dragon'), true);
  assert.equal(similarCardName('Hammer', ''), false);
});
