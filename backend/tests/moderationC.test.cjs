// Moderación, Fase C: huellas visuales, filtros de texto, reputación de quien reporta, métricas, retención e informe para autoridades.
const crypto = require('crypto');
const sharp = require('sharp');
const { pathToFileURL } = require('url');
const path = require('path');
const { prisma, NAMES, call, ok, fixtures } = require('./fixtures.cjs');

const uid = (who) => 'cztest-' + who;
const idOf = async (who) => (await prisma.user.findUnique({ where: { firebaseUid: uid(who) }, select: { id: true } })).id;
const DAY = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (fn, tries = 20) => { for (let i = 0; i < tries; i += 1) { const value = await fn(); if (value) return value; await sleep(250); } return null; };
const code = () => 'RP-T' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);

// Imagen de prueba: ruido determinista (semilla) para que dos imágenes distintas se vean distintas
const unusedNoise = (seed, size = 96) => {
  const buffer = Buffer.alloc(size * size * 3);
  let state = seed;
  for (let i = 0; i < buffer.length; i += 1) { state = (state * 1664525 + 1013904223) >>> 0; buffer[i] = state >>> 24; }
  return sharp(buffer, { raw: { width: size, height: size, channels: 3 } });
};
// Imagen de prueba: formas sobre un fondo, como una foto sencilla (el ruido puro no es estable al recomprimir)
const picture = (seed) => {
  const shapes = Array.from({ length: 6 }, (_, k) => {
    const gray = (seed * 37 + k * 53) % 256;
    const x = (seed * (k + 3) * 11) % 200 + 20;
    const y = (seed * (k + 5) * 7) % 200 + 20;
    const size = 30 + ((seed + k * 13) % 60);
    return k % 2
      ? '<circle cx="' + x + '" cy="' + y + '" r="' + size + '" fill="rgb(' + gray + ',' + ((gray + 90) % 256) + ',' + ((gray + 170) % 256) + ')"/>'
      : '<rect x="' + x + '" y="' + y + '" width="' + size * 2 + '" height="' + size + '" fill="rgb(' + ((gray + 40) % 256) + ',' + gray + ',' + ((gray + 120) % 256) + ')"/>';
  }).join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="rgb(' + ((seed * 29) % 256) + ',' + ((seed * 71) % 256) + ',' + ((seed * 113) % 256) + ')"/>' + shapes + '</svg>';
  return sharp(Buffer.from(svg));
};

