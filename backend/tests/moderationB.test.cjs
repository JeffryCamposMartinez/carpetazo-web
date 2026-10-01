// Moderación, Fase B: roles del equipo, sanciones, apelaciones, bloqueo, reportes de pedido con casos de estafa y evidencias.
const crypto = require('crypto');
const sharp = require('sharp');
const { prisma, NAMES, B, U, call, ok, fixtures, acceptTerms } = require('./fixtures.cjs');

const uid = (who) => 'cztest-' + who;
const idOf = async (who) => (await prisma.user.findUnique({ where: { firebaseUid: uid(who) }, select: { id: true } })).id;
const DAY = 24 * 60 * 60 * 1000;

const upload = async (who, reportId, buffer, name = 'a.png', type = 'image/png') => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type }), name);
  const r = await fetch(B + '/reports/' + reportId + '/evidence', { method: 'POST', headers: { Authorization: 'Bearer test-' + U[who] }, body: form });
  let j = null;
  try { j = await r.json(); } catch (_) { /* sin JSON */ }
  return { status: r.status, j };
};

(async () => {
  try {
    const { folderId, cardId } = fixtures();
    const sellerId = await idOf('seller');
    await prisma.user.updateMany({ where: { firebaseUid: { in: ['jerry', 'ale', 'jeffry'].map(uid) } }, data: { createdAt: new Date(Date.now() - 3 * DAY) } });

    // --- Roles del equipo ---
    ok('cambiar rol siendo usuario común → 403', (await call('POST', `/admin/users/${NAMES.ignacio}/role`, 'jerry', { role: 'moderator' })).status === 403);
    ok('rol inválido → 400', (await call('POST', `/admin/users/${NAMES.ignacio}/role`, 'admin', { role: 'dios' })).status === 400);
    ok('no se cambia el rol de un administrador → 403', (await call('POST', `/admin/users/${NAMES.admin}/role`, 'admin', { role: 'user' })).status === 403);
    ok('usuario inexistente → 404', (await call('POST', '/admin/users/no_existe_xyz/role', 'admin', { role: 'support' })).status === 404);
    ok('hacer moderador a un usuario → 200', (await call('POST', `/admin/users/${NAMES.ignacio}/role`, 'admin', { role: 'moderator' })).status === 200);
    ok('hacer soporte a un usuario → 200', (await call('POST', `/admin/users/${NAMES.jeffry}/role`, 'admin', { role: 'support' })).status === 200);
    let r = await call('GET', '/admin/me', 'ignacio');
    ok('el moderador entra al panel pero no es administrador', r.status === 200 && r.j.isStaff === true && r.j.isAdmin === false && r.j.level === 2);
    ok('un usuario común no entra al panel → 403', (await call('GET', '/admin/me', 'jerry')).status === 403);
    ok('soporte puede leer la cola', (await call('GET', '/admin/reports', 'jeffry')).status === 200);
    ok('la auditoría completa es solo de administradores', (await call('GET', '/admin/audit', 'ignacio')).status === 403);
    ok('soporte no puede decidir → 403', (await call('POST', `/admin/reports/${randomId()}/decision`, 'jeffry', { action: 'dismiss' })).status === 403);

    // --- Sanciones ---
    const warn = { type: 'warning', reason: 'Publicaste una carpeta duplicada' };
    ok('sin sesión → 401', (await call('POST', `/admin/users/${NAMES.ale}/sanctions`, null, warn)).status === 401);
    ok('usuario común no sanciona → 403', (await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'jerry', warn)).status === 403);
    ok('soporte no sanciona → 403', (await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'jeffry', warn)).status === 403);
    ok('tipo inválido → 400', (await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'ignacio', { ...warn, type: 'explotar' })).status === 400);
    ok('motivo muy corto → 400', (await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'ignacio', { type: 'warning', reason: 'x' })).status === 400);
    ok('duración inválida → 400', (await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'ignacio', { type: 'suspend', reason: 'motivo de prueba', durationDays: 0 })).status === 400);
    ok('no se sanciona a un integrante del equipo → 403', (await call('POST', `/admin/users/${NAMES.admin}/sanctions`, 'ignacio', warn)).status === 403);
    ok('nadie se sanciona a sí mismo → 400', (await call('POST', `/admin/users/${NAMES.ignacio}/sanctions`, 'ignacio', warn)).status === 400);
    r = await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'ignacio', warn);
    ok('el moderador advierte → 201', r.status === 201 && r.j.status === 'active');
    r = await call('GET', '/me/moderation', 'ale');
    ok('la persona ve su advertencia y no puede apelarla', r.status === 200 && r.j.sanctions.some((x) => x.type === 'warning' && x.canAppeal === false));
    ok('una advertencia no bloquea nada (puede escribir)', (await call('PUT', '/users/me', 'ale', { bio: 'sigo activa' })).status === 200);

    ok('suspender ventas sin duración (moderador) → 400', (await call('POST', `/admin/users/${NAMES.seller}/sanctions`, 'ignacio', { type: 'suspend_selling', reason: 'Reportes de compradores' })).status === 400);
    ok('suspender ventas por más de 30 días (moderador) → 400', (await call('POST', `/admin/users/${NAMES.seller}/sanctions`, 'ignacio', { type: 'suspend_selling', reason: 'Reportes de compradores', durationDays: 90 })).status === 400);
    ok('el moderador no puede cerrar una cuenta → 403', (await call('POST', `/admin/users/${NAMES.seller}/sanctions`, 'ignacio', { type: 'ban', reason: 'motivo de prueba' })).status === 403);
    r = await call('POST', `/admin/users/${NAMES.seller}/sanctions`, 'ignacio', { type: 'suspend_selling', reason: 'Reportes de compradores', durationDays: 7 });
    ok('suspender ventas por 7 días → 201', r.status === 201);
    const sellingSanction = r.j.sanctionId;
    ok('la carpeta del vendedor deja de ser pública', (await call('GET', '/folders/' + folderId)).status === 404);
    ok('el vendedor no puede crear cartas → 403 selling_suspended', (await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'x', name: 'x', price: 1, stock: 1 })).j?.code === 'selling_suspended');
    ok('el vendedor sigue pudiendo leer y editar su perfil', (await call('PUT', '/users/me', 'seller', { bio: 'sigo aquí' })).status === 200);
    ok('el vendedor no puede volver a publicar su carpeta → 403', (await call('PUT', '/folders/' + folderId, 'seller', { isPublic: true })).status === 403);
    ok('el moderador no revoca (solo administradores) → 403', (await call('POST', `/admin/sanctions/${sellingSanction}/revoke`, 'ignacio', { note: 'prueba de revocar' })).status === 403);

    // Apelación de la sanción
    r = await call('GET', '/me/moderation', 'seller');
    ok('el vendedor ve la medida y puede apelarla', r.j.sanctions.some((x) => x.id === sellingSanction && x.canAppeal === true) && r.j.restrictions.includes('suspend_selling'));
    ok('apelar sin texto suficiente → 400', (await call('POST', '/appeals', 'seller', { sanctionId: sellingSanction, text: 'no' })).status === 400);
    ok('apelar una medida ajena → 404', (await call('POST', '/appeals', 'jerry', { sanctionId: sellingSanction, text: 'Esta apelación no me corresponde para nada' })).status === 404);
    ok('apelar sin indicar qué → 400', (await call('POST', '/appeals', 'seller', { text: 'Texto suficientemente largo para apelar' })).status === 400);
    r = await call('POST', '/appeals', 'seller', { sanctionId: sellingSanction, text: 'Los reportes son falsos, tengo todos los comprobantes' });
    ok('apelar → 201', r.status === 201);
    ok('apelar dos veces lo mismo → 409', (await call('POST', '/appeals', 'seller', { sanctionId: sellingSanction, text: 'Los reportes son falsos, tengo todos los comprobantes' })).status === 409);
    r = await call('GET', '/admin/appeals', 'ignacio');
    const appeal = r.j.appeals?.find((x) => x.user?.username === NAMES.seller);
    ok('el equipo ve la apelación', r.status === 200 && Boolean(appeal) && appeal.sanction.type === 'suspend_selling');
    ok('el moderador no decide apelaciones → 403', (await call('POST', `/admin/appeals/${appeal.id}/decision`, 'ignacio', { action: 'accept', note: 'prueba de decidir' })).status === 403);
    ok('decisión sin motivo → 400', (await call('POST', `/admin/appeals/${appeal.id}/decision`, 'admin', { action: 'accept' })).status === 400);
    r = await call('POST', `/admin/appeals/${appeal.id}/decision`, 'admin', { action: 'accept', note: 'Comprobantes verificados, se levanta la medida' });
    ok('el administrador acepta la apelación → 200', r.status === 200);
    ok('al aceptar, la carpeta vuelve a ser pública', (await call('GET', '/folders/' + folderId)).status === 200);
    ok('al aceptar, el vendedor puede escribir cartas otra vez', (await call('POST', '/folders/' + folderId + '/cards', 'seller', { tcgId: 'tst-extra', name: 'carta extra', price: 100, stock: 1, data: {} })).status !== 403);
    ok('decidir una apelación ya decidida → 409', (await call('POST', `/admin/appeals/${appeal.id}/decision`, 'admin', { action: 'reject', note: 'otra vez otra vez' })).status === 409);

    // Cierre de cuenta: dos administradores
    r = await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'admin', { type: 'ban', reason: 'Estafas comprobadas con varias víctimas' });
    ok('el administrador pide cerrar una cuenta → queda pendiente de aprobación', r.status === 201 && r.j.status === 'pending_approval');
    const banId = r.j.sanctionId;
    ok('mientras está pendiente, la persona puede escribir', (await call('PUT', '/users/me', 'ale', { bio: 'aún activa' })).status === 200);
    ok('el mismo administrador no puede aprobar → 403', (await call('POST', `/admin/sanctions/${banId}/approve`, 'admin', {})).status === 403);
    ok('un moderador no aprueba → 403', (await call('POST', `/admin/sanctions/${banId}/approve`, 'ignacio', {})).status === 403);
    await prisma.user.update({ where: { id: await idOf('ignacio') }, data: { role: 'admin' } });
    ok('otro administrador aprueba → 200', (await call('POST', `/admin/sanctions/${banId}/approve`, 'ignacio', {})).status === 200);
    ok('aprobar de nuevo → 409', (await call('POST', `/admin/sanctions/${banId}/approve`, 'ignacio', {})).status === 409);
    r = await call('PUT', '/users/me', 'ale', { bio: 'ya cerrada' });
    ok('cuenta cerrada: no puede escribir → 403 account_suspended', r.status === 403 && r.j.code === 'account_suspended');
    ok('cuenta cerrada: puede leer', (await call('GET', '/users/me', 'ale')).status === 200);
    ok('cuenta cerrada: su perfil público ya no existe → 404', (await call('GET', '/users/' + NAMES.ale)).status === 404);
    r = await call('POST', '/appeals', 'ale', { sanctionId: banId, text: 'No hubo estafas, pido que revisen mis pedidos' });
    ok('cuenta cerrada: sí puede apelar', r.status === 201);
    ok('el administrador que pidió el cierre no decide solo la apelación si hay otro administrador → 403', (await call('POST', `/admin/appeals/${(await call('GET', '/admin/appeals', 'admin')).j.appeals.find((x) => x.user?.username === NAMES.ale).id}/decision`, 'admin', { action: 'reject', note: 'No corresponde a mí decidir' })).status === 403);
    r = await call('GET', '/admin/appeals', 'ignacio');
    ok('otro administrador rechaza la apelación → 200', (await call('POST', `/admin/appeals/${r.j.appeals.find((x) => x.user?.username === NAMES.ale).id}/decision`, 'ignacio', { action: 'reject', note: 'Los pedidos confirman las estafas' })).status === 200);
    r = await call('POST', `/admin/sanctions/${banId}/revoke`, 'admin', { note: 'Cierre revertido en la prueba' });
    ok('el administrador levanta el cierre → 200', r.status === 200);
    ok('cuenta restituida: puede escribir', (await call('PUT', '/users/me', 'ale', { bio: 'de vuelta' })).status === 200);
    ok('levantar dos veces → 409', (await call('POST', `/admin/sanctions/${banId}/revoke`, 'admin', { note: 'otra vez otra vez' })).status === 409);
    ok('ficha de moderación de la persona (soporte)', (await call('GET', `/admin/users/${NAMES.ale}/moderation`, 'jeffry')).j?.sanctions?.length >= 2);
    ok('la ficha no expone correo, RUT ni banco', !/@|rut|bank|email/i.test(JSON.stringify((await call('GET', `/admin/users/${NAMES.ale}/moderation`, 'jeffry')).j)));
    await prisma.user.update({ where: { id: await idOf('ignacio') }, data: { role: 'moderator' } });

    // Medida vencida: no cuenta
    await prisma.sanction.create({ data: { userId: await idOf('ale'), type: 'restrict_messages', reason: 'Prueba de vencimiento', expiresAt: new Date(Date.now() - 1000) } });
    r = await call('POST', '/messages/' + NAMES.jerry, 'ale', { content: 'mensaje con medida vencida' });
    ok('una restricción vencida ya no bloquea los mensajes', r.status === 200, String(r.status));
    r = await call('POST', `/admin/users/${NAMES.ale}/sanctions`, 'ignacio', { type: 'restrict_messages', reason: 'Prueba de restricción vigente', durationDays: 1 });
    ok('restringir mensajes por 1 día → 201', r.status === 201);
    const restrictId = r.j.sanctionId;
    r = await call('POST', '/messages/' + NAMES.jerry, 'ale', { content: 'mensaje con restricción' });
    ok('una restricción de mensajes vigente bloquea escribir → 403 messages_restricted', r.status === 403 && r.j.code === 'messages_restricted', JSON.stringify(r.j));
    ok('con mensajes restringidos igual puede editar su perfil', (await call('PUT', '/users/me', 'ale', { bio: 'solo sin mensajes' })).status === 200);
    ok('el administrador levanta la restricción → 200', (await call('POST', `/admin/sanctions/${restrictId}/revoke`, 'admin', { note: 'Fin de la prueba de restricción' })).status === 200);

    // --- Bloqueo entre usuarios ---
    const aleId = await idOf('ale');
    const jerryId = await idOf('jerry');
    ok('bloquear sin sesión → 401', (await call('POST', '/blocks', null, { userId: jerryId })).status === 401);
    ok('bloquearse a sí mismo → 400', (await call('POST', '/blocks', 'ale', { userId: aleId })).status === 400);
    ok('bloquear a un usuario inexistente → 404', (await call('POST', '/blocks', 'ale', { userId: crypto.randomUUID() })).status === 404);
    ok('bloquear con id inválido → 404', (await call('POST', '/blocks', 'ale', { userId: 'abc' })).status === 404);
    ok('bloquear → 201', (await call('POST', '/blocks', 'ale', { userId: jerryId })).status === 201);
    ok('bloquear de nuevo es inofensivo', (await call('POST', '/blocks', 'ale', { userId: jerryId })).status === 201);
    r = await call('POST', '/messages/' + NAMES.ale, 'jerry', { content: 'hola, ¿me escuchas?' });
    ok('quien fue bloqueado no puede escribir → 403 blocked', r.status === 403 && r.j.code === 'blocked');
    r = await call('POST', '/messages/' + NAMES.jerry, 'ale', { content: 'hola' });
    ok('quien bloqueó tampoco escribe hasta desbloquear → 403', r.status === 403 && /Desbloquéala/.test(r.j.message));
    ok('la lista de bloqueados es solo la propia', (await call('GET', '/blocks', 'ale')).j.blocks.length === 1 && (await call('GET', '/blocks', 'jerry')).j.blocks.length === 0);
    ok('desbloquear → 200', (await call('DELETE', '/blocks/' + jerryId, 'ale')).status === 200);
    ok('desbloqueada, ya puede escribirse', (await call('POST', '/messages/' + NAMES.ale, 'jerry', { content: 'ya me desbloqueaste' })).status === 200);

    // --- Reportes de pedido y casos de estafa ---
    for (const who of ['buy1', 'buy2', 'buy3']) {
      await call('POST', '/users/sync', who, { displayName: 'Comprador ' + who, username: 'cztest_' + who });
      await acceptTerms(who);
      await prisma.user.updateMany({ where: { firebaseUid: uid(who) }, data: { createdAt: new Date(Date.now() - 3 * DAY) } });
    }
    const orderFor = async (who, status = 'completed') => prisma.order.create({ data: { code: 'T' + crypto.randomBytes(4).toString('hex').toUpperCase(), sellerId, buyerName: who, buyerId: await idOf(who), folderId, folderName: 'TEST fixtures', items: [{ id: cardId, name: 'carta fixture', quantity: 1, price: 1000 }], total: 1000, status } });
    const o1 = await orderFor('buy1');
    const o2 = await orderFor('buy2');
    const o3 = await orderFor('buy3');
    const base = { targetType: 'order', targetId: o1.id, reasonCode: 'order.not_delivered', comment: 'Pagué por transferencia y nunca me enviaron nada', extra: { monto: '$35.000', medioPago: 'transferencia' } };
    ok('razones de pedido: un ajeno no las ve → 404', (await call('GET', `/reports/reasons?targetType=order&targetId=${o1.id}`, 'jerry')).status === 404);
    r = await call('GET', `/reports/reasons?targetType=order&targetId=${o1.id}`, 'buy1');
    ok('razones de pedido para el comprador', r.status === 200 && r.j.reasons.some((x) => x.code === 'order.not_delivered' && x.allowEvidence) && !r.j.reasons.some((x) => x.code === 'order.fake_order'));
    r = await call('GET', `/reports/reasons?targetType=order&targetId=${o1.id}`, 'seller');
    ok('un ajeno no puede reportar el pedido → 404', (await call('POST', '/reports', 'jerry', base)).status === 404);
    ok('el vendedor no puede usar razones de comprador → 400', (await call('POST', '/reports', 'seller', base)).status === 400);
    ok('pedido sin comentario ni monto → 400', (await call('POST', '/reports', 'buy1', { ...base, comment: undefined })).status === 400);
    r = await call('POST', '/reports', 'buy1', { ...base, extra: {} });
    ok('pedido sin monto → 400', r.status === 400, r.status + ' ' + JSON.stringify(r.j));
    r = await call('POST', '/reports', 'buy1', base);
    ok('el comprador reporta que no le llegó el pedido → 201', r.status === 201 && r.j.allowEvidence === true, r.status + ' ' + JSON.stringify(r.j));
    const report1 = r.j.reportId;
    r = await call('GET', '/admin/cases', 'ignacio');
    const fraudCase = r.j.cases?.find((x) => x.subject?.username === NAMES.seller);
    ok('se abrió un caso de estafa contra el vendedor', r.status === 200 && Boolean(fraudCase) && fraudCase.status === 'open' && /^CS-/.test(fraudCase.shortCode) && fraudCase.priority === 'normal');
    ok('el caso no es visible para un usuario común → 403', (await call('GET', '/admin/cases', 'jerry')).status === 403);

    // Evidencias
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ff0000' } }).png().toBuffer();
    r = await upload('buy1', report1, png);
    ok('subir evidencia (imagen válida) → 201', r.status === 201, JSON.stringify(r.j));
    ok('subir un archivo que no es imagen → 400', (await upload('buy1', report1, Buffer.from('esto no es una imagen'), 'a.png', 'image/png')).status === 400);
    ok('quien no reportó no puede subir evidencia → 404', (await upload('buy2', report1, png)).status === 404);
    ok('hasta 3 evidencias', (await upload('buy1', report1, png)).status === 201 && (await upload('buy1', report1, png)).status === 201);
    ok('la cuarta evidencia → 409', (await upload('buy1', report1, png)).status === 409);
    r = await call('GET', '/admin/reports/' + report1, 'ignacio');
    const evidenceId = r.j.report?.evidence?.[0]?.id;
    ok('el moderador ve la lista de evidencias del reporte', r.status === 200 && r.j.report.evidence.length === 3 && r.j.report.reporterRole === 'buyer' && Boolean(evidenceId));
    ok('soporte no ve evidencias ni quién reportó', (await call('GET', '/admin/reports/' + report1, 'jeffry')).j.report.evidence.length === 0 && (await call('GET', '/admin/reports/' + report1, 'jeffry')).j.report.reporter === null);
    const evRes = await fetch(B + '/admin/evidence/' + evidenceId, { headers: { Authorization: 'Bearer test-' + U.ignacio } });
    ok('el moderador descarga la evidencia (JPEG, sin caché)', evRes.status === 200 && evRes.headers.get('content-type') === 'image/jpeg' && /no-store/.test(evRes.headers.get('cache-control')));
    ok('soporte no descarga evidencias → 403', (await fetch(B + '/admin/evidence/' + evidenceId, { headers: { Authorization: 'Bearer test-' + U.jeffry } })).status === 403);
    ok('sin sesión no se descarga evidencia → 401', (await fetch(B + '/admin/evidence/' + evidenceId)).status === 401);
    ok('ver una evidencia queda en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'evidence.viewed', reportId: report1 } })) >= 1);

    // 2.º y 3.er comprador
    await call('POST', '/reports', 'buy2', { ...base, targetId: o2.id });
    r = await call('GET', '/admin/cases', 'ignacio');
    ok('con dos compradores distintos el caso sube a prioridad alta', r.j.cases.find((x) => x.subject?.username === NAMES.seller)?.priority === 'high');
    ok('con dos reportes aún no se pausan las ventas', (await call('GET', '/folders/' + folderId)).status === 200);
    await call('POST', '/reports', 'buy3', { ...base, targetId: o3.id });
    ok('con tres compradores con pedido se pausan las ventas automáticamente', (await call('GET', '/folders/' + folderId)).status === 404);
    r = await call('GET', '/admin/sanctions', 'ignacio');
    ok('la pausa es una medida automática reversible', r.j.sanctions.some((x) => x.user?.username === NAMES.seller && x.type === 'suspend_selling' && x.automatic === true));
    r = await call('GET', '/admin/cases/' + fraudCase.id, 'ignacio');
    ok('detalle del caso con indicadores y reportes', r.status === 200 && r.j.indicators.distinctReporters30d === 3 && r.j.reports.length === 3 && r.j.subject.username === NAMES.seller);

    // Descargo
    ok('un moderador pide el descargo → 200', (await call('POST', `/admin/cases/${fraudCase.id}/request-response`, 'ignacio', {})).status === 200);
    ok('pedir el descargo dos veces → 409', (await call('POST', `/admin/cases/${fraudCase.id}/request-response`, 'ignacio', {})).status === 409);
    ok('soporte no pide descargo → 403', (await call('POST', `/admin/cases/${fraudCase.id}/request-response`, 'jeffry', {})).status === 403);
    r = await call('GET', '/me/moderation', 'seller');
    ok('el vendedor ve el caso y puede responder', r.j.cases.some((x) => x.id === fraudCase.id && x.canRespond === true));
    ok('otra persona no puede responder el caso → 404', (await call('POST', `/me/cases/${fraudCase.id}/response`, 'jerry', { text: 'Respuesta de alguien que no es el vendedor investigado' })).status === 404);
    ok('responder con muy poco texto → 400', (await call('POST', `/me/cases/${fraudCase.id}/response`, 'seller', { text: 'no' })).status === 400);
    ok('el vendedor responde aun con las ventas pausadas → 200', (await call('POST', `/me/cases/${fraudCase.id}/response`, 'seller', { text: 'Todos los pedidos se enviaron; adjunto los comprobantes de envío al correo.' })).status === 200);
    ok('responder dos veces → 404', (await call('POST', `/me/cases/${fraudCase.id}/response`, 'seller', { text: 'Segunda respuesta de prueba para el mismo caso' })).status === 404);
    r = await call('GET', '/admin/cases/' + fraudCase.id, 'ignacio');
    ok('el equipo ve el descargo y el caso queda en revisión', r.j.case.status === 'in_review' && /comprobantes/.test(r.j.case.sellerResponse));

    // Resolver
    ok('resolución inválida → 400', (await call('POST', `/admin/cases/${fraudCase.id}/resolve`, 'ignacio', { resolution: 'fusilar', note: 'motivo de prueba' })).status === 400);
    ok('resolver sin motivo → 400', (await call('POST', `/admin/cases/${fraudCase.id}/resolve`, 'ignacio', { resolution: 'dismissed' })).status === 400);
    ok('el moderador suspende sin duración → 400', (await call('POST', `/admin/cases/${fraudCase.id}/resolve`, 'ignacio', { resolution: 'suspended', note: 'motivo de prueba' })).status === 400);
    ok('soporte no resuelve → 403', (await call('POST', `/admin/cases/${fraudCase.id}/resolve`, 'jeffry', { resolution: 'dismissed', note: 'motivo de prueba' })).status === 403);
    r = await call('POST', `/admin/cases/${fraudCase.id}/resolve`, 'ignacio', { resolution: 'dismissed', note: 'El vendedor probó los envíos con comprobantes' });
    ok('descartar el caso → 200', r.status === 200);
    ok('al descartar, la pausa automática se levanta y la carpeta vuelve', (await call('GET', '/folders/' + folderId)).status === 200);
    ok('resolver dos veces → 409', (await call('POST', `/admin/cases/${fraudCase.id}/resolve`, 'ignacio', { resolution: 'dismissed', note: 'otra vez otra vez' })).status === 409);
    r = await call('GET', '/admin/reports/' + report1, 'ignacio');
    ok('los reportes del caso quedaron descartados', r.j.report.status === 'dismissed');
    ok('los reportes de estafa del comprador no se vuelven a abrir ya resueltos', (await call('GET', '/admin/cases?status=resolved', 'ignacio')).j.cases.some((x) => x.id === fraudCase.id));

    // Un caso nuevo se resuelve con sanción
    const o4 = await orderFor('buy1');
    r = await call('POST', '/reports', 'buy1', { ...base, targetId: o4.id, reasonCode: 'order.not_responding' });
    ok('un nuevo reporte abre otro caso', r.status === 201);
    const second = (await call('GET', '/admin/cases', 'ignacio')).j.cases.find((x) => x.subject?.username === NAMES.seller && x.id !== fraudCase.id);
    ok('el caso nuevo es distinto del resuelto', Boolean(second));
    r = await call('POST', `/admin/cases/${second.id}/resolve`, 'ignacio', { resolution: 'warned', note: 'Primera falta, se advierte', publicMessage: 'Responde siempre a tus compradores' });
    ok('resolver con advertencia → 200', r.status === 200);
    ok('la advertencia quedó registrada', (await call('GET', '/me/moderation', 'seller')).j.sanctions.some((x) => x.type === 'warning' && /Responde siempre/.test(x.reason)));
  } finally {
    await prisma.$disconnect();
  }
})();

function randomId() { return crypto.randomUUID(); }
