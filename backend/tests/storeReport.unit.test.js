import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesCsv, isSummaryTime, parseReportRange, summaryText } from '../core/storeReport.js';

test('parseReportRange: hora de Chile, máximo un año', () => {
  const r = parseReportRange('2026-11-01', '2026-11-15');
  assert.equal(r.start.toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-11-16T03:00:00.000Z');
  for (const [a, b] of [['2026-11-15', '2026-11-01'], ['ayer', 'hoy'], ['2024-01-01', '2026-01-01'], [undefined, '2026-01-01']]) assert.equal(parseReportRange(a, b), null, `${a}..${b}`);
});

test('buildSalesCsv: filas de ventas y pedidos, sin fórmulas', () => {
  const csv = buildSalesCsv(
    [{ createdAt: '2026-11-15T15:00:00Z', folderName: '=HYPERLINK("x")', paymentMethod: 'debit', items: [{ name: 'Pikachu', quantity: 2 }], units: 2, discountAmount: 0, total: 4000 }],
    [{ updatedAt: '2026-11-15T16:00:00Z', via: 'pickup', code: 'AB12C', folderName: 'Pokémon', couponCode: 'VERANO10', items: [{ name: 'Mew', quantity: 1 }], discountClp: 500, total: 4500 }]
  );
  const rows = csv.replace('﻿', '').trim().split('\r\n');
  assert.equal(rows.length, 3);
  assert.match(rows[1], /Venta en persona/);
  assert.match(rows[1], /Débito/);
  assert.match(rows[1], /"'=HYPERLINK\(""x""\)"/);
  assert.match(rows[2], /Pedido \(Retiro en tienda\),AB12C/);
  assert.match(rows[2], /Cupón VERANO10/);
});

test('isSummaryTime: lunes desde las 9 en Chile', () => {
  assert.equal(isSummaryTime(new Date('2026-11-16T12:30:00Z')), true); // lun 09:30
  assert.equal(isSummaryTime(new Date('2026-11-16T11:00:00Z')), false); // lun 08:00
  assert.equal(isSummaryTime(new Date('2026-11-17T12:30:00Z')), false); // martes
});

test('summaryText incluye las cifras', () => {
  assert.match(summaryText({ salesCount: 3, salesTotal: 15000, visits: 40, pickups: 1, followers: 2, buys: 0, events: 1 }), /3 ventas por \$15\.000/);
});
