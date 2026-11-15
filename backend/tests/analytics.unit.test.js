import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS, cleanProps, gameKey } from '../core/analyticsCatalog.js';
import { buildContext, buildEvent, classifySource, normalizePath, parseAgent } from '../core/analytics.js';
import { confirmedAmount, parseMercadoPagoPayment } from '../core/paymentLedger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = buildContext({ ctx: { vid: 'visitor-0001', sid: 'session-0001', vp: '390x844', tz: 'America/Santiago', ref: 'www.google.com' }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });

test('el navegador se resume sin guardar el User-Agent completo y los robots se detectan', () => {
  assert.deepEqual(parseAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120'), { os: 'Windows', browser: 'Edge', device: 'desktop', bot: false });
  assert.equal(ctx.device, 'mobile'); assert.equal(ctx.os, 'iOS'); assert.equal(ctx.browser, 'Safari');
  assert.equal(parseAgent('Googlebot/2.1').bot, true);
  assert.equal(buildContext({ ctx: { vid: 'visitor-0001', sid: 'session-0001' }, userAgent: 'Googlebot/2.1' }), null);
});

test('fuente de tráfico: UTM manda; luego el sitio de origen', () => {
  assert.deepEqual(classifySource({ ref: '', utm: {} }), { source: 'direct', medium: 'direct', campaign: '' });
  assert.equal(classifySource({ ref: 'www.carpetazo.cl' }).source, 'internal');
  assert.equal(classifySource({ ref: 'www.google.com' }).medium, 'organic');
  assert.equal(classifySource({ ref: 'l.instagram.com' }).medium, 'social');
  assert.equal(classifySource({ ref: 'blog.ejemplo.cl' }).medium, 'referral');
  assert.deepEqual(classifySource({ ref: 'x.com', utm: { s: 'Instagram', m: 'Social', c: 'Lanzamiento' } }), { source: 'instagram', medium: 'social', campaign: 'lanzamiento' });
});

test('las rutas se agrupan y nunca guardan nombres de usuario, ids ni parámetros', () => {
  assert.equal(normalizePath('/carpeta/3f2c1b9a-aaaa?x=1'), '/carpeta/:id');
  assert.equal(normalizePath('/c/abc/'), '/c/:id');
  assert.equal(normalizePath('/catalogo/123/charizard'), '/catalogo/:id');
  assert.equal(normalizePath('/tito_jeffry'), '/:usuario');
  assert.equal(normalizePath('/planes#precios'), '/planes');
  assert.equal(normalizePath('/a/b/c/d'), '/otra');
});

test('buildEvent: solo eventos web del catálogo, propiedades limpias, fechas acotadas', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  const ok = buildEvent({ id: 'evt-0000001', name: 'page_view', at: '2026-11-15T11:59:00Z', path: '/carta/xyz?q=1', props: { title: 'Inicio', evil: 'x', email: 'a@b.cl' } }, ctx, now);
  assert.equal(ok.path, '/carta/:id'); assert.deepEqual(ok.props, { title: 'Inicio' }); assert.equal(ok.visitorId, 'visitor-0001'); assert.equal(ok.origin, 'web');
  assert.equal(buildEvent({ id: 'evt-0000002', name: 'order_created' }, ctx, now), null, 'un evento del servidor no puede venir de la web');
  assert.equal(buildEvent({ id: 'evt-0000003', name: 'inventado' }, ctx, now), null);
  assert.equal(buildEvent({ id: 'x', name: 'page_view' }, ctx, now), null, 'id corto');
  assert.equal(buildEvent({ id: 'evt-0000004', name: 'page_view', at: '2030-01-01T00:00:00Z' }, ctx, now).at.getTime(), now, 'fecha futura -> ahora');
  assert.equal(buildEvent({ id: 'evt-0000005', name: 'page_view', at: '2020-01-01T00:00:00Z' }, ctx, now).at.getTime(), now, 'fecha muy antigua -> ahora');
});

test('las propiedades nunca admiten correos, enlaces ni números largos (teléfonos, RUT, tarjetas)', () => {
  assert.deepEqual(cleanProps('page_view', { title: 'Hola a@b.cl' }), {});
  assert.deepEqual(cleanProps('page_view', { title: 'mira https://x.cl' }), {});
  assert.deepEqual(cleanProps('page_view', { title: 'llama 912345678' }), {});
  assert.deepEqual(cleanProps('search', { game: 'pokemon', results: 12, filters: 2, scope: 'catalogo', game2: 'x', ms: 'rápido' }), { game: 'pokemon', results: 12, filters: 2, scope: 'catalogo' });
  assert.deepEqual(cleanProps('scroll_depth', { pct: 60 }), {}, 'solo valores de la lista');
});

test('gameKey normaliza los nombres de juego del sitio', () => {
  for (const [input, key] of [['Pokemon', 'pokemon'], ['Mitos y Leyendas', 'myl'], ['YuGiOh', 'yugioh'], ['Yu-Gi-Oh!', 'yugioh'], ['OnePiece', 'onepiece'], ['Magic', 'magic'], ['Lorcana', 'lorcana'], ['Algo raro', 'otro']]) assert.equal(gameKey(input), key, input);
});

test('el catálogo del servidor y el de la web son idénticos', () => {
  const read = (file) => fs.readFileSync(path.join(here, file), 'utf8').replace(/\r\n/g, '\n');
  const front = read('../../frontend/src/analytics/eventCatalog.js');
  const names = Object.keys(EVENTS).filter((n) => EVENTS[n].origin === 'web');
  for (const name of names) assert.ok(new RegExp(`\\b${name}\\b`).test(front), `falta ${name} en la copia de la web`);
  for (const name of Object.keys(EVENTS).filter((n) => EVENTS[n].origin === 'server')) assert.ok(!new RegExp(`^\\s+${name}:`, 'm').test(front), `${name} es del servidor y no debe estar en la web`);
});

test('pagos: solo «approved» suma ingresos y un pago raro nunca cuenta', () => {
  const approved = parseMercadoPagoPayment({ id: 123, status: 'approved', transaction_amount: 3990, transaction_amount_refunded: 0, date_approved: '2026-11-10T15:00:00.000-03:00', external_reference: 'sub-1', currency_id: 'CLP' });
  assert.equal(approved.status, 'approved'); assert.equal(approved.amountClp, 3990); assert.equal(approved.paidAt.toISOString(), '2026-11-10T18:00:00.000Z');
  assert.equal(confirmedAmount(approved), 3990);
  assert.equal(confirmedAmount({ ...approved, refundedClp: 990 }), 3000, 'se descuenta lo reembolsado');
  for (const status of ['rejected', 'refunded', 'charged_back', 'cancelled', 'pending']) assert.equal(confirmedAmount({ status, amountClp: 3990, refundedClp: 0 }), 0, status);
  assert.equal(parseMercadoPagoPayment({ id: 9, status: 'estado_nuevo', transaction_amount: 5000 }).status, 'unverified');
  assert.equal(confirmedAmount(parseMercadoPagoPayment({ id: 9, status: 'estado_nuevo', transaction_amount: 5000 })), 0);
  assert.equal(parseMercadoPagoPayment({ status: 'approved' }), null, 'sin id no hay pago');
  assert.equal(parseMercadoPagoPayment({ id: 1, status: 'approved', transaction_amount: -5 }).amountClp, 0, 'monto negativo -> 0');
});
