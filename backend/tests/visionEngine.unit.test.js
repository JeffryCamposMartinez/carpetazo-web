import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { engineFetch, engineStatus, engineConfigured, __resetEngineState } from '../core/visionEngine.js';

const serve = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler).listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});
const reply = (status, body) => (req, res) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
const deadUrl = async () => { const { server, url } = await serve(reply(200, {})); await new Promise((r) => server.close(r)); return url; };

test('el motor principal contesta: no se usa el respaldo y el escáner figura disponible', async () => {
  __resetEngineState();
  const primary = await serve(reply(200, { from: 'principal' }));
  const backup = await serve(reply(200, { from: 'respaldo' }));
  Object.assign(process.env, { VISION_ENGINE_URL: primary.url, VISION_ENGINE_KEY: 'k1', VISION_ENGINE_FALLBACK_URL: backup.url, VISION_ENGINE_FALLBACK_KEY: 'k2' });
  const response = await engineFetch('/scan', { method: 'POST', body: 'x' });
  assert.equal((await response.json()).from, 'principal');
  assert.equal(engineStatus().available, true);
  assert.equal(engineStatus().usingBackup, false);
  assert.equal(engineConfigured(), true);
  primary.server.close(); backup.server.close();
});

test('el principal falla con error 500: contesta el de respaldo y queda marcado', async () => {
  __resetEngineState();
  const primary = await serve(reply(500, { error: 'caído' }));
  const backup = await serve(reply(200, { from: 'respaldo' }));
  Object.assign(process.env, { VISION_ENGINE_URL: primary.url, VISION_ENGINE_KEY: 'k1', VISION_ENGINE_FALLBACK_URL: backup.url, VISION_ENGINE_FALLBACK_KEY: 'k2' });
  const response = await engineFetch('/scan', { method: 'POST', body: 'x' });
  assert.equal((await response.json()).from, 'respaldo');
  const status = engineStatus();
  assert.equal(status.usingBackup, true);
  assert.equal(status.available, true);
  assert.equal(status.backup, true);
  primary.server.close(); backup.server.close();
});

test('el principal no está y no hay respaldo: falla, y tras 3 fallos seguidos el escáner figura no disponible', async () => {
  __resetEngineState();
  Object.assign(process.env, { VISION_ENGINE_URL: await deadUrl(), VISION_ENGINE_KEY: 'k1', VISION_ENGINE_FALLBACK_URL: '', VISION_ENGINE_FALLBACK_KEY: '' });
  for (let i = 0; i < 3; i += 1) await assert.rejects(engineFetch('/scan', { method: 'POST', body: 'x' }, { timeoutMs: 2000 }));
  assert.equal(engineStatus().available, false);
  assert.equal(engineStatus().backup, false);
});

test('un error 4xx del motor no es una caída: se devuelve tal cual y no usa el respaldo', async () => {
  __resetEngineState();
  const primary = await serve(reply(401, { error: 'no autorizado' }));
  const backup = await serve(reply(200, { from: 'respaldo' }));
  Object.assign(process.env, { VISION_ENGINE_URL: primary.url, VISION_ENGINE_KEY: 'k1', VISION_ENGINE_FALLBACK_URL: backup.url, VISION_ENGINE_FALLBACK_KEY: 'k2' });
  const response = await engineFetch('/scan', { method: 'POST', body: 'x' });
  assert.equal(response.status, 401);
  assert.equal(engineStatus().usingBackup, false);
  primary.server.close(); backup.server.close();
});

test('si el motor principal vuelve, el estado se recupera', async () => {
  __resetEngineState();
  const primary = await serve(reply(200, { from: 'principal' }));
  Object.assign(process.env, { VISION_ENGINE_URL: await deadUrl(), VISION_ENGINE_KEY: 'k1', VISION_ENGINE_FALLBACK_URL: '', VISION_ENGINE_FALLBACK_KEY: '' });
  for (let i = 0; i < 3; i += 1) await assert.rejects(engineFetch('/scan', { method: 'POST', body: 'x' }, { timeoutMs: 2000 }));
  assert.equal(engineStatus().available, false);
  process.env.VISION_ENGINE_URL = primary.url;
  await engineFetch('/scan', { method: 'POST', body: 'x' });
  assert.equal(engineStatus().available, true);
  assert.equal(engineStatus().failures, 0);
  primary.server.close();
});

test('warmEngine: no hace nada sin motor configurado y solo una vez cada 10 s', async () => {
  const before = { url: process.env.VISION_ENGINE_URL, key: process.env.VISION_ENGINE_KEY, stub: process.env.TEST_AUTH_STUB };
  const { warmEngine, __resetEngineState } = await import('../core/visionEngine.js');
  delete process.env.TEST_AUTH_STUB;
  delete process.env.VISION_ENGINE_URL;
  assert.equal(warmEngine(), false);
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.VISION_ENGINE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.VISION_ENGINE_KEY = 'k';
  __resetEngineState();
  assert.equal(warmEngine(), true);
  assert.equal(warmEngine(), false);
  server.close();
  for (const [name, value] of [['VISION_ENGINE_URL', before.url], ['VISION_ENGINE_KEY', before.key], ['TEST_AUTH_STUB', before.stub]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  __resetEngineState();
});
