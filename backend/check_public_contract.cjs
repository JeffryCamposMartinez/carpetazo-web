// Prueba de contrato: las rutas públicas NO deben devolver datos privados.
// Uso: node check_public_contract.cjs [urlBaseApi]   (por defecto http://localhost:8000/api)
// Sale con código 1 si detecta un campo prohibido; pensada para el CI y para revisar después de cada cambio de la API.
const BASE = (process.argv[2] || 'http://localhost:8000/api').replace(/\/$/, '');
const FORBIDDEN = ['email', 'rut', 'bankDetails', 'firebaseUid', 'role', 'password', 'accessToken'];
const FORBIDDEN_ADDRESS_KEYS = ['street', 'number', 'floor', 'depto', 'reference'];

const scan = (value, where = '$') => {
  if (Array.isArray(value)) return value.flatMap((v, i) => scan(v, `${where}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => {
      const here = `${where}.${key}`;
      const hit = FORBIDDEN.includes(key) ? [here] : [];
      const addr = where.endsWith('addresses') || /addresses\[\d+\]$/.test(where);
      return hit.concat(addr && FORBIDDEN_ADDRESS_KEYS.includes(key) ? [here] : [], scan(v, here));
    });
  }
  return [];
};

const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} respondió ${res.status}`);
  return res.json();
};

(async () => {
  const problems = [];
  const check = (label, json) => scan(json).forEach((p) => problems.push(`${label}: ${p}`));

  const list = await get('/folders');
  check('/folders', list);
  const folders = list.folders || [];
  if (folders[0]) check('/folders/:id', await get(`/folders/${folders[0].id}`));

  const usernames = [...new Set(folders.map((f) => f.user?.username).filter(Boolean))].slice(0, 5);
  for (const username of usernames) check(`/users/${username}`, await get(`/users/${encodeURIComponent(username)}`));

  check('/cards/recent', await get('/cards/recent?limit=5'));
  check('/cards/search', await get('/cards/search?q=a'));

  if (problems.length) {
    console.error('FUGA DE DATOS en rutas públicas:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  console.log(`OK: sin campos privados en ${2 + usernames.length + 2} respuestas públicas revisadas.`);
})().catch((err) => { console.error('Error:', err.message); process.exit(2); });
