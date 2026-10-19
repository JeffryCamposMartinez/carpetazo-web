// Venta presencial: baja el stock en transacción, calcula el total en el servidor, no se registra dos veces,
// solo la hace el dueño de la carpeta y no crea pedidos ni toca el precio de referencia.
const { prisma, call, ok } = require('./fixtures.cjs');

const rid = () => 'req' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

(async () => {
  try {
    const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
    const seller = await id('seller');
    const jerry = await id('jerry');
    const folder = await prisma.folder.create({ data: { name: 'TEST venta presencial', userId: seller, tcg: 'Pokemon', isPublic: true } });
    const other = await prisma.folder.create({ data: { name: 'TEST otra carpeta', userId: seller, tcg: 'Pokemon', isPublic: true } });
    const foreign = await prisma.folder.create({ data: { name: 'TEST ajena', userId: jerry, tcg: 'Pokemon', isPublic: true } });
    const card = (folderId, name, price, stock) => prisma.card.create({ data: { folderId, tcgId: 'tst-presencial', name, price, stock } });
    const A = await card(folder.id, 'CZTEST A', 15000, 8);
    const B = await card(folder.id, 'CZTEST B', 2000, 20);
    const C = await card(folder.id, 'CZTEST C sin precio', null, 1);
    const inOther = await card(other.id, 'CZTEST en otra carpeta', 500, 5);
    const theirs = await card(foreign.id, 'CZTEST ajena', 500, 5);
    const stock = async (cardId) => (await prisma.card.findUnique({ where: { id: cardId } })).stock;
    const url = '/folders/' + folder.id + '/in-person-sales';
    const ordersBefore = await prisma.order.count({ where: { sellerId: seller } });

    // ---- Acceso
    let r = await call('POST', url, undefined, { requestId: rid(), items: [{ cardId: A.id, quantity: 1 }] });
    ok('sin sesión → 401', r.status === 401, String(r.status));
    r = await call('GET', url);
    ok('historial sin sesión → 401', r.status === 401, String(r.status));
    r = await call('POST', url, 'jerry', { requestId: rid(), items: [{ cardId: A.id, quantity: 1 }] });
    ok('otra persona no vende desde mi carpeta → 404', r.status === 404, String(r.status));
    r = await call('GET', url, 'jerry');
    ok('otra persona no ve mi historial → 404', r.status === 404, String(r.status));
    r = await call('POST', '/folders/no-es-un-id/in-person-sales', 'seller', { requestId: rid(), items: [{ cardId: A.id, quantity: 1 }] });
    ok('carpeta con id inválido → 404', r.status === 404, String(r.status));
    ok('...y el stock no cambió', (await stock(A.id)) === 8, String(await stock(A.id)));

    // ---- Entradas inválidas: 400 y el stock intacto
    const bad = [
      ['sin requestId', { items: [{ cardId: A.id, quantity: 1 }] }],
      ['requestId corto', { requestId: 'abc', items: [{ cardId: A.id, quantity: 1 }] }],
      ['requestId con símbolos', { requestId: 'abc def!!!!!!', items: [{ cardId: A.id, quantity: 1 }] }],
      ['sin cartas', { requestId: rid(), items: [] }],
      ['items no es arreglo', { requestId: rid(), items: 'x' }],
      ['101 líneas', { requestId: rid(), items: Array.from({ length: 101 }, () => ({ cardId: A.id, quantity: 1 })) }],
      ['cantidad 0', { requestId: rid(), items: [{ cardId: A.id, quantity: 0 }] }],
      ['cantidad negativa', { requestId: rid(), items: [{ cardId: A.id, quantity: -2 }] }],
      ['cantidad decimal', { requestId: rid(), items: [{ cardId: A.id, quantity: 1.5 }] }],
      ['cantidad texto', { requestId: rid(), items: [{ cardId: A.id, quantity: 'x' }] }],
      ['cantidad enorme', { requestId: rid(), items: [{ cardId: A.id, quantity: 1e9 }] }],
      ['cardId inválido', { requestId: rid(), items: [{ cardId: '1; DROP TABLE "Card"', quantity: 1 }] }],
      ['carta repetida', { requestId: rid(), items: [{ cardId: A.id, quantity: 1 }, { cardId: A.id, quantity: 1 }] }],
      ['carta de otra carpeta mía', { requestId: rid(), items: [{ cardId: inOther.id, quantity: 1 }] }],
      ['carta de otra persona', { requestId: rid(), items: [{ cardId: theirs.id, quantity: 1 }] }],
      ['precio negativo', { requestId: rid(), items: [{ cardId: A.id, quantity: 1, unitPrice: -1 }] }],
      ['precio texto', { requestId: rid(), items: [{ cardId: A.id, quantity: 1, unitPrice: 'abc' }] }],
      ['precio enorme', { requestId: rid(), items: [{ cardId: A.id, quantity: 1, unitPrice: 1e12 }] }],
      ['carta sin precio y sin precio indicado', { requestId: rid(), items: [{ cardId: C.id, quantity: 1 }] }],
    ];
    for (const [label, body] of bad) {
      r = await call('POST', url, 'seller', body);
      ok('entrada inválida (' + label + ') → 400', r.status === 400, String(r.status) + ' ' + JSON.stringify(r.j).slice(0, 80));
    }
    ok('...y ninguna dejó stock a medias', (await stock(A.id)) === 8 && (await stock(B.id)) === 20 && (await stock(C.id)) === 1, '');
    ok('...ni registró ventas', (await prisma.inPersonSale.count({ where: { userId: seller } })) === 0, '');

    // ---- Venta correcta: el total lo calcula el servidor
    const first = rid();
    r = await call('POST', url, 'seller', { requestId: first, total: 1, units: 999, items: [{ cardId: A.id, quantity: 2, total: 5 }, { cardId: B.id, quantity: 5, unitPrice: 1800 }] });
    ok('venta de 2 + 5 cartas → 201', r.status === 201 && r.j.success, JSON.stringify(r.j).slice(0, 120));
    ok('el total y las unidades los calcula el servidor (2 × 15.000 + 5 × 1.800 = 39.000 en 7 unidades)', r.j.sale?.total === 39000 && r.j.sale?.units === 7, JSON.stringify(r.j.sale));
    ok('el stock baja: A 8 → 6 y B 20 → 15', (await stock(A.id)) === 6 && (await stock(B.id)) === 15 && r.j.stocks?.[A.id] === 6 && r.j.stocks?.[B.id] === 15, JSON.stringify(r.j.stocks));
    ok('la venta guarda precio unitario y nombre de cada carta', r.j.sale.items.some((line) => line.name === 'CZTEST A' && line.unitPrice === 15000 && line.quantity === 2) && r.j.sale.items.some((line) => line.unitPrice === 1800), JSON.stringify(r.j.sale.items));

    // ---- Repetir el mismo envío no descuenta otra vez
    r = await call('POST', url, 'seller', { requestId: first, items: [{ cardId: A.id, quantity: 2 }, { cardId: B.id, quantity: 5, unitPrice: 1800 }] });
    ok('el mismo requestId devuelve la venta ya registrada (200, duplicada)', r.status === 200 && r.j.duplicate === true && r.j.sale?.total === 39000, JSON.stringify(r.j).slice(0, 120));
    ok('...y el stock no vuelve a bajar', (await stock(A.id)) === 6 && (await stock(B.id)) === 15, '');
    const sameTime = rid();
    const burst = await Promise.all(Array.from({ length: 5 }, () => call('POST', url, 'seller', { requestId: sameTime, items: [{ cardId: B.id, quantity: 1 }] })));
    ok('5 envíos simultáneos con el mismo requestId: todos 2xx y el stock baja una sola vez (15 → 14)', burst.every((x) => x.status === 200 || x.status === 201) && (await stock(B.id)) === 14, JSON.stringify(burst.map((x) => x.status)) + ' ' + (await stock(B.id)));

    // ---- Stock insuficiente: ni una carta se descuenta
    r = await call('POST', url, 'seller', { requestId: rid(), items: [{ cardId: B.id, quantity: 3 }, { cardId: A.id, quantity: 7 }] });
    ok('pedir más de lo que hay → 409 con el nombre de la carta', r.status === 409 && /CZTEST A/.test(r.j?.message || ''), JSON.stringify(r.j));
    ok('...y tampoco se descontó la otra carta (todo o nada)', (await stock(A.id)) === 6 && (await stock(B.id)) === 14, '');

    // ---- Última unidad vendida a la vez: solo una venta se concreta
    const race = await Promise.all(Array.from({ length: 6 }, () => call('POST', url, 'seller', { requestId: rid(), items: [{ cardId: C.id, quantity: 1, unitPrice: 5000 }] })));
    const wins = race.filter((x) => x.status === 201).length;
    ok('6 ventas simultáneas de la última unidad: una sola se concreta y el resto 409', wins === 1 && race.filter((x) => x.status === 409).length === 5, JSON.stringify(race.map((x) => x.status)));
    ok('...y el stock queda en 0, nunca negativo', (await stock(C.id)) === 0, String(await stock(C.id)));

    // ---- Historial: solo del dueño, lo más reciente primero
    r = await call('GET', url, 'seller');
    ok('el historial lista las ventas registradas, la más reciente primero', r.status === 200 && r.j.sales.length === 3 && new Date(r.j.sales[0].createdAt) >= new Date(r.j.sales[1].createdAt), JSON.stringify(r.j.sales?.map((s) => s.total)));
    ok('el historial no expone identificadores ajenos ni el requestId', !/requestId|userId|firebase/.test(JSON.stringify(r.j)), '');

    // ---- Mis ventas presenciales (historial de la cuenta): solo las mías
    r = await call('GET', '/in-person-sales/mine');
    ok('mis ventas presenciales sin sesión → 401', r.status === 401, String(r.status));
    r = await call('GET', '/in-person-sales/mine', 'seller');
    ok('mis ventas presenciales: las 3 del dueño, con la imagen guardada en cada carta', r.status === 200 && r.j.sales.length === 3 && r.j.sales.every((sale) => Array.isArray(sale.items) && sale.items.every((line) => 'imageUrl' in line)), JSON.stringify(r.j.sales?.length));
    r = await call('GET', '/in-person-sales/mine', 'jerry');
    ok('otra persona no ve mis ventas presenciales', r.status === 200 && r.j.sales.length === 0, JSON.stringify(r.j));

    // Ventas anteriores a que se guardara la imagen: la toman de la carta si existe
    const pictured = await prisma.card.create({ data: { folderId: folder.id, tcgId: 'tst-presencial', name: 'CZTEST con imagen', price: 100, stock: 1, imageUrl: 'https://example.com/czimg.webp' } });
    await prisma.inPersonSale.create({ data: { userId: seller, folderId: folder.id, folderName: folder.name, requestId: rid(), items: [{ cardId: pictured.id, name: 'CZTEST con imagen', quantity: 1, unitPrice: 100 }, { cardId: '00000000-0000-4000-8000-000000000000', name: 'carta borrada', quantity: 1, unitPrice: 5 }], units: 2, total: 105 } });
    r = await call('GET', '/in-person-sales/mine', 'seller');
    const old = r.j.sales.find((sale) => sale.total === 105);
    ok('una venta sin imagen guardada recupera la de la carta que sigue existiendo', old?.items.find((line) => line.name === 'CZTEST con imagen')?.imageUrl === 'https://example.com/czimg.webp', JSON.stringify(old?.items));
    ok('...y si la carta ya no existe queda sin imagen, sin error', old?.items.find((line) => line.name === 'carta borrada')?.imageUrl === null, JSON.stringify(old?.items));
    await prisma.inPersonSale.deleteMany({ where: { userId: seller, total: 105 } });

    // ---- No es un pedido ni mueve precios
    ok('no se crearon pedidos', (await prisma.order.count({ where: { sellerId: seller } })) === ordersBefore, '');
    const ref = await call('GET', '/cards/reference-prices?ids=tst-presencial');
    ok('el precio de referencia ignora las ventas presenciales', ref.status === 200 && !ref.j.prices?.['tst-presencial'], JSON.stringify(ref.j));

    // ---- Si se borra la carpeta, el historial se conserva
    await prisma.folder.delete({ where: { id: other.id } });
    ok('las ventas no dependen de que la carpeta siga existiendo (sin relación con Folder)', (await prisma.inPersonSale.count({ where: { userId: seller } })) === 3, '');
    await prisma.folder.deleteMany({ where: { id: { in: [folder.id, foreign.id] } } });
    ok('...ni de que se borre la carpeta vendida', (await prisma.inPersonSale.count({ where: { userId: seller } })) === 3, '');
    await prisma.inPersonSale.deleteMany({ where: { userId: { in: [seller, jerry] } } });
  } finally {
    await prisma.$disconnect();
  }
})();
