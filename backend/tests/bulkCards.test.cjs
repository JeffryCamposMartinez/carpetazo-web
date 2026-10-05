// Edición en bloque de cartas: solo el dueño, datos validados, cartas ocultadas por moderación omitidas, mover solo entre carpetas propias del mismo juego.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    const mk = async (who, name, tcg = 'Pokemon') => (await call('POST', '/folders', who, { name, tcg, color: 'blue', isPublic: false })).j.folder.id;
    const card = async (fid, n, extra = {}) => (await call('POST', '/folders/' + fid + '/cards', 'seller', { tcgId: 'bulk-' + n, name: 'Carta ' + n, price: 1000 * n, stock: n, data: { language: 'English' }, ...extra })).j.card.id;
    const fid = await mk('seller', 'TEST bloque');
    const other = await mk('seller', 'TEST bloque destino');
    const mylFolder = await mk('seller', 'TEST bloque MyL', 'Mitos y Leyendas');
    const foreign = await mk('jerry', 'TEST bloque ajena');
    const [a, b, c] = [await card(fid, 1), await card(fid, 2), await card(fid, 3)];
    const stored = (id) => prisma.card.findUnique({ where: { id } });

    // Edición de precio, stock e idioma
    let r = await call('PUT', '/folders/' + fid + '/cards-bulk', 'seller', { updates: [{ id: a, price: 2500, stock: 7 }, { id: b, language: 'Spanish' }] });
    ok('editar dos cartas en bloque → 200', r.status === 200 && r.j.count === 2 && r.j.skipped === 0, JSON.stringify(r.j));
    let [ca, cb] = [await stored(a), await stored(b)];
    ok('...cambia precio y stock de la primera', ca.price === 2500 && ca.stock === 7);
    ok('...cambia solo el idioma de la segunda y conserva su precio', cb.data.language === 'Spanish' && cb.price === 2000 && cb.stock === 2);

    // Ajenas y datos inválidos
    r = await call('PUT', '/folders/' + foreign + '/cards-bulk', 'seller', { updates: [{ id: a, price: 1 }] });
    ok('carpeta ajena → 404', r.status === 404, String(r.status));
    r = await call('PUT', '/folders/' + fid + '/cards-bulk', 'jerry', { updates: [{ id: a, price: 1 }] });
    ok('otra persona editando mi carpeta → 404', r.status === 404, String(r.status));
    ok('...y no cambió nada', (await stored(a)).price === 2500);
    const foreignCard = (await call('POST', '/folders/' + foreign + '/cards', 'jerry', { tcgId: 'bulk-x', name: 'Ajena', price: 10, stock: 1 })).j.card.id;
    r = await call('PUT', '/folders/' + fid + '/cards-bulk', 'seller', { updates: [{ id: a, price: 5 }, { id: foreignCard, price: 5 }] });
    ok('incluir una carta de otra carpeta → 400 y no se aplica nada', r.status === 400 && (await stored(a)).price === 2500, String(r.status));
    for (const [label, updates] of [
      ['precio negativo', [{ id: a, price: -1 }]],
      ['precio vacío', [{ id: a, price: '' }]],
      ['stock decimal', [{ id: a, stock: 1.5 }]],
      ['stock nulo', [{ id: a, stock: null }]],
      ['idioma desconocido', [{ id: a, language: 'Klingon' }]],
      ['sin ningún campo', [{ id: a }]],
      ['id repetido', [{ id: a, price: 1 }, { id: a, price: 2 }]],
      ['id que no es uuid', [{ id: '1; DROP TABLE', price: 1 }]],
      ['lista vacía', []],
    ]) {
      r = await call('PUT', '/folders/' + fid + '/cards-bulk', 'seller', { updates });
      ok('datos inválidos (' + label + ') → 400', r.status === 400, String(r.status));
    }
    r = await call('PUT', '/folders/' + fid + '/cards-bulk', 'seller', { updates: Array.from({ length: 501 }, () => ({ id: a, price: 1 })) });
    ok('más de 500 cartas → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/folders/' + fid + '/cards-bulk', null, { updates: [{ id: a, price: 1 }] });
    ok('sin sesión → 401', r.status === 401, String(r.status));

    // Cartas ocultadas por moderación: se omiten
    await prisma.card.update({ where: { id: c }, data: { moderationState: 'hidden' } });
    r = await call('PUT', '/folders/' + fid + '/cards-bulk', 'seller', { updates: [{ id: b, price: 3000 }, { id: c, price: 9 }] });
    ok('una carta oculta por moderación se omite', r.status === 200 && r.j.count === 1 && r.j.skipped === 1, JSON.stringify(r.j));
    ok('...y no cambia su precio', (await stored(c)).price === 3000);
    await prisma.card.update({ where: { id: c }, data: { moderationState: 'visible' } });

    // Mover
    r = await call('POST', '/folders/' + fid + '/cards-bulk/move', 'seller', { ids: [a], targetFolderId: foreign });
    ok('mover a una carpeta ajena → 404', r.status === 404, String(r.status));
    r = await call('POST', '/folders/' + fid + '/cards-bulk/move', 'seller', { ids: [a], targetFolderId: mylFolder });
    ok('mover a una carpeta de otro juego → 400', r.status === 400, String(r.status));
    r = await call('POST', '/folders/' + fid + '/cards-bulk/move', 'seller', { ids: [a], targetFolderId: fid });
    ok('mover a la misma carpeta → 400', r.status === 400, String(r.status));
    await prisma.card.update({ where: { id: a }, data: { data: { language: 'English', catalogOrder: 4 } } });
    r = await call('POST', '/folders/' + fid + '/cards-bulk/move', 'seller', { ids: [a, b], targetFolderId: other });
    ok('mover dos cartas a otra carpeta propia del mismo juego → 200', r.status === 200 && r.j.count === 2, JSON.stringify(r.j));
    ca = await stored(a);
    ok('...cambian de carpeta y pierden su posición', ca.folderId === other && !('catalogOrder' in ca.data) && ca.data.language === 'English');

    // Eliminar
    r = await call('POST', '/folders/' + other + '/cards-bulk/delete', 'jerry', { ids: [a] });
    ok('eliminar en una carpeta ajena → 404', r.status === 404, String(r.status));
    r = await call('POST', '/folders/' + other + '/cards-bulk/delete', 'seller', { ids: [a, c] });
    ok('eliminar solo borra las cartas de esa carpeta', r.status === 200 && r.j.count === 1 && !(await stored(a)) && !!(await stored(c)), JSON.stringify(r.j));
    r = await call('POST', '/folders/' + other + '/cards-bulk/delete', 'seller', { ids: ['no-es-uuid'] });
    ok('eliminar con ids inválidos → 400', r.status === 400, String(r.status));
  } finally {
    await prisma.$disconnect();
  }
})();
