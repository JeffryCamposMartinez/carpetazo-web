// Revisión de seguridad: borrado de archivos ajenos en R2, datos libres de la carta, huella de conexión en pedidos,
// cartas ocultadas por moderación y campos internos en el perfil público.
const sharp = require('sharp');
const { prisma, NAMES, B, U, call, ok } = require('./fixtures.cjs');

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

    // 6) Opciones de filtros: la segunda consulta sale de la memoria con el mismo contenido
    const [a, b] = [await call('GET', '/tcg/99/filter-options', null), await call('GET', '/tcg/99/filter-options', null)];
    ok('opciones de filtros → 200 dos veces y con el mismo contenido', a.status === 200 && b.status === 200 && JSON.stringify(a.j.data) === JSON.stringify(b.j.data));
  } finally {
    await prisma.$disconnect();
  }
})();
