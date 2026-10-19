// QA de seguridad de las rutas nuevas y barrido de autorización de todas las rutas de la API.
const fs = require('node:fs');
const path = require('node:path');
const { prisma, B, call, ok } = require('./fixtures.cjs');

const get = async (url, headers = {}) => {
  const started = Date.now();
  const r = await fetch(B + url, { headers });
  let j = null;
  try { j = await r.json(); } catch (_) { /* sin JSON */ }
  return { status: r.status, j, ms: Date.now() - started, headers: r.headers };
};
const enc = encodeURIComponent;

(async () => {
  try {
    // ---- 1. Arranque en frío: muchas sugerencias a la vez arman el vocabulario una vez y responden igual
    const cold = await Promise.all(Array.from({ length: 12 }, () => get('/tcg/suggest?q=lucaro', { 'X-Forwarded-For': '10.50.0.1' })));
    ok('sugerencias simultáneas en frío: todas 200 y con la misma respuesta', cold.every((r) => r.status === 200 && r.j?.suggestion === 'Lucario'), JSON.stringify(cold.map((r) => r.status)));

    // ---- 2. Entradas hostiles en los buscadores: nunca 5xx, nunca lentos, nunca error con detalles
    const hostile = ["' OR 1=1 --", '"; DROP TABLE "Card"; --', '%', '%%%%', '_', '\\', '.*', '(a+)+$', '[a-', '{{7*7}}', '<script>alert(1)</script>', '../../etc/passwd', '\u0000', '‮', 'a'.repeat(200), 'ñandú', '🔥🔥🔥', "'''", 'palabra '.repeat(40)];
    for (const route of ['/tcg/suggest?q=', '/tcg/search-index?q=', '/cards/search?q=', '/tcg/search?categoryId=3&q=']) {
      let bad = '';
      let slowest = 0;
      for (const text of hostile) {
        const r = await get(route + enc(text), { 'X-Forwarded-For': '10.50.1.' + (1 + (text.length % 200)) });
        slowest = Math.max(slowest, r.ms);
        if (r.status >= 500 || ![200, 400, 404, 429].includes(r.status)) bad += ' [' + text.slice(0, 12) + ':' + r.status + ']';
        if (/prisma|stack|at \S+ \(|node_modules|SELECT |relation "/i.test(JSON.stringify(r.j) || '')) bad += ' [fuga:' + text.slice(0, 12) + ']';
      }
      ok(route + ' con ' + hostile.length + ' entradas hostiles: sin 5xx ni detalles internos (más lenta ' + slowest + ' ms)', !bad && slowest < 6000, bad);
    }

    // ---- 3. Parámetros con tipos inesperados
    const odd = [
      ['/tcg/suggest?q[]=lucaro&q[]=boss', 'arreglo'], ['/tcg/suggest?q[a]=1', 'objeto'],
      ['/tcg/search-index?q=pikachu&page=-1', 'página negativa'], ['/tcg/search-index?q=pikachu&page=1e9', 'página enorme'],
      ['/tcg/search-index?q=pikachu&page=0x10', 'página hex'], ['/tcg/search-index?q=pikachu&sort[]=best_selling', 'orden como arreglo'],
      ['/tcg/search-index?q=pikachu&sort=__proto__', 'orden __proto__'], ['/cards/search?q=a&sort[$ne]=x', 'orden como objeto'],
      ['/cards/search?q=a&page=999999999', 'página enorme en cartas'], ['/cards/search?q=a&tcg[]=Pokemon', 'tcg como arreglo'],
    ];
    for (const [route, label] of odd) {
      const r = await get(route, { 'X-Forwarded-For': '10.50.2.' + (route.length % 200) });
      ok('tipo inesperado (' + label + ') → 200/400 sin 5xx', [200, 400].includes(r.status), String(r.status));
    }

    // ---- 4. Comodines: «%» y «_» se buscan como símbolos, no como «todo»
    const all = await get('/cards/search?q=a', { 'X-Forwarded-For': '10.50.3.1' });
    for (const symbol of ['%', '_']) {
      const r = await get('/cards/search?q=' + enc(symbol), { 'X-Forwarded-For': '10.50.3.2' });
      ok('«' + symbol + '» no se comporta como comodín en cartas a la venta', r.status === 200 && r.j.total <= all.j.total && r.j.cards.every((c) => c.name.includes(symbol)), String(r.j?.total));
    }
    const wildcard = await get('/tcg/search-index?q=' + enc('%%'), { 'X-Forwarded-For': '10.50.3.3' });
    ok('«%%» no devuelve todo el catálogo', wildcard.status === 200 && wildcard.j.cards.every((c) => c.name.includes('%')), String(wildcard.j?.total));

    // ---- 5. Costo: texto largo con muchas palabras largas no multiplica el trabajo
    const heavy = Array.from({ length: 30 }, (_, i) => 'abcdefghijklmn' + i).join(' ').slice(0, 80);
    for (const route of ['/cards/search?q=', '/tcg/search-index?q=', '/tcg/suggest?q=', '/tcg/search?categoryId=99&q=']) {
      const r = await get(route + enc(heavy), { 'X-Forwarded-For': '10.50.4.' + route.length });
      ok(route + ' texto de 80 caracteres con palabras largas responde rápido (' + r.ms + ' ms)', r.status < 500 && r.ms < 4000, String(r.status));
    }
    const tooLong = await get('/tcg/suggest?q=' + enc('x'.repeat(500)), { 'X-Forwarded-For': '10.50.4.200' });
    ok('texto de 500 caracteres en sugerencias → 400', tooLong.status === 400, String(tooLong.status));

    // ---- 6. Concurrencia: 60 consultas distintas a la vez no tumban ni paralizan el servidor
    const started = Date.now();
    const burst = await Promise.all(Array.from({ length: 60 }, (_, i) => get('/tcg/suggest?q=' + enc('pikacu' + 'xyz'.slice(0, i % 3) + i), { 'X-Forwarded-For': '10.51.' + i + '.1' })));
    const health = await get('/health');
    ok('60 sugerencias distintas simultáneas: todas 200 (' + (Date.now() - started) + ' ms) y /health responde', burst.every((r) => r.status === 200) && health.status === 200, JSON.stringify(burst.filter((r) => r.status !== 200).map((r) => r.status)));

    // ---- 7. Límite de frecuencia en sugerencias
    let limited = 0;
    for (let i = 0; i < 700; i += 1) { const r = await get('/tcg/suggest?q=lucaro', { 'X-Forwarded-For': '10.52.0.9' }); if (r.status === 429) { limited = i + 1; break; } }
    ok('/tcg/suggest se frena con 429 (primer 429 en el intento ' + limited + ')', limited > 0 && limited <= 700, String(limited));

    // ---- 8. Cabeceras de la API
    const headers = await get('/tcg/suggest?q=lucaro', { 'X-Forwarded-For': '10.53.0.1', Origin: 'https://evil.example' });
    ok('la API envía nosniff y no abre CORS a un origen ajeno', headers.headers.get('x-content-type-options') === 'nosniff' && headers.headers.get('access-control-allow-origin') !== 'https://evil.example' && headers.headers.get('access-control-allow-origin') !== '*', String(headers.headers.get('access-control-allow-origin')));
    const pre = await fetch(B + '/users/me', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT', 'X-Forwarded-For': '10.53.0.2' } });
    ok('preflight de un origen ajeno no autoriza PUT /users/me', pre.headers.get('access-control-allow-origin') !== 'https://evil.example', String(pre.headers.get('access-control-allow-origin')));
    const reflected = await get('/tcg/suggest?q=' + enc('<img src=x onerror=alert(1)>'), { 'X-Forwarded-For': '10.53.0.3' });
    ok('la sugerencia de un texto con HTML es JSON y no devuelve etiquetas', /application\/json/.test(reflected.headers.get('content-type') || '') && !/[<>]/.test(reflected.j?.suggestion || ''), JSON.stringify(reflected.j));

    // ---- 9. Lo que no debe verse en las respuestas públicas de cartas
    const publicCards = await get('/cards/search?q=a', { 'X-Forwarded-For': '10.54.0.1' });
    const leaky = JSON.stringify(publicCards.j).match(/soldUnits|firebaseUid|"email"|"rut"|"phone"|bankDetails|"role"/g);
    ok('/cards/search no expone ventas, correo, RUT, teléfono, banco ni rol', publicCards.status === 200 && !leaky, JSON.stringify(leaky));
    const searchIndex = await get('/tcg/search-index?q=pikachu', { 'X-Forwarded-For': '10.54.0.2' });
    ok('/tcg/search-index solo trae datos del catálogo', !/soldUnits|firebaseUid|"email"|userId|sellerId/.test(JSON.stringify(searchIndex.j)), '');

    // ---- 10. Barrido de autorización: todas las rutas sin sesión y, las de equipo, con una persona normal
    const routesDir = path.join(__dirname, '..', 'routes');
    const found = [];
    for (const file of fs.readdirSync(routesDir).filter((name) => name.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
      for (const m of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']*)'/g)) found.push({ method: m[1].toUpperCase(), route: m[2], file });
    }
    const UUID = '00000000-0000-4000-8000-000000000001';
    const fill = (route) => route.replace(/:[A-Za-z]+/g, UUID);
    const origin = B.replace(/\/api$/, '');
    const open2xx = [];
    const serverErrors = [];
    let n = 0;
    for (const { method, route } of found) {
      n += 1;
      const r = await fetch(origin + fill(route), { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.60.' + (n % 250) + '.' + (1 + Math.floor(n / 250)) }, body: method === 'GET' ? undefined : '{}' });
      // /api/tcg/sets y /api/tcg/cards reenvían a un servicio externo: si este no responde, 502 es lo esperado
      if (r.status >= 500 && !(r.status === 502 && /^\/api\/tcg\/(sets|cards)$/.test(route))) serverErrors.push(method + ' ' + route + ' → ' + r.status);
      if (r.status >= 200 && r.status < 300) open2xx.push(method + ' ' + route);
    }
    ok('barrido de ' + found.length + ' rutas sin sesión: ninguna responde 5xx', serverErrors.length === 0, serverErrors.join(' ; '));
    const SENSITIVE = /\/(admin|team|moderation|moderacion|ops|audit|sanctions?|orders\/(mine|pending)|chats|messages|notifications|users\/me|users\/sync|uploads|billing\/(me|checkout|cancel|change)|folders\/mine|cards\/mine|fraud)/;
    const exposed = open2xx.filter((entry) => SENSITIVE.test(entry.split(' ')[1]));
    ok('barrido sin sesión: ninguna ruta sensible responde 2xx', exposed.length === 0, exposed.join(' ; '));
    console.log('INFO ' + open2xx.length + ' de ' + found.length + ' rutas responden 2xx sin sesión: ' + open2xx.join(', '));

    const staff = found.filter(({ route }) => /\/(admin|team|moderation|ops|audit|sanctions?)\b/.test(route));
    const escalated = [];
    let k = 0;
    for (const { method, route } of staff) {
      k += 1;
      const r = await call(method, fill(route).replace(/^\/api/, ''), 'jerry', method === 'GET' ? undefined : {}, '10.70.' + (k % 250) + '.1');
      if (r.status >= 200 && r.status < 300) escalated.push(method + ' ' + route + ' → ' + r.status);
      if (r.status >= 500) escalated.push('5xx ' + method + ' ' + route);
    }
    ok('una persona normal en ' + staff.length + ' rutas de equipo/moderación: ninguna responde 2xx ni 5xx', escalated.length === 0, escalated.join(' ; '));

    // ---- 11. El enlace de pago que llega al navegador es https y de Mercado Pago
    const { isMercadoPagoCheckoutUrl } = await import('../core/mercadopago.js');
    const good = ['https://www.mercadopago.cl/subscriptions/checkout?preapproval_id=1', 'https://mercadopago.com/x'];
    const evil = ['https://evil.com/', 'https://mercadopago.cl.evil.com/', 'https://evilmercadopago.cl/', 'http://www.mercadopago.cl/', 'https://user:pw@www.mercadopago.cl/', 'javascript:alert(1)', '//evil.com', '', null];
    ok('enlace de pago: acepta Mercado Pago por https', good.every((url) => isMercadoPagoCheckoutUrl(url)), '');
    ok('enlace de pago: rechaza otros dominios, http, credenciales y esquemas raros', evil.every((url) => !isMercadoPagoCheckoutUrl(url)), JSON.stringify(evil.filter((url) => isMercadoPagoCheckoutUrl(url))));
  } finally {
    await prisma.$disconnect();
  }
})();
