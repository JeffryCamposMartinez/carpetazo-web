import test from 'node:test';
import assert from 'node:assert/strict';
import { canActForStore, parsePermissions, permissionsOf, roleAllows } from '../core/storeAccess.js';

test('roleAllows: cada rol solo lo suyo', () => {
  assert.equal(roleAllows('cashier', 'sales'), true);
  assert.equal(roleAllows('cashier', 'pickups'), true);
  assert.equal(roleAllows('cashier', 'stock'), false);
  assert.equal(roleAllows('stock', 'stock'), true);
  assert.equal(roleAllows('stock', 'sales'), false);
  assert.equal(roleAllows('admin', 'sales'), false);
  for (const p of ['bank', 'plan', 'settings', 'reports']) assert.equal(roleAllows('cashier', p) || roleAllows('stock', p), false, p);
});

test('permisos por casilla: se guardan, se leen y folders incluye stock', () => {
  assert.equal(parsePermissions(['pickups', 'sales']), 'sales,pickups');
  assert.equal(parsePermissions([]), null);
  assert.equal(parsePermissions(['sales', 'bank']), null);
  assert.equal(parsePermissions('sales'), null);
  assert.deepEqual(permissionsOf('sales,stock'), ['sales', 'stock']);
  assert.equal(roleAllows('sales,pickups', 'stock'), false);
  assert.equal(roleAllows('folders', 'stock'), true);
  assert.equal(roleAllows('folders', 'sales'), false);
  assert.equal(roleAllows('sales,folders', 'folders'), true);
});

test('canActForStore: dueño sí; invitado, rol equivocado o sin plan no', async () => {
  const db = (member, planKey = 'store') => ({
    storeMember: { findUnique: async () => member },
    planGrant: { findFirst: async () => ({ id: 'g', planKey, endsAt: null, reason: null }) },
    subscription: { findMany: async () => [] }
  });
  assert.equal(await canActForStore(db(null), 's', 's', 'sales'), true);
  assert.equal(await canActForStore(db({ role: 'cashier', status: 'active' }), 'u', 's', 'sales'), true);
  assert.equal(await canActForStore(db({ role: 'cashier', status: 'invited' }), 'u', 's', 'sales'), false);
  assert.equal(await canActForStore(db({ role: 'stock', status: 'active' }), 'u', 's', 'sales'), false);
  assert.equal(await canActForStore(db({ role: 'cashier', status: 'active' }, 'pro'), 'u', 's', 'sales'), false);
  assert.equal(await canActForStore(db(null), 'u', 's', 'sales'), false);
});
