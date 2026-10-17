// Revisión de seguridad: borrado de archivos ajenos en R2, datos libres de la carta, huella de conexión en pedidos,
// cartas ocultadas por moderación y campos internos en el perfil público.
const sharp = require('sharp');
const { prisma, NAMES, B, U, call, ok, acceptTerms } = require('./fixtures.cjs');

const picture = (seed) => sharp({ create: { width: 64, height: 48, channels: 3, background: { r: (seed * 53) % 256, g: (seed * 97) % 256, b: (seed * 151) % 256 } } }).png().toBuffer();
const upload = async (who, buffer, type = 'avatar') => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: 'image/png' }), 'foto.png');
  form.append('type', type);
  const r = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who], 'x-test-scan': 'clear' }, body: form });
  return { status: r.status, j: await r.json().catch(() => null) };
};
const r2Log = async () => (await (await fetch(B + '/__test/r2-log')).json()).log;
const keyOf = (url) => new URL(url).pathname.replace(/^\//, '');

(async () => {
  try {
    // 1) R2: una URL del perfil que apunta al archivo de otra persona no se borra al cambiar la foto
    const victimKey = 'Carpetazo.cl/Usuarios/' + U.seller + '/avatar/' + 'a'.repeat(32) + '.webp';
    let r = await call('PUT', '/users/me', 'ignacio', { photoURL: 'https://pub-cztest.r2.dev/' + victimKey });
    ok('el perfil acepta una URL del bucket propio', r.status === 200, String(r.status));
    r = await upload('ignacio', await picture(201));
    ok('subir una foto nueva → 200', r.status === 200, String(r.status));
    const firstOwn = keyOf(r.j.url);
    ok('...y NO se borra el archivo de otra persona', !(await r2Log()).some((entry) => entry.op === 'delete' && entry.key === victimKey));
    r = await upload('ignacio', await picture(202));
    ok('cambiar otra vez la foto → 200', r.status === 200, String(r.status));
    ok('...y SÍ se borra la foto anterior propia', (await r2Log()).some((entry) => entry.op === 'delete' && entry.key === firstOwn));

    // 1b) Portada: se guarda también su copia para celular (_m) y al cambiarla se borran las dos
    r = await upload('ignacio', await picture(203), 'banner');
    ok('subir una portada → 200', r.status === 200, String(r.status));
    const bannerKey = keyOf(r.j.url);
    const phoneKey = bannerKey.replace(/\.webp$/, '_m.webp');
    ok('...y se guarda la copia para celular', (await r2Log()).some((entry) => entry.op === 'put' && entry.key === phoneKey), phoneKey);
    r = await upload('ignacio', await picture(204), 'banner');
    ok('cambiar la portada → 200', r.status === 200, String(r.status));
    const deletedKeys = (await r2Log()).filter((entry) => entry.op === 'delete').map((entry) => entry.key);
    ok('...y se borran la portada anterior y su copia para celular', deletedKeys.includes(bannerKey) && deletedKeys.includes(phoneKey));

    // 2) Datos libres de la carta: no pisan precio, id, nombre ni imagen, y no traen enlaces a otros sitios
    const folder = await call('POST', '/folders', 'seller', { name: 'TEST seguridad', tcg: 'Pokemon', color: 'blue', isPublic: true });
    const fid = folder.j.folder.id;
    r = await call('POST', '/folders/' + fid + '/cards', 'seller', {
      tcgId: 'tst-seg', name: 'Carta segura', price: 5000, stock: 3,
      data: { set: 'Base', imageUrl: 'https://pub-cztest.r2.dev/otra.webp', price: 1, id: 'falso', name: 'Otro nombre', images: { small: 'https://x.test/a.png' }, tcgplayer: { url: 'javascript:alert(1)' } }
    });
    ok('crear carta con datos libres → 200', r.status === 200, String(r.status));
    const cardId = r.j.card.id;
    const stored = r.j.card.data || {};
    ok('...se conserva lo legítimo (edición)', stored.set === 'Base');
    ok('...y se descartan imageUrl, price, id, name e images', ['imageUrl', 'price', 'id', 'name', 'images'].every((key) => !(key in stored)), JSON.stringify(stored));
    ok('...y un enlace que no es de TCGplayer', !('tcgplayer' in stored));
    r = await call('PUT', '/folders/' + fid + '/cards/' + cardId, 'seller', { data: { imageUrl: 'https://pub-cztest.r2.dev/vuelta.webp', tcgplayer: { url: 'https://www.tcgplayer.com/product/1' } } });
    ok('editar la carta no permite reponer la imagen por los datos', r.status === 200 && !('imageUrl' in (r.j.card.data || {})), JSON.stringify(r.j?.card?.data));
    ok('...pero sí acepta un enlace https de TCGplayer', r.j.card.data?.tcgplayer?.url === 'https://www.tcgplayer.com/product/1');
    await prisma.card.update({ where: { id: cardId }, data: { data: { set: 'Base', imageUrl: 'https://pub-cztest.r2.dev/antiguo.webp', price: 1 } } });
    r = await call('GET', '/folders/' + fid, 'jerry');
    const publicCard = r.j.folder.cards.find((card) => card.id === cardId);
    ok('la vista pública limpia también los datos guardados antes del cambio', publicCard && !('imageUrl' in (publicCard.data || {})) && !('price' in (publicCard.data || {})), JSON.stringify(publicCard?.data));

    // 3) Pedidos: la huella de conexión del comprador no sale del servidor
    r = await call('POST', '/orders/create', null, { folderId: fid, items: [{ id: cardId, quantity: 1 }] }, '7.7.7.1');
    ok('pedido sin cuenta → 200', r.status === 200, String(r.status));
    ok('...la respuesta no trae la huella de conexión', !('createdIpHash' in r.j.order) && !('completedIpHash' in r.j.order));
    r = await call('GET', '/orders/mine', 'seller');
    const mine = r.j.orders.find((order) => order.folderId === fid);
    ok('el vendedor ve el pedido sin la huella de conexión', mine && !('createdIpHash' in mine) && !('completedIpHash' in mine));

    // 4) Una carta ocultada por moderación no se puede pedir
    await prisma.card.update({ where: { id: cardId }, data: { moderationState: 'hidden' } });
    r = await call('POST', '/orders/create', null, { folderId: fid, items: [{ id: cardId, quantity: 1 }] }, '7.7.7.2');
    ok('pedir una carta ocultada por moderación → 400', r.status === 400, String(r.status));

    // 5) Perfil público: sin el estado de moderación de las carpetas
    r = await call('GET', '/users/' + NAMES.seller, null);
    ok('perfil público → 200', r.status === 200, String(r.status));
    ok('...sus carpetas no traen el estado de moderación', (r.j.user.folders || []).every((item) => !('moderationState' in item)));

    // 5b) Moderación: las carpetas privadas se pueden revisar sin abrirlas a visitantes
    const sellerIdForFolders = (await prisma.user.findUnique({ where: { firebaseUid: U.seller }, select: { id: true } })).id;
    const privateFolder = await prisma.folder.create({ data: { name: 'TEST privada moderación', tcg: 'Pokemon', color: 'blue', isPublic: false, userId: sellerIdForFolders } });
    ok('visitante no ve la carpeta privada en el perfil', !(r.j.user.folders || []).some((item) => item.id === privateFolder.id));
    await prisma.user.update({ where: { firebaseUid: U.ignacio }, data: { role: 'moderator' } });
    r = await call('GET', '/users/' + NAMES.seller, 'ignacio');
    ok('moderador ve carpetas públicas y privadas en el perfil', r.status === 200 && r.j.user.canViewPrivateFolders === true && r.j.user.folders.some((item) => item.id === privateFolder.id && item.isPublic === false));
    r = await call('GET', '/folders/' + privateFolder.id, 'ignacio');
    ok('moderador puede ingresar a la carpeta privada', r.status === 200 && r.j.folder.id === privateFolder.id && r.j.folder.isOwner === false, String(r.status));
    ok('usuario común no puede ingresar a la carpeta privada', (await call('GET', '/folders/' + privateFolder.id, 'jerry')).status === 404);
    await prisma.user.update({ where: { firebaseUid: U.ignacio }, data: { role: 'user' } });

    // 6) Opciones de filtros: la segunda consulta sale de la memoria con el mismo contenido
    const [a, b] = [await call('GET', '/tcg/99/filter-options', null), await call('GET', '/tcg/99/filter-options', null)];
    ok('opciones de filtros → 200 dos veces y con el mismo contenido', a.status === 200 && b.status === 200 && JSON.stringify(a.j.data) === JSON.stringify(b.j.data));

    // Borrar la cuenta borra también las fotos y notas de voz que la persona envió por el chat
    U.chatdel = 'cztest-chatdel';
    await call('POST', '/users/sync', 'chatdel', { displayName: 'Prueba borrado chat', username: 'cztest_chatdel' });
    await acceptTerms('chatdel', {}, '198.51.100.90');
    const chatPhoto = (await upload('chatdel', await picture(7), 'message')).j?.url;
    const voiceForm = new FormData();
    voiceForm.append('audio', new Blob([Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 7)])], { type: 'audio/webm' }), 'voz.webm');
    const chatVoice = (await (await fetch(B + '/users/upload-audio', { method: 'POST', headers: { Authorization: 'Bearer test-' + U.chatdel }, body: voiceForm })).json()).url;
    const sendChat = (body) => call('POST', '/messages/' + NAMES.seller, 'chatdel', { content: JSON.stringify({ v: 1, text: '', imageUrl: null, imageBase64: null, ...body }) });
    const sentPhoto = await sendChat({ imageUrl: chatPhoto });
    const sentVoice = await sendChat({ text: 'nota', audio: { url: chatVoice, seconds: 2, wave: [10, 20] } });
    ok('preparación: foto y nota de voz enviadas por el chat', sentPhoto.status === 200 && sentVoice.status === 200, `${sentPhoto.status},${sentVoice.status}`);
    const chatDeletedBefore = (await r2Log()).filter((entry) => entry.op === 'delete').length;
    ok('borrar la cuenta → 200', (await call('DELETE', '/users/me', 'chatdel')).status === 200);
    const chatDeletedKeys = (await r2Log()).filter((entry) => entry.op === 'delete').slice(chatDeletedBefore).map((entry) => entry.key);
    ok('al borrar la cuenta se borran la foto y la nota de voz del chat', chatDeletedKeys.includes(keyOf(chatPhoto)) && chatDeletedKeys.includes(keyOf(chatVoice)), JSON.stringify(chatDeletedKeys));

    // El perfil público no se encuentra por el uid de Firebase (es privado), sí por el nombre de usuario
    ok('perfil público por uid de Firebase → 404', (await call('GET', '/users/' + U.seller)).status === 404);
    ok('perfil público por nombre de usuario → 200', (await call('GET', '/users/' + NAMES.seller)).status === 200);

    // Limpieza de archivos sin uso: solo carpetas del chat, voz y cartas, con más de 7 días y que nada en la base menciona
    const { findOrphanFiles } = await import('../core/orphanFiles.js');
    const hex = (c) => c.repeat(32);
    const base = 'Carpetazo.cl/Usuarios/' + U.seller + '/';
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const sellerId = (await prisma.user.findUnique({ where: { firebaseUid: U.seller } })).id;
    const jerryId = (await prisma.user.findUnique({ where: { firebaseUid: U.jerry } })).id;
    const refMessage = await prisma.message.create({ data: { senderId: sellerId, receiverId: jerryId, content: JSON.stringify({ v: 1, text: '', imageUrl: 'https://pub-cztest.r2.dev/' + base + 'message/' + hex('a') + '.webp' }) } });
    const refFolder = (await prisma.folder.findFirst({ where: { userId: sellerId } })).id;
    const refCard = await prisma.card.create({ data: { tcgId: 'tst-orphan', name: 'carta con foto', folderId: refFolder, imageUrl: 'https://pub-cztest.r2.dev/' + base + 'card/' + hex('b') + '.webp' } });
    const orphans = await findOrphanFiles([
      { key: base + 'message/' + hex('a') + '.webp', lastModified: old }, // usada en un mensaje
      { key: base + 'card/' + hex('b') + '.webp', lastModified: old }, // usada en una carta
      { key: base + 'message/' + hex('c') + '.webp', lastModified: old }, // sin uso y vieja → se borra
      { key: base + 'message/' + hex('d') + '.webp', lastModified: new Date() }, // sin uso pero reciente
      { key: base + 'avatar/' + hex('e') + '.webp', lastModified: old }, // foto de perfil: nunca se toca
      { key: base + 'voice/' + hex('f') + '.webm', lastModified: old } // nota de voz sin uso y vieja → se borra
    ]);
    ok('limpieza: solo salen los archivos sin uso, viejos y de chat/voz/cartas', JSON.stringify(orphans.sort()) === JSON.stringify([base + 'message/' + hex('c') + '.webp', base + 'voice/' + hex('f') + '.webm'].sort()), JSON.stringify(orphans));
    await prisma.message.delete({ where: { id: refMessage.id } });
    await prisma.card.delete({ where: { id: refCard.id } });

    // Vistas previas que llegan por el nginx del sitio: con la clave correcta se cuentan por la IP del visitante; sin ella, la cabecera se ignora
    const remaining = async (headers) => Number((await fetch(B + '/legal/versions', { headers })).headers.get('ratelimit-remaining'));
    const viaProxy = (ip, secret = 'cztest-preview-secret') => ({ 'X-Preview-Proxy': secret, 'X-Visitor-Ip': ip });
    const a1 = await remaining(viaProxy('203.0.113.70'));
    const a2 = await remaining(viaProxy('203.0.113.70'));
    const b1 = await remaining(viaProxy('203.0.113.71'));
    ok('vía nginx con clave: cada visitante tiene su propio cupo', a2 === a1 - 1 && b1 > a2, `${a1},${a2},${b1}`);
    const mine1 = await remaining({});
    const forged = await remaining(viaProxy('203.0.113.72', 'clave-falsa'));
    ok('con clave falsa la IP informada se ignora (cuenta como la conexión real)', forged === mine1 - 1, `${mine1},${forged}`);
    const missing = await remaining({ 'X-Visitor-Ip': '203.0.113.73' });
    ok('sin clave la IP informada se ignora', missing === forged - 1, `${forged},${missing}`);

    // Cuenta desactivada en Firebase: su token deja de valer aunque no haya vencido
    const revoked = await fetch(B + '/users/me', { headers: { Authorization: 'Bearer test-cztest-ghost-disabled' } });
    ok('sesión de una cuenta desactivada → 401', revoked.status === 401 && (await revoked.json()).code === 'session_revoked', String(revoked.status));

    // Sin la clave de hashes y firmas el servidor no arranca (una clave por defecto en el código sería pública)
    const { spawnSync } = require('child_process');
    const path = require('path');
    const noSalt = spawnSync(process.execPath, ['--import', './tests/register.mjs', 'server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, IP_HASH_SALT: '', PORT: '0', TEST_AUTH_STUB: '1' }, timeout: 20000, encoding: 'utf8' });
    ok('sin IP_HASH_SALT el servidor no arranca', noSalt.status === 1 && /IP_HASH_SALT/.test(noSalt.stderr || ''), `salida=${noSalt.status}`);
  } finally {
    await prisma.$disconnect();
  }
})();
