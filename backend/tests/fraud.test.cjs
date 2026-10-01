const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const B = 'http://localhost:8000/api';
const F = 'ca393529-f3a8-4429-9fca-49d6cf71a0f5';
const U = { seller: 'x7ixqotUu3aXfcCsTpyPEx64GgS2', jerry: 'rS5nDQJ1KChdDJhWvbPcNktr3Nr1', ignacio: 'vqbEaDAh24QkSMhjZT4SImXCtlQ2', ale: 'rKkJWG0q2eR7lIBMsjt1CFZBwQ12', jeffry: 'ljxBEIxkI5hJJ76NKuhXQlI8jhU2' };
const SELLER_USERNAME = 'rigoberto_godoy_espinoza';
const call = async (method, path, uid, body, ip) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}), ...(uid ? { Authorization: 'Bearer test-' + U[uid] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
};
const ok = (n, c, e = '') => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + ' ' + e); if (!c) process.exitCode = 1; };
const summary = async () => (await call('GET', '/users/' + SELLER_USERNAME + '/reviews')).j;

(async () => {
  const card = (await call('GET', '/folders/' + F)).j.folder.cards.find((c) => c.stock > 6 && c.price > 0);
  console.log('CARD ' + JSON.stringify({ id: card.id, stock: card.stock }));
  const items = [{ id: card.id, quantity: 1 }];
  const orders = [];
  const buy = async (who, createIp, confirmIp) => {
    const r = await call('POST', '/orders/create', who, { folderId: F, via: 'message', items }, createIp);
    orders.push(r.j.order.id);
    await call('POST', '/orders/mine/' + r.j.order.id + '/status', 'seller', { status: 'completed' }, confirmIp);
    return r.j.order.id;
  };

  // A) conexiones distintas: cuenta
  const a1 = await buy('jerry', '1.1.1.1', '9.9.9.9');
  let r = await call('POST', '/reviews', 'jerry', { orderId: a1, rating: 5, comment: 'Todo bien' });
  ok('A: reseña desde conexiones distintas → 200', r.status === 200, String(r.status));
  let s = await summary();
  ok('A: cuenta (1 reseña) y NO muestra promedio', s.count === 1 && s.average === null && s.showAverage === false, JSON.stringify([s.count, s.average, s.showAverage]));

  // B) una por pareja
  const b2 = await buy('jerry', '1.1.1.1', '9.9.9.9');
  ok('B: el segundo pedido al mismo vendedor no se ofrece para calificar', (await call('GET', '/reviews/pending', 'jerry')).j.pending.length === 0);
  r = await call('POST', '/reviews', 'jerry', { orderId: b2, rating: 1 });
  ok('B: segunda reseña a la misma pareja → 409', r.status === 409, r.status + ' ' + r.j?.message);

  // C) misma conexión: se guarda pero no cuenta
  const c1 = await buy('ignacio', '2.2.2.2', '2.2.2.2');
  r = await call('POST', '/reviews', 'ignacio', { orderId: c1, rating: 1, comment: 'sospechosa' });
  ok('C: misma conexión → el comprador ve éxito (no se le avisa)', r.status === 200, String(r.status));
  s = await summary();
  ok('C: pero no se muestra ni cuenta', s.count === 1 && !s.reviews.some((x) => x.comment === 'sospechosa'), String(s.count));

  // D) 3 reseñas que cuentan: aparece el promedio
  const d1 = await buy('ale', '3.3.3.3', '9.9.9.9');
  await call('POST', '/reviews', 'ale', { orderId: d1, rating: 4 });
  s = await summary();
  ok('D: con 2 reseñas todavía sin promedio', s.count === 2 && s.average === null);
  const d2 = await buy('jeffry', '4.4.4.4', '9.9.9.9');
  await call('POST', '/reviews', 'jeffry', { orderId: d2, rating: 3 });
  s = await summary();
  ok('D: con 3 reseñas muestra promedio 4.0', s.count === 3 && s.average === 4 && s.showAverage === true, JSON.stringify([s.count, s.average]));
  const prof = (await call('GET', '/users/' + SELLER_USERNAME)).j.user.reviewSummary;
  ok('D: el perfil trae el mismo resumen', prof.count === 3 && prof.average === 4 && prof.showAverage);

  // E) reportes
  const jerryReview = s.reviews.find((x) => x.comment === 'Todo bien');
  ok('E: sin sesión → 401', (await call('POST', '/reviews/' + jerryReview.id + '/report', null, {})).status === 401);
  const aleName = (await call('GET', '/users/me', 'ale')).j.user.username;
  const aleReview = s.reviews.find((x) => x.reviewer.username === aleName);
  ok('E: no se puede reportar la propia reseña → 400', (await call('POST', '/reviews/' + aleReview.id + '/report', 'ale', {})).status === 400);
  ok('E: id inexistente → 404', (await call('POST', '/reviews/00000000-0000-4000-8000-000000000000/report', 'ale', {})).status === 404);
  ok('E: motivo de 201 → 400', (await call('POST', '/reviews/' + jerryReview.id + '/report', 'ale', { reason: 'x'.repeat(201) })).status === 400);
  r = await call('POST', '/reviews/' + jerryReview.id + '/report', 'seller', { reason: 'No me gusta' });
  s = await summary();
  ok('E: el vendedor reporta su reseña → 200 pero sigue visible', r.status === 200 && r.j.hidden === false && s.count === 3 && s.reviews.some((x) => x.id === jerryReview.id), JSON.stringify([r.status, r.j?.hidden, s.count]));
  r = await call('POST', '/reviews/' + jerryReview.id + '/report', 'ale', { reason: 'Parece falsa' });
  s = await summary();
  ok('E: un reporte ajeno → 200 y todavía visible', r.status === 200 && r.j.hidden === false && s.count === 3, JSON.stringify([r.status, r.j?.hidden, s.count]));
  ok('E: reportar dos veces la misma → 409', (await call('POST', '/reviews/' + jerryReview.id + '/report', 'ale', {})).status === 409);
  r = await call('POST', '/reviews/' + jerryReview.id + '/report', 'ignacio', {});
  s = await summary();
  ok('E: segundo reporte ajeno → se oculta y vuelve a ocultarse el promedio', r.j?.hidden === true && s.count === 2 && s.average === null && !s.reviews.some((x) => x.id === jerryReview.id), JSON.stringify([s.count, s.average]));
  ok('E: reportar una ya oculta → 404', (await call('POST', '/reviews/' + jerryReview.id + '/report', 'jeffry', {})).status === 404);

  // Limpieza: borra las reseñas, pedidos y mensajes de la prueba y devuelve el stock que descontaron los pedidos completados
  const made = await prisma.order.findMany({ where: { id: { in: orders } }, select: { code: true } });
  await prisma.$transaction([
    prisma.sellerReview.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.message.deleteMany({ where: { OR: made.filter((o) => o.code).map((o) => ({ content: { contains: o.code } })) } }),
    prisma.order.deleteMany({ where: { id: { in: orders } } }),
    prisma.card.update({ where: { id: card.id }, data: { stock: { increment: orders.length } } })
  ]);
  await prisma.$disconnect();
})();
