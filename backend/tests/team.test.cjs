// Equipo y administradores: jerarquía (propietaria > administrador > moderador > soporte), la propietaria protegida en todos los caminos,
// y las acciones entre administradores (rol, suspender, cerrar, restaurar), con doble confirmación, auditoría e historial.
const { prisma, call, ok, NAMES } = require('./fixtures.cjs');

(async () => {
  const touched = {};
  const user = (who) => prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true, role: true, isOwner: true, photoURL: true, username: true } });
  const roleOf = async (who) => (await prisma.user.findUnique({ where: { id: touched[who].id }, select: { role: true } })).role;
  try {
    for (const who of ['ale', 'jeffry', 'jerry', 'seller']) touched[who] = await user(who);
    await prisma.user.update({ where: { id: touched.ale.id }, data: { photoURL: 'https://lh3.googleusercontent.com/a/cztest-foto', role: 'user' } });
    await prisma.user.update({ where: { id: touched.jeffry.id }, data: { role: 'support' } });
    // "jerry" hace de cuenta propietaria durante la prueba
    await prisma.user.update({ where: { id: touched.jerry.id }, data: { role: 'admin', isOwner: true } });
    const ale = NAMES.ale; const jeffry = NAMES.jeffry; const jerry = NAMES.jerry;
    const id = (who) => touched[who].id;
    const adminId = (await user('admin')).id;

    // ---- Acceso ----
    let r = await call('GET', '/admin/team');
    ok('ver el equipo sin sesión → 401', r.status === 401, String(r.status));
    for (const [method, path] of [['GET', '/admin/team'], ['GET', '/admin/team/search?q=cztest'], ['GET', '/admin/team/history']]) {
      r = await call(method, path, 'seller');
      ok(`${path.split('?')[0]} sin ser del equipo → 403`, r.status === 403, String(r.status));
    }
    r = await call('GET', '/admin/team', 'jeffry');
    ok('el personal de soporte no entra a la gestión del equipo → 403', r.status === 403, String(r.status));

    // ---- Jerarquía ----
    r = await call('GET', '/admin/team', 'admin');
    const team = r.j.team || [];
    const owner = team.find((member) => member.username === jerry);
    ok('la lista del equipo trae la jerarquía: propietaria primero', r.status === 200 && team[0].isOwner === true && team[0].rank === 4 && owner?.rank === 4, JSON.stringify(team.map((m) => `${m.username}:${m.rank}`)));
    ok('cada integrante trae nivel, estado, actividad y foto, sin correo', team.every((m) => typeof m.rank === 'number' && 'restriction' in m && typeof m.actions30d === 'number') && !JSON.stringify(r.j).includes('@test.local'));
    ok('quien lee ve su propio nivel', r.j.me?.rank === 3 && r.j.me.isOwner === false, JSON.stringify(r.j.me));
    ok('una cuenta administradora por configuración se marca como fija', team.find((m) => m.username === NAMES.admin)?.fixedByConfig === true);
    ok('el orden es de mayor a menor nivel', team.every((m, i) => i === 0 || team[i - 1].rank >= m.rank));

    // ---- La cuenta propietaria está protegida en todos los caminos ----
    const body = { confirmUsername: jerry, reason: 'prueba de protección', note: 'prueba de protección', role: 'user', days: 7 };
    for (const [label, path, extra] of [['cambiar su rol', `/admin/team/${id('jerry')}/role`, {}], ['suspenderla', `/admin/team/${id('jerry')}/suspend`, {}], ['cerrarla', `/admin/team/${id('jerry')}/close`, {}], ['restaurarla', `/admin/team/${id('jerry')}/restore`, {}]]) {
      r = await call('POST', path, 'admin', { ...body, ...extra });
      ok(`nadie puede ${label} (la propietaria) → 403`, r.status === 403 && /cuenta original/i.test(r.j.message), `${r.status} ${r.j.message}`);
    }
    ok('la propietaria sigue como administradora y sin medidas', (await roleOf('jerry')) === 'admin' && (await prisma.sanction.count({ where: { userId: id('jerry') } })) === 0);
    r = await call('POST', `/admin/users/${jerry}/role`, 'admin', { role: 'user' });
    ok('la ruta de roles anterior tampoco puede tocarla → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/users/${jerry}/sanctions`, 'admin', { type: 'suspend', reason: 'prueba de protección', durationDays: 7 });
    ok('las medidas de siempre tampoco pueden aplicarse a la propietaria → 403', r.status === 403, String(r.status));
    // Un reporte sobre su contenido no permite ocultarlo ni retirarlo
    const reason = 'profile_text.offensive';
    r = await call('POST', '/reports', 'seller', { targetType: 'profile_text', targetId: id('jerry'), reasonCode: reason, comment: 'prueba de protección de la cuenta propietaria', extra: { campo: 'bio' } });
    const reportId = r.j?.reportId;
    if (reportId) {
      r = await call('POST', `/admin/reports/${reportId}/decision`, 'admin', { action: 'hide', note: 'prueba' });
      ok('un reporte sobre la propietaria no permite ocultar su contenido → 409', r.status === 409 && /cuenta original/i.test(r.j.message || ''), `${r.status} ${r.j?.message}`);
    } else {
      ok('se pudo crear el reporte de prueba contra la propietaria', false, JSON.stringify(r.j));
    }

    // ---- Cambios de rol ----
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'seller', { role: 'admin', confirmUsername: ale });
    ok('sin ser administrador no se cambian roles → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'superjefe', confirmUsername: ale });
    ok('un rol que no existe → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/team/no-uuid/role`, 'admin', { role: 'admin', confirmUsername: ale });
    ok('id inválido → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'admin', confirmUsername: 'otra_persona' });
    ok('usuario escrito distinto → 400 y no cambia nada', r.status === 400 && (await roleOf('ale')) === 'user', String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'admin', confirmUsername: '@' + ale.toUpperCase() });
    ok('con la confirmación correcta la persona pasa a administradora', r.status === 200 && (await roleOf('ale')) === 'admin', JSON.stringify(r.j));
    ok('queda en la auditoría con quién lo hizo y el rol anterior', (await prisma.moderationAudit.count({ where: { action: 'role.admin_granted', targetId: id('ale') } })) === 1);
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'admin', confirmUsername: ale });
    ok('repetirlo → 409', r.status === 409, String(r.status));
    r = await call('POST', `/admin/team/${adminId}/role`, 'ale', { role: 'moderator', confirmUsername: NAMES.admin });
    ok('el rol de un administrador fijado por configuración no se quita desde aquí → 409', r.status === 409 && /ADMIN_EMAILS/.test(r.j.message), `${r.status} ${r.j.message}`);
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'ale', { role: 'user', confirmUsername: ale });
    ok('nadie cambia su propio rol → 403', r.status === 403, String(r.status));
    // Un administrador puede quitar el rol a otro administrador (salvo la propietaria)
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'moderator', confirmUsername: ale });
    ok('un administrador puede bajar de nivel a otro administrador', r.status === 200 && (await roleOf('ale')) === 'moderator', JSON.stringify(r.j));
    ok('bajar a un administrador queda en la auditoría', (await prisma.moderationAudit.count({ where: { action: 'role.admin_revoked', targetId: id('ale') } })) === 1);
    r = await call('GET', '/admin/team', 'ale');
    ok('un moderador no entra a la gestión del equipo → 403', r.status === 403, String(r.status));
    await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'admin', confirmUsername: ale });

    // ---- Suspender entre administradores ----
    r = await call('POST', `/admin/team/${id('ale')}/suspend`, 'admin', { reason: 'no', days: 7, confirmUsername: ale });
    ok('motivo demasiado corto → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/suspend`, 'admin', { reason: 'Prueba de suspensión', days: 0, confirmUsername: ale });
    ok('duración inválida → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/suspend`, 'admin', { reason: 'Prueba de suspensión', days: 7, confirmUsername: 'otra' });
    ok('suspender sin escribir el usuario correcto → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/team/${adminId}/suspend`, 'admin', { reason: 'Prueba de suspensión', days: 7, confirmUsername: NAMES.admin });
    ok('nadie se suspende a sí mismo → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/suspend`, 'admin', { reason: 'Prueba de suspensión de un administrador', days: 7, confirmUsername: ale });
    ok('un administrador puede suspender a otro administrador', r.status === 200, JSON.stringify(r.j));
    r = await call('GET', '/admin/team', 'ale');
    ok('la persona suspendida pierde el acceso al equipo (también de lectura) → 403', r.status === 403 && r.j.code === 'staff_suspended', `${r.status} ${r.j.code}`);
    r = await call('POST', '/folders', 'ale', { name: 'TEST suspendida', tcg: 'Pokemon', color: 'blue', isPublic: false });
    ok('y no puede escribir en la plataforma → 403', r.status === 403 && r.j.code === 'account_suspended', `${r.status} ${r.j.code}`);
    r = await call('GET', '/admin/team', 'admin');
    const suspended = r.j.team.find((m) => m.username === ale);
    ok('la lista muestra la suspensión con su motivo y fecha de término', suspended?.restriction?.type === 'suspend' && suspended.restriction.until && /Prueba de suspensión/.test(suspended.restriction.reason), JSON.stringify(suspended?.restriction));
    r = await call('POST', `/admin/team/${id('ale')}/suspend`, 'admin', { reason: 'Otra suspensión distinta', days: 7, confirmUsername: ale });
    ok('suspender dos veces → 409', r.status === 409, String(r.status));
    r = await call('GET', '/admin/team/search?q=' + encodeURIComponent(ale), 'admin');
    ok('el buscador muestra que la cuenta está suspendida', r.j.people?.find((p) => p.username === ale)?.restriction?.type === 'suspend');
    r = await call('POST', `/admin/team/${id('ale')}/restore`, 'admin', { note: 'ok', confirmUsername: ale });
    ok('restaurar exige un motivo → 400', r.status === 400, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/restore`, 'admin', { note: 'Se resolvió la revisión', confirmUsername: ale });
    ok('restaurar devuelve el acceso', r.status === 200, JSON.stringify(r.j));
    r = await call('GET', '/admin/team', 'ale');
    ok('la persona restaurada vuelve a entrar al equipo', r.status === 200, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/restore`, 'admin', { note: 'Se resolvió la revisión', confirmUsername: ale });
    ok('restaurar sin medida vigente → 409', r.status === 409, String(r.status));

    // ---- Cerrar la cuenta de un administrador ----
    r = await call('POST', `/admin/team/${id('ale')}/close`, 'admin', { reason: 'Cierre por uso indebido de la cuenta', confirmUsername: ale });
    ok('un administrador puede cerrar la cuenta de otro administrador', r.status === 200, JSON.stringify(r.j));
    ok('la cuenta cerrada queda sin rol de equipo y con el cierre vigente', (await roleOf('ale')) === 'user' && (await prisma.sanction.count({ where: { userId: id('ale'), type: 'ban', status: 'active' } })) === 1);
    r = await call('GET', '/admin/team', 'ale');
    ok('la cuenta cerrada no entra al equipo → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/restore`, 'admin', { note: 'Se revisó y fue un error', confirmUsername: ale });
    ok('se puede restaurar una cuenta cerrada', r.status === 200 && (await prisma.sanction.count({ where: { userId: id('ale'), status: 'active', type: { in: ['ban', 'suspend'] } } })) === 0, JSON.stringify(r.j));
    r = await call('GET', '/admin/team', 'ale');
    ok('restaurada, la cuenta NO recupera el rol de equipo sola → 403', r.status === 403 && (await roleOf('ale')) === 'user', `${r.status}`);
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'admin', { role: 'admin', confirmUsername: ale });
    ok('el rol se da de nuevo a propósito', r.status === 200 && (await roleOf('ale')) === 'admin', JSON.stringify(r.j));

    // ---- Historial ----
    r = await call('GET', '/admin/team/history', 'admin');
    const events = r.j.events || [];
    const actions = new Set(events.map((e) => e.action));
    ok('el historial trae roles, suspensiones, cierres y restauraciones', ['role.admin_granted', 'role.admin_revoked', 'team.suspended', 'team.closed', 'team.restored'].every((a) => actions.has(a)), JSON.stringify([...actions]));
    ok('cada evento dice quién lo hizo y a quién', events.every((e) => e.actor?.username && e.target?.username) && events.some((e) => e.actor.username === NAMES.admin && e.target.username === ale));
    ok('el historial viene del más nuevo al más antiguo', events.every((e, i) => i === 0 || new Date(events[i - 1].at) >= new Date(e.at)));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    const ids = Object.values(touched).filter(Boolean).map((u) => u.id);
    await prisma.sanction.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.report.deleteMany({ where: { targetOwnerId: touched.jerry?.id, reasonCode: 'profile_text.offensive' } }).catch(() => {});
    await prisma.moderationAudit.deleteMany({ where: { OR: [{ targetId: { in: ids }, action: { startsWith: 'role.' } }, { targetId: { in: ids }, action: { startsWith: 'team.' } }, { targetId: { in: ids }, action: { startsWith: 'sanction.' } }] } }).catch(() => {});
    for (const [who, row] of Object.entries(touched)) if (row) await prisma.user.update({ where: { id: row.id }, data: { role: row.role, isOwner: row.isOwner, photoURL: row.photoURL } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { name: 'TEST suspendida' } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
})();
