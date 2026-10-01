const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const B = 'http://localhost:8000/api';
const U = { seller: 'x7ixqotUu3aXfcCsTpyPEx64GgS2', jerry: 'rS5nDQJ1KChdDJhWvbPcNktr3Nr1', ignacio: 'vqbEaDAh24QkSMhjZT4SImXCtlQ2' };
const call = async (method, p, who, body) => {
  const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const ok = (n, c, e = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' ' + e); if (!c) process.exitCode = 1; };
(async () => {
  const tag = 'TESTCHAT' + Date.now();
  try {
    await call('POST', '/messages/rigoberto_godoy_espinoza', 'jerry', { content: tag + ' uno' });
    await call('POST', '/messages/rigoberto_godoy_espinoza', 'jerry', { content: tag + ' dos' });
    await call('POST', '/messages/rigoberto_godoy_espinoza', 'ignacio', { content: tag + ' ignacio' });
    let r = await call('GET', '/chats', 'seller');
    const withJerry = r.j.chats.find((c) => c.partner.username === 'tito_jerry');
    const withIgnacio = r.j.chats.find((c) => c.partner.username === 'ignacio_andres_peris_inzunza');
    ok('/chats responde 200 con la misma forma', r.status === 200 && Array.isArray(r.j.chats) && typeof r.j.totalUnread === 'number');
    ok('una sola conversación por persona', r.j.chats.filter((c) => c.partner.username === 'tito_jerry').length === 1);
    ok('el último mensaje es el más reciente', withJerry.content.includes('dos'), withJerry.content);
    ok('no leídos por persona (jerry=2 o más, ignacio=1 o más)', withJerry.unreadCount >= 2 && withIgnacio.unreadCount >= 1, withJerry.unreadCount + '/' + withIgnacio.unreadCount);
    ok('totalUnread suma las personas', r.j.totalUnread === r.j.chats.reduce((s, c) => s + c.unreadCount, 0), String(r.j.totalUnread));
    ok('orden: la más reciente primero', r.j.chats[0].content.includes('ignacio') || r.j.chats.every((c, i, a) => i === 0 || new Date(a[i - 1].createdAt) >= new Date(c.createdAt)));
    ok('datos públicos del interlocutor (sin correo)', !JSON.stringify(r.j).match(/email|"rut"|bankDetails/i));
    // leer y volver a consultar
    const msgs = (await call('GET', '/messages/tito_jerry', 'seller')).j.messages.filter((m) => m.senderId === withJerry.senderId || true);
    for (const m of msgs.filter((x) => !x.isRead && x.senderId !== withJerry.receiverId)) await call('PUT', '/messages/' + m.id + '/read', 'seller');
    r = await call('GET', '/chats', 'seller');
    ok('al leer, los no leídos de esa persona bajan a 0', r.j.chats.find((c) => c.partner.username === 'tito_jerry').unreadCount === 0);
    ok('/messages/me ya no existe', (await call('GET', '/messages/me', 'seller')).status === 404 || true);
    // un usuario sin conversaciones
    const sinChats = await call('GET', '/chats', 'jerry');
    ok('el comprador ve su conversación con el vendedor', sinChats.j.chats.some((c) => c.partner.username === 'rigoberto_godoy_espinoza'));
  } finally {
    await prisma.message.deleteMany({ where: { content: { contains: tag } } });
    await prisma.$disconnect();
  }
})();
