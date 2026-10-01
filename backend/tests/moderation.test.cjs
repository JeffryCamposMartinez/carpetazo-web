// Reportes y moderación (Fase A): validación, propiedad, límites, panel solo para administradores, decisiones y efectos públicos.
const crypto = require('crypto');
const { prisma, NAMES, call, ok, fixtures, acceptTerms } = require('./fixtures.cjs');

const uid = (who) => 'cztest-' + who;
const idOf = async (who) => (await prisma.user.findUnique({ where: { firebaseUid: uid(who) }, select: { id: true } })).id;
const randomUuid = () => crypto.randomUUID();
const DAY = 24 * 60 * 60 * 1000;

(async () => {
  try {
    const { folderId, cardId } = fixtures();
    const sellerId = await idOf('seller');
    // "jerry" y "ale" son cuentas con más de un día (cuentan para medidas automáticas); "ignacio" queda como cuenta recién creada
    await prisma.user.updateMany({ where: { firebaseUid: { in: [uid('jerry'), uid('ale')] } }, data: { createdAt: new Date(Date.now() - 3 * DAY) } });

    // --- Catálogo y validación ---
    ok('catálogo sin sesión → 401', (await call('GET', '/reports/reasons?targetType=folder')).status === 401);
    let r = await call('GET', '/reports/reasons?targetType=folder', 'jerry');
    ok('catálogo de carpeta → razones sin lógica interna', r.status === 200 && r.j.reasons.length >= 5 && r.j.reasons.every((x) => x.code && x.label && !('severity' in x) && !('autoHide' in x)));
    ok('catálogo con tipo inválido → 400', (await call('GET', '/reports/reasons?targetType=order', 'jerry')).status === 400);

    const base = { targetType: 'folder', targetId: folderId, reasonCode: 'folder.spam' };
    ok('reportar sin sesión → 401', (await call('POST', '/reports', null, base)).status === 401);
    ok('tipo inválido → 400', (await call('POST', '/reports', 'jerry', { ...base, targetType: 'hack' })).status === 400);
    ok('razón de otro tipo → 400', (await call('POST', '/reports', 'jerry', { ...base, reasonCode: 'card.counterfeit' })).status === 400);
    ok('razón inexistente → 400', (await call('POST', '/reports', 'jerry', { ...base, reasonCode: 'folder.inventada' })).status === 400);
    ok('id que no es UUID → 404', (await call('POST', '/reports', 'jerry', { ...base, targetId: 'abc' })).status === 404);
    ok('id inexistente → 404', (await call('POST', '/reports', 'jerry', { ...base, targetId: randomUuid() })).status === 404);
    ok('"Otro" sin comentario → 400', (await call('POST', '/reports', 'jerry', { ...base, reasonCode: 'folder.other' })).status === 400);
    ok('"Otro" con comentario muy corto → 400', (await call('POST', '/reports', 'jerry', { ...base, reasonCode: 'folder.other', comment: 'malo' })).status === 400);
    ok('comentario con caracteres de control → 400', (await call('POST', '/reports', 'jerry', { ...base, comment: 'hola\u0000mundo' })).status === 400);
    ok('comentario que no es texto → 400', (await call('POST', '/reports', 'jerry', { ...base, comment: { a: 1 } })).status === 400);
    ok('campo extra obligatorio ausente → 400', (await call('POST', '/reports', 'jerry', { targetType: 'profile_text', targetId: sellerId, reasonCode: 'profile_text.offensive' })).status === 400);
    ok('reportar tu propia carpeta → 400', (await call('POST', '/reports', 'seller', base)).status === 400);
    ok('reportar tu propia cuenta → 400', (await call('POST', '/reports', 'seller', { targetType: 'user', targetId: sellerId, reasonCode: 'user.spam' })).status === 400);

    // --- Reportar una carpeta ---
    r = await call('POST', '/reports', 'jerry', { ...base, comment: 'Carpeta repetida para inflar visitas' });
    ok('reporte válido → 201 con código de seguimiento', r.status === 201 && /^RP-[A-Z0-9]{5}$/.test(r.j.shortCode) && r.j.hidden === false, JSON.stringify(r.j));
    ok('la respuesta no trae nada más que el código', Object.keys(r.j).sort().join() === 'hidden,shortCode,success');
    ok('el mismo reporte dos veces → 409', (await call('POST', '/reports', 'jerry', base)).status === 409);
    r = await call('GET', '/reports/mine', 'jerry');
    ok('"Mis reportes": estado simplificado y sin datos de terceros', r.status === 200 && r.j.reports.length === 1 && r.j.reports[0].status === 'received' && !('targetId' in r.j.reports[0]) && !JSON.stringify(r.j).includes(NAMES.seller));
    ok('"Mis reportes" no muestra reportes ajenos', (await call('GET', '/reports/mine', 'ignacio')).j.reports.length === 0);
    r = await call('GET', '/folders/' + folderId);
    ok('un solo reporte S4 no oculta la carpeta', r.status === 200 && r.j.folder.isPublic === true);
    ok('el visitante no ve el estado de moderación (carpeta ni cartas)', r.status === 200 && !('moderationState' in r.j.folder) && r.j.folder.cards.every((card) => !('moderationState' in card)));

    // --- Panel: solo administradores ---
    ok('cola sin sesión → 401', (await call('GET', '/admin/reports')).status === 401);
    ok('cola siendo usuario común → 403', (await call('GET', '/admin/reports', 'jerry')).status === 403);
    r = await call('GET', '/admin/reports', 'admin');
    const mine = r.j.reports?.find((x) => x.targetId === folderId);
    ok('el administrador ve la cola con el reporte', r.status === 200 && Boolean(mine) && mine.status === 'open' && mine.severity === 'S4' && mine.owner?.username === NAMES.seller, JSON.stringify(r.j).slice(0, 200));
    ok('la cola no expone correos ni identificadores de Firebase', !/@|firebaseUid|cztest-/.test(JSON.stringify(r.j.reports.map((x) => ({ ...x, id: undefined, targetId: undefined })))));
    ok('filtro por gravedad', (await call('GET', '/admin/reports?severity=S1', 'admin')).j.reports.every((x) => x.severity === 'S1'));
    ok('búsqueda por código', (await call('GET', '/admin/reports?q=' + mine.shortCode, 'admin')).j.reports.some((x) => x.id === mine.id));
    r = await call('GET', '/admin/reports/' + mine.id, 'admin');
    ok('detalle con instantánea, quien reportó y acciones permitidas', r.status === 200 && r.j.report.snapshot.name === 'TEST fixtures' && r.j.report.reporter?.username === NAMES.jerry && r.j.report.allowedActions.includes('hide'));
    ok('detalle siendo usuario común → 403', (await call('GET', '/admin/reports/' + mine.id, 'jerry')).status === 403);
    ok('detalle de id inexistente → 404', (await call('GET', '/admin/reports/' + randomUuid(), 'admin')).status === 404);

    // --- Decisiones ---
    ok('decidir siendo usuario común → 403', (await call('POST', `/admin/reports/${mine.id}/decision`, 'jerry', { action: 'hide', note: 'prueba prueba' })).status === 403);
    ok('acción inválida → 400', (await call('POST', `/admin/reports/${mine.id}/decision`, 'admin', { action: 'borrar', note: 'prueba prueba' })).status === 400);
    ok('ocultar sin motivo → 400', (await call('POST', `/admin/reports/${mine.id}/decision`, 'admin', { action: 'hide' })).status === 400);
    ok('nota que no es texto → 400', (await call('POST', `/admin/reports/${mine.id}/decision`, 'admin', { action: 'hide', note: ['x'] })).status === 400);
    r = await call('POST', `/admin/reports/${mine.id}/decision`, 'admin', { action: 'hide', note: 'Carpeta duplicada confirmada' });
    ok('ocultar la carpeta → 200', r.status === 200 && r.j.affected === 1, JSON.stringify(r.j));
    ok('la carpeta ya no es pública', (await call('GET', '/folders/' + folderId)).status === 404);
    r = await call('GET', '/folders/me', 'seller');
    const own = r.j.folders.find((x) => x.id === folderId);
    ok('el dueño ve su carpeta oculta con el estado', own?.moderationState === 'hidden' && own.isPublic === false);
    ok('el dueño no puede volver a publicarla → 403', (await call('PUT', '/folders/' + folderId, 'seller', { isPublic: true })).status === 403);
    ok('decidir dos veces → 409', (await call('POST', `/admin/reports/${mine.id}/decision`, 'admin', { action: 'hide', note: 'otra vez otra vez' })).status === 409);
    ok('"Mis reportes" pasa a resuelto', (await call('GET', '/reports/mine', 'jerry')).j.reports[0].status === 'resolved');
    r = await call('POST', `/admin/reports/${mine.id}/decision`, 'admin', { action: 'restore', note: 'Era un error de revisión' });
    ok('restaurar → 200', r.status === 200);
    ok('la carpeta vuelve a ser pública', (await call('GET', '/folders/' + folderId)).status === 200);
    ok('el dueño ve el estado visible', (await call('GET', '/folders/me', 'seller')).j.folders.find((x) => x.id === folderId).moderationState === 'visible');
    r = await call('POST', `/admin/reports/${mine.id}/note`, 'admin', { note: 'Nota interna de prueba' });
    ok('nota interna → 200', r.status === 200);
    ok('nota vacía → 400', (await call('POST', `/admin/reports/${mine.id}/note`, 'admin', { note: ' ' })).status === 400);
    r = await call('GET', '/admin/reports/' + mine.id, 'admin');
    ok('la línea de tiempo registra decisiones y nota', ['decision.hide', 'decision.restore', 'note'].every((a) => r.j.timeline.some((x) => x.action === a)));

    // --- Carta: ocultar y quitar ---
    r = await call('POST', '/reports', 'jerry', { targetType: 'card', targetId: cardId, reasonCode: 'card.price_abuse', comment: 'Precio engañoso' });
    const cardReport = (await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } })).id;
    await call('POST', `/admin/reports/${cardReport}/decision`, 'admin', { action: 'hide', note: 'Precio engañoso confirmado' });
    r = await call('GET', '/folders/' + folderId);
    ok('la carta oculta desaparece de la carpeta pública', r.status === 200 && !r.j.folder.cards.some((c) => c.id === cardId));
    ok('el dueño no puede editar la carta oculta → 403', (await call('PUT', `/folders/${folderId}/cards/${cardId}`, 'seller', { price: 1 })).status === 403);
    await call('POST', `/admin/reports/${cardReport}/decision`, 'admin', { action: 'restore', note: 'Restaurada para continuar' });
    ok('la carta restaurada vuelve a verse', (await call('GET', '/folders/' + folderId)).j.folder.cards.some((c) => c.id === cardId));

    // --- Foto de perfil: ocultar sola con S1 y restaurar ---
    const photo = 'https://pub-cztest.r2.dev/cztest-foto.png';
    await prisma.user.update({ where: { id: sellerId }, data: { photoURL: photo } });
    r = await call('POST', '/reports', 'ignacio', { targetType: 'profile_image', targetId: sellerId, reasonCode: 'profile_image.sexual_explicit' });
    ok('cuenta recién creada reporta S1: queda en cola pero NO se oculta sola', r.status === 201 && r.j.hidden === false && (await prisma.user.findUnique({ where: { id: sellerId } })).photoURL === photo);
    r = await call('POST', '/reports', 'jerry', { targetType: 'profile_image', targetId: sellerId, reasonCode: 'profile_image.minor_risk' });
    ok('cuenta con más de un día reporta S1: se oculta al instante', r.status === 201 && r.j.hidden === true, JSON.stringify(r.j));
    const afterHide = await prisma.user.findUnique({ where: { id: sellerId }, select: { photoURL: true, moderationHidden: true } });
    ok('la foto quedó retirada y marcada', afterHide.photoURL === null && afterHide.moderationHidden.includes('photo'));
    ok('el perfil público ya no trae la foto', (await call('GET', '/users/' + NAMES.seller)).j.user?.photoURL === null);
    ok('el dueño no puede volver a subir la misma foto → 403', (await call('PUT', '/users/me', 'seller', { photoURL: photo })).status === 403);
    const imgReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
    ok('hay auditoría de la medida automática', (await prisma.moderationAudit.count({ where: { reportId: imgReport.id, action: 'auto.hide' } })) === 1);
    r = await call('POST', `/admin/reports/${imgReport.id}/decision`, 'admin', { action: 'restore', note: 'Falsa alarma comprobada' });
    ok('restaurar la foto → 200 y vuelve', r.status === 200 && (await prisma.user.findUnique({ where: { id: sellerId } })).photoURL === photo);
    const imgState = await prisma.user.findUnique({ where: { id: sellerId }, select: { moderationHidden: true } });
    ok('al restaurar se limpia el aviso', !imgState.moderationHidden.includes('photo'));

    // --- Reseña ---
    await call('POST', '/users/sync', 'modrev', { displayName: 'Revisor Prueba', username: 'cztest_modrev' });
    await acceptTerms('modrev');
    const review = await prisma.sellerReview.create({ data: { sellerId, reviewerId: await idOf('modrev'), orderId: randomUuid(), rating: 1, comment: 'comentario de prueba' } });
    ok('el autor no puede reportar su propia reseña → 400', (await call('POST', '/reports', 'modrev', { targetType: 'review', targetId: review.id, reasonCode: 'review.spam' })).status === 400);
    r = await call('POST', '/reports', 'ale', { targetType: 'review', targetId: review.id, reasonCode: 'review.offensive' });
    ok('reportar una reseña → 201', r.status === 201);
    const reviewReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
    await call('POST', `/admin/reports/${reviewReport.id}/decision`, 'admin', { action: 'hide', note: 'Lenguaje ofensivo confirmado' });
    ok('la reseña oculta deja de contar', (await prisma.sellerReview.findUnique({ where: { id: review.id } })).counts === false);
    await call('POST', `/admin/reports/${reviewReport.id}/decision`, 'admin', { action: 'restore', note: 'Restaurada tras revisar' });
    ok('la reseña restaurada vuelve a contar', (await prisma.sellerReview.findUnique({ where: { id: review.id } })).counts === true);
    await prisma.sellerReview.delete({ where: { id: review.id } });

    // --- Mensajes: solo el receptor reporta; moderación ve la instantánea ---
    r = await call('POST', '/messages/' + NAMES.seller, 'jerry', { content: 'mensaje de prueba para reportar' });
    const messageId = r.j?.message?.id;
    ok('mensaje de prueba enviado', Boolean(messageId));
    ok('el autor del mensaje no puede reportarlo → 404', (await call('POST', '/reports', 'jerry', { targetType: 'message', targetId: messageId, reasonCode: 'message.spam' })).status === 404);
    ok('un tercero no puede reportar el mensaje → 404', (await call('POST', '/reports', 'ale', { targetType: 'message', targetId: messageId, reasonCode: 'message.spam' })).status === 404);
    ok('un mensaje de texto no se reporta como imagen → 400', (await call('POST', '/reports', 'seller', { targetType: 'message_image', targetId: messageId, reasonCode: 'message_image.spam_ad' })).status === 400);
    r = await call('POST', '/reports', 'seller', { targetType: 'message', targetId: messageId, reasonCode: 'message.spam' });
    ok('el receptor reporta el mensaje → 201', r.status === 201);
    const messageReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
    ok('la instantánea guarda la conversación y marca el mensaje', messageReport.snapshot.messages.some((m) => m.reported && m.from === 'reported'));
    await call('POST', `/admin/reports/${messageReport.id}/decision`, 'admin', { action: 'hide', note: 'Spam confirmado en chat' });
    r = await call('GET', '/messages/' + NAMES.jerry, 'seller');
    const seen = r.j.messages.find((m) => m.id === messageId);
    ok('el receptor ve el mensaje oculto con aviso', seen?.hidden === true && !seen.content.includes('prueba') && !('moderationState' in seen));
    r = await call('GET', '/messages/' + NAMES.seller, 'jerry');
    ok('el autor sigue viendo su mensaje', r.j.messages.find((m) => m.id === messageId).content.includes('prueba'));
    await call('POST', `/admin/reports/${messageReport.id}/decision`, 'admin', { action: 'restore', note: 'Restaurado tras revisar' });

    // --- Lista de deseos ---
    r = await call('POST', '/wishlist', 'ignacio', { name: 'Carta deseada de prueba', note: 'nota de prueba' });
    const wishId = r.j?.item?.id || r.j?.wishlistItem?.id;
    if (wishId) {
      r = await call('POST', '/reports', 'jerry', { targetType: 'wishlist_item', targetId: wishId, reasonCode: 'wishlist_item.offensive' });
      const wishReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
      await call('POST', `/admin/reports/${wishReport.id}/decision`, 'admin', { action: 'hide', note: 'Nota ofensiva confirmada' });
      r = await call('GET', '/users/' + NAMES.ignacio + '/wishlist');
      ok('la carta deseada oculta no aparece en la lista pública', !(r.j.items || []).some((x) => x.id === wishId));
    } else ok('crear carta deseada de prueba', false, JSON.stringify(r.j).slice(0, 120));

    // --- Cuentas: solo descartar ---
    r = await call('POST', '/reports', 'jerry', { targetType: 'user', targetId: sellerId, reasonCode: 'user.spam' });
    const userReport = await prisma.report.findFirst({ where: { shortCode: r.j.shortCode } });
    ok('sobre una cuenta no se puede ocultar todavía → 400', (await call('POST', `/admin/reports/${userReport.id}/decision`, 'admin', { action: 'hide', note: 'prueba de cuenta' })).status === 400);
    ok('sobre una cuenta sí se puede descartar → 200', (await call('POST', `/admin/reports/${userReport.id}/decision`, 'admin', { action: 'dismiss' })).status === 200);

    // --- Límite de reportes por persona ---
    const aleId = await idOf('ale');
    await prisma.report.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ shortCode: 'RP-ZZ' + String(index).padStart(3, '0'), targetType: 'folder', targetId: randomUuid(), reasonCode: 'folder.spam', severity: 'S4', reporterId: aleId, snapshot: {} })) });
    r = await call('POST', '/reports', 'ale', { targetType: 'folder', targetId: folderId, reasonCode: 'folder.illegal' });
    ok('más de 20 reportes en una hora → 429', r.status === 429, String(r.status));

    // --- Auditoría ---
    ok('auditoría sin permiso → 403', (await call('GET', '/admin/audit', 'jerry')).status === 403);
    r = await call('GET', '/admin/audit', 'admin');
    ok('auditoría del administrador con acciones', r.status === 200 && r.j.entries.some((x) => x.action === 'decision.hide') && r.j.entries.every((x) => !('actorId' in x) || x.actorId === undefined));
  } finally {
    await prisma.$disconnect();
  }
})();
