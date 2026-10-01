// Pedidos: reserva corta de los anónimos, cupo de pedidos sin cuenta y confirmación que no se procesa dos veces.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    const folder = await call('POST', '/folders', 'seller', { name: 'TEST pedidos', tcg: 'Pokemon', color: 'green', isPublic: true });
    const fid = folder.j.folder.id;
    const mk = async (name, stock) => (await call('POST', '/folders/' + fid + '/cards', 'seller', { tcgId: 'tst-' + name, name, price: 500, stock, data: { catalogOrder: 0 } })).j.card.id;
    const single = await mk('unica', 1);
    const many = await mk('muchas', 100);
    const order = (who, cardId, ip, quantity = 1) => call('POST', '/orders/create', who, { folderId: fid, items: [{ id: cardId, quantity }] }, ip);
    const age = (id, hours) => prisma.order.update({ where: { id }, data: { createdAt: new Date(Date.now() - hours * 60 * 60 * 1000) } });

    // Reserva: sin cuenta dura 24 horas; con cuenta, 7 días
    let r = await order(null, single, '6.6.6.1');
    ok('anónimo reserva la única copia', r.status === 200, String(r.status));
    const anonId = r.j.order.id;
    ok('mientras tanto nadie más puede pedirla → 409', (await order(null, single, '6.6.6.2')).status === 409);
    await age(anonId, 25);
    r = await order('jerry', single, '6.6.6.3');
    ok('pasadas 24 h la reserva anónima vence y otro puede pedir', r.status === 200, String(r.status));
    const buyerId = r.j.order.id;
    await age(buyerId, 25);
    ok('la reserva de un comprador con cuenta sigue a las 25 h → 409', (await order(null, single, '6.6.6.4')).status === 409);
    await age(buyerId, 24 * 8);
    ok('y vence a los 7 días', (await order(null, single, '6.6.6.5')).status === 200);

    // Cupo de pedidos sin cuenta por carpeta (15): no bloquea a quien tiene cuenta
    const anonStatuses = [];
    for (let i = 0; anonStatuses.length < 20; i++) {
      const x = await order(null, many, '5.5.' + Math.floor(i / 200) + '.' + (i % 200 + 1));
      anonStatuses.push(x.status);
      if (x.status === 429) break;
    }
    const accepted = anonStatuses.filter((s) => s === 200).length;
    ok('se corta con 429 al llenar el cupo de pedidos sin cuenta', anonStatuses[anonStatuses.length - 1] === 429, anonStatuses.join(','));
    ok('el cupo cuenta todos los anónimos activos (15)', accepted + 1 === 15, 'aceptados=' + accepted);
    r = await order('ale', many, '5.6.0.1');
    ok('un comprador con cuenta sí puede pedir aunque el cupo anónimo esté lleno', r.status === 200, String(r.status));

    // Confirmar dos veces a la vez: solo una pasa y el stock baja una vez
    const before = (await prisma.card.findUnique({ where: { id: many } })).stock;
    const [a, b] = await Promise.all([
      call('POST', '/orders/mine/' + r.j.order.id + '/status', 'seller', { status: 'completed' }),
      call('POST', '/orders/mine/' + r.j.order.id + '/status', 'seller', { status: 'completed' })
    ]);
    const after = (await prisma.card.findUnique({ where: { id: many } })).stock;
    ok('doble confirmación simultánea: una 200 y otra 409', [a.status, b.status].sort().join() === '200,409', a.status + ',' + b.status);
    ok('el stock se descuenta una sola vez', before - after === 1, before + '→' + after);
    ok('otro vendedor no puede gestionar el pedido → 404', (await call('POST', '/orders/mine/' + anonId + '/status', 'jerry', { status: 'rejected' })).status === 404);
  } finally {
    await prisma.$disconnect();
  }
})();
