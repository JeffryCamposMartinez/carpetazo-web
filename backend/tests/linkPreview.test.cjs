// Vista previa al compartir el enlace de una carpeta: etiquetas Open Graph y miniatura, solo para carpetas públicas y visibles.
const sharp = require('sharp');
const { prisma, B, call, ok } = require('./fixtures.cjs');

const get = async (path) => {
  const response = await fetch(B + path);
  return { status: response.status, type: response.headers.get('content-type') || '', cache: response.headers.get('cache-control') || '', body: Buffer.from(await response.arrayBuffer()) };
};
const meta = (html, property) => (html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`)) || [])[1];

(async () => {
  try {
    const pub = (await call('POST', '/folders', 'seller', { name: 'TEST preview <b>& "x"', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const priv = (await call('POST', '/folders', 'seller', { name: 'TEST preview privada', tcg: 'Pokemon', color: 'blue', isPublic: false })).j.folder;
    const hidden = (await call('POST', '/folders', 'seller', { name: 'TEST preview oculta', tcg: 'Magic', color: 'blue', isPublic: true })).j.folder;
    await call('POST', '/folders/' + pub.id + '/cards', 'seller', { tcgId: 'tst-prev-1', name: 'Carta uno', price: 1000, stock: 1 });
    await call('POST', '/folders/' + pub.id + '/cards', 'seller', { tcgId: 'tst-prev-2', name: 'Carta dos', price: 1000, stock: 1 });
    // Cartas antiguas con imágenes de dominios no permitidos o internos: la miniatura no las descarga
    await prisma.card.createMany({ data: [
      { tcgId: 'tst-prev-3', name: 'Carta tres', price: 1000, stock: 1, folderId: pub.id, imageUrl: 'https://evil.example.com/a.png' },
      { tcgId: 'tst-prev-4', name: 'Carta cuatro', price: 1000, stock: 1, folderId: pub.id, imageUrl: 'http://169.254.169.254/latest/meta-data' }
    ] });
    await prisma.folder.update({ where: { id: hidden.id }, data: { moderationState: 'hidden' } });

    // Carpeta pública: título, descripción, enlace y miniatura
    let r = await get('/og/folder/' + pub.id);
    const html = r.body.toString('utf8');
    ok('carpeta pública → página HTML', r.status === 200 && /text\/html/.test(r.type));
    ok('título con el nombre de la carpeta (con los caracteres especiales escapados)', meta(html, 'og:title') === 'TEST preview &lt;b&gt;&amp; &quot;x&quot;', meta(html, 'og:title'));
    ok('el HTML no trae etiquetas inyectadas por el nombre', !html.includes('<b>& "x"'));
    ok('descripción con cantidad, juego y dueño', /^4 cartas de Pokémon - /.test((meta(html, 'og:description') || '').replace(/&amp;/g, '&')), meta(html, 'og:description'));
    ok('enlace oficial a la carpeta', meta(html, 'og:url') === 'https://carpetazo.cl/c/' + pub.id, meta(html, 'og:url'));
    ok('miniatura 1200x630 declarada', meta(html, 'og:image:width') === '1200' && meta(html, 'og:image:height') === '630' && /\/api\/og\/folder\/[0-9a-f-]{36}\/image\.jpg\?v=[0-9a-f]{16}$/.test(meta(html, 'og:image') || ''), meta(html, 'og:image'));
    ok('tarjeta grande para Twitter y similares', html.includes('name="twitter:card" content="summary_large_image"'));
    ok('sin datos privados del dueño (correo, RUT, teléfono)', !/@[a-z0-9-]+\.[a-z]{2,}|rut|phone|firebaseUid/i.test(html.replace(/https?:\/\/[^"]*/g, '').replace(/carpetazo\.cl/gi, '')));

    // Miniatura: JPEG de 1200x630 y liviana, aunque las cartas no tengan imágenes permitidas (solo se ve el logo)
    const imagePath = (meta(html, 'og:image') || '').replace(/^https?:\/\/[^/]+\/api/, '');
    r = await get(imagePath);
    const info = r.status === 200 ? await sharp(r.body).metadata() : {};
    ok('la miniatura es un JPEG de 1200x630', r.status === 200 && /image\/jpeg/.test(r.type) && info.width === 1200 && info.height === 630, `${r.status} ${r.type} ${info.width}x${info.height}`);
    ok('la miniatura pesa menos de 300 KB', r.body.length < 300 * 1024, String(r.body.length));
    ok('la miniatura se puede guardar en caché', /max-age=\d+/.test(r.cache), r.cache);
    ok('las imágenes de dominios no permitidos o internos no se descargan (la miniatura sale igual)', r.status === 200);

    // Carpeta privada, oculta por moderación, inexistente o con id inválido: página genérica sin datos de la carpeta
    for (const [label, id] of [['privada', priv.id], ['oculta por moderación', hidden.id], ['inexistente', '00000000-0000-4000-8000-000000000000'], ['id inválido', '../etc/passwd']]) {
      r = await get('/og/folder/' + encodeURIComponent(id));
      const generic = r.body.toString('utf8');
      ok(`carpeta ${label} → página genérica del sitio`, r.status === 200 && meta(generic, 'og:title') === 'Carpetazo - El mercado de Cartas TCG en Chile' && !generic.includes('TEST preview'), String(r.status));
      r = await get('/og/folder/' + encodeURIComponent(id) + '/image.jpg');
      ok(`miniatura de carpeta ${label} → 404`, r.status === 404, String(r.status));
    }
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.message);
  } finally {
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST preview' } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
