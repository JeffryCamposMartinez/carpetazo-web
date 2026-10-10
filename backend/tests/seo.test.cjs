// SEO: páginas para buscadores de cartas y vendedores, y sitemap; solo contenido público y visible.
const { prisma, B, call, ok } = require('./fixtures.cjs');

const get = async (path) => {
  const response = await fetch(B + path);
  return { status: response.status, type: response.headers.get('content-type') || '', body: await response.text() };
};

(async () => {
  try {
    const pub = (await call('POST', '/folders', 'seller', { name: 'TEST seo publica', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    const priv = (await call('POST', '/folders', 'seller', { name: 'TEST seo privada', tcg: 'Pokemon', color: 'blue', isPublic: false })).j.folder;
    const cheap = await prisma.card.create({ data: { tcgId: 'tst-seo-1', name: 'Carta <b>SEO</b>', price: 1500, stock: 2, folderId: pub.id, data: { set: 'Edición "Prueba"', rarity: 'Rara' } } });
    const dear = await prisma.card.create({ data: { tcgId: 'tst-seo-1', name: 'Carta <b>SEO</b>', price: 4000, stock: 1, folderId: pub.id } });
    const hiddenCard = await prisma.card.create({ data: { tcgId: 'tst-seo-2', name: 'Carta privada', price: 900, stock: 1, folderId: priv.id } });
    const noStock = await prisma.card.create({ data: { tcgId: 'tst-seo-3', name: 'Carta agotada', price: 900, stock: 0, folderId: pub.id } });

    // Carta: contenido, precio desde, canónica a la oferta más barata y datos estructurados
    let r = await get('/seo/card/' + dear.id);
    ok('carta pública → HTML', r.status === 200 && /text\/html/.test(r.type), String(r.status));
    ok('título con nombre escapado y precio desde', r.body.includes('<title>Carta &lt;b&gt;SEO&lt;/b&gt;') && r.body.includes('desde $1.500'), r.body.slice(0, 300));
    ok('canónica apunta a la oferta más barata', r.body.includes(`rel="canonical" href="https://carpetazo.cl/carta/${cheap.id}"`));
    ok('el nombre no inyecta etiquetas', !r.body.includes('<b>SEO</b>'));
    ok('datos estructurados de producto con precio en CLP', r.body.includes('"@type":"Product"') && r.body.includes('"priceCurrency":"CLP"') && r.body.includes('"lowPrice":1500') && r.body.includes('"highPrice":4000'));
    ok('lista las ofertas', (r.body.match(/<li>\$/g) || []).length === 2, String((r.body.match(/<li>\$/g) || []).length));
    ok('sin datos privados (correo, teléfono, uid)', !/firebaseUid|"phone"|@[a-z0-9-]+\.[a-z]{2,}\b/i.test(r.body.replace(/https?:\/\/[^"<\s]*/g, '')));
    for (const [label, id] of [['en carpeta privada', hiddenCard.id], ['sin stock', noStock.id], ['inexistente', '00000000-0000-4000-8000-000000000000'], ['id inválido', '../etc']]) {
      r = await get('/seo/card/' + encodeURIComponent(id));
      ok(`carta ${label} → 404`, r.status === 404, String(r.status));
    }

    // Vendedor
    const seller = await prisma.user.findFirst({ where: { folders: { some: { id: pub.id } } }, select: { username: true } });
    r = await get('/seo/seller/' + encodeURIComponent(seller.username));
    ok('vendedor con carpeta pública → HTML con su carpeta', r.status === 200 && r.body.includes('TEST seo publica') && !r.body.includes('TEST seo privada'), String(r.status));
    ok('vendedor: canónica y datos estructurados', r.body.includes(`href="https://carpetazo.cl/${seller.username}"`) && r.body.includes('"@type":"ProfilePage"'));
    ok('vendedor: sin teléfono ni correo', !/phone|firebaseUid|"email"/i.test(r.body));
    for (const [label, name] of [['inexistente', 'nadie_existe_xyz'], ['con caracteres inválidos', '../x'], ['demasiado corto', 'ab']]) {
      r = await get('/seo/seller/' + encodeURIComponent(name));
      ok(`vendedor ${label} → 404`, r.status === 404, String(r.status));
    }

    // Carpeta pública para buscadores
    r = await get('/seo/folder/' + pub.id);
    ok('carpeta pública → HTML con sus cartas con stock', r.status === 200 && /text\/html/.test(r.type) && r.body.includes(`/carta/${cheap.id}"`) && !r.body.includes(noStock.id), String(r.status));
    ok('carpeta: canónica, título con cantidad y datos estructurados', r.body.includes(`rel="canonical" href="https://carpetazo.cl/c/${pub.id}"`) && /<title>TEST seo publica - \d+ cartas de Pok/.test(r.body) && r.body.includes('"@type":"ItemList"'));
    ok('carpeta: el nombre de las cartas no inyecta etiquetas', !r.body.includes('<b>SEO</b>'));
    for (const [label, id] of [['privada', priv.id], ['inexistente', '00000000-0000-4000-8000-000000000000'], ['id inválido', '../x']]) {
      r = await get('/seo/folder/' + encodeURIComponent(id));
      ok(`carpeta ${label} → 404`, r.status === 404, String(r.status));
    }
    const empty = (await call('POST', '/folders', 'seller', { name: 'TEST seo vacia', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder;
    r = await get('/seo/folder/' + empty.id);
    ok('carpeta sin cartas a la venta → 404', r.status === 404, String(r.status));

    // La misma carta cargada con otro código de catálogo cuenta como una sola carta
    const dupA = await prisma.card.create({ data: { tcgId: 'tst-seo-dup-a', name: 'Carta Doble', price: 2000, stock: 1, folderId: pub.id, data: { set: 'Edición X', number: '007' } } });
    const dupB = await prisma.card.create({ data: { tcgId: 'tst-seo-dup-b', name: 'carta doble', price: 3000, stock: 1, folderId: pub.id, data: { set: 'Edición X', number: '007' } } });
    const other = await prisma.card.create({ data: { tcgId: 'tst-seo-dup-c', name: 'Carta Doble', price: 1000, stock: 1, folderId: pub.id, data: { set: 'Edición X', number: '008' } } });
    r = await get('/seo/card/' + dupB.id);
    ok('misma carta con otro código: se juntan sus ofertas', (r.body.match(/<li>\$/g) || []).length === 2 && r.body.includes(`/carta/${dupA.id}"`), String((r.body.match(/<li>\$/g) || []).length));
    ok('otro número de la misma edición no se mezcla', !r.body.includes('$1.000'));
    r = await get('/cards/' + dupB.id + '/offers');
    ok('la página de la carta también junta las ofertas', JSON.parse(r.body).offers.length === 2, r.body.slice(0, 120));

    // Sitemap
    r = await get('/seo/sitemap.xml');
    ok('sitemap XML', r.status === 200 && /xml/.test(r.type) && r.body.startsWith('<?xml'), String(r.status));
    ok('sitemap incluye páginas fijas, la carta más barata y la carpeta pública', r.body.includes('<loc>https://carpetazo.cl/cartas</loc>') && r.body.includes(`/carta/${cheap.id}<`) && r.body.includes(`/c/${pub.id}<`));
    ok('sitemap: una sola dirección para la misma carta con distinto código', [dupA.id, dupB.id].filter((id) => r.body.includes(`/carta/${id}<`)).length === 1 && r.body.includes(`/carta/${other.id}<`));
    ok('sitemap no incluye la carta cara repetida, ni privadas, ni agotadas', !r.body.includes(`/carta/${dear.id}<`) && !r.body.includes(hiddenCard.id) && !r.body.includes(noStock.id) && !r.body.includes(priv.id));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.message);
  } finally {
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'TEST seo' } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
