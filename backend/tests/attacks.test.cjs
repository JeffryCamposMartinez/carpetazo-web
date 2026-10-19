// Ataques variados contra la API (solo contra la base y el servidor de pruebas): cada línea FALLA es una vulnerabilidad real.
// Cubre: asignación masiva, contaminación de prototipos, cuerpos y parámetros malformados, SSRF (proxy de imágenes, campos de imagen,
// notificaciones push y SVG con referencias externas), bombas de píxeles, carreras sobre cuotas, suplantación con Unicode,
// inyección de la cabecera Host, divulgación de errores, límites de frecuencia y visibilidad de carpetas privadas.
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { prisma, B, U, NAMES, call, ok, fixtures } = require('./fixtures.cjs');

const raw = async (method, route, { who, headers = {}, body, contentType = 'application/json' } = {}) => {
  const r = await fetch(B + route, {
    method,
    headers: { ...(contentType ? { 'Content-Type': contentType } : {}), ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}), ...headers },
    body
  });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch (_) { /* no es JSON */ }
  return { status: r.status, text, j, headers: r.headers };
};
const LEAK = /node_modules|\/backend\/|C:\\|\bat (async )?[\w.<>$]+ \((file:\/\/|\/|[A-Za-z]:\\)|PrismaClient|prisma\.|ECONNREFUSED|stack trace|\"stack\":|SQLSTATE|syntax error at/i;

(async () => {
  try {
    const { folderId, cardId } = fixtures();
    const snapshot = () => prisma.user.findUnique({ where: { username: NAMES.seller } });

    // ===== 1. Asignación masiva y escalada de privilegios =====
    console.log('\n-- 1. asignación masiva');
    const before = await snapshot();
    let r = await call('PUT', '/users/me', 'seller', { name: 'Prueba seller', role: 'admin', isAdmin: true, isOwner: true, verified: true, emailVerified: true, firebaseUid: 'cztest-robado', email: 'robado@evil.test', id: '00000000-0000-4000-8000-000000000000', moderationHidden: [], createdAt: '2001-01-01T00:00:00Z', deletedAt: null, planKey: 'store', trustScore: 999 });
    const after = await snapshot();
    ok('PUT /users/me no cambia rol, correo, uid ni id', after.role === before.role && after.email === before.email && after.firebaseUid === before.firebaseUid && after.id === before.id, JSON.stringify({ rol: after.role, status: r.status }));
    ok('...ni la verificación de correo ni la fecha de creación', after.emailVerified === before.emailVerified && +after.createdAt === +before.createdAt);
    r = await call('POST', '/users/sync', 'seller', { displayName: 'Prueba seller', username: NAMES.seller, role: 'admin', emailVerified: true, email: 'otro@evil.test' });
    const after2 = await snapshot();
    ok('POST /users/sync no eleva el rol ni cambia el correo', after2.role === before.role && after2.email === before.email, 'rol=' + after2.role);
    r = await call('POST', '/folders', 'seller', { name: 'TEST masiva', tcg: 'Pokemon', color: 'blue', isPublic: true, userId: (await prisma.user.findUnique({ where: { username: NAMES.jerry } })).id, weeklyVisits: 999999, totalVisits: 999999, lastVisitWeek: 1, moderationHidden: true });
    const f = r.j?.folder && await prisma.folder.findUnique({ where: { id: r.j.folder.id } });
    const sellerId = before.id;
    ok('crear carpeta ignora userId ajeno y visitas inventadas', f && f.userId === sellerId && f.totalVisits === 0 && f.weeklyVisits === 0, JSON.stringify(f && { u: f.userId === sellerId, t: f.totalVisits }));
    if (f) await prisma.folder.delete({ where: { id: f.id } });
    const jerryFolder = await call('POST', '/folders', 'jerry', { name: 'TEST ajena', tcg: 'Pokemon', color: 'blue', isPublic: false });
    const jerryFolderId = jerryFolder.j?.folder?.id;
    for (const [label, body] of [['stock negativo', { stock: -5 }], ['stock gigante', { stock: 1e12 }], ['precio negativo', { price: -1 }], ['precio texto', { price: 'abc' }], ['precio 1e21', { price: 1e21 }], ['precio NaN como texto', { price: 'NaN' }], ['stock decimal', { stock: 1.5 }]]) {
      r = await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'atk-' + label, name: 'ataque', price: 1000, stock: 1, ...body });
      ok('carta con ' + label + ' → rechazada', r.status >= 400 && r.status < 500, String(r.status));
    }
    r = await call('POST', '/folders/' + jerryFolderId + '/cards', 'seller', { tcgId: 'atk-ajena', name: 'ataque', price: 1000, stock: 1 });
    ok('agregar carta a la carpeta de otra persona → 403/404', r.status === 403 || r.status === 404, String(r.status));
    r = await call('PUT', '/folders/' + folderId + '/cards/' + cardId, 'seller', { folderId: jerryFolderId, moderationState: 'visible', createdAt: '2001-01-01' });
    const moved = await prisma.card.findUnique({ where: { id: cardId } });
    ok('editar carta no la mueve a la carpeta de otra persona', moved.folderId === folderId, 'folderId ' + (moved.folderId === folderId ? 'igual' : 'CAMBIÓ'));

    // ===== 2. Contaminación de prototipos =====
    console.log('\n-- 2. contaminación de prototipos');
    for (const body of ['{"__proto__":{"role":"admin","isAdmin":true}}', '{"constructor":{"prototype":{"role":"admin"}}}', '{"name":"x","publicTheme":{"__proto__":{"role":"admin"}}}']) {
      await raw('PUT', '/users/me', { who: 'seller', body });
      await raw('POST', '/folders/' + folderId + '/cards', { who: 'seller', body: '{"tcgId":"p1","name":"p","price":1,"stock":1,"data":{"__proto__":{"role":"admin"}}}' });
    }
    r = await call('GET', '/admin/reports', 'jerry');
    ok('tras intentar contaminar Object.prototype, una persona normal sigue sin acceso de moderación', r.status === 403 || r.status === 401, String(r.status));
    r = await call('GET', '/admin/reports', 'seller');
    ok('...ni la persona que envió las cargas', r.status === 403 || r.status === 401, String(r.status));
    ok('...y el prototipo de Object del servidor de pruebas sigue limpio (comprobación indirecta por salud)', (await raw('GET', '/health', {})).status === 200);

    // ===== 3. Cuerpos y parámetros malformados =====
    console.log('\n-- 3. cuerpos y parámetros malformados');
    r = await raw('POST', '/folders', { who: 'seller', body: '{"name":' });
    ok('JSON roto → 400 sin detalles internos', r.status === 400 && !LEAK.test(r.text), r.status + ' ' + r.text.slice(0, 80));
    r = await raw('POST', '/folders', { who: 'seller', body: '[1,2,3]' });
    ok('cuerpo que es un arreglo → 4xx', r.status >= 400 && r.status < 500, String(r.status));
    r = await raw('POST', '/folders', { who: 'seller', body: '{"a":'.repeat(4000) + '1' + '}'.repeat(4000) });
    ok('JSON anidado 4000 niveles → 4xx sin caída', r.status >= 400 && r.status < 500 && (await raw('GET', '/health', {})).status === 200, String(r.status));
    r = await raw('POST', '/folders', { who: 'seller', body: JSON.stringify({ name: 'x'.repeat(3 * 1024 * 1024) }) });
    ok('cuerpo de 3 MB → 413', r.status === 413, String(r.status));
    r = await raw('POST', '/folders', { who: 'seller', contentType: 'text/plain', body: JSON.stringify({ name: 'CSRF simple', tcg: 'Pokemon', color: 'blue', isPublic: false }) });
    ok('POST con text/plain (petición "simple" sin preflight) no crea nada', r.status >= 400 && r.status < 500, String(r.status));
    r = await raw('POST', '/folders', { who: 'seller', contentType: 'application/x-www-form-urlencoded', body: 'name=urlenc&tcg=Pokemon&color=blue&__proto__[role]=admin' });
    ok('POST urlencoded tampoco crea nada', r.status >= 400 && r.status < 500, String(r.status));
    r = await raw('GET', '/folders/' + 'z'.repeat(5000), { who: 'seller' });
    ok('ruta con parámetro de 5000 caracteres → 4xx', r.status >= 400 && r.status < 500 && !LEAK.test(r.text), String(r.status));
    for (const [label, headers] of [['token con salto de línea', { Authorization: 'Bearer abc\r\nX-Injected: 1' }], ['token enorme', { Authorization: 'Bearer ' + 'A'.repeat(20000) }], ['esquema raro', { Authorization: 'Basic dGVzdDp0ZXN0' }], ['solo Bearer', { Authorization: 'Bearer ' }]]) {
      try { r = await fetch(B + '/orders/mine', { headers }); ok(label + ' → 400/401/403/431 (nunca 2xx)', [400, 401, 403, 431].includes(r.status), String(r.status)); } catch (e) { ok(label + ' → rechazada por el cliente HTTP (no llega al servidor)', true, e.cause?.code || e.message); }
    }
    r = await raw('HEAD', '/admin/reports', {});
    ok('HEAD a ruta de moderación sin sesión → 401', r.status === 401, String(r.status));
    r = await raw('GET', '/folders/' + jerryFolderId, { who: 'seller', headers: { 'X-HTTP-Method-Override': 'DELETE', 'X-Method-Override': 'DELETE' } });
    ok('cabecera de sobrescritura de método no borra carpetas ajenas', !!(await prisma.folder.findUnique({ where: { id: jerryFolderId } })));

    for (const [label, route, body] of [['byte nulo en la búsqueda del catálogo', '/tcg/search?q=%00', null], ['byte nulo en una ruta', '/users/ab%00cd', null]]) {
      r = await raw('GET', route, {});
      ok(label + ' → 400 (no llega a la base de datos)', r.status === 400 || r.status === 404, String(r.status));
    }
    r = await raw('POST', '/folders', { who: 'seller', body: JSON.stringify({ name: 'a\u0000b', tcg: 'Pokemon', color: 'blue', isPublic: false }) });
    ok('byte nulo en el nombre de una carpeta → 400', r.status === 400, String(r.status));
    r = await raw('POST', '/folders/' + folderId + '/cards', { who: 'seller', body: JSON.stringify({ tcgId: 'nul-1', name: 'nul', price: 1, stock: 1, data: { nota: 'x\u0000y' } }) });
    ok('byte nulo dentro de los datos JSON de una carta → 400', r.status === 400, String(r.status));

    // ===== 4. Parámetros de consulta hostiles en rutas públicas =====
    console.log('\n-- 4. consultas hostiles en rutas GET públicas');
    const routesDir = path.join(__dirname, '..', 'routes');
    const publicGets = [];
    for (const file of fs.readdirSync(routesDir).filter((n) => n.endsWith('.js'))) {
      for (const line of fs.readFileSync(path.join(routesDir, file), 'utf8').split('\n')) {
        const m = line.match(/router\.get\('(\/api\/[^']+)'(.*)/);
        if (m && !/authenticateToken|requireStaff|requireAdmin/.test(m[2])) publicGets.push(m[1].replace(/^\/api/, ''));
      }
    }
    const fill = (p) => p.replace(':id', cardId).replace(':folderId', folderId).replace(':cardId', cardId).replace(':username', NAMES.seller).replace(/:[A-Za-z]+/g, 'x');
    const payloads = ['?q[a]=1&q[b][c]=2', '?q[]=a&q[]=b&page[]=1&limit[]=5', '?q=%00&page=-1&limit=999999999', "?q=' OR 1=1--&sort=;DROP TABLE users", '?q=' + encodeURIComponent('(a+)+$'.repeat(2000)), '?page=1e309&limit=NaN&offset=-5&skip=-1&take=-1', '?tcg=__proto__&comuna[$ne]=x&sort[$gt]=1&username[contains]=a'];
    let malos = [];
    for (const route of [...new Set(publicGets.map(fill))].filter((route) => route !== '/seo/sitemap.xml')) {
      for (const qs of payloads) {
        const rr = await raw('GET', route + qs, {}).catch((e) => ({ status: 599, text: String(e) }));
        if ((rr.status >= 500 && !(rr.status === 502 && /^\/tcg\//.test(route))) || LEAK.test(rr.text)) malos.push(`${route}${qs.slice(0, 18)} → ${rr.status} [${(rr.text.match(LEAK) || [''])[0].slice(0, 40)}] ...${(rr.text.slice(Math.max(0, rr.text.search(LEAK) - 30), rr.text.search(LEAK) + 50) || '').replace(/\s+/g, ' ')}`);
      }
    }
    ok('ninguna ruta GET pública (' + new Set(publicGets).size + ') da 5xx ni filtra detalles con consultas hostiles', malos.length === 0, malos.slice(0, 6).join(' | '));

    // ===== 5. SSRF =====
    console.log('\n-- 5. SSRF');
    const ssrfUrls = ['http://carpetazo.cl/x.png', 'https://carpetazo.cl@evil.test/x.png', 'https://evil.test#@carpetazo.cl/x.png', 'https://carpetazo.cl.evil.test/x.png', 'https://127.0.0.1/x.png', 'https://localhost/x.png', 'https://[::1]/x.png', 'https://2130706433/x.png', 'https://0x7f000001/x.png', 'https://169.254.169.254/latest/meta-data/', 'https://carpetazo.cl./x.png', 'https://carpetazo.cl%2f.evil.test/x.png', 'file:///etc/passwd', 'gopher://127.0.0.1:6379/_PING', 'javascript:alert(1)', 'https://evil.test/redirect?to=https://carpetazo.cl/x.png', '//evil.test/x.png', 'https:\\\\evil.test\\x.png'];
    let abiertas = [];
    for (const u of ssrfUrls) {
      const rr = await raw('GET', '/proxy-image?url=' + encodeURIComponent(u), {});
      if (rr.status === 200) abiertas.push(u);
    }
    ok('proxy-image rechaza ' + ssrfUrls.length + ' variantes de URL internas o con confusión de host', abiertas.length === 0, abiertas.join(' | '));
    const photoVariants = ['https://evil.test/x.png', 'https://pub-cztest.r2.dev.evil.test/x.png', 'https://evil.test/pub-cztest.r2.dev/x.png', 'https://x.googleusercontent.com.evil.test/a.png', 'https://evil.test/?a=.googleusercontent.com', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+', 'https://pub-cztest.r2.dev@evil.test/x.png', '//evil.test/x.png', 'https://pub-cztest.r2.dev\\.evil.test/x.png', 'http://pub-cztest.r2.dev/x.png'];
    let aceptadas = [];
    for (const u of photoVariants) {
      for (const field of ['photoURL', 'bannerBase64', 'wallpaperBase64']) {
        const rr = await call('PUT', '/users/me', 'seller', { [field]: u });
        if (rr.status === 200) aceptadas.push(field + '=' + u);
      }
    }
    ok('campos de imagen del perfil rechazan ' + photoVariants.length + ' URLs hostiles en 3 campos', aceptadas.length === 0, aceptadas.slice(0, 4).join(' | '));
    const b64 = Buffer.from('k'.repeat(65)).toString('base64url');
    let pushAceptadas = [];
    for (const endpoint of ['https://fcm.googleapis.com.evil.test/x', 'https://evil.test/fcm.googleapis.com/x', 'https://fcm.googleapis.com@evil.test/x', 'http://fcm.googleapis.com/x', 'https://updates.push.services.mozilla.com.evil.test/x', 'https://127.0.0.1/x', 'https://169.254.169.254/x', 'https://localhost:8000/api/health']) {
      const rr = await call('POST', '/notifications/push/subscribe', 'seller', { endpoint, keys: { p256dh: b64, auth: b64.slice(0, 22) } });
      if (rr.status !== 400) pushAceptadas.push(endpoint + ' → ' + rr.status);
    }
    ok('suscripción push rechaza endpoints internos o con confusión de host', pushAceptadas.length === 0, pushAceptadas.join(' | '));

    // SVG con referencia externa: ¿el servidor hace la petición al procesar la imagen subida?
    let hits = [];
    const listener = http.createServer((req, res) => { hits.push(req.url); res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(); });
    await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const lport = listener.address().port;
    const svgs = {
      'SVG con <image> a http': `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200"><image xlink:href="http://127.0.0.1:${lport}/svg-image" width="200" height="200"/></svg>`,
      'SVG con hoja de estilo externa': `<?xml-stylesheet href="http://127.0.0.1:${lport}/svg-css" type="text/css"?><svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200"/></svg>`,
      'SVG con entidad externa (XXE)': `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "http://127.0.0.1:${lport}/svg-xxe">]><svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="20">&x;</text></svg>`,
      'SVG con use externo': `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200"><use xlink:href="http://127.0.0.1:${lport}/svg-use#a"/></svg>`
    };
    const form = (buf, mime, name) => { const fd = new FormData(); fd.append('image', new Blob([buf], { type: mime }), name); fd.append('type', 'avatar'); return fd; };
    for (const [label, svg] of Object.entries(svgs)) {
      const rr = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U.seller, 'x-test-scan': 'clean' }, body: form(Buffer.from(svg), 'image/png', 'foto.png') });
      await rr.text();
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    listener.close();
    ok('subir SVG con referencias externas no hace peticiones desde el servidor (SSRF por imagen)', hits.length === 0, hits.length ? 'PETICIONES RECIBIDAS: ' + hits.join(', ') : '');

    // ===== 6. Archivos: tipo falso, bombas de píxeles y rendimiento =====
    console.log('\n-- 6. archivos');
    for (const [label, buf, mime, name] of [['HTML con tipo image/png', Buffer.from('<html><script>alert(1)</script></html>'), 'image/png', 'foto.png'], ['nombre con ruta ../../', await sharp({ create: { width: 40, height: 40, channels: 3, background: '#123456' } }).png().toBuffer(), 'image/png', '../../etc/passwd.png'], ['archivo vacío', Buffer.alloc(0), 'image/png', 'foto.png'], ['PNG truncado', (await sharp({ create: { width: 400, height: 400, channels: 3, background: '#abcdef' } }).png().toBuffer()).subarray(0, 120), 'image/png', 'foto.png']]) {
      const rr = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U.seller, 'x-test-scan': 'clean' }, body: form(buf, mime, name) });
      const t = await rr.text();
      if (label.startsWith('nombre con ruta')) { ok('subida con nombre "../../" no permite escribir fuera de la carpeta de la persona (la clave la genera el servidor)', rr.status !== 200 || (!/\.\./.test(t) && /\/Usuarios\/cztest-seller\//.test(t)), rr.status + ' ' + t.slice(0, 120)); continue; }
      ok('subida "' + label + '" → 4xx sin detalles internos', rr.status >= 400 && rr.status < 500 && !LEAK.test(t), rr.status + ' ' + t.slice(0, 90));
    }
    const bomb = await sharp({ create: { width: 8900, height: 8900, channels: 3, background: '#335577' } }).png({ compressionLevel: 9 }).toBuffer();
    const healthLatency = async () => { const t0 = Date.now(); await raw('GET', '/health', {}); return Date.now() - t0; };
    const base = await healthLatency();
    const t0 = Date.now();
    const ups = Array.from({ length: 4 }, (_, i) => fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[['seller', 'jerry', 'ignacio', 'ale'][i]], 'x-test-scan': 'clean', 'X-Forwarded-For': '203.0.113.' + (50 + i) }, body: form(bomb, 'image/png', 'bomba.png') }).then((x) => x.status).catch(() => 0));
    const during = [];
    const sampler = setInterval(() => healthLatency().then((ms) => during.push(ms)), 300);
    const statuses = await Promise.all(ups);
    clearInterval(sampler);
    const worst = Math.max(base, ...during);
    ok('4 subidas simultáneas de ~79 millones de píxeles no dejan sin responder al servidor (peor latencia de /health ' + worst + ' ms, subidas ' + (Date.now() - t0) + ' ms, estados ' + statuses.join(',') + ')', worst < 2500 && statuses.every((s) => s !== 0), '');

    // ===== 7. Carreras sobre cuotas =====
    console.log('\n-- 7. carreras');
    const victim = await prisma.user.findUnique({ where: { username: NAMES.ignacio } });
    await prisma.planGrant.deleteMany({ where: { userId: victim.id } });
    await prisma.folder.deleteMany({ where: { userId: victim.id } });
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => call('POST', '/folders', 'ignacio', { name: 'Carrera ' + i, tcg: 'Pokemon', color: 'blue', isPublic: false }, '198.51.100.' + (10 + i))));
    const created = await prisma.folder.count({ where: { userId: victim.id } });
    ok('16 creaciones simultáneas de carpeta con plan Free (tope 1) crean como máximo 1', created <= 1, 'creadas: ' + created + ', éxitos: ' + results.filter((x) => x.status === 200 || x.status === 201).length);
    const only = await prisma.folder.findFirst({ where: { userId: victim.id } });
    if (only) {
      const base54 = Array.from({ length: 52 }, (_, i) => ({ folderId: only.id, tcgId: 'race-' + i, name: 'c' + i, price: 100, stock: 1, language: 'English', data: {} }));
      await prisma.card.createMany({ data: base54 }).catch(() => null);
      const have = await prisma.card.count({ where: { folderId: only.id } });
      const rc = await Promise.all(Array.from({ length: 12 }, (_, i) => call('POST', '/folders/' + only.id + '/cards', 'ignacio', { tcgId: 'race-new-' + i, name: 'n' + i, price: 100, stock: 1 }, '198.51.100.' + (40 + i))));
      const total = await prisma.card.count({ where: { folderId: only.id } });
      ok('12 altas simultáneas de cartas únicas en el borde del tope Free (54) no lo superan (había ' + have + ', quedaron ' + total + ')', total <= 54, 'total ' + total);
    }
    await prisma.folder.deleteMany({ where: { userId: victim.id } });
    await prisma.planGrant.create({ data: { userId: victim.id, planKey: 'store', reason: 'Pruebas automatizadas' } });

    // ===== 8. Suplantación con Unicode =====
    console.log('\n-- 8. suplantación con Unicode');
    const bidi = ['Admin\u202E', '\u202Esoporte', 'Ana\u2066x\u2069', 'Mod\u200Berador', 'Sop\u200Eorte', '\uFEFFAdmin', 'Carpetazo\u2028Oficial'];
    let aceptados = [];
    for (const name of bidi) {
      const rr = await call('PUT', '/users/me', 'seller', { name });
      if (rr.status === 200) aceptados.push(JSON.stringify(name));
    }
    await call('PUT', '/users/me', 'seller', { name: 'Prueba seller' });
    ok('el nombre del perfil rechaza caracteres de dirección y de ancho cero (suplantación de personal)', aceptados.length === 0, 'aceptados: ' + aceptados.join(' '));
    const folderNameBidi = await call('POST', '/folders', 'seller', { name: 'Oferta\u202Egnp.exe', tcg: 'Pokemon', color: 'blue', isPublic: false });
    ok('el nombre de carpeta rechaza caracteres de dirección', folderNameBidi.status >= 400, String(folderNameBidi.status));
    if (folderNameBidi.j?.folder?.id) await prisma.folder.delete({ where: { id: folderNameBidi.j.folder.id } });

    // ===== 9. Host, errores y cabeceras =====
    console.log('\n-- 9. Host, errores y cabeceras');
    r = await raw('GET', '/og/folder/' + folderId, { headers: { Host: 'evil.test', 'X-Forwarded-Host': 'evil.test' } }).catch(() => null);
    if (r) ok('la vista previa HTML no refleja la cabecera Host ni X-Forwarded-Host', !/evil\.test/.test(r.text), r.status + '');
    const leaks = [];
    for (const [m, p, b] of [['GET', '/folders/not-a-uuid', null], ['GET', '/cards/%00/offers', null], ['POST', '/orders/create', { folderId: 'x', items: 'x' }], ['GET', '/users/' + encodeURIComponent('<script>'), null], ['GET', '/og/folder/%27%22', null], ['PUT', '/folders/' + folderId + '/cards/' + 'q'.repeat(100), { price: 1 }]]) {
      const rr = await raw(m, p, { who: 'seller', body: b ? JSON.stringify(b) : undefined });
      if (LEAK.test(rr.text) || rr.status >= 500) leaks.push(m + ' ' + p.slice(0, 30) + ' → ' + rr.status);
    }
    ok('errores provocados a propósito no devuelven rutas internas, trazas ni 5xx', leaks.length === 0, leaks.join(' | '));
    r = await raw('GET', '/health', {});
    ok('/health no revela el tiempo en marcha ni la versión (huella del servidor)', !('uptime' in (r.j || {})) && !('version' in (r.j || {})), JSON.stringify(r.j));
    ok('las respuestas de la API no exponen X-Powered-By', !r.headers.get('x-powered-by'));

    // ===== 10. Visibilidad de carpetas privadas =====
    console.log('\n-- 10. carpetas privadas');
    const priv = await call('POST', '/folders', 'seller', { name: 'SECRETO-ATAQUE', tcg: 'Pokemon', color: 'blue', isPublic: false });
    const privId = priv.j?.folder?.id;
    const privCard = await call('POST', '/folders/' + privId + '/cards', 'seller', { tcgId: 'priv-1', name: 'carta secreta ataque', price: 777, stock: 3 });
    const privCardId = privCard.j?.card?.id;
    const fugas = [];
    for (const [label, route, who] of [['carpeta por API', '/folders/' + privId, null], ['carpeta por API (otra persona)', '/folders/' + privId, 'jerry'], ['ofertas de la carta', '/cards/' + privCardId + '/offers', null], ['historial de precios', '/cards/' + privCardId + '/price-history', null], ['vista previa HTML', '/og/folder/' + privId, null], ['imagen de vista previa', '/og/folder/' + privId + '/image.jpg', null], ['imagen de carta', '/og/card/' + privCardId + '/image.jpg', null]]) {
      const rr = await raw('GET', route, { who });
      if (rr.status === 200 && /SECRETO-ATAQUE|carta secreta ataque|"price":777|777/.test(rr.text)) fugas.push(label);
    }
    for (const [label, route] of [['búsqueda de cartas', '/cards/search?q=secreta'], ['búsqueda de carpetas', '/folders/search?q=SECRETO'], ['inicio destacado', '/home/featured'], ['perfil público', '/users/' + NAMES.seller]]) {
      const rr = await raw('GET', route, {});
      if (/SECRETO-ATAQUE|carta secreta ataque/.test(rr.text)) fugas.push(label);
    }
    ok('una carpeta privada y sus cartas no aparecen en ninguna ruta pública', fugas.length === 0, 'fugas: ' + fugas.join(', '));
    if (privId) await prisma.folder.delete({ where: { id: privId } });

    // ===== 11. Límites de frecuencia =====
    console.log('\n-- 11. límites de frecuencia');
    let primero429 = 0;
    for (let i = 1; i <= 80 && !primero429; i += 1) {
      const rr = await raw('POST', '/feedback', { who: 'seller', headers: { 'X-Forwarded-For': '198.51.100.250' }, body: JSON.stringify({ kind: 'suggestion', title: 'Spam ' + i, message: 'Mensaje de ataque repetido ' + i }) });
      if (rr.status === 429) primero429 = i;
    }
    await prisma.feedback.deleteMany({ where: { user: { username: NAMES.seller } } });
    ok('el envío masivo de sugerencias se frena con 429 (primer 429 en el intento ' + (primero429 || '—') + ' de 80)', primero429 > 0 && primero429 <= 40, '');
    let user429 = 0;
    for (let i = 1; i <= 200 && !user429; i += 1) {
      const rr = await raw('GET', '/users/username/available?username=probe' + i, { headers: { 'X-Forwarded-For': '198.51.100.251' } });
      if (rr.status === 429) user429 = i;
    }
    ok('consultar la disponibilidad de usuarios (enumeración) se frena con 429 (primer 429 en el intento ' + (user429 || '—') + ' de 200)', user429 > 0, '');

    // ===== 12. Lógica de pedidos =====
    console.log('\n-- 12. lógica de pedidos');
    const sellerRow = await prisma.user.findUnique({ where: { username: NAMES.seller } });
    const ordF = await call('POST', '/folders', 'seller', { name: 'TEST pedidos', tcg: 'Pokemon', color: 'blue', isPublic: true });
    const ordFolderId = ordF.j?.folder?.id;
    if (ordFolderId) {
      const mkCard = async (tcgId, stock) => (await call('POST', '/folders/' + ordFolderId + '/cards', 'seller', { tcgId, name: 'pedido ' + tcgId, price: 1000, stock })).j?.card?.id;
      const cA = await mkCard('ord-a', 3);
      const cB = await mkCard('ord-b', 1);
      const clean = () => prisma.order.deleteMany({ where: { folderId: ordFolderId } });
      let n = 0;
      const order = (items, extra = {}) => call('POST', '/orders/create', 'jerry', { folderId: ordFolderId, items, ...extra }, '203.0.113.' + (++n));
      const stockOf = async (id) => (await prisma.card.findUnique({ where: { id } })).stock;

      for (const q of [-5, 0, 1.5, 'abc', null, 1e9, 1e400]) {
        const r = await order([{ id: cA, quantity: q }]);
        const it = r.j?.order?.items?.[0];
        ok('cantidad ' + String(q) + ' no rompe el pedido (sin 500, cantidad válida o 409)', r.status < 500 && (r.status === 409 || (it && Number.isInteger(it.quantity) && it.quantity >= 1 && it.quantity <= 3)), 'status ' + r.status + ' qty ' + it?.quantity);
        await clean();
      }
      let r = await order([{ id: cA, quantity: 1, price: 1, name: 'gratis' }], { total: 1, sellerId: 'x', status: 'completed', buyerId: 'x' });
      const stored = r.j?.code && await prisma.order.findFirst({ where: { code: r.j.code } });
      ok('precio, total, vendedor, estado y comprador enviados por el cliente se ignoran', !!stored && stored.total === 1000 && stored.sellerId === sellerRow.id && stored.status === 'pending' && stored.buyerId !== 'x', JSON.stringify(stored && { total: stored.total, status: stored.status }));
      await clean();
      r = await order([{ id: cardId, quantity: 1 }]);
      ok('carta de otra carpeta → 400', r.status === 400, 'status ' + r.status);
      r = await order(Array.from({ length: 101 }, () => ({ id: cA, quantity: 1 })));
      ok('más de 100 líneas → 400', r.status === 400, 'status ' + r.status);
      r = await order([{ id: cA, quantity: 2 }, { id: cA, quantity: 2 }]);
      ok('la misma carta repetida no supera el stock → 409', r.status === 409, 'status ' + r.status);
      r = await order([{ id: cA, quantity: 1 }], { items: [{ id: cA, quantity: 1 }], orderItems: [{ id: cB, quantity: 99 }] });
      ok('items/orderItems duplicados no suman más de lo pedido', r.status === 200 && r.j.order.items.length === 1, 'status ' + r.status);
      await clean();

      // Doble confirmación en paralelo: el stock baja una sola vez
      r = await order([{ id: cB, quantity: 1 }]);
      const oid = r.j?.order?.id;
      const stockBefore = await stockOf(cB);
      const [x1, x2] = await Promise.all([call('POST', '/orders/mine/' + oid + '/status', 'seller', { status: 'completed' }), call('POST', '/orders/mine/' + oid + '/status', 'seller', { status: 'completed' })]);
      ok('confirmar dos veces a la vez: una sola respuesta 200', [x1.status, x2.status].filter((s) => s === 200).length === 1, x1.status + '/' + x2.status);
      ok('el stock baja una sola vez', (await stockOf(cB)) === stockBefore - 1, 'antes ' + stockBefore + ' después ' + (await stockOf(cB)));
      r = await call('POST', '/orders/mine/' + oid + '/status', 'seller', { status: 'rejected' });
      ok('un pedido ya gestionado no se puede cambiar → 409', r.status === 409, 'status ' + r.status);
      await clean();
      r = await order([{ id: cA, quantity: 1 }]);
      const oid2 = r.j?.order?.id;
      for (const who of ['jerry', 'ignacio']) {
        const rr = await call('POST', '/orders/mine/' + oid2 + '/status', who, { status: 'completed' });
        ok('el comprador u otra persona no confirma el pedido (' + who + ')', rr.status === 404 || rr.status === 403, 'status ' + rr.status);
      }
      ok('el pedido sigue pendiente tras los intentos ajenos', (await prisma.order.findUnique({ where: { id: oid2 } })).status === 'pending', '');
      r = await call('POST', '/orders/mine/' + oid2 + '/status', 'seller', { status: 'canceled' });
      ok('estado inválido → 400', r.status === 400, 'status ' + r.status);
      await clean();
      await prisma.folder.delete({ where: { id: ordFolderId } });
    }
    // ===== 13. Plan de prueba solo para administradores =====

    console.log('\n-- 13. plan de prueba (solo administradores)');
    r = await raw('GET', '/plans', {});
    ok('el catálogo público no lista el plan de prueba', r.status === 200 && !/"test"|Prueba/.test(r.text), '');
    for (const who of ['jerry', 'seller']) {
      r = await call('GET', '/billing/me', who);
      ok('/billing/me no muestra planes de administrador a ' + who, r.status === 200 && !r.j?.adminPlans, '');
      r = await call('POST', '/billing/checkout', who, { planKey: 'test' });
      ok('contratar el plan de prueba sin ser administrador → 404 (' + who + ')', r.status === 404, 'status ' + r.status);
    }
    r = await call('GET', '/billing/me', 'admin');
    ok('/billing/me muestra el plan de prueba ($950) a un administrador', r.status === 200 && r.j?.adminPlans?.[0]?.key === 'test' && r.j.adminPlans[0].priceClp === 950, JSON.stringify(r.j?.adminPlans));
  } finally {
    await prisma.$disconnect();
  }
})();
