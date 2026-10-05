// Levanta la API con sesión simulada (solo base local), crea los datos de prueba, corre las pruebas, limpia y la apaga.
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { setup, cleanup, prisma, ADMIN_EMAIL } = require('./fixtures.cjs');

const root = path.join(__dirname, '..');
const server = spawn(process.execPath, ['--import', './tests/register.mjs', 'server.js'], {
  cwd: root, env: { ...process.env, TEST_AUTH_STUB: '1', PORT: '8000', ADMIN_EMAILS: ADMIN_EMAIL, MAIL_TEST_OUTBOX: '1', R2_PUBLIC_URL: 'https://pub-cztest.r2.dev', R2_BUCKET_NAME: 'cztest-bucket', R2_TEST_STUB: '1', IMAGE_SCAN_TEST: '1', HASH_BANK_TTL_MS: '1', SIGHTENGINE_USER: '', SIGHTENGINE_SECRET: '', GOOGLE_VISION_KEY: '', EXTRA_ENV_FILE: '', SMTP_USER: '', SMTP_PASS: '' }, stdio: 'inherit'
});
let failed = false;
server.on('exit', (code) => { if (code) { console.error('El servidor de pruebas no pudo iniciar.'); process.exit(1); } });

(async () => {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try { ready = (await fetch('http://localhost:8000/api/health')).ok; } catch (_) { /* aún no levanta */ }
    if (!ready) await new Promise((r) => setTimeout(r, 500));
  }
  try {
    if (!ready) throw new Error('La API de pruebas no respondió');
    const data = await setup();
    for (const file of ['marketFlows', 'chats', 'fraud', 'orders', 'audit', 'terms', 'reports', 'sanctions', 'automation', 'imageScan', 'sync', 'security', 'termsEvidence']) {
      console.log('\n== ' + file);
      const r = spawnSync(process.execPath, [path.join(__dirname, file + '.test.cjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, CZ_FIXTURES: JSON.stringify(data) } });
      if (r.status) failed = true;
    }
  } catch (error) {
    console.error(error.message);
    failed = true;
  } finally {
    await cleanup().catch((error) => { console.error('Limpieza:', error.message); failed = true; });
    await prisma.$disconnect();
    server.removeAllListeners('exit');
    server.kill();
    process.exit(failed ? 1 : 0);
  }
})();
