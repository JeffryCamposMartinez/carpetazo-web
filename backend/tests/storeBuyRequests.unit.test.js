import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStatus, parseBuyRequest, parseOffer } from '../core/storeBuyRequests.js';

test('parseBuyRequest acepta una lista válida', () => {
  const r = parseBuyRequest({ game: 'Pokémon', items: [{ name: 'Charizard ex', quantity: 2, condition: 'NM', set: 'Obsidian Flames' }, { name: 'Pikachu' }], note: 'Todo en fundas' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.items[1].quantity, 1);
});

test('parseBuyRequest rechaza listas malas', () => {
  for (const bad of [{ items: [] }, { items: 'x' }, { items: [{ name: '' }] }, { items: [{ name: 'a', quantity: 0 }] }, { items: [{ name: 'a', condition: 'Nuevo' }] }, { items: Array.from({ length: 201 }, () => ({ name: 'a' })) }, { items: [{ name: 'a' }], photos: ['http://x.com/a.png'] }, { items: [{ name: 'a' }], game: 'Fortnite' }]) {
    assert.equal(parseBuyRequest(bad).ok, false, JSON.stringify(bad).slice(0, 80));
  }
});

test('parseOffer valida montos', () => {
  assert.equal(parseOffer({ offerClp: 50000 }).ok, true);
  for (const offerClp of [-1, 1.5, 'mucho', 200000000]) assert.equal(parseOffer({ offerClp }).ok, false, String(offerClp));
});

test('nextStatus solo permite los cambios de cada rol', () => {
  assert.equal(nextStatus('store', 'offer', 'pending'), 'offered');
  assert.equal(nextStatus('store', 'offer', 'accepted'), null);
  assert.equal(nextStatus('seller', 'accept', 'pending'), null);
  assert.equal(nextStatus('seller', 'accept', 'offered'), 'accepted');
  assert.equal(nextStatus('store', 'accept', 'offered'), null);
  assert.equal(nextStatus('seller', 'cancel', 'accepted'), null);
});
