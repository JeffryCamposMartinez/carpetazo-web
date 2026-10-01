// Reseñas: antifraude (una por pareja, misma conexión, promedio desde 3), reportes y moderación.
const { prisma, call, ok, fixtures } = require('./fixtures.cjs');

const { folderId: F, cardId, sellerUsername: SELLER_USERNAME } = fixtures();
const summary = async () => (await call('GET', '/users/' + SELLER_USERNAME + '/reviews')).j;

(async () => {
  const items = [{ id: cardId, quantity: 1 }];
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
  r = await call('POST', '/reviews/' + jerryReview.id + '/report', 'nobuyer', { reason: 'Cuenta sin compras' });
  ok('E: reporte de una cuenta sin compras → 200 pero no cuenta para ocultar', r.status === 200 && r.j.hidden === false, JSON.stringify([r.status, r.j?.hidden]));
  r = await call('POST', '/reviews/' + jerryReview.id + '/report', 'ale', { reason: 'Parece falsa' });
  s = await summary();
  ok('E: un reporte de comprador verificado → todavía visible', r.status === 200 && r.j.hidden === false && s.count === 3, JSON.stringify([r.status, r.j?.hidden, s.count]));
  ok('E: reportar dos veces la misma → 409', (await call('POST', '/reviews/' + jerryReview.id + '/report', 'ale', {})).status === 409);
  r = await call('POST', '/reviews/' + jerryReview.id + '/report', 'ignacio', {});
  s = await summary();
  ok('E: segundo comprador verificado → se oculta y vuelve a ocultarse el promedio', r.j?.hidden === true && s.count === 2 && s.average === null && !s.reviews.some((x) => x.id === jerryReview.id), JSON.stringify([s.count, s.average]));
  ok('E: reportar una ya oculta → 404', (await call('POST', '/reviews/' + jerryReview.id + '/report', 'jeffry', {})).status === 404);

  // F) moderación (solo administradores)
  ok('F: sin sesión → 401', (await call('GET', '/admin/reviews')).status === 401);
  ok('F: usuario común → 403', (await call('GET', '/admin/reviews', 'jerry')).status === 403);
  ok('F: usuario común no puede aprobar → 403', (await call('POST', '/admin/reviews/' + jerryReview.id + '/approve', 'jerry')).status === 403);
  ok('F: usuario común no puede borrar → 403', (await call('DELETE', '/admin/reviews/' + jerryReview.id, 'jerry')).status === 403);
  r = await call('GET', '/admin/reviews', 'admin');
  const listed = r.j?.reviews || [];
  const hiddenOne = listed.find((x) => x.id === jerryReview.id);
  ok('F: el admin ve la reportada (oculta) con sus 4 reportes', r.status === 200 && hiddenOne && hiddenOne.counts === false && hiddenOne.reports.length === 4, JSON.stringify([r.status, hiddenOne?.reports?.length]));
  ok('F: y la de la misma conexión', listed.some((x) => x.flag === 'same_connection'));
  ok('F: sin correos ni datos privados', !JSON.stringify(r.j).match(/email|"rut"|bankDetails|firebaseUid/i));
  ok('F: id inválido → 404', (await call('POST', '/admin/reviews/nada/approve', 'admin')).status === 404);
  r = await call('POST', '/admin/reviews/' + jerryReview.id + '/approve', 'admin');
  s = await summary();
  ok('F: aprobar → vuelve a mostrarse y contar', r.status === 200 && s.count === 3 && s.reviews.some((x) => x.id === jerryReview.id), JSON.stringify([r.status, s.count]));
  ok('F: aprobada ya no aparece en moderación', !(await call('GET', '/admin/reviews', 'admin')).j.reviews.some((x) => x.id === jerryReview.id));
  const suspicious = listed.find((x) => x.flag === 'same_connection');
  r = await call('DELETE', '/admin/reviews/' + suspicious.id, 'admin');
  ok('F: eliminar → 200 y luego 404', r.status === 200 && (await call('DELETE', '/admin/reviews/' + suspicious.id, 'admin')).status === 404);
  ok('F: el comprador puede volver a calificar a ese vendedor', (await call('GET', '/reviews/pending', 'ignacio')).j.pending.length === 1);

  // La limpieza general de tests/run.cjs borra pedidos, reseñas y mensajes de prueba
  await prisma.$disconnect();
})();
