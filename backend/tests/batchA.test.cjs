const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const B = 'http://localhost:8000/api';
const U = { seller: 'x7ixqotUu3aXfcCsTpyPEx64GgS2', jerry: 'rS5nDQJ1KChdDJhWvbPcNktr3Nr1', ignacio: 'vqbEaDAh24QkSMhjZT4SImXCtlQ2', temp: 'tempDeleteMeUid0000000001' };
const call = async (method, p, who, body, ip) => {
  const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}), ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const ok = (n, c, e = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' ' + e); if (!c) process.exitCode = 1; };

(async () => {
  const cleanup = { folders: [], orders: [] };
  try {
    // ---- carpeta de prueba del vendedor
    let r = await call('POST', '/folders', 'seller', { name: 'TEST lote A', tcg: 'Pokemon', color: 'red', isPublic: true });
    const fid = r.j.folder.id; cleanup.folders.push(fid);
    ok('#14 crear carpeta con juego inválido → 400', (await call('POST', '/folders', 'seller', { name: 'x', tcg: 'Basura' })).status === 400);
    ok('#14 cambiar el juego de una carpeta → 400', (await call('PUT', '/folders/' + fid, 'seller', { tcg: 'Magic' })).status === 400);
    ok('#14 mismo juego + otros campos → 200', (await call('PUT', '/folders/' + fid, 'seller', { tcg: 'Pokemon', name: 'TEST lote A2' })).status === 200);

    const mk = async (name, stock) => (await call('POST', '/folders/' + fid + '/cards', 'seller', { tcgId: 'tst-' + name, name, price: 1000, stock, data: { catalogOrder: 0 } })).j.card.id;
    const c1 = await mk('carta uno', 2);
    const c2 = await mk('carta dos', 50);
    const c3 = await mk('carta tres', 50);

    // ---- #12 orden de la carpeta
    ok('#12 sin sesión → 401', (await call('PUT', '/folders/' + fid + '/order', null, { ids: [c1] })).status === 401);
    ok('#12 otro usuario → 404', (await call('PUT', '/folders/' + fid + '/order', 'jerry', { ids: [c1] })).status === 404);
    ok('#12 ids inválidos → 400', (await call('PUT', '/folders/' + fid + '/order', 'seller', { ids: ['nada'] })).status === 400);
    ok('#12 carta de otra carpeta → 400', (await call('PUT', '/folders/' + fid + '/order', 'seller', { ids: ['00000000-0000-4000-8000-000000000000'] })).status === 400);
    ok('#12 ids repetidos → 400', (await call('PUT', '/folders/' + fid + '/order', 'seller', { ids: [c1, c1] })).status === 400);
    r = await call('PUT', '/folders/' + fid + '/order', 'seller', { ids: [c3, c1, c2] });
    ok('#12 orden válido → 200', r.status === 200 && r.j.count === 3);
    const cards = (await call('GET', '/folders/' + fid, 'seller')).j.folder.cards;
    const ord = Object.fromEntries(cards.map((c) => [c.id, c.data.catalogOrder]));
    ok('#12 quedó c3=0, c1=1, c2=2', ord[c3] === 0 && ord[c1] === 1 && ord[c2] === 2, JSON.stringify(ord));
    await call('PUT', '/folders/' + fid + '/order', 'seller', { ids: [c2] });
    const after = Object.fromEntries((await call('GET', '/folders/' + fid, 'seller')).j.folder.cards.map((c) => [c.id, c.data.catalogOrder]));
    ok('#12 parcial: c2=0 y el resto detrás en su orden', after[c2] === 0 && after[c3] === 1 && after[c1] === 2, JSON.stringify(after));

    // ---- #10 reserva de stock y #5 límites
    const order = (who, cardId, q, ip) => call('POST', '/orders/create', who, { folderId: fid, items: [{ id: cardId, quantity: q }] }, ip);
    ok('el vendedor no puede pedirse a sí mismo por WhatsApp → 400', (await order('seller', c1, 1, '7.7.7.9')).status === 400);
    ok('ni por mensaje → 400', (await call('POST', '/orders/create', 'seller', { folderId: fid, via: 'message', items: [{ id: c1, quantity: 1 }] }, '7.7.7.9')).status === 400);
    r = await order(null, c1, 3, '7.7.7.1');
    ok('#10 pedir más que el stock → 409 "Solo quedan 2"', r.status === 409 && /Solo quedan 2/.test(r.j.message), r.status + ' ' + r.j?.message);
    r = await order(null, c1, 2, '7.7.7.1');
    ok('#10 pedir todo el stock → 200', r.status === 200, String(r.status)); if (r.j?.order) cleanup.orders.push(r.j.order.id);
    r = await order(null, c1, 1, '7.7.7.2');
    ok('#10 otra persona ya no puede pedir lo reservado → 409', r.status === 409 && /ya no está disponible/.test(r.j.message), r.status + ' ' + r.j?.message);
    // límite por conexión: 3 pendientes
    const statuses = [];
    for (let i = 0; i < 4; i++) { const x = await order(null, c2, 1, '7.7.7.3'); statuses.push(x.status); if (x.j?.order) cleanup.orders.push(x.j.order.id); }
    ok('#5 el 4.º pedido pendiente de la misma conexión → 429', statuses.join() === '200,200,200,429', statuses.join());
    r = await order(null, c2, 1, '7.7.7.4');
    ok('#5 otra conexión sí puede pedir', r.status === 200, String(r.status)); if (r.j?.order) cleanup.orders.push(r.j.order.id);
    // si el vendedor rechaza, el stock se libera
    const first = cleanup.orders[0];
    await call('POST', '/orders/mine/' + first + '/status', 'seller', { status: 'rejected' });
    r = await order(null, c1, 1, '7.7.7.5');
    ok('#10 rechazar el pedido libera la reserva', r.status === 200, String(r.status)); if (r.j?.order) cleanup.orders.push(r.j.order.id);

    // ---- #4 eliminar cuenta
    await call('POST', '/users/sync', 'temp', { displayName: 'Persona Temporal', username: 'temp_borrar_1' });
    await call('PUT', '/users/me', 'temp', { fullName: 'Nombre Completo', phone: '+56911112222', rut: '11111111-1', bio: 'hola', bankDetails: { bank: 'Banco X', accountType: 'Cuenta vista', accountNumber: '123456' }, addresses: [{ region: 'RM', comuna: 'Santiago', street: 'Calle 1', number: '10' }], publicTheme: { showWishlist: 'on' } });
    await call('POST', '/wishlist', 'temp', { name: 'Carta deseada borrar' });
    await call('POST', '/messages/' + 'rigoberto_godoy_espinoza', 'temp', { content: 'mensaje de la persona' });
    const tempBuy = await call('POST', '/orders/create', 'temp', { folderId: fid, via: 'message', items: [{ id: c3, quantity: 1 }] }, '8.8.8.8');
    if (tempBuy.j?.order) cleanup.orders.push(tempBuy.j.order.id);
    const me0 = (await call('GET', '/users/me', 'temp')).j.user;
    ok('#4 (antes) la cuenta tiene datos', me0.rut === '11111111-1' && me0.phone);
    r = await call('DELETE', '/users/me', 'temp');
    ok('#4 eliminar cuenta → 200', r.status === 200, String(r.status));
    const row = await prisma.user.findUnique({ where: { id: me0.id } });
    ok('#4 datos personales borrados', row.rut === null && row.phone === null && row.fullName === null && row.bio === null && row.bankDetails === null && row.addresses === null && row.publicTheme === null && row.photoURL === null);
    ok('#4 correo y usuario anonimizados, rol deleted', /@deleted\.invalid$/.test(row.email) && /^deleted_/.test(row.username) && row.role === 'deleted' && row.name === 'Usuario Eliminado', row.email);
    ok('#4 lista de deseos borrada', (await prisma.wishlistItem.count({ where: { userId: me0.id } })) === 0);
    const msgs = await prisma.message.findMany({ where: { senderId: me0.id } });
    ok('#4 sus mensajes quedan como "Mensaje eliminado"', msgs.length >= 1 && msgs.every((m) => JSON.parse(m.content).text === 'Mensaje eliminado'));
    const tempOrder = await prisma.order.findUnique({ where: { id: tempBuy.j.order.id } });
    ok('#4 su pedido queda sin comprador identificable', tempOrder.buyerId === null && tempOrder.buyerName === 'Comprador eliminado');
    const sync2 = await call('POST', '/users/sync', 'temp', { displayName: 'Persona Nueva' });
    ok('#4 si vuelve a entrar con el mismo acceso, empieza de cero', sync2.j?.user?.role === 'user' && sync2.j.user.rut === null, sync2.j?.user?.role);

    // ---- el resto sigue igual
    ok('carpeta privada de otro sigue oculta (404)', (await call('PUT', '/folders/' + fid, 'seller', { isPublic: false })).status === 200 && (await call('GET', '/folders/' + fid, null)).status === 404);
    const tmpUser = await prisma.user.findUnique({ where: { firebaseUid: U.temp } });
    if (tmpUser) await prisma.user.delete({ where: { id: tmpUser.id } });
  } finally {
    await prisma.message.deleteMany({ where: { content: { contains: 'mensaje de la persona' } } }).catch(() => {});
    await prisma.message.deleteMany({ where: { content: { contains: 'Mensaje eliminado' } } }).catch(() => {});
    await prisma.message.deleteMany({ where: { content: { contains: 'Te hice un pedido desde tu carpeta "TEST lote A' } } }).catch(() => {});
    await prisma.order.deleteMany({ where: { folderId: { in: cleanup.folders } } }).catch(() => {});
    for (const f of cleanup.folders) await prisma.folder.delete({ where: { id: f } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
