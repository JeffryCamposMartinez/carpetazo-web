// Conversaciones: una por persona, último mensaje, no leídos y datos públicos del interlocutor.
const { prisma, NAMES, call, ok } = require('./fixtures.cjs');

(async () => {
  const tag = 'TESTCHAT' + Date.now();
  try {
    await call('POST', '/messages/' + NAMES.seller, 'jerry', { content: tag + ' uno' });
    await call('POST', '/messages/' + NAMES.seller, 'jerry', { content: tag + ' dos' });
    await call('POST', '/messages/' + NAMES.seller, 'ignacio', { content: tag + ' ignacio' });
    let r = await call('GET', '/chats', 'seller');
    const withJerry = r.j.chats.find((c) => c.partner.username === NAMES.jerry);
    const withIgnacio = r.j.chats.find((c) => c.partner.username === NAMES.ignacio);
    ok('/chats responde 200 con la misma forma', r.status === 200 && Array.isArray(r.j.chats) && typeof r.j.totalUnread === 'number');
    ok('una sola conversación por persona', r.j.chats.filter((c) => c.partner.username === NAMES.jerry).length === 1);
    ok('el último mensaje es el más reciente', withJerry.content.includes('dos'), withJerry.content);
    ok('no leídos por persona (jerry=2, ignacio=1)', withJerry.unreadCount === 2 && withIgnacio.unreadCount === 1, withJerry.unreadCount + '/' + withIgnacio.unreadCount);
    ok('totalUnread suma las personas', r.j.totalUnread === r.j.chats.reduce((s, c) => s + c.unreadCount, 0), String(r.j.totalUnread));
    ok('orden: la más reciente primero', r.j.chats[0].partner.username === NAMES.ignacio && r.j.chats.every((c, i, a) => i === 0 || new Date(a[i - 1].createdAt) >= new Date(c.createdAt)));
    ok('datos públicos del interlocutor (sin correo)', !JSON.stringify(r.j).match(/email|"rut"|bankDetails/i));

    // Leer los de jerry y volver a consultar
    const msgs = (await call('GET', '/messages/' + NAMES.jerry, 'seller')).j.messages;
    for (const m of msgs.filter((x) => !x.isRead && x.senderId === withJerry.senderId)) await call('PUT', '/messages/' + m.id + '/read', 'seller');
    r = await call('GET', '/chats', 'seller');
    ok('al leer, los no leídos de esa persona bajan a 0', r.j.chats.find((c) => c.partner.username === NAMES.jerry).unreadCount === 0);
    ok('los de la otra persona no cambian', r.j.chats.find((c) => c.partner.username === NAMES.ignacio).unreadCount === 1);
    ok('un tercero no puede marcar como leído un mensaje ajeno', (await call('PUT', '/messages/' + msgs[0].id + '/read', 'ale')).status >= 400);
    ok('/messages/me ya no existe', (await call('GET', '/messages/me', 'seller')).status === 404);
    const buyerView = await call('GET', '/chats', 'jerry');
    ok('el comprador ve su conversación con el vendedor', buyerView.j.chats.some((c) => c.partner.username === NAMES.seller));
  } finally {
    await prisma.$disconnect();
  }
})();
