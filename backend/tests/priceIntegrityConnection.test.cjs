// Integridad de precios: un pedido creado y confirmado desde la misma conexión no cuenta para el precio de referencia
// (señal de autoventa, no prueba), pero sigue apareciendo en «Últimas ventas». El pedido y el stock no cambian. Las demás reglas siguen igual.
const { prisma, call, ok } = require('./fixtures.cjs');

const TCG_ID = '980000802';
const MYL = 'Mitos y Leyendas';

(async () => {
  try {
    const { eligibleSales, referenceSales, referenceFromSales, sameConnection, MIN_SELLERS } = await import('../core/priceIntegrity.js');

    // ---- Lógica pura: el precio de referencia (referenceSales)
    const sale = (extra = {}) => ({ sellerId: 's1', buyerId: null, buyerKey: 'ip:a', unit: 1000, createdIpHash: null, completedIpHash: null, ...extra });
    ok('referencia: sin buyerId y con ambos hashes iguales → excluida', referenceSales([sale({ createdIpHash: 'h1', completedIpHash: 'h1' })], null).length === 0, '');
    ok('referencia: con buyerId distinto y ambos hashes iguales → también excluida (la regla es por conexión)', referenceSales([sale({ buyerId: 'b1', createdIpHash: 'h1', completedIpHash: 'h1' })], null).length === 0, '');
    ok('referencia: hashes diferentes → no se excluye por esta regla', referenceSales([sale({ createdIpHash: 'h1', completedIpHash: 'h2' })], null).length === 1, '');
    ok('referencia: sin hash de creación → no se excluye por esta regla', referenceSales([sale({ completedIpHash: 'h1' })], null).length === 1, '');
    ok('referencia: sin hash de confirmación → no se excluye por esta regla', referenceSales([sale({ createdIpHash: 'h1' })], null).length === 1, '');
    ok('referencia: sin ningún hash → no se excluye por esta regla', referenceSales([sale()], null).length === 1, '');
    ok('hashes vacíos nunca cuentan como coincidencia', !sameConnection(sale({ createdIpHash: '', completedIpHash: '' })), '');
    ok('referencia: la autoventa por ID sigue excluyéndose', referenceSales([sale({ buyerId: 's1' })], null).length === 0, '');
    ok('referencia: una venta legítima (compradora distinta, hashes distintos, en rango) sigue contando con anclaje', referenceSales([sale({ buyerId: 'b1', createdIpHash: 'h1', completedIpHash: 'h2', unit: 1000 })], 1000).length === 1, '');
    ok('referencia: el rango de precio sigue aplicando (400 %)', referenceSales([sale({ unit: 5000 }), sale({ unit: 1000 })], 1000).length === 1, '');
    const mixed = [sale({ unit: 900, createdIpHash: 'x', completedIpHash: 'x' }), sale({ unit: 1000 }), sale({ unit: 1100, createdIpHash: 'a', completedIpHash: 'b' })];
    ok('referencia: en una lista mezclada solo queda fuera la de la misma conexión', JSON.stringify(referenceSales(mixed, null).map((row) => row.unit)) === '[1000,1100]', '');

    // ---- Lógica pura: las ventas visibles (eligibleSales, la de «Últimas ventas») no usan la regla de conexión
    ok('visibles: la venta de la misma conexión se mantiene', JSON.stringify(eligibleSales(mixed, null).map((row) => row.unit)) === '[900,1000,1100]', '');
    ok('visibles: la autoventa por ID sigue excluyéndose', eligibleSales([sale({ buyerId: 's1', createdIpHash: 'x', completedIpHash: 'y' })], null).length === 0, '');
    ok('visibles: el rango de precio sigue aplicando (400 %) también a la misma conexión', eligibleSales([sale({ unit: 5000, createdIpHash: 'x', completedIpHash: 'x' }), sale({ unit: 1000, createdIpHash: 'x', completedIpHash: 'x' })], 1000).length === 1, '');

    // ---- Con la base: la referencia de Mitos y Leyendas no se apoya en esos pedidos, pero «Últimas ventas» los muestra
    const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
    const sellers = [await id('seller'), await id('jerry'), await id('ignacio')];
    const buyers = [await id('ale'), await id('admin'), await id('jeffry')];
    const folders = [];
    for (let i = 0; i < 3; i += 1) {
      const folder = (await call('POST', '/folders', ['seller', 'jerry', 'ignacio'][i], { name: 'TEST conexión ' + i, tcg: MYL, color: 'blue', isPublic: true })).j.folder;
      folders.push(folder);
    }
    // Una carta publicada con ese código para poder pedir «Últimas ventas» (un solo vendedor: no forma referencia por ofertas)
    const listed = await prisma.card.create({ data: { tcgId: TCG_ID, name: 'CZTEST conexión', price: 1100, stock: 3, folderId: folders[0].id } });
    const order = (i, buyerId, hashes, unit) => prisma.order.create({ data: { sellerId: sellers[i], buyerId, buyerName: 'CZTEST comprador', folderId: folders[i].id, folderName: folders[i].name, items: [{ id: 'x' + i, tcgId: TCG_ID, name: 'CZTEST conexión', quantity: 1, price: unit }], total: unit, status: 'completed', ...hashes } });
    const reference = async () => (await call('GET', '/cards/reference-prices?ids=' + TCG_ID)).j.prices?.[TCG_ID];
    const latest = async () => (await call('GET', '/cards/' + listed.id + '/offers')).j.sales;
    const prices = (sales) => JSON.stringify((sales || []).map((entry) => entry.price).sort((a, b) => a - b));

    // Tres vendedores y tres compradores distintos, pero cada pedido creado y confirmado desde la misma conexión
    for (let i = 0; i < 3; i += 1) await order(i, buyers[i], { createdIpHash: 'same-' + i, completedIpHash: 'same-' + i }, 1000 + i * 100);
    ok('pedidos de la misma conexión no forman una referencia de precio', (await reference()) === undefined, JSON.stringify(await reference()));
    ok('...pero sí aparecen en «Últimas ventas»', prices(await latest()) === '[1000,1100,1200]', prices(await latest()));
    const stats = await prisma.order.count({ where: { sellerId: { in: sellers }, status: 'completed', items: { path: ['0', 'tcgId'], equals: TCG_ID } } });
    ok('...y los pedidos siguen completados (no se invalidan)', stats === 3, String(stats));
    ok('...y el stock de la carta publicada no cambió', (await prisma.card.findUnique({ where: { id: listed.id } })).stock === 3, '');

    // Los mismos pedidos con conexiones distintas sí cuentan para la referencia
    await prisma.order.updateMany({ where: { sellerId: { in: sellers }, status: 'completed', items: { path: ['0', 'tcgId'], equals: TCG_ID } }, data: { completedIpHash: 'other' } });
    const counted = await reference();
    ok('con conexiones distintas la referencia se calcula (mediana de 3 vendedores)', counted?.clp === 1100 && counted.sales === MIN_SELLERS, JSON.stringify(counted));
    ok('...y «Últimas ventas» sigue mostrándolas', prices(await latest()) === '[1000,1100,1200]', prices(await latest()));

    // Un pedido más de la misma conexión a precio alto no mueve la referencia, pero se ve en «Últimas ventas» (si está en rango)
    await order(0, buyers[0], { createdIpHash: 'same-x', completedIpHash: 'same-x' }, 1300);
    const after = await reference();
    ok('un pedido extra de la misma conexión no cambia la referencia', after?.clp === counted?.clp && after.sales === counted.sales, JSON.stringify(after));
    ok('...pero aparece en «Últimas ventas»', prices(await latest()) === '[1000,1100,1200,1300]', prices(await latest()));
    ok('referenceFromSales sigue exigiendo vendedores y compradores distintos', referenceFromSales([sale({ unit: 1000 })]) === null, '');
  } finally {
    await prisma.$disconnect();
  }
})();
