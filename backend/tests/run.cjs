// Levanta la API con sesión simulada (solo base local), corre las pruebas y la apaga.
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const server = spawn(process.execPath, ['--import', './tests/register.mjs', 'server.js'], {
  cwd: root, env: { ...process.env, TEST_AUTH_STUB: '1', PORT: '8000' }, stdio: 'inherit'
});
let failed = false;
server.on('exit', (code) => { if (code) { console.error('El servidor de pruebas no pudo iniciar.'); process.exit(1); } });

(async () => {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch('http://localhost:8000/api/health')).ok) break; } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const file of ['batchA', 'chats', 'fraud']) {
    console.log('\n== ' + file);
    const r = spawnSync(process.execPath, [path.join(__dirname, file + '.test.cjs')], { cwd: root, stdio: 'inherit' });
    if (r.status) failed = true;
  }
  server.removeAllListeners('exit');
  server.kill();
  process.exit(failed ? 1 : 0);
})();
