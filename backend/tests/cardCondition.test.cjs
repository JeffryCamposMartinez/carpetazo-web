// Estado de la carta (1 a 5 estrellas): la misma carta en otro estado es otra fila; conflictos al agregar, editar, editar en bloque y mover; validación y filtro del buscador.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    const a = (await call('POST', '/folders', 'seller', { name: 'CZTEST estado A', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    const b = (await call('POST', '/folders', 'seller', { name: 'CZTEST estado B', tcg: 'Pokemon', color: 'blue', isPublic: true })).j.folder.id;
    const add = (folder, condition, extra = {}) => call('POST', `/folders/${folder}/cards`, 'seller', { tcgId: '98002001', name: 'CZTEST Estado', price: 1000, stock: 1, condition, data: { catalogOrder: 0 }, ...extra });

    let r = await add(a, 3);
    ok('se agrega una carta con estado 3', r.status === 200 && r.j.card?.condition === 3, JSON.stringify(r.j).slice(0, 160));
    const c3 = r.j.card;
    r = await add(a, 3);
    ok('la misma carta en el mismo estado es un duplicado', r.status === 409 || r.status === 403 || r.j.code === 'card_identity_conflict', JSON.stringify(r));
    r = await add(a, 4);
    ok('la misma carta en otro estado es otra fila', r.status === 200 && r.j.card?.condition === 4);
    const c4 = r.j.card;
    r = await add(a, null);
    ok('y sin estado también es otra fila', r.status === 200 && r.j.card?.condition === null);
    ok('quedan tres filas de la misma carta', (await prisma.card.count({ where: { folderId: a, tcgId: '98002001' } })) === 3);

    r = await add(a, 9, { tcgId: '98002002' });
    ok('un estado fuera de 1 a 5 se rechaza', r.status === 400, JSON.stringify(r));
    r = await add(a, 'abc', { tcgId: '98002002' });
    ok('un estado que no es número se rechaza', r.status === 400);
    r = await add(a, true, { tcgId: '98002002' });
    ok('un booleano como estado se rechaza', r.status === 400);

    r = await call('PUT', `/folders/${a}/cards/${c4.id}`, 'seller', { condition: 3 });
    ok('cambiar el estado a uno que ya existe es un conflicto', r.status === 409 || r.status === 403 || r.j.code === 'card_identity_conflict', JSON.stringify(r));
    r = await call('PUT', `/folders/${a}/cards/${c4.id}`, 'seller', { condition: 5 });
    ok('cambiar el estado a uno libre funciona', r.status === 200 && r.j.card?.condition === 5);
    r = await call('PUT', `/folders/${a}/cards/${c4.id}`, 'seller', { condition: 7 });
    ok('editar con un estado inválido se rechaza', r.status === 400);
    r = await call('PUT', `/folders/${a}/cards/${c4.id}`, 'seller', { price: 1200 });
    ok('editar solo el precio no toca el estado', r.status === 200 && r.j.card?.condition === 5);

    r = await call('PUT', `/folders/${a}/cards-bulk`, 'seller', { updates: [{ id: c4.id, condition: 3 }] });
    ok('la edición en bloque también detecta el conflicto de estado', r.status === 409 || r.status === 403 || r.j.code === 'card_identity_conflict', JSON.stringify(r));
    r = await call('PUT', `/folders/${a}/cards-bulk`, 'seller', { updates: [{ id: c4.id, condition: 2 }] });
    ok('la edición en bloque cambia el estado', r.status === 200 && (await prisma.card.findUnique({ where: { id: c4.id } })).condition === 2);

    // Mover a otra carpeta: igual identidad (id, idioma y estado) se junta con la existente
    const inB = await add(b, 3);
    r = await call('POST', `/folders/${a}/cards-bulk/move`, 'seller', { ids: [c3.id], targetFolderId: b });
    const moved = await prisma.card.findMany({ where: { folderId: b, tcgId: '98002001' } });
    ok('al mover una carta con el mismo estado se suma el stock', r.status === 200 && moved.length === 1 && moved[0].id === inB.j.card.id && moved[0].stock === 2, JSON.stringify(moved));
    r = await call('POST', `/folders/${a}/cards-bulk/move`, 'seller', { ids: [c4.id], targetFolderId: b });
    ok('con otro estado se mueve como carta aparte', r.status === 200 && (await prisma.card.count({ where: { folderId: b, tcgId: '98002001' } })) === 2);

    r = await call('GET', '/cards/search?condition=9');
    ok('el buscador rechaza un estado inválido', r.status === 400);
    r = await call('GET', '/cards/search?condition=5');
    ok('el buscador filtra por estado mínimo', r.status === 200 && (r.j.cards || []).every((card) => card.condition >= 5), JSON.stringify((r.j.cards || []).map((card) => card.condition)));
    for (const sort of ['condition_desc', 'condition_asc']) {
      r = await call('GET', `/cards/search?sort=${sort}`);
      ok(`el buscador ordena por ${sort}`, r.status === 200);
    }
  } catch (error) {
    ok('el estado de la carta no lanzó errores inesperados', false, error.stack);
  } finally {
    await prisma.folder.deleteMany({ where: { name: { startsWith: 'CZTEST estado' } } });
    await prisma.$disconnect();
  }
})();
