// Compara frontend/nginx.conf (la copia del repo) con la configuración que realmente usa producción en Coolify, y avisa si divergen.
// Con --apply sube la del repo a Coolify (hay que redesplegar el frontend después). Solo lee, salvo con --apply.
//   COOLIFY_URL=https://coolify.ejemplo.com COOLIFY_TOKEN=... node scripts/checks/nginx_drift.cjs [--apply]
// El uuid del frontend en Coolify puede cambiarse con COOLIFY_FRONTEND_UUID.
const fs = require('fs');
const path = require('path');

const url = (process.env.COOLIFY_URL || '').replace(/\/$/, '');
const token = process.env.COOLIFY_TOKEN;
const uuid = process.env.COOLIFY_FRONTEND_UUID || 'vwxve1fwyfu0zwtgyxqhukv7';
const apply = process.argv.includes('--apply');
if (!url || !token) { console.error('Faltan COOLIFY_URL y COOLIFY_TOKEN.'); process.exit(2); }

const normalize = (text) => String(text || '').replace(/\r\n/g, '\n').trim();
const api = async (method, body) => {
  const response = await fetch(`${url}/api/v1/applications/${uuid}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Coolify respondió ${response.status}`);
  return response.json();
};

(async () => {
  const repoText = normalize(fs.readFileSync(path.join(__dirname, '../../../frontend/nginx.conf'), 'utf8'));
  const app = await api('GET');
  const raw = app.custom_nginx_configuration;
  // Coolify devuelve el texto ya decodificado (y recibe base64 al guardar); una versión anterior lo devolvía en base64
  const live = normalize(raw && /^[A-Za-z0-9+/=\s]+$/.test(raw) ? Buffer.from(raw, 'base64').toString('utf8') : raw);
  if (!live) { console.log('Producción no tiene configuración propia: usa la del repo.'); return; }
  if (live === repoText) { console.log('OK: producción y el repo tienen el mismo nginx.'); return; }
  const a = repoText.split('\n');
  const b = live.split('\n');
  const only = (x, y) => x.filter((line) => !y.includes(line)).slice(0, 8);
  console.log('DIFERENCIA entre el repo y producción.');
  console.log('Solo en el repo:\n  ' + (only(a, b).join('\n  ') || '(nada)'));
  console.log('Solo en producción:\n  ' + (only(b, a).join('\n  ') || '(nada)'));
  if (!apply) { console.log('\nPara dejar producción igual que el repo: repite con --apply y redespliega el frontend.'); process.exitCode = 1; return; }
  if (/PEGA_AQUI/.test(repoText)) { console.error('No se sube: el nginx del repo tiene marcadores «PEGA_AQUI» (por ejemplo el secreto del proxy de vistas previas) que pisarían los valores reales de producción. Cambia solo la línea necesaria en la configuración de Coolify.'); process.exit(2); }
  await api('PATCH', { custom_nginx_configuration: Buffer.from(repoText + '\n', 'utf8').toString('base64') });
  console.log('Listo: se subió el nginx del repo a Coolify. Redespliega el frontend para aplicarlo.');
})().catch((error) => { console.error('Error:', error.message); process.exit(2); });
