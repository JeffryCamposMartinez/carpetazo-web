// Imágenes para compartir una carta o un vendedor: 1200x630, solo contenido público, nombres con símbolos sin romper la imagen.
const sharp = require('sharp');
const { prisma, B, call, ok, fixtures, NAMES } = require('./fixtures.cjs');

const get = async (path) => {
  const response = await fetch(B + path);
  return { status: response.status, type: response.headers.get('content-type') || '', cache: response.headers.get('cache-control') || '', buffer: Buffer.from(await response.arrayBuffer()) };
};
const isJpeg = (r) => r.status === 200 && /image\/jpeg/.test(r.type) && r.buffer[0] === 0xff && r.buffer[1] === 0xd8;

(async () => {
  try {
    const fx = fixtures();
    const pub = (await call('POST', '/folders', 'seller', { name: 'TEST compartir', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const priv = (await call('POST', '/folders', 'seller', { name: 'TEST compartir privada', tcg: 'Pokemon', color: 'blue', isPublic: false })).j.folder;
    const weird = await prisma.card.create({ data: { tcgId: 'tst-share-1', name: 'Carta <b>&</b> "rara" ' + 'muy larga '.repeat(12), price: 12990, stock: 2, folderId: pub.id, data: { set: 'Edición <x> & Cía', rarity: 'Ultra' } } });
    const hidden = await prisma.card.create({ data: { tcgId: 'tst-share-2', name: 'Carta privada', price: 900, stock: 1, folderId: priv.id } });
    const noStock = await prisma.card.create({ data: { tcgId: 'tst-share-3', name: 'Carta agotada', price: 900, stock: 0, folderId: pub.id } });

    let r = await get('/og/card/' + weird.id + '/image.jpg');
    ok('carta → JPEG', isJpeg(r), r.status + ' ' + r.type);
    const meta = await sharp(r.buffer).metadata();
    ok('tamaño 1200x630 (el que piden las redes)', meta.width === 1200 && meta.height === 630, `${meta.width}x${meta.height}`);
    ok('se puede guardar en caché por un rato', /max-age=3600/.test(r.cache));
    ok('nombre con símbolos y muy largo no rompe la imagen', r.buffer.length > 8000, String(r.buffer.length));
    const again = await get('/og/card/' + weird.id + '/image.jpg');
    ok('la segunda vez sale igual (desde memoria)', again.buffer.equals(r.buffer));
    r = await get('/og/card/' + fx.cardId + '/image.jpg');
    ok('carta sin imagen ni edición también se arma', isJpeg(r), r.status + ' ' + r.type);
    for (const [label, id] of [['en carpeta privada', hidden.id], ['sin stock', noStock.id], ['inexistente', '00000000-0000-4000-8000-000000000000'], ['con id inválido', 'no-es-id']]) {
      r = await get('/og/card/' + encodeURIComponent(id) + '/image.jpg');
      ok(`carta ${label} → 404`, r.status === 404, String(r.status));
    }

    r = await get('/og/seller/' + NAMES.seller + '/image.jpg');
    ok('vendedor con carpeta pública → JPEG 1200x630', isJpeg(r) && (await sharp(r.buffer).metadata()).width === 1200, r.status + ' ' + r.type);
    for (const [label, name] of [['inexistente', 'nadie_existe_xyz'], ['con caracteres inválidos', '../x'], ['demasiado corto', 'ab']]) {
      r = await get('/og/seller/' + encodeURIComponent(name) + '/image.jpg');
      ok(`vendedor ${label} → 404`, r.status === 404, String(r.status));
    }
    const noFolders = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-nobuyer' }, select: { username: true } });
    r = await get('/og/seller/' + noFolders.username + '/image.jpg');
    ok('vendedor sin carpetas públicas → 404', r.status === 404, String(r.status));

    // Las páginas para redes apuntan a la imagen con marca y avisan su tamaño
    const page = async (path) => (await fetch(B + path)).text();
    let html = await page('/seo/card/' + weird.id);
    ok('página de carta: og:image con marca, tamaño y tarjeta grande', /property="og:image" content="[^"]*\/api\/og\/card\/[0-9a-f-]{36}\/image\.jpg\?v=12990-1"/.test(html) && html.includes('og:image:width" content="1200"') && html.includes('summary_large_image'));
    ok('página de carta: los datos estructurados siguen con la foto real', !/"image":"[^"]*\/api\/og\//.test(html));
    html = await page('/seo/seller/' + NAMES.seller);
    ok('página de vendedor: og:image con marca', /property="og:image" content="[^"]*\/api\/og\/seller\/cztest_seller\/image\.jpg/.test(html));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST compartir' } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
