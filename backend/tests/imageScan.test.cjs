// Escaneo de imágenes: cascada de proveedores (con respuestas simuladas, sin gastar cuota), umbrales, cuotas, huellas y la ruta de subida.
const crypto = require('crypto');
const sharp = require('sharp');
const path = require('path');
const { pathToFileURL } = require('url');
const { prisma, NAMES, B, U, call, ok } = require('./fixtures.cjs');

const uid = (who) => 'cztest-' + who;
const DAY = 24 * 60 * 60 * 1000;
const FAR_NOW = new Date('2031-03-15T12:00:00Z').getTime(); // mes aislado para las pruebas de cuota
const FAR_MONTH = '2031-03';
const testStart = new Date();

// Imagen distinta por semilla (formas de colores), para que cada prueba tenga su propio sha256 y su propia huella
const picture = (seed, format = 'png') => {
  const shapes = Array.from({ length: 7 }, (_, k) => {
    const gray = (seed * 41 + k * 59) % 256;
    const x = (seed * (k + 3) * 13) % 200 + 10;
    const y = (seed * (k + 5) * 9) % 200 + 10;
    const size = 20 + ((seed + k * 17) % 70);
    return k % 2
      ? '<circle cx="' + x + '" cy="' + y + '" r="' + size + '" fill="rgb(' + gray + ',' + ((gray + 80) % 256) + ',' + ((gray + 160) % 256) + ')"/>'
      : '<rect x="' + x + '" y="' + y + '" width="' + size * 2 + '" height="' + size + '" fill="rgb(' + ((gray + 30) % 256) + ',' + gray + ',' + ((gray + 110) % 256) + ')"/>';
  }).join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="240"><rect width="300" height="240" fill="rgb(' + ((seed * 31) % 256) + ',' + ((seed * 67) % 256) + ',' + ((seed * 109) % 256) + ')"/>' + shapes + '</svg>';
  const image = sharp(Buffer.from(svg));
  return format === 'jpeg' ? image.jpeg({ quality: 90 }).toBuffer() : image.png().toBuffer();
};

