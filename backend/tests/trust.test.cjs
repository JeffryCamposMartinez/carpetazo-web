// Confianza: insignia de vendedor verificado, tiempo de respuesta y el aviso para calificar una compra confirmada.
// Los correos de esta prueba nunca salen: quedan en memoria (sin credenciales reales ni claves de notificaciones)
Object.assign(process.env, { MAIL_TEST_OUTBOX: '1', SMTP_USER: '', SMTP_PASS: '', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' });
const { prisma, U, NAMES, call, ok, acceptTerms, fixtures } = require('./fixtures.cjs');

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

(async () => {
  try {
    const fx = fixtures();

    // ---- Verificado: solo con la identidad revisada por Moderación (correo y perfil completo ya no bastan)
    const seller = await prisma.user.findUnique({ where: { firebaseUid: U.seller }, select: { id: true, username: true, emailVerified: true } });
    ok('al iniciar sesión se guarda que Firebase confirmó el correo', seller.emailVerified === true);
    let r = await call('GET', '/users/' + NAMES.seller);
    ok('perfil público: sin identidad verificada → no verificado', r.status === 200 && r.j.user.verified === false, JSON.stringify(r.j.user?.verified));
    await prisma.user.update({ where: { id: seller.id }, data: { photoURL: 'https://lh3.googleusercontent.com/a/cztest', publicComuna: 'Santiago', phone: '+56911112222' } });
    r = await call('GET', '/users/' + NAMES.seller);
    ok('correo confirmado y perfil completo no bastan: sigue sin verificar', r.j.user.verified === false);
    await prisma.user.update({ where: { id: seller.id }, data: { identityVerifiedAt: new Date() } });
    r = await call('GET', '/users/' + NAMES.seller);
    ok('con la identidad verificada por Moderación → verificado', r.j.user.verified === true);
    ok('el perfil público muestra la insignia del plan sin exponer datos internos', r.j.user.planBadge?.key === 'store' && !/planGrants|subscriptions|priceClp/.test(JSON.stringify(r.j.user)), JSON.stringify(r.j.user.planBadge));
    ok('el perfil público no revela el estado interno del correo ni la fecha de verificación', !JSON.stringify(r.j).includes('emailVerified') && !JSON.stringify(r.j).includes('identityVerifiedAt'));
    await prisma.user.update({ where: { id: seller.id }, data: { phone: '+56911112222' } });

    r = await call('GET', '/cards/' + fx.cardId + '/offers');
    const offerUser = r.j?.offers?.[0]?.folder?.user;
    ok('las ofertas de una carta traen si el vendedor está verificado', r.status === 200 && offerUser?.verified === true, JSON.stringify(offerUser));
    ok('las ofertas muestran la insignia del plan', offerUser?.planBadge?.key === 'store', JSON.stringify(offerUser?.planBadge));
    ok('las ofertas no filtran correo, teléfono ni estado del correo', !/emailVerified|"phone"|"email"/.test(JSON.stringify(r.j)));
    r = await call('GET', '/sellers?q=' + encodeURIComponent(NAMES.seller));
    const row = r.j?.sellers?.find((entry) => entry.username === NAMES.seller);
    ok('el listado de vendedores marca al verificado', r.status === 200 && row?.verified === true && !JSON.stringify(r.j).includes('phone'), JSON.stringify(row));
    ok('el listado de vendedores muestra la insignia del plan', row?.planBadge?.key === 'store', JSON.stringify(row?.planBadge));
    r = await call('GET', '/home/featured');
    const featuredSeller = r.j?.topSellers?.find((entry) => entry.username === NAMES.seller);
    const featuredFolder = [...(r.j?.visited || []), ...(r.j?.newest || [])].find((entry) => entry.user?.username === NAMES.seller);
    ok('la portada muestra la insignia en vendedores y carpetas destacadas', r.status === 200 && featuredSeller?.planBadge?.key === 'store' && featuredFolder?.user?.planBadge?.key === 'store', JSON.stringify({ seller: featuredSeller?.planBadge, folder: featuredFolder?.user?.planBadge }));
    ok('la portada no expone concesiones ni suscripciones', !/planGrants|subscriptions|priceClp/.test(JSON.stringify(r.j)));

    // ---- Tiempo de respuesta
    for (const name of ['rtime', 'rbuyer']) {
      const sync = await call('POST', '/users/sync', name, { displayName: 'Prueba ' + name, username: NAMES[name] || 'cztest_' + name });
      if (sync.status !== 200) throw new Error('no se pudo crear ' + name);
    }
    const rtime = await prisma.user.findUnique({ where: { firebaseUid: U.rtime }, select: { id: true, username: true } });
    const buyer = await prisma.user.findUnique({ where: { firebaseUid: U.rbuyer }, select: { id: true } });
    const now = Date.now();
    const talk = async (daysAgo, replyMinutes, from = buyer.id) => {
      const asked = new Date(now - daysAgo * DAY);
      await prisma.message.create({ data: { senderId: from, receiverId: rtime.id, content: 'consulta', createdAt: asked } });
      if (replyMinutes != null) await prisma.message.create({ data: { senderId: rtime.id, receiverId: from, content: 'respuesta', createdAt: new Date(asked.getTime() + replyMinutes * MIN) } });
    };
    await talk(2, 10);
    await talk(3, 20);
    await talk(4, 30);
    await talk(6, null); // consulta de hace seis días que nunca contestó
    // Dos mensajes seguidos de la misma persona (menos de 12 horas) son una sola consulta
    await prisma.message.create({ data: { senderId: buyer.id, receiverId: rtime.id, content: 'sigo esperando', createdAt: new Date(now - 2 * DAY + 5 * MIN) } });
    r = await call('GET', '/users/' + rtime.username);
    const rt = r.j.user.responseTime;
    ok('mediana de lo que tardó en contestar', rt && rt.medianMinutes === 20, JSON.stringify(rt));
    ok('la tasa descuenta lo que no contestó y los seguidos no cuentan doble', rt && rt.sample === 4 && rt.answeredRate === 0.75, JSON.stringify(rt));
    ok('el tiempo de respuesta no trae mensajes ni personas', rt && Object.keys(rt).sort().join() === 'answeredRate,medianMinutes,sample');
    // Con menos de 3 conversaciones respondidas no se muestra nada
    r = await call('GET', '/users/' + NAMES.jerry);
    ok('sin conversaciones o con pocas → sin tiempo de respuesta', r.j.user.responseTime === null);
    const stats = await import('../core/sellerTrust.js');
    ok('una respuesta tardía (más de 7 días) no cuenta como respuesta', stats.computeResponseStats([1, 2, 3].map((n) => ({ createdAt: new Date(now - 30 * DAY), repliedAt: new Date(now - (30 - 8) * DAY) })), now) === null);

    // ---- Aviso para calificar una compra confirmada
    const { notifyReviewRequest, buildReviewNotice } = await import('../core/reviewNotice.js');
    const msg = buildReviewNotice({ sellerName: 'Ana <b>', folderName: 'Mi "carpeta"', code: 'A1' });
    ok('el aviso escapa los nombres y no inyecta HTML', !msg.html.includes('Ana <b>') && msg.html.includes('Ana &lt;b&gt;'));
    ok('el aviso lleva el asunto, el enlace y la notificación', /Califica tu compra/.test(msg.subject) && msg.text.includes('https://carpetazo.cl') && msg.push.tag === 'review-request');
    await acceptTerms('rbuyer');
    const order = await prisma.order.create({ data: { sellerId: seller.id, buyerName: 'Comprador', buyerId: buyer.id, folderId: fx.folderId, folderName: 'TEST fixtures', items: [], total: 1000, status: 'completed' } });
    let result = await notifyReviewRequest(order);
    ok('el comprador con cuenta recibe el aviso por correo', result.email === true, JSON.stringify(result));
    result = await notifyReviewRequest({ ...order, buyerId: null });
    ok('un pedido sin cuenta de comprador no envía nada', result.email === false && result.push === 0);
    result = await notifyReviewRequest({ ...order, buyerId: seller.id });
    ok('el vendedor no recibe aviso de su propio pedido', result.email === false);
    await prisma.sellerReview.create({ data: { sellerId: seller.id, reviewerId: buyer.id, orderId: order.id, rating: 5 } });
    result = await notifyReviewRequest(order);
    ok('quien ya calificó a ese vendedor no recibe el aviso otra vez', result.email === false);
    await prisma.sellerReview.deleteMany({ where: { orderId: order.id } });

    // La confirmación del vendedor sigue funcionando con el aviso en segundo plano
    const pending = await prisma.order.create({ data: { sellerId: seller.id, buyerName: 'Comprador', buyerId: buyer.id, folderId: fx.folderId, folderName: 'TEST fixtures', items: [], total: 1000, status: 'pending' } });
    r = await call('POST', '/orders/mine/' + pending.id + '/status', 'seller', { status: 'completed' });
    ok('confirmar una venta responde 200 y queda completada', r.status === 200 && (await prisma.order.findUnique({ where: { id: pending.id } })).status === 'completed', String(r.status));
    r = await call('POST', '/orders/mine/' + pending.id + '/status', 'seller', { status: 'completed' });
    ok('confirmar dos veces → 409 (el aviso no se repite)', r.status === 409, String(r.status));
    await prisma.order.deleteMany({ where: { id: { in: [order.id, pending.id] } } });
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