(async () => {
  try {
    const textSignals = await import(pathToFileURL(path.join(__dirname, '..', 'textSignals.js')).href);
    const perceptual = await import(pathToFileURL(path.join(__dirname, '..', 'perceptual.js')).href);
    const { folderId } = fixtures();
    const sellerId = await idOf('seller');
    await prisma.user.updateMany({ where: { firebaseUid: { in: ['jerry', 'ale', 'jeffry', 'buy1', 'buy2'].map(uid) } }, data: { createdAt: new Date(Date.now() - 3 * DAY) } });

    // --- Filtros de texto (reglas simples) ---
    const { analyzeText } = textSignals;
    ok('texto: un RUT en una reseña se marca', analyzeText('Mi RUT es 12.345.678-5, llámenme', 'review').includes('personal_data'));
    ok('texto: un teléfono en una reseña se marca', analyzeText('Escríbele al +56 9 8765 4321', 'review').includes('personal_data'));
    ok('texto: una cuenta bancaria en una reseña se marca', analyzeText('Cuenta corriente número 123456789012', 'review').includes('personal_data'));
    ok('texto: un teléfono en un mensaje NO se marca (es normal al coordinar)', analyzeText('Mi WhatsApp es +56 9 8765 4321', 'message').length === 0);
    ok('texto: pagar por adelantado se marca en mensajes', analyzeText('Transfiere primero el adelanto y te lo envío mañana', 'message').includes('external_payment'));
    ok('texto: cobrar fuera de la plataforma se marca', analyzeText('Mejor evitemos Carpetazo y pagamos directo', 'message').includes('external_payment'));
    ok('texto: pedir un código de verificación se marca', analyzeText('Mándame el código de verificación que te llegó', 'message').includes('external_payment'));
    ok('texto: un enlace acortado se marca', analyzeText('Mira esto https://bit.ly/3abcXYZ', 'message').includes('suspicious_link'));
    ok('texto: un enlace normal no se marca', analyzeText('Mi perfil está en https://carpetazo.cl/yo', 'message').length === 0);
    ok('texto: texto repetitivo en reseñas se marca', analyzeText('ahhhhhhhhhhhhhhhhhhh malo', 'review').includes('repeated_text'));
    ok('texto: una frase normal no se marca en ningún contexto', ['review', 'bio', 'message'].every((context) => analyzeText('Excelente vendedor, la carta llegó perfecta y bien protegida', context).length === 0));
    ok('texto: contexto desconocido no marca nada', analyzeText('Transfiere primero el adelanto', 'otro').length === 0);

    // --- Huella visual ---
    const original = await picture(7).jpeg({ quality: 92 }).toBuffer();
    const recompressed = await sharp(original).resize(100).jpeg({ quality: 55 }).toBuffer();
    const other = await picture(91).jpeg({ quality: 92 }).toBuffer();
    const hashOriginal = await perceptual.dHash(original);
    const hashRecompressed = await perceptual.dHash(recompressed);
    const hashOther = await perceptual.dHash(other);
    ok('huella: 16 caracteres hexadecimales', /^[0-9a-f]{16}$/.test(hashOriginal));
    ok('huella: la misma imagen reducida y recomprimida casi no cambia', perceptual.hamming(hashOriginal, hashRecompressed) <= perceptual.HASH_MAX_DISTANCE, String(perceptual.hamming(hashOriginal, hashRecompressed)));
    ok('huella: una imagen distinta queda lejos', perceptual.hamming(hashOriginal, hashOther) > perceptual.HASH_MAX_DISTANCE, String(perceptual.hamming(hashOriginal, hashOther)));
    ok('huella: distancia de una huella consigo misma es 0', perceptual.hamming(hashOriginal, hashOriginal) === 0);

    const bank = perceptual.createHashBank({ prisma });
    const url = 'https://pub-cztest.r2.dev/cztest-huella.png';
    await bank.remember({ url, hash: hashOriginal });
    ok('banco de huellas: antes de prohibir no bloquea nada', (await bank.closestBanned(hashRecompressed)) === null);
    ok('banco de huellas: prohibir por URL', (await bank.banByUrl(url)) === 1);
    ok('banco de huellas: prohibir dos veces no repite', (await bank.banByUrl(url)) === 0);
    ok('banco de huellas: una copia recomprimida ahora se detecta', (await bank.closestBanned(hashRecompressed)) !== null);
    ok('banco de huellas: una imagen distinta sigue permitida', (await bank.closestBanned(hashOther)) === null);
    ok('banco de huellas: un valor inválido no rompe nada', (await bank.closestBanned('xyz')) === null);
    await prisma.imageHash.deleteMany({ where: { url } });
    bank.invalidate();

    // --- Roles para las pruebas ---
    await call('POST', `/admin/users/${NAMES.ignacio}/role`, 'admin', { role: 'moderator' });

    // --- Huella: una decisión de ocultar prohíbe la imagen ---
    const photo = 'https://pub-cztest.r2.dev/cztest-foto-c.png';
    await prisma.user.update({ where: { id: sellerId }, data: { photoURL: photo } });
    await prisma.imageHash.create({ data: { url: photo, hash: hashOriginal } });
    let r = await call('POST', '/reports', 'jerry', { targetType: 'profile_image', targetId: sellerId, reasonCode: 'profile_image.violence_gore' });
    ok('reportar la foto de perfil → 201', r.status === 201);
    const photoReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
    ok('el reporte guarda el peso de quien reportó (entre 0,5 y 1,5)', photoReport.weight >= 0.5 && photoReport.weight <= 1.5, String(photoReport.weight));
    r = await call('POST', `/admin/reports/${photoReport.id}/decision`, 'ignacio', { action: 'hide', note: 'Violencia gráfica confirmada' });
    ok('ocultar la foto → 200', r.status === 200);
    const banned = await waitFor(async () => (await prisma.imageHash.findUnique({ where: { url: photo } }))?.banned);
    ok('al ocultar una imagen su huella queda prohibida', banned === true);
    ok('la prohibición queda en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'phash.banned', reportId: photoReport.id } })) === 1);
    await prisma.imageHash.deleteMany({ where: { url: photo } });

    // --- Reputación de quien reporta ---
    const buy1Id = await idOf('buy1');
    await prisma.report.createMany({ data: Array.from({ length: 6 }, (_, index) => ({ shortCode: 'RP-ZR' + index + crypto.randomBytes(2).toString('hex').toUpperCase(), targetType: 'folder', targetId: crypto.randomUUID(), reasonCode: 'folder.spam', severity: 'S4', reporterId: buy1Id, status: 'dismissed', decision: 'dismiss', decidedAt: new Date(), snapshot: {} })) });
    await prisma.user.update({ where: { id: sellerId }, data: { photoURL: 'https://pub-cztest.r2.dev/cztest-foto-d.png' } });
    r = await call('POST', '/reports', 'buy1', { targetType: 'profile_image', targetId: sellerId, reasonCode: 'profile_image.sexual_explicit' });
    ok('reporte de baja reputación: se acepta (201) pero NO se oculta solo', r.status === 201 && r.j.hidden === false, JSON.stringify(r.j));
    const lowReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
    ok('reporte de baja reputación: pesa 0,25', lowReport.weight === 0.25);
    ok('reporte de baja reputación: la foto sigue en el perfil', (await prisma.user.findUnique({ where: { id: sellerId } })).photoURL === 'https://pub-cztest.r2.dev/cztest-foto-d.png');
    r = await call('POST', '/reports', 'jeffry', { targetType: 'profile_image', targetId: sellerId, reasonCode: 'profile_image.sexual_explicit' });
    ok('reporte de buena reputación sobre lo mismo: se oculta al instante', r.status === 201 && r.j.hidden === true, JSON.stringify(r.j));
    r = await call('GET', '/admin/reports?status=open', 'ignacio');
    ok('la cola muestra el peso de cada reporte', r.status === 200 && r.j.reports.some((x) => x.weight === 0.25) && r.j.reports.every((x) => typeof x.weight === 'number'));

    // --- Detección automática en textos ---
    r = await call('POST', '/messages/' + NAMES.seller, 'jerry', { content: JSON.stringify({ v: 1, text: 'Transfiere primero el adelanto y te envío la carta' }) });
    const messageId = r.j?.message?.id;
    ok('mensaje con cobro por adelantado se envía igual (no se bloquea)', r.status === 200 && Boolean(messageId));
    const autoMessage = await waitFor(() => prisma.report.findFirst({ where: { targetType: 'message', targetId: messageId, reasonCode: 'auto.external_payment' } }));
    ok('...pero genera un reporte automático', Boolean(autoMessage) && autoMessage.reporterId === null && autoMessage.severity === 'S2');
    r = await call('POST', '/messages/' + NAMES.seller, 'jerry', { content: JSON.stringify({ v: 1, text: 'Hola, ¿sigue disponible la carta?' }) });
    await sleep(600);
    ok('un mensaje normal no genera reportes', (await prisma.report.count({ where: { targetType: 'message', targetId: r.j.message.id } })) === 0);
    r = await call('PUT', '/users/me', 'seller', { bio: 'Compra más barato en https://bit.ly/3abcXYZ' });
    ok('biografía con enlace acortado se guarda igual', r.status === 200);
    const autoBio = await waitFor(() => prisma.report.findFirst({ where: { targetType: 'profile_text', targetId: sellerId, reasonCode: 'auto.suspicious_link' } }));
    ok('...y genera un reporte automático', Boolean(autoBio) && autoBio.reporterId === null);
    await call('PUT', '/users/me', 'seller', { bio: 'Compra más barato en https://bit.ly/3abcXYZ otra vez' });
    await sleep(600);
    ok('el mismo texto no abre un segundo reporte', (await prisma.report.count({ where: { targetType: 'profile_text', targetId: sellerId, reasonCode: 'auto.suspicious_link' } })) === 1);
    r = await call('GET', '/admin/reports/' + autoMessage.id, 'ignacio');
    ok('el detalle de un reporte automático no tiene reportante y la etiqueta lo dice', r.status === 200 && r.j.report.automatic === true && r.j.report.reporter === null && /automática/i.test(r.j.report.reasonLabel));
    r = await call('POST', `/admin/reports/${autoMessage.id}/decision`, 'ignacio', { action: 'dismiss' });
    ok('el moderador puede descartar un reporte automático', r.status === 200);

    // --- Métricas ---
    ok('métricas sin sesión → 401', (await call('GET', '/admin/metrics')).status === 401);
    ok('métricas para moderador → 403', (await call('GET', '/admin/metrics', 'ignacio')).status === 403);
    r = await call('GET', '/admin/metrics', 'admin');
    ok('métricas para administrador', r.status === 200 && r.j.last30Days.total >= 3 && r.j.last30Days.perDay.length === 30 && r.j.queue.slaHours.S1 === 24 && typeof r.j.queue.open === 'number', JSON.stringify(r.j).slice(0, 160));
    ok('métricas: reportes automáticos y de peso bajo contados', r.j.last30Days.automatic >= 2 && r.j.last30Days.lowWeightReports >= 1);
    ok('métricas: tasa de descartados y tiempos', (r.j.last30Days.dismissedRate === null || typeof r.j.last30Days.dismissedRate === 'number') && 'average' in r.j.last30Days.hoursToDecision);
    ok('métricas: no traen correos ni identificadores de personas', !/@[a-z0-9.-]+\.[a-z]{2,}|firebase|cztest-/i.test(JSON.stringify(r.j)));

    // --- Contadores del menú ---
    ok('contadores sin sesión → 401', (await call('GET', '/admin/summary')).status === 401);
    ok('contadores para un usuario común → 403', (await call('GET', '/admin/summary', 'jerry')).status === 403);
    r = await call('GET', '/admin/summary', 'ignacio');
    ok('contadores para un moderador: números de pendientes', r.status === 200 && ['reports', 'criticalReports', 'cases', 'appeals', 'pendingBans'].every((key) => typeof r.j[key] === 'number'), JSON.stringify(r.j));
    ok('contadores: no traen datos de personas', !/@|username|cztest/i.test(JSON.stringify(r.j)));

    // --- Retención ---
    const oldDismissed = await prisma.report.create({ data: { shortCode: code() + 'A', targetType: 'folder', targetId: crypto.randomUUID(), reasonCode: 'folder.spam', severity: 'S4', reporterId: buy1Id, status: 'dismissed', decision: 'dismiss', decidedAt: new Date(Date.now() - 200 * DAY), snapshot: {} } });
    const midDismissed = await prisma.report.create({ data: { shortCode: code() + 'B', targetType: 'folder', targetId: crypto.randomUUID(), reasonCode: 'folder.spam', severity: 'S4', reporterId: buy1Id, status: 'dismissed', decision: 'dismiss', decidedAt: new Date(Date.now() - 100 * DAY), snapshot: {} } });
    const freshDismissed = await prisma.report.create({ data: { shortCode: code() + 'C', targetType: 'folder', targetId: crypto.randomUUID(), reasonCode: 'folder.spam', severity: 'S4', reporterId: buy1Id, status: 'dismissed', decision: 'dismiss', decidedAt: new Date(Date.now() - 5 * DAY), snapshot: {} } });
    const protectedReport = await prisma.report.create({ data: { shortCode: code() + 'D', targetType: 'folder', targetId: crypto.randomUUID(), reasonCode: 'folder.spam', severity: 'S4', reporterId: buy1Id, status: 'actioned', decision: 'hide', decidedAt: new Date(Date.now() - 900 * DAY), targetOwnerId: sellerId, snapshot: {} } });
    await prisma.appeal.create({ data: { userId: sellerId, reportId: protectedReport.id, text: 'Apelación abierta que protege el reporte antiguo' } });
    const evData = Buffer.from('x');
    for (const reportId of [midDismissed.id, freshDismissed.id]) await prisma.evidence.create({ data: { reportId, mime: 'image/jpeg', size: 1, sha256: 'a'.repeat(64), data: evData } });
    await prisma.moderationAudit.create({ data: { actorId: null, action: 'note', note: 'auditoría vieja de prueba', createdAt: new Date(Date.now() - 1500 * DAY) } });
    await prisma.imageHash.create({ data: { url: 'https://pub-cztest.r2.dev/vieja.png', hash: 'f'.repeat(16), createdAt: new Date(Date.now() - 300 * DAY) } });

    ok('retención sin sesión → 401', (await call('POST', '/admin/retention/run')).status === 401);
    ok('retención para moderador → 403', (await call('POST', '/admin/retention/run', 'ignacio')).status === 403);
    r = await call('GET', '/admin/retention', 'admin');
    ok('política de retención visible para administradores', r.status === 200 && r.j.policy.reportDismissedDays === 180);
    r = await call('POST', '/admin/retention/run', 'admin');
    ok('ejecutar la retención → 200 con conteos', r.status === 200 && r.j.counts.reportsDismissed >= 1 && r.j.counts.evidenceDismissed >= 1 && r.j.counts.audit >= 1 && r.j.counts.imageHashes >= 1, JSON.stringify(r.j));
    ok('retención: el reporte descartado hace 200 días se borró', (await prisma.report.findUnique({ where: { id: oldDismissed.id } })) === null);
    ok('retención: el descartado hace 100 días se conserva, pero sin evidencias', (await prisma.report.findUnique({ where: { id: midDismissed.id } })) !== null && (await prisma.evidence.count({ where: { reportId: midDismissed.id } })) === 0);
    ok('retención: lo reciente se conserva con su evidencia', (await prisma.report.findUnique({ where: { id: freshDismissed.id } })) !== null && (await prisma.evidence.count({ where: { reportId: freshDismissed.id } })) === 1);
    ok('retención: un reporte con apelación abierta nunca se borra', (await prisma.report.findUnique({ where: { id: protectedReport.id } })) !== null);
    ok('retención: la auditoría vieja y las huellas viejas se borraron', (await prisma.moderationAudit.count({ where: { note: 'auditoría vieja de prueba' } })) === 0 && (await prisma.imageHash.count({ where: { url: 'https://pub-cztest.r2.dev/vieja.png' } })) === 0);
    ok('cada ejecución queda registrada', (await prisma.moderationAudit.count({ where: { action: 'retention.run' } })) >= 1);
    await prisma.appeal.deleteMany({ where: { reportId: protectedReport.id } });

    // --- Informe para autoridades ---
    const fraudCase = await prisma.fraudCase.create({ data: { shortCode: 'CS-TEST1', subjectUserId: sellerId, status: 'in_review', priority: 'high', sellerResponse: 'Envié todo, tengo comprobantes' } });
    const caseReport = await prisma.report.create({ data: { shortCode: code() + 'E', targetType: 'order', targetId: crypto.randomUUID(), targetOwnerId: sellerId, reasonCode: 'order.not_delivered', severity: 'S1', comment: 'No me llegó el pedido', reporterId: buy1Id, reporterRole: 'buyer', caseId: fraudCase.id, snapshot: { code: 'TEST123', total: 35000, status: 'completed', createdAt: new Date(), updatedAt: new Date() } } });
    await prisma.evidence.create({ data: { reportId: caseReport.id, mime: 'image/jpeg', size: 10, sha256: 'b'.repeat(64), data: evData } });
    ok('exportar sin sesión → 401', (await call('POST', `/admin/cases/${fraudCase.id}/export`, null, { purpose: 'Requerimiento de la autoridad' })).status === 401);
    ok('exportar siendo moderador → 403', (await call('POST', `/admin/cases/${fraudCase.id}/export`, 'ignacio', { purpose: 'Requerimiento de la autoridad' })).status === 403);
    ok('exportar sin motivo → 400', (await call('POST', `/admin/cases/${fraudCase.id}/export`, 'admin', {})).status === 400);
    ok('exportar con motivo muy corto → 400', (await call('POST', `/admin/cases/${fraudCase.id}/export`, 'admin', { purpose: 'corto' })).status === 400);
    ok('exportar un caso inexistente → 404', (await call('POST', `/admin/cases/${crypto.randomUUID()}/export`, 'admin', { purpose: 'Requerimiento de la autoridad' })).status === 404);
    r = await call('POST', `/admin/cases/${fraudCase.id}/export`, 'admin', { purpose: 'Requerimiento de la Fiscalía por estafa', reference: 'RUC 2600123456-7' });
    ok('el administrador exporta el informe → 200 con HTML y datos', r.status === 200 && r.j.filename === 'informe-CS-TEST1.html' && r.j.html.includes('CS-TEST1') && r.j.html.includes('Requerimiento de la Fiscalía') && r.j.data.reports.length === 1);
    ok('el informe incluye la huella (sha256) de las evidencias, no las imágenes', r.j.html.includes('b'.repeat(64)) && !/data:image|<img/i.test(r.j.html));
    ok('el informe no trae correos, RUT, teléfonos ni datos bancarios', !/@[a-z0-9.-]+\.[a-z]{2,}|rut|bank|phone|firebase/i.test(JSON.stringify(r.j.data)));
    ok('el informe escapa el HTML de los comentarios', !(await call('POST', `/admin/cases/${fraudCase.id}/export`, 'admin', { purpose: 'Prueba <script>alert(1)</script> de escape' })).j.html.includes('<script>alert'));
    ok('cada exportación queda en la auditoría con su motivo', (await prisma.moderationAudit.count({ where: { action: 'case.exported', targetId: fraudCase.id, note: { contains: 'Fiscalía' } } })) === 1);
    await prisma.fraudCase.delete({ where: { id: fraudCase.id } });
  } finally {
    await prisma.$disconnect();
  }
})();
