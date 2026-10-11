// Chequeo de producción (sin dependencias): comprueba lo que, si falla, deja el sitio inutilizable o invisible.
// Uso: node scripts/checks/check_production.cjs [https://carpetazo.cl] [https://api.carpetazo.cl]
// Sale con código 1 si algo falla (la automatización de GitHub avisa por correo).
const SITE = (process.argv[2] || 'https://carpetazo.cl').replace(/\/$/, '');
const API = (process.argv[3] || 'https://api.carpetazo.cl').replace(/\/$/, '');
const TIMEOUT_MS = 20000;
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const failures = [];
const check = async (name, fn) => {
  const started = Date.now();
  try {
    const detail = await fn();
    console.log(`OK    ${name}${detail ? ` (${detail})` : ''} [${Date.now() - started} ms]`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`FALLA ${name}: ${error.message}`);
  }
};
const get = (url, options = {}) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual', ...options });
const expect = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  let cardId = null;
  let folderId = null;

  await check('la web responde y carga la aplicación', async () => {
    const r = await get(`${SITE}/`);
    const html = await r.text();
    expect(r.status === 200, `estado ${r.status}`);
    expect(html.includes('id="root"') && /\/assets\/index-[\w-]+\.js/.test(html), 'la página no trae la aplicación');
  });

  await check('la web trae las cabeceras de seguridad', async () => {
    const r = await get(`${SITE}/`);
    expect(r.headers.get('strict-transport-security') && r.headers.get('content-security-policy') && r.headers.get('x-content-type-options') === 'nosniff', 'faltan cabeceras (HSTS, CSP o nosniff)');
  });

  await check('la API responde y la base de datos contesta', async () => {
    const r = await get(`${API}/api/health`);
    const body = await r.json().catch(() => ({}));
    expect(r.status === 200 && body.status === 'ok' && body.db === 'ok', `estado ${r.status} ${JSON.stringify(body)}`);
    return `encendida hace ${body.uptime} s`;
  });

  await check('la API permite que la web la consulte (CORS)', async () => {
    const r = await get(`${API}/api/home/featured`, { method: 'OPTIONS', headers: { Origin: SITE, 'Access-Control-Request-Method': 'GET' } });
    expect(r.headers.get('access-control-allow-origin') === SITE, `cabecera ${r.headers.get('access-control-allow-origin')}`);
  });

  for (const path of ['/api/home/featured', '/api/cards/search', '/api/folders/search', '/api/sellers']) {
    await check(`datos públicos: ${path}`, async () => {
      const r = await get(`${API}${path}`, { headers: { Origin: SITE } });
      const body = await r.json().catch(() => ({}));
      expect(r.status === 200 && body.success === true, `estado ${r.status}`);
    });
  }

  await check('el sitemap está al día y trae cartas y carpetas', async () => {
    const r = await get(`${SITE}/sitemap.xml`);
    const xml = await r.text();
    expect(r.status === 200 && xml.includes('<urlset'), `estado ${r.status}`);
    cardId = (xml.match(/\/carta\/([0-9a-f-]{36})/) || [])[1] || null;
    folderId = (xml.match(/\/c\/([0-9a-f-]{36})/) || [])[1] || null;
    expect(xml.split('<url>').length > 8, 'el sitemap solo trae las páginas fijas');
    return `${xml.split('<url>').length - 1} direcciones`;
  });

  if (cardId) {
    await check('Google recibe la página de una carta con datos estructurados', async () => {
      const r = await get(`${SITE}/carta/${cardId}`, { headers: { 'User-Agent': GOOGLEBOT } });
      const html = await r.text();
      expect(r.status === 200 && html.includes('application/ld+json') && html.includes('rel="canonical"'), `estado ${r.status}`);
    });
    await check('una persona recibe la aplicación en la página de una carta', async () => {
      const r = await get(`${SITE}/carta/${cardId}`, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } });
      const html = await r.text();
      expect(r.status === 200 && html.includes('id="root"'), `estado ${r.status}`);
    });
  }
  if (folderId) {
    await check('Google recibe la página de una carpeta', async () => {
      const r = await get(`${SITE}/c/${folderId}`, { headers: { 'User-Agent': GOOGLEBOT } });
      const html = await r.text();
      expect(r.status === 200 && html.includes('application/ld+json'), `estado ${r.status}`);
    });
    await check('WhatsApp recibe la vista previa de una carpeta', async () => {
      const r = await get(`${SITE}/c/${folderId}`, { headers: { 'User-Agent': 'WhatsApp/2.24' } });
      const html = await r.text();
      expect(r.status === 200 && html.includes('og:image'), `estado ${r.status}`);
    });
  }

  await check('las páginas legales cargan', async () => {
    for (const path of ['/terminos', '/privacidad']) {
      const r = await get(`${SITE}${path}`, { redirect: 'follow' });
      expect(r.status === 200, `${path} no responde (estado ${r.status})`);
    }
  });

  // Aviso (no falla): una redirección a http:// obliga a dar una vuelta de más; se arregla con "absolute_redirect off;" en nginx
  try {
    const r = await get(`${SITE}/terminos`);
    const to = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && to.startsWith('http://')) console.log(`AVISO /terminos redirige a una dirección insegura (${to}); conviene agregar "absolute_redirect off;" en nginx`);
  } catch (_error) { /* ya lo cubre la comprobación anterior */ }

  if (failures.length) {
    console.log(`\n${failures.length} comprobación(es) fallaron:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nTodo en orden.');
})();
