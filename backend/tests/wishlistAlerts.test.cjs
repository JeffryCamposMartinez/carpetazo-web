// Avisos de la lista de deseos: cuándo se avisa (aparece, baja de precio), con qué texto, sin repetir, y las preferencias y la baja desde el correo.
const { prisma, B, U, call, ok } = require('./fixtures.cjs');

const TCG_ID = '980000601';
const HOUR = 60 * 60 * 1000;

(async () => {
  try {
    const { runWishlistAlerts, unsubscribeLink } = await import('../core/wishlistAlerts.js');
    const ale = await prisma.user.findUnique({ where: { firebaseUid: U.ale }, select: { id: true } });
    const sellerFolder = (await call('POST', '/folders', 'seller', { name: 'TEST avisos vendedor', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const aleFolder = (await call('POST', '/folders', 'ale', { name: 'TEST avisos propia', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const card = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST carta aviso', price: 3000, stock: 1, folderId: sellerFolder.id } });
    await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST carta aviso', price: 100, stock: 1, folderId: aleFolder.id } }); // la propia no cuenta
    const added = await call('POST', '/wishlist', 'ale', { external: { categoryId: 3, productId: TCG_ID }, name: 'CZTEST carta aviso' });
    const itemId = added.j?.item?.id;
    ok('se agregó la carta a la lista', added.status === 200 && itemId);

    const sent = [];
    const deliver = async (user, message) => { sent.push({ user, message }); return { email: true, push: 0 }; };
    const run = (offset = 0) => runWishlistAlerts({ deliver, now: new Date(Date.now() + offset), userIds: [ale.id] });
    const state = () => prisma.wishlistAlertState.findUnique({ where: { itemId } });

    // Primera pasada: solo punto de partida, nadie recibe nada (la carta ya estaba a la venta al agregarla)
    await run();
    ok('la primera vez no se avisa y queda el precio de partida', sent.length === 0 && (await state())?.lastPrice === 3000, JSON.stringify(await state()));

    // Baja de precio fuerte: se avisa una vez, con el texto y el enlace de baja
    await prisma.card.update({ where: { id: card.id }, data: { price: 1500 } });
    await run();
    ok('baja de precio → un aviso', sent.length === 1 && sent[0].message.subject === 'Bajó el precio de CZTEST carta aviso', sent[0]?.message.subject);
    ok('el aviso dice de cuánto a cuánto y enlaza la carta', /\$3\.000/.test(sent[0].message.text) && /\$1\.500/.test(sent[0].message.text) && sent[0].message.text.includes(`https://carpetazo.cl/carta/${card.id}`));
    ok('trae enlace de baja y cabeceras de baja', /\/api\/notifications\/unsubscribe\?u=/.test(sent[0].message.text) && sent[0].message.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');
    ok('la notificación del navegador lleva la ruta de la carta', sent[0].message.push.url === `/carta/${card.id}`);
    ok('queda anotado el aviso', (await state())?.lastPrice === 1500 && (await state())?.notifiedAt);

    await run();
    ok('sin cambios no se repite', sent.length === 1);

    // Otra baja dentro de las 12 horas de la anterior: no avisa, pero el nuevo precio queda como referencia
    await prisma.card.update({ where: { id: card.id }, data: { price: 500 } });
    await run(1 * HOUR);
    ok('dentro de 12 h no se vuelve a avisar de la misma carta', sent.length === 1 && (await state())?.lastPrice === 500, String(sent.length));

    // Se agota y vuelve: aparece de nuevo → aviso
    await prisma.card.update({ where: { id: card.id }, data: { stock: 0 } });
    await run(13 * HOUR);
    ok('al agotarse se anota que no hay', (await state())?.lastPrice === null);
    await prisma.card.update({ where: { id: card.id }, data: { stock: 1, price: 700 } });
    await run(26 * HOUR);
    ok('al volver a publicarse → aviso de que apareció', sent.length === 2 && sent[1].message.subject === '¡Apareció CZTEST carta aviso!', sent[1]?.message.subject);

    // Un precio máximo por debajo de lo publicado: no hay aviso
    await call('PUT', '/wishlist/' + itemId, 'ale', { maxPrice: 100 });
    await prisma.card.update({ where: { id: card.id }, data: { price: 650 } });
    await run(60 * HOUR);
    ok('con precio máximo menor a lo publicado no se avisa', sent.length === 2);

    // Preferencias
    let r = await call('GET', '/notifications/settings', 'ale');
    ok('preferencias: correo activado por defecto, sin notificaciones configuradas en pruebas', r.status === 200 && r.j.settings.wishlistEmail === true && r.j.settings.pushAvailable === false, JSON.stringify(r.j));
    r = await call('PUT', '/notifications/settings', 'ale', { wishlistEmail: false });
    ok('se puede apagar el correo', r.status === 200 && r.j.settings.wishlistEmail === false);
    r = await call('PUT', '/notifications/settings', 'ale', { wishlistEmail: 'si' });
    ok('dato inválido → 400', r.status === 400, String(r.status));
    r = await call('GET', '/notifications/settings');
    ok('sin sesión → 401', r.status === 401, String(r.status));
    await call('PUT', '/notifications/settings', 'ale', { wishlistEmail: true });

    // Dispositivos: solo servicios de notificaciones de los navegadores y claves bien formadas
    const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
    for (const [label, endpoint] of [['dirección interna', 'https://169.254.169.254/latest'], ['sitio cualquiera', 'https://evil.example.com/push'], ['sin https', 'http://fcm.googleapis.com/fcm/send/x'], ['con puerto', 'https://fcm.googleapis.com:8443/fcm/send/x'], ['no es texto', 12345]]) {
      r = await call('POST', '/notifications/push/subscribe', 'ale', { endpoint, keys });
      ok(`dispositivo rechazado (${label})`, r.status === 400, String(r.status));
    }
    r = await call('POST', '/notifications/push/subscribe', 'ale', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'no valido!', auth: keys.auth } });
    ok('claves mal formadas → 400', r.status === 400, String(r.status));

    // Baja desde el correo
    const link = unsubscribeLink(ale.id).replace('https://api.carpetazo.cl/api', B);
    const emailOn = async () => (await prisma.user.findUnique({ where: { id: ale.id }, select: { notifyWishlistEmail: true } })).notifyWishlistEmail;
    let page = await fetch(link);
    const html = await page.text();
    ok('el enlace muestra un botón y no da de baja solo', page.status === 200 && html.includes('<form method="post"') && (await emailOn()) === true);
    page = await fetch(link.replace(/t=[0-9a-f]+/, 't=' + '0'.repeat(40)), { method: 'POST' });
    ok('enlace con firma falsa → 400 y no da de baja', page.status === 400 && (await emailOn()) === true, String(page.status));
    page = await fetch(link.replace(/u=[0-9a-f-]+/, 'u=00000000-0000-4000-8000-000000000000'), { method: 'POST' });
    ok('enlace de otra cuenta con la firma de esta → 400', page.status === 400, String(page.status));
    page = await fetch(link, { method: 'POST' });
    ok('el botón da de baja', page.status === 200 && (await emailOn()) === false, String(page.status));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.card.deleteMany({ where: { name: 'CZTEST carta aviso' } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST avisos' } } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
})();
