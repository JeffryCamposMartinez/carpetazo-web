// Auditoría Fase 1 de server.js: validación de entradas, datos que no deben salir y rutas que no deben fallar con 500.
const { prisma, NAMES, call, ok, fixtures } = require('./fixtures.cjs');

const { folderId, cardId } = fixtures();

(async () => {
  try {
    // Perfil: tipos y largos
    ok('perfil: biografía de 601 → 400', (await call('PUT', '/users/me', 'ale', { bio: 'x'.repeat(601) })).status === 400);
    ok('perfil: nombre vacío → 400', (await call('PUT', '/users/me', 'ale', { name: '   ' })).status === 400);
    ok('perfil: nombre que no es texto → 400', (await call('PUT', '/users/me', 'ale', { name: { a: 1 } })).status === 400);
    ok('perfil: teléfono de 31 → 400', (await call('PUT', '/users/me', 'ale', { phone: '9'.repeat(31) })).status === 400);
    ok('perfil: color con caracteres de control → 400', (await call('PUT', '/users/me', 'ale', { bannerDominantColor: 'red\u0000' })).status === 400);
    let r = await call('PUT', '/users/me', 'ale', { name: 'Ale Prueba', bio: 'Colecciono\nPokémon', phone: '+56911112222', rut: '11.111.111-1' });
    ok('perfil: datos válidos (con salto de línea en la bio) → 200', r.status === 200 && r.j.user.bio === 'Colecciono\nPokémon', String(r.status));

    // Alta de usuario
    ok('alta: nombre de 101 → 400', (await call('POST', '/users/sync', 'ghost', { displayName: 'x'.repeat(101) })).status === 400);
    r = await call('POST', '/users/sync', 'jerry', { username: NAMES.ale });
    const jerryNow = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-jerry' }, select: { username: true } });
    ok('alta: usuario ya tomado por otra cuenta → 409 (antes 500) y no se lo quita', r.status === 409 && jerryNow.username === NAMES.jerry, String(r.status));

    // Sesión válida pero sin cuenta en la base: se rechaza sin errores internos
    ok('sin cuenta: borrar carpeta ajena → 403', (await call('DELETE', '/folders/' + folderId, 'ghost')).status === 403);
    ok('sin cuenta: agregar carta → 403', (await call('POST', '/folders/' + folderId + '/cards', 'ghost', { tcgId: 'x', name: 'x', price: 1, stock: 1 })).status === 403);
    ok('sin cuenta: editar carta → 403', (await call('PUT', '/folders/' + folderId + '/cards/' + cardId, 'ghost', { price: 1 })).status === 403);
    ok('sin cuenta: borrar carta → 403', (await call('DELETE', '/cards/' + cardId, 'ghost')).status === 403);

    // Nunca sale el firebaseUid de otra persona
    await call('POST', '/messages/' + NAMES.seller, 'ale', { content: 'hola auditoría' });
    r = await call('POST', '/messages/' + NAMES.ale, 'seller', { content: 'respuesta auditoría' });
    ok('enviar mensaje: la respuesta no trae firebaseUid', r.status === 200 && r.j.otherUser && !('firebaseUid' in r.j.otherUser), JSON.stringify(Object.keys(r.j?.otherUser || {})));
    r = await call('GET', '/chats', 'seller');
    ok('/chats: sin firebaseUid ni correo de los interlocutores', r.status === 200 && !JSON.stringify(r.j).match(/firebaseUid|email/i));

    // Visitas: solo carpetas públicas
    const priv = await call('POST', '/folders', 'seller', { name: 'TEST privada', tcg: 'Pokemon', isPublic: false });
    ok('visita a carpeta privada → 404', (await call('POST', '/folders/' + priv.j.folder.id + '/visit', null, {}, '4.4.4.1')).status === 404);
    ok('visita a carpeta pública → 200', (await call('POST', '/folders/' + folderId + '/visit', null, {}, '4.4.4.2')).status === 200);

    // Catálogo y servicios externos: entradas acotadas
    ok('búsqueda del catálogo: juego no numérico → 400', (await call('GET', '/tcg/search?categoryId=abc')).status === 400);
    ok('búsqueda del catálogo: texto de 81 → 400', (await call('GET', '/tcg/search?q=' + 'a'.repeat(81))).status === 400);
    ok('búsqueda del catálogo: válida → 200', (await call('GET', '/tcg/search?categoryId=99&q=dragon')).status === 200);
    ok('metadatos: más de 500 ids → 400', (await call('POST', '/tcg/products/metadata', null, { ids: Array.from({ length: 501 }, (_, i) => String(i)) })).status === 400);
    ok('pokemontcg.io: consulta de 201 → 400 (sin llamar afuera)', (await call('GET', '/tcg/cards?q=' + 'a'.repeat(201))).status === 400);
    ok('proxy de imágenes: no se llama a sí mismo → 400', (await call('GET', '/proxy-image?url=' + encodeURIComponent('https://api.carpetazo.cl/api/proxy-image?url=x'))).status === 400);

    // Cuenta eliminada: su perfil deja de existir
    const before = await call('GET', '/users/' + NAMES.nobuyer);
    await call('DELETE', '/users/me', 'nobuyer');
    const deleted = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-nobuyer' }, select: { username: true } });
    ok('perfil de cuenta eliminada → 404', before.status === 200 && (await call('GET', '/users/' + deleted.username)).status === 404);
  } finally {
    await prisma.$disconnect();
  }
})();
