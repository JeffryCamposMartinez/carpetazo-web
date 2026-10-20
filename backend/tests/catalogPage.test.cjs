// Ficha pública de las cartas del catálogo: JSON para la web, página para buscadores, ofertas visibles y sitemaps del catálogo.
const { prisma, B, call, ok } = require('./fixtures.cjs');

const GAME_ID = 98005;
const SET_A = 98000501;
const SET_B = 98000502;
const IDS = { carta: 98000511, otraEdicion: 98000512, sinImagen: 98000513, producto: 98000514 };
const ALL = Object.values(IDS);
const html = async (path) => { const r = await fetch(B + path); return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() }; };

(async () => {
  try {
    await prisma.catalogGame.create({ data: { categoryId: GAME_ID, name: 'CZTEST_Pagina', folder: 'CZTEST_Pagina' } });
    await prisma.catalogSet.createMany({ data: [
      { groupId: SET_A, categoryId: GAME_ID, name: 'CZTEST Edición Alfa', folder: 'Alfa' },
      { groupId: SET_B, categoryId: GAME_ID, name: 'CZTEST Edición Beta', folder: 'Beta' },
    ] });
    const img = (n) => `Carpetazo.cl/CZTEST_Pagina/CZTEST_Pagina_DB/CZTEST_Pagina_Images/Alfa/c${n}/c${n}.webp`;
    const row = (productId, groupId, name, extra = {}) => ({ productId, categoryId: GAME_ID, groupId, kind: 'card', name, cleanName: 'cztest dragon <b>rojo', number: '012/100', rarity: 'Rare', folder: `c${productId}`, ...extra });
    await prisma.catalogCard.createMany({ data: [
      row(IDS.carta, SET_A, 'CZTEST Dragón <b>Rojo</b> & "Co"', { imageKey: img(1), attributes: { CardText: 'Hace daño. <script>alert(1)</script>' } }),
      row(IDS.otraEdicion, SET_B, 'CZTEST Dragón <b>Rojo</b> & "Co"', { imageKey: img(2) }),
      row(IDS.sinImagen, SET_B, 'CZTEST Sin Imagen', { cleanName: 'cztest sin imagen' }),
      row(IDS.producto, SET_A, 'CZTEST Caja', { kind: 'product', imageKey: img(4), cleanName: 'cztest caja' }),
    ] });

    // Ofertas: una pública y visible, una en carpeta privada y una sin stock (esas dos no se muestran)
    const publicFolder = (await call('POST', '/folders', 'seller', { name: 'CZTEST ficha pública', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    const privateFolder = (await call('POST', '/folders', 'seller', { name: 'CZTEST ficha privada', tcg: 'Pokemon', color: 'blue', isPublic: false })).j.folder.id;
    const add = (folder, price) => call('POST', `/folders/${folder}/cards`, 'seller', { tcgId: String(IDS.carta), name: 'Dragón', price, stock: 2, data: { catalogOrder: 0 } });
    ok('se crean las ofertas de prueba', (await add(publicFolder, 4500)).status === 200 && (await add(privateFolder, 1000)).status === 200);
    const publicOffer = await prisma.card.findFirst({ where: { folderId: publicFolder, tcgId: String(IDS.carta) } });

    // --- JSON de la ficha
    let r = await call('GET', `/tcg/card/${IDS.carta}`, null);
    ok('la ficha trae los datos, la imagen y la dirección con el nombre', r.status === 200 && r.j.card.name.startsWith('CZTEST Dragón') && r.j.card.gameLabel === 'CZTEST Pagina' && r.j.card.set === 'CZTEST Edición Alfa' && r.j.card.number === '012/100' && r.j.card.imageUrl.startsWith('https://pub-cztest.r2.dev/Carpetazo.cl/') && r.j.card.path === `/catalogo/${IDS.carta}/cztest-dragon-b-rojo-b-co`, JSON.stringify(r.j.card?.path));
    ok('solo muestra la oferta pública y con stock, con el precio', r.j.offers.length === 1 && r.j.offers[0].id === publicOffer.id && r.j.offers[0].price === 4500 && r.j.low === 4500 && r.j.high === 4500);
    ok('el vendedor sale con su nombre público, sin correo ni datos privados', Boolean(r.j.offers[0].seller.username) && !/@test\.local|firebaseUid|"email"|"rut"|phone/i.test(JSON.stringify(r.j)));
    ok('trae el texto de la carta y las otras versiones', r.j.card.text.startsWith('Hace daño') && r.j.others.length === 1 && r.j.others[0].productId === IDS.otraEdicion && r.j.others[0].set === 'CZTEST Edición Beta');
    ok('una carta sin ofertas se muestra igual, sin precio', (await call('GET', `/tcg/card/${IDS.sinImagen}`, null)).j.offers.length === 0 && (await call('GET', `/tcg/card/${IDS.sinImagen}`, null)).j.low === null);
    ok('ids inválidos → 400', (await call('GET', '/tcg/card/abc', null)).status === 400 && (await call('GET', '/tcg/card/0', null)).status === 400 && (await call('GET', '/tcg/card/12345678901', null)).status === 400);
    ok('carta que no existe → 404', (await call('GET', '/tcg/card/98099999', null)).status === 404);
    ok('un producto sellado no tiene ficha → 404', (await call('GET', `/tcg/card/${IDS.producto}`, null)).status === 404);

    // --- Datos de cartas para filtrar una carpeta pública (Yu-Gi-Oh!, Magic, One Piece, Riftbound)
    r = await call('POST', '/tcg/catalog/cards-data', null, { ids: [IDS.carta, String(IDS.otraEdicion), IDS.producto, 'abc', '0', "1; DROP TABLE", IDS.carta] });
    const data = r.j?.data || {};
    ok('devuelve los datos de las cartas pedidas, sin sesión', r.status === 200 && Object.keys(data).length === 2 && data[IDS.carta]?.extendedData.some((item) => item.name === 'CardText') && data[IDS.carta].group.name === 'CZTEST Edición Alfa', JSON.stringify(Object.keys(data)));
    ok('trae el número de la carta y la edición', data[IDS.carta]?.extendedData.some((item) => item.name === 'Number' && item.value === '012/100') && data[IDS.otraEdicion]?.group.name === 'CZTEST Edición Beta');
    ok('un producto sellado y los ids inválidos se ignoran', !data[IDS.producto] && !('abc' in data));
    ok('sin ids → vacío', (await call('POST', '/tcg/catalog/cards-data', null, { ids: [] })).j.data && Object.keys((await call('POST', '/tcg/catalog/cards-data', null, { ids: [] })).j.data).length === 0);
    ok('más de 500 ids → 400', (await call('POST', '/tcg/catalog/cards-data', null, { ids: Array.from({ length: 501 }, (_, i) => i + 1) })).status === 400);
    ok('un cuerpo sin ids no rompe', (await call('POST', '/tcg/catalog/cards-data', null, {})).status === 200);

    // --- Página para buscadores
    let page = await html(`/seo/catalog/${IDS.carta}`);
    ok('página para buscadores: HTML con título, descripción y dirección canónica', page.status === 200 && /text\/html/.test(page.type) && /<title>CZTEST Dragón &lt;b&gt;Rojo&lt;\/b&gt; &amp; &quot;Co&quot; \(CZTEST Edición Alfa\)/.test(page.body) && page.body.includes(`<link rel="canonical" href="https://carpetazo.cl/catalogo/${IDS.carta}/cztest-dragon-b-rojo-b-co">`) && /desde \$4\.500/.test(page.body), page.body.slice(0, 300));
    const ld = JSON.parse(page.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    ok('datos estructurados de producto con el rango de precios', ld['@type'] === 'Product' && ld.sku === String(IDS.carta) && ld.offers['@type'] === 'AggregateOffer' && ld.offers.lowPrice === 4500 && ld.offers.offerCount === 1);
    ok('el HTML escapa el contenido (nombre y texto de la carta)', !page.body.includes('<b>Rojo</b>') && !page.body.includes('<script>alert(1)</script>') && page.body.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && page.body.includes('Otras versiones'));
    ok('la página lista la oferta y enlaza a la del vendedor', page.body.includes(`/carta/${publicOffer.id}`) && !page.body.includes('ficha privada'));
    page = await html(`/seo/catalog/${IDS.sinImagen}`);
    ok('sin ofertas: dice que nadie la vende y no declara un precio', page.status === 200 && page.body.includes('Nadie la vende por ahora') && !JSON.parse(page.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]).offers);
    ok('id inválido, inexistente o producto → 404', (await html('/seo/catalog/abc')).status === 404 && (await html('/seo/catalog/98099999')).status === 404 && (await html(`/seo/catalog/${IDS.producto}`)).status === 404);

    // --- Sitemaps
    const withImage = { kind: 'card', imageKey: { not: null } };
    const total = await prisma.catalogCard.count({ where: withImage });
    const files = Math.ceil(total / 40000);
    const index = await html('/seo/sitemap-index.xml');
    const mentions = [...index.body.matchAll(/<loc>https:\/\/carpetazo\.cl\/sitemap-catalogo-(\d+)\.xml<\/loc>/g)].map((m) => Number(m[1]));
    ok('el índice lista el sitemap principal y los del catálogo', index.status === 200 && /xml/.test(index.type) && index.body.includes('<sitemapindex') && index.body.includes('https://carpetazo.cl/sitemap-main.xml') && mentions.length === files && mentions.at(-1) === files, `${files} archivos`);
    const position = await prisma.catalogCard.count({ where: { ...withImage, productId: { lt: IDS.carta } } });
    const chunkNo = Math.floor(position / 40000) + 1;
    const chunk = await html(`/seo/sitemap-catalogo/${chunkNo}.xml`);
    ok('el sitemap del catálogo trae la carta con su dirección y fecha', chunk.status === 200 && chunk.body.includes('<urlset') && chunk.body.includes(`<loc>https://carpetazo.cl/catalogo/${IDS.carta}/cztest-dragon-b-rojo-b-co</loc>`) && /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(chunk.body));
    ok('no incluye productos sellados ni cartas sin imagen', !chunk.body.includes(`/catalogo/${IDS.producto}/`) && !chunk.body.includes(`/catalogo/${IDS.sinImagen}/`));
    ok('cada sitemap respeta el máximo de 40.000 direcciones', (chunk.body.match(/<url>/g) || []).length <= 40000);
    ok('un número fuera de rango o inválido → 404', (await html(`/seo/sitemap-catalogo/${files + 1}.xml`)).status === 404 && (await html('/seo/sitemap-catalogo/0.xml')).status === 404 && (await html('/seo/sitemap-catalogo/abc.xml')).status === 404);
  } catch (error) {
    ok('la ficha del catálogo no lanzó errores inesperados', false, error.stack);
  } finally {
    await prisma.card.deleteMany({ where: { tcgId: String(IDS.carta) } });
    await prisma.catalogCard.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogGame.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.$disconnect();
  }
})();