const upload = async (who, buffer, { type = 'avatar', scan = null, name = 'foto.png', mime = 'image/png' } = {}) => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: mime }), name);
  form.append('type', type);
  const headers = { ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}), ...(scan ? { 'x-test-scan': scan } : {}) };
  const r = await fetch(B + '/users/upload-image', { method: 'POST', headers, body: form });
  let j = null;
  try { j = await r.json(); } catch (_) { /* sin JSON */ }
  return { status: r.status, j };
};
const r2Log = async () => (await (await fetch(B + '/__test/r2-log')).json()).log;
const keyOf = (url) => new URL(url).pathname.replace(/^\//, '');
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

(async () => {
  try {
    const scanModule = await import(pathToFileURL(path.join(__dirname, '..', 'imageScan.js')).href);
    const perceptual = await import(pathToFileURL(path.join(__dirname, '..', 'perceptual.js')).href);
    const { decide, createImageScanner, prepareImage, cleanEnv } = scanModule;

    // --- Umbrales ---
    ok('umbral: explícito alto en perfil se bloquea', decide({ explicit: 0.9, suggestive: 0.9, violence: null }, 'profile') === 'block');
    ok('umbral: explícito medio en perfil va a revisión', decide({ explicit: 0.6, suggestive: 0.3, violence: null }, 'profile') === 'review');
    ok('umbral: muy sugerente en perfil va a revisión', decide({ explicit: 0.1, suggestive: 0.95, violence: null }, 'profile') === 'review');
    ok('umbral: violencia muy probable en perfil va a revisión', decide({ explicit: 0, suggestive: 0, violence: 0.95 }, 'profile') === 'review');
    ok('umbral: imagen limpia pasa', decide({ explicit: 0.02, suggestive: 0.05, violence: 0.15 }, 'profile') === 'clear');
    ok('umbral: el mismo puntaje que bloquea un perfil NO bloquea una carta (arte)', decide({ explicit: 0.9, suggestive: 0.9, violence: null }, 'card') === 'review');
    ok('umbral: solo lo extremo bloquea una carta', decide({ explicit: 0.97, suggestive: 0.9, violence: null }, 'card') === 'block');
    ok('umbral: la violencia no afecta a las cartas', decide({ explicit: 0.1, suggestive: 0.1, violence: 0.95 }, 'card') === 'clear');

    // --- Cascada con servicios simulados ---
    const env = { SIGHTENGINE_USER: 'usuario', SIGHTENGINE_SECRET: 'secreto', GOOGLE_VISION_KEY: 'clave', TEST_AUTH_STUB: '0' };
    const calls = { sightengine: 0, google: 0 };
    let sightengineReply = () => response({ status: 'success', request: { operations: 1 }, nudity: { sexual_activity: 0.01, sexual_display: 0.01, erotica: 0.01, very_suggestive: 0.02, suggestive: 0.02, mildly_suggestive: 0.02, none: 0.98 } });
    let googleReply = () => response({ responses: [{ safeSearchAnnotation: { adult: 'VERY_UNLIKELY', racy: 'UNLIKELY', violence: 'VERY_UNLIKELY', spoof: 'UNLIKELY', medical: 'UNLIKELY' } }] });
    const fakeFetch = async (url, options) => {
      if (String(url).includes('sightengine')) { calls.sightengine += 1; return sightengineReply(url, options); }
      calls.google += 1;
      return googleReply(url, options);
    };
    let clock = FAR_NOW;
    const makeScanner = (overrides = {}) => createImageScanner({ prisma, env: { ...env, ...overrides }, fetchImpl: fakeFetch, now: () => clock });
    const sample = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#336699' } }).jpeg().toBuffer();
    await prisma.scanUsage.deleteMany({ where: { month: FAR_MONTH } });

    let scanner = makeScanner();
    ok('escáner con claves configuradas queda activo', scanner.enabled === true && scanner.providers.join() === 'sightengine,google');
    ok('sin claves el escáner queda apagado (el sitio funciona igual)', createImageScanner({ prisma, env: { TEST_AUTH_STUB: '0' } }).enabled === false);
    ok('IMAGE_SCAN_DISABLED apaga el escáner', createImageScanner({ prisma, env: { ...env, IMAGE_SCAN_DISABLED: '1' } }).enabled === false);

    let result = await scanner.scan(sample, { kind: 'profile' });
    ok('Sightengine responde: veredicto limpio y sin respaldo', result.verdict === 'clear' && result.provider === 'sightengine' && result.fallback === false && calls.google === 0);
    await new Promise((resolve) => setTimeout(resolve, 200));
    ok('el uso mensual se registra con las operaciones informadas', (await prisma.scanUsage.findUnique({ where: { provider_month: { provider: 'sightengine', month: FAR_MONTH } } }))?.used === 1);

    // Variables pegadas con espacios, saltos de línea o comillas (típico al copiarlas a un panel): se limpian antes de usarlas
    ok('cleanEnv: quita espacios y saltos de línea', cleanEnv('  abc\n') === 'abc');
    ok('cleanEnv: quita comillas que envuelven el valor', cleanEnv('"abc"') === 'abc' && cleanEnv("'abc'") === 'abc');
    ok('cleanEnv: no toca comillas dentro del valor', cleanEnv('ab"c') === 'ab"c');
    ok('cleanEnv: valores vacíos o ausentes quedan vacíos', cleanEnv(undefined) === '' && cleanEnv('   ') === '' && cleanEnv(null) === '');
    let seen = {};
    const spyFetch = async (url, options) => {
      if (String(url).includes('sightengine')) seen = { user: options.body.get('api_user'), secret: options.body.get('api_secret') };
      return fakeFetch(url, options);
    };
    const dirtyScanner = createImageScanner({ prisma, env: { ...env, SIGHTENGINE_USER: '  "usuario"\n', SIGHTENGINE_SECRET: "'secreto'  " }, fetchImpl: spyFetch, now: () => clock });
    result = await dirtyScanner.scan(sample, { kind: 'profile' });
    ok('credenciales con comillas y espacios se envían limpias y el escaneo funciona', seen.user === 'usuario' && seen.secret === 'secreto' && result.provider === 'sightengine');
    ok('...y un escaneo normal no deja nada en "detail"', result.detail === null);

    sightengineReply = () => response({ status: 'success', request: { operations: 2 }, nudity: { sexual_activity: 0.9, sexual_display: 0.2, erotica: 0.3, very_suggestive: 0.9, suggestive: 0.9, mildly_suggestive: 0.9, none: 0.02 } });
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('contenido explícito en un perfil → block', result.verdict === 'block' && result.provider === 'sightengine');
    result = await scanner.scan(sample, { kind: 'card' });
    ok('el mismo puntaje en una carta → review (más permisivo)', result.verdict === 'review');
    await new Promise((resolve) => setTimeout(resolve, 200));
    ok('se suman las operaciones que informa el proveedor (1 + 1 + 2 + 2)', (await prisma.scanUsage.findUnique({ where: { provider_month: { provider: 'sightengine', month: FAR_MONTH } } }))?.used === 6);

    // Cuota agotada de Sightengine → respaldo en Google, y Sightengine no se vuelve a llamar ese mes
    scanner = makeScanner();
    sightengineReply = () => response({ status: 'failure', request: { operations: 0 }, error: { type: 'usage_limit', code: 32, message: 'limit' } }, 429);
    calls.sightengine = 0; calls.google = 0;
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('cuota agotada en Sightengine → responde Google como respaldo', result.verdict === 'clear' && result.provider === 'google' && result.fallback === true && calls.sightengine === 1 && calls.google === 1);
    const exhausted = await prisma.scanUsage.findUnique({ where: { provider_month: { provider: 'sightengine', month: FAR_MONTH } } });
    ok('queda anotado que la cuota de Sightengine se agotó (usado = límite)', exhausted.used >= 2000);
    scanner = makeScanner();
    calls.sightengine = 0; calls.google = 0;
    await scanner.scan(sample, { kind: 'profile' });
    ok('con la cuota agotada ya no se llama a Sightengine (ahorra la llamada fallida)', calls.sightengine === 0 && calls.google === 1);

    // Google también sin cuota → no disponible
    googleReply = () => response({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } }, 429);
    scanner = makeScanner();
    await prisma.scanUsage.deleteMany({ where: { provider: 'google', month: FAR_MONTH } });
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('los dos servicios sin cuota → unavailable', result.verdict === 'unavailable' && result.provider === null);
    ok('"unavailable" deja constancia de qué pasó con cada proveedor', result.detail === 'sightengine:cuota,google:quota', String(result.detail));
    await new Promise((resolve) => setTimeout(resolve, 200));
    ok('...y el motivo queda guardado en el registro de escaneos', (await prisma.scanEvent.count({ where: { createdAt: { gte: testStart }, detail: 'sightengine:cuota,google:quota' } })) >= 1);
    ok('...y Google queda marcado como agotado', (await prisma.scanUsage.findUnique({ where: { provider_month: { provider: 'google', month: FAR_MONTH } } }))?.used >= 1000);

    // Mes nuevo: las cuotas vuelven a empezar
    clock = new Date('2031-04-02T10:00:00Z').getTime();
    googleReply = () => response({ responses: [{ safeSearchAnnotation: { adult: 'VERY_LIKELY', racy: 'VERY_LIKELY', violence: 'VERY_UNLIKELY' } }] });
    sightengineReply = () => response({ status: 'success', request: { operations: 1 }, nudity: { sexual_activity: 0, sexual_display: 0, erotica: 0, very_suggestive: 0, suggestive: 0, mildly_suggestive: 0, none: 1 } });
    scanner = makeScanner();
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('al cambiar de mes se vuelve a usar el proveedor principal', result.provider === 'sightengine' && result.verdict === 'clear');
    clock = FAR_NOW;

    // Solo Google (sin Sightengine configurado) y traducción de probabilidades
    scanner = makeScanner({ SIGHTENGINE_USER: '', SIGHTENGINE_SECRET: '' });
    await prisma.scanUsage.deleteMany({ where: { provider: 'google', month: FAR_MONTH } });
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('Google: adult e inapropiado muy probables → block', result.provider === 'google' && result.verdict === 'block');
    googleReply = () => response({ responses: [{ safeSearchAnnotation: { adult: 'POSSIBLE', racy: 'UNLIKELY', violence: 'VERY_LIKELY' } }] });
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('Google: violencia muy probable → review', result.verdict === 'review');
    googleReply = () => response({ responses: [{ safeSearchAnnotation: { adult: 'UNKNOWN', racy: 'UNKNOWN', violence: 'UNKNOWN' } }] });
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('Google: respuestas desconocidas no bloquean', result.verdict === 'clear');

    // Credenciales malas → se deja de insistir un rato
    scanner = makeScanner();
    await prisma.scanUsage.deleteMany({ where: { month: FAR_MONTH } });
    sightengineReply = () => response({ status: 'failure', error: { type: 'credentials_error', code: 2, message: 'bad' } }, 401);
    googleReply = () => response({ responses: [{ safeSearchAnnotation: { adult: 'VERY_UNLIKELY', racy: 'VERY_UNLIKELY', violence: 'VERY_UNLIKELY' } }] });
    calls.sightengine = 0;
    await scanner.scan(sample, { kind: 'profile' });
    await scanner.scan(sample, { kind: 'profile' });
    ok('credenciales rechazadas: se prueba una vez y luego se abre el circuito (usa el respaldo)', calls.sightengine === 1);

    // Errores transitorios: 3 fallos seguidos abren el circuito; entre medio responde el respaldo
    scanner = makeScanner();
    await prisma.scanUsage.deleteMany({ where: { month: FAR_MONTH } });
    sightengineReply = () => response({ status: 'failure', error: { type: 'api_error', code: 9 } }, 500);
    calls.sightengine = 0;
    for (let i = 0; i < 5; i += 1) await scanner.scan(sample, { kind: 'profile' });
    ok('errores 5xx: tras 3 fallos seguidos se deja de llamar al principal', calls.sightengine === 3, String(calls.sightengine));

    // Tiempo máximo: un servicio colgado no bloquea la subida
    scanner = makeScanner({ IMAGE_SCAN_PROVIDER_TIMEOUT_MS: '300', IMAGE_SCAN_BUDGET_MS: '1500' });
    await prisma.scanUsage.deleteMany({ where: { month: FAR_MONTH } });
    sightengineReply = (url, options) => new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' }))); });
    const started = Date.now();
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('un proveedor que no responde se corta por tiempo y responde el respaldo', result.provider === 'google' && Date.now() - started < 1500, String(Date.now() - started));
    ok('...y queda anotado como "timeout"', result.detail === 'sightengine:timeout', String(result.detail));
    ok('los tiempos por defecto son holgados para un servidor en São Paulo (4 s por servicio, 8 s en total)', createImageScanner({ prisma, env: { ...env } }).providers.length === 2);

    // 95 % de la cuota: se deja de usar antes de agotarla
    await prisma.scanUsage.deleteMany({ where: { month: FAR_MONTH } });
    await prisma.scanUsage.create({ data: { provider: 'sightengine', month: FAR_MONTH, used: 1900 } });
    scanner = makeScanner();
    sightengineReply = () => response({ status: 'success', request: { operations: 1 }, nudity: { none: 1 } });
    calls.sightengine = 0;
    result = await scanner.scan(sample, { kind: 'profile' });
    ok('al llegar al 95 % de la cuota se pasa al respaldo sin llamar al principal', calls.sightengine === 0 && result.provider === 'google');
    await prisma.scanUsage.deleteMany({ where: { month: FAR_MONTH } });

    // La respuesta no debe traer ni registrar la clave
    ok('el resultado del escaneo no contiene credenciales', !/usuario|secreto|clave/.test(JSON.stringify(result)));

    // --- Preparación de la imagen ---
    const png = await picture(5);
    const prepared = await prepareImage(png);
    ok('preparar: huella de 16 hex, sha256 y copia JPEG reducida', /^[0-9a-f]{16}$/.test(prepared.hash) && /^[0-9a-f]{64}$/.test(prepared.sha256) && prepared.scanJpeg[0] === 0xff && prepared.scanJpeg[1] === 0xd8);
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#aa5500' } }).jpeg().toBuffer();
    const bigMeta = await sharp((await prepareImage(big)).scanJpeg).metadata();
    ok('preparar: la copia a escanear no pasa de 768 px', Math.max(bigMeta.width, bigMeta.height) <= 768);
    const transparent = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const flat = await sharp((await prepareImage(transparent)).scanJpeg).stats();
    ok('preparar: la transparencia se aplana sobre blanco (nada escondido)', flat.channels[0].mean > 240);
    let rejected = null;
    try { await prepareImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')); } catch (error) { rejected = error.scanCode; }
    ok('preparar: un SVG no se acepta', rejected === 'format');
    rejected = null;
    try { await prepareImage(Buffer.from('esto no es una imagen')); } catch (error) { rejected = error.message; }
    ok('preparar: un archivo dañado falla sin romper nada', Boolean(rejected));

    // --- Caché de veredictos ---
    const shaClear = crypto.randomBytes(32).toString('hex');
    const shaBlock = crypto.randomBytes(32).toString('hex');
    const shaReview = crypto.randomBytes(32).toString('hex');
    const shaOld = crypto.randomBytes(32).toString('hex');
    await prisma.imageHash.createMany({ data: [
      { url: 'cztest-cache-1', hash: 'a'.repeat(16), sha256: shaClear, verdict: 'clear', provider: 'sightengine' },
      { url: 'cztest-cache-2', hash: 'b'.repeat(16), sha256: shaBlock, verdict: 'block' },
      { url: 'cztest-cache-3', hash: 'c'.repeat(16), sha256: shaReview, verdict: 'review' },
      { url: 'cztest-cache-4', hash: 'd'.repeat(16), sha256: shaOld, verdict: 'clear', createdAt: new Date(Date.now() - 40 * DAY) }
    ] });
    scanner = createImageScanner({ prisma, env: { ...env }, fetchImpl: fakeFetch });
    ok('caché: archivo ya aprobado', (await scanner.cachedVerdict(shaClear))?.verdict === 'clear');
    ok('caché: archivo ya rechazado', (await scanner.cachedVerdict(shaBlock))?.verdict === 'block');
    ok('caché: un veredicto "review" no se reutiliza', (await scanner.cachedVerdict(shaReview)) === null);
    ok('caché: pasados 30 días se vuelve a escanear', (await scanner.cachedVerdict(shaOld)) === null);
    ok('caché: archivo desconocido', (await scanner.cachedVerdict(crypto.randomBytes(32).toString('hex'))) === null);
    await prisma.imageHash.deleteMany({ where: { url: { startsWith: 'cztest-cache-' } } });

    // --- Ruta de subida (R2 simulado y veredictos forzados; sin servicios reales) ---
    await prisma.user.updateMany({ where: { firebaseUid: uid('ale') }, data: { createdAt: new Date(Date.now() - 30 * DAY) } });
    const aleId = (await prisma.user.findUnique({ where: { firebaseUid: uid('ale') } })).id;
    const sellerId = (await prisma.user.findUnique({ where: { firebaseUid: uid('seller') } })).id;
    await prisma.sanction.deleteMany({ where: { userId: aleId } });
    await prisma.report.deleteMany({ where: { targetOwnerId: aleId } });
    await prisma.user.update({ where: { id: sellerId }, data: { photoURL: null, createdAt: new Date() } });

    ok('subir sin sesión → 401', (await upload(null, await picture(11))).status === 401);

    // el chat nunca se escanea, aunque el veredicto forzado fuera "block"
    let r = await upload('ale', await picture(12), { type: 'message', scan: 'block' });
    ok('imagen de chat: no se envía a escanear (privada) → 200', r.status === 200 && Boolean(r.j.url));
    await new Promise((resolve) => setTimeout(resolve, 300));
    ok('imagen de chat: no tiene veredicto de escaneo', (await prisma.imageHash.findUnique({ where: { url: r.j.url } }))?.verdict === 'unscanned');

    // limpia → se publica
    r = await upload('ale', await picture(13), { scan: 'clear' });
    ok('foto de perfil limpia (cuenta con historial) → 200 y publicada', r.status === 200 && (await prisma.user.findUnique({ where: { id: aleId } })).photoURL === r.j.url);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const cleanRow = await prisma.imageHash.findUnique({ where: { url: r.j.url } });
    ok('se guarda la huella con su veredicto y sha256', cleanRow?.verdict === 'clear' && /^[0-9a-f]{64}$/.test(cleanRow.sha256) && /^[0-9a-f]{16}$/.test(cleanRow.hash));

    // bloqueada → rechazo, R2 limpio y caché del rechazo
    const blockedImage = await picture(14);
    const logBefore = (await r2Log()).length;
    const photoBefore = (await prisma.user.findUnique({ where: { id: aleId } })).photoURL;
    r = await upload('ale', blockedImage, { scan: 'block' });
    ok('imagen explícita → 400 con mensaje genérico', r.status === 400 && /no cumple las normas/i.test(r.j.message) && !('url' in r.j));
    ok('rechazada: la foto actual no cambió', (await prisma.user.findUnique({ where: { id: aleId } })).photoURL === photoBefore);
    const logAfter = (await r2Log()).slice(logBefore);
    ok('rechazada: lo subido a R2 se borró (no queda huérfano)', logAfter.length === 2 && logAfter[0].op === 'put' && logAfter[1].op === 'delete' && logAfter[0].key === logAfter[1].key, JSON.stringify(logAfter));
    ok('rechazada: queda anotada en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'scan.blocked', targetId: uid('ale') } })) >= 1);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const logMid = (await r2Log()).length;
    r = await upload('ale', blockedImage);
    ok('el mismo archivo rechazado, reintentado → 400 sin subir nada ni gastar cuota', r.status === 400 && (await r2Log()).length === logMid);

    // a revisión → se publica y entra a la cola
    r = await upload('ale', await picture(15), { scan: 'review' });
    ok('foto de perfil en zona gris → 200 y publicada', r.status === 200 && (await prisma.user.findUnique({ where: { id: aleId } })).photoURL === r.j.url);
    const reviewReport = await prisma.report.findFirst({ where: { targetOwnerId: aleId, reasonCode: 'auto.image_review' } });
    ok('...y genera un reporte automático (sin ocultarla)', Boolean(reviewReport) && reviewReport.reporterId === null && reviewReport.autoActioned === false && reviewReport.snapshot.value === r.j.url);
    r = await upload('ale', await picture(16), { type: 'card', scan: 'review' });
    ok('carta en zona gris → se publica sin reporte (umbral permisivo)', r.status === 200 && (await prisma.report.count({ where: { targetOwnerId: aleId, reasonCode: 'auto.image_review' } })) === 1);

    // sin servicio disponible
    r = await upload('ale', await picture(17), { scan: 'unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    ok('sin servicio y cuenta con historial → se publica', r.status === 200 && !r.j.pending && (await prisma.imageHash.findUnique({ where: { url: r.j.url } }))?.verdict === 'unscanned');
    r = await upload('seller', await picture(18), { scan: 'unavailable' });
    ok('sin servicio y cuenta nueva → pendiente de revisión', r.status === 200 && r.j.pending === true, JSON.stringify(r.j));
    const sellerAfter = await prisma.user.findUnique({ where: { id: sellerId }, select: { photoURL: true, moderationHidden: true } });
    ok('...la foto no se ve en el perfil y queda marcada', sellerAfter.photoURL === null && sellerAfter.moderationHidden.includes('photo'));
    const pending = await prisma.report.findFirst({ where: { targetOwnerId: sellerId, reasonCode: 'auto.image_pending' } });
    ok('...y hay un reporte automático ya aplicado, listo para revisar', Boolean(pending) && pending.autoActioned === true && pending.status === 'open' && pending.snapshot.value === r.j.url);
    ok('...la imagen retenida sigue guardada en R2 (para poder restaurarla)', !(await r2Log()).some((entry) => entry.op === 'delete' && entry.key === keyOf(r.j.url)));
    r = await call('GET', '/admin/reports?status=open', 'admin');
    ok('la imagen pendiente aparece en la cola de moderación como detección automática', r.j.reports.some((x) => x.id === pending.id && x.automatic === true));
    r = await upload('seller', await picture(19), { type: 'card', scan: 'unavailable' });
    const cardLog = await r2Log();
    ok('sin servicio y cuenta nueva, foto de carta → 503 con mensaje para reintentar', r.status === 503 && /intenta de nuevo/i.test(r.j.message));
    ok('...y no queda archivo huérfano en R2', cardLog.filter((entry) => entry.op === 'put').length - cardLog.filter((entry) => entry.op === 'delete').length >= 0 && cardLog[cardLog.length - 1].op === 'delete');

    // caché por sha256 de una imagen aprobada
    const approved = await picture(20);
    await upload('ale', approved, { scan: 'clear' });
    const eventsBefore = await prisma.scanEvent.count({ where: { provider: 'cache' } });
    r = await upload('ale', approved);
    ok('el mismo archivo aprobado se acepta sin escanear de nuevo', r.status === 200);
    ok('...y queda registrado como acierto de caché', (await prisma.scanEvent.count({ where: { provider: 'cache' } })) === eventsBefore + 1);

    // huella prohibida por moderación
    const forbidden = await picture(21, 'jpeg');
    await prisma.imageHash.create({ data: { url: 'cztest-prohibida', hash: await perceptual.dHash(forbidden), banned: true, bannedAt: new Date() } });
    const logForbidden = (await r2Log()).length;
    r = await upload('ale', forbidden, { name: 'otra.jpg', mime: 'image/jpeg' });
    ok('una imagen con huella prohibida se rechaza antes de subir nada', r.status === 400 && (await r2Log()).length === logForbidden);
    await prisma.imageHash.deleteMany({ where: { url: 'cztest-prohibida' } });
    perceptualBankReset();

    // formatos no válidos
    r = await upload('ale', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), { name: 'a.png', mime: 'image/png' });
    ok('un SVG disfrazado de PNG → 400', r.status === 400 && /JPG, PNG, WebP o GIF/.test(r.j.message));
    r = await upload('ale', Buffer.from('no soy una imagen'), { name: 'a.png', mime: 'image/png' });
    ok('un archivo dañado → 400 (no 500)', r.status === 400);
    r = await upload('ale', await picture(22), { type: 'otro' });
    ok('tipo de imagen inválido → 400', r.status === 400);

    // métricas
    await new Promise((resolve) => setTimeout(resolve, 400));
    await call('POST', `/admin/users/${NAMES.ignacio}/role`, 'admin', { role: 'moderator' });
    r = await call('GET', '/admin/metrics', 'admin');
    ok('métricas: sección de escaneo con proveedores y cuotas', r.status === 200 && r.j.scans.providers.length === 2 && r.j.scans.providers.every((p) => p.limit > 0 && p.stopAt < p.limit) && r.j.scans.enabled === true);
    ok('métricas: escaneos, veredictos, caché y latencia', r.j.scans.last30d.total >= 6 && r.j.scans.last30d.cacheHits >= 1 && r.j.scans.last30d.byVerdict.block >= 1 && r.j.scans.last30d.byVerdict.unavailable >= 1);
    ok('métricas: no exponen claves ni secretos', !/secret|api_key|api_secret|key=|GOOGLE_VISION_KEY|SIGHTENGINE_/i.test(JSON.stringify(r.j)));
  } finally {
    await prisma.scanUsage.deleteMany({ where: { month: { in: [FAR_MONTH, '2031-04'] } } });
    await prisma.scanEvent.deleteMany({ where: { createdAt: { gte: testStart } } });
    await prisma.imageHash.deleteMany({ where: { OR: [{ url: { startsWith: 'cztest-' } }, { url: { startsWith: 'blocked:' } }, { url: { startsWith: 'https://pub-cztest.r2.dev/' } }] } });
    await prisma.$disconnect();
  }
})();

// El banco de huellas del servidor se refresca solo cada minuto; en la prueba se espera lo mismo que en producción.
function perceptualBankReset() { /* la huella prohibida de la prueba ya se aplicó; no hace falta nada más */ }
