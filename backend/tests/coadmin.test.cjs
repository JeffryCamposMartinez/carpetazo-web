// Co-administrador: poderes de administrador, pero nunca sobre administradores, otros co-administradores ni la cuenta propietaria.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  const user = (who) => prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true, role: true, isOwner: true, username: true, bio: true } });
  const roleOf = async (id) => (await prisma.user.findUnique({ where: { id }, select: { role: true } })).role;
  const touched = {};
  let sellerGrants = [];
  try {
    for (const who of ['ale', 'jeffry', 'jerry', 'seller', 'ignacio', 'nobuyer']) touched[who] = await user(who);
    const adminId = (await user('admin')).id;
    // Asignar un plan a «seller» revoca sus concesiones vigentes (la de la plataforma de pruebas): se anotan para devolverlas al final
    sellerGrants = (await prisma.planGrant.findMany({ where: { userId: touched.seller.id, revokedAt: null }, select: { id: true } })).map((row) => row.id);
    // ale = co-administradora; jeffry = administrador (no por correo); jerry = propietaria durante la prueba; seller, ignacio y nobuyer = personas
    await prisma.user.update({ where: { id: touched.ale.id }, data: { role: 'coadmin', isOwner: false } });
    await prisma.user.update({ where: { id: touched.jeffry.id }, data: { role: 'admin', isOwner: false } });
    await prisma.user.update({ where: { id: touched.jerry.id }, data: { role: 'admin', isOwner: true } });
    for (const who of ['seller', 'ignacio', 'nobuyer']) await prisma.user.update({ where: { id: touched[who].id }, data: { role: 'user', isOwner: false } });
    const id = (who) => touched[who].id;
    let r;

    // ---- Tiene los poderes de un administrador ----
    r = await call('GET', '/admin/me', 'ale');
    ok('el co-administrador entra a Moderación con nivel de administrador', r.status === 200 && r.j.isAdmin === true && r.j.level === 3, JSON.stringify(r.j).slice(0, 120));
    for (const path of ['/admin/team', '/admin/team/history', '/admin/team/search?q=cztest', `/admin/users/${touched.seller.username}/details`, `/admin/users/${touched.seller.username}/plan`, '/admin/users/search?q=cztest']) {
      r = await call('GET', path, 'ale');
      ok(`el co-administrador puede ver ${path.split('?')[0].replace(touched.seller.username, ':usuario')}`, r.status === 200, String(r.status));
    }
    r = await call('POST', `/admin/users/${touched.seller.username}/plan`, 'ale', { planKey: 'pro', reason: 'prueba del co-administrador', days: 5, notify: false });
    ok('el co-administrador puede asignar un plan a una persona', r.status === 200, String(r.status));
    r = await call('PUT', `/admin/users/${touched.seller.username}/profile`, 'ale', { bio: 'Presentación corregida', reason: 'corrección pedida por la persona', notify: false });
    ok('el co-administrador puede editar los datos de una persona', r.status === 200, String(r.status));

    // ---- Gestiona a moderadores, soporte y personas ----
    r = await call('POST', `/admin/team/${id('nobuyer')}/role`, 'ale', { role: 'moderator', confirmUsername: touched.nobuyer.username });
    ok('el co-administrador da el rol de moderador', r.status === 200 && (await roleOf(id('nobuyer'))) === 'moderator', JSON.stringify(r.j).slice(0, 100));
    r = await call('POST', `/admin/team/${id('nobuyer')}/role`, 'ale', { role: 'support', confirmUsername: touched.nobuyer.username });
    ok('el rol de soporte ya no se puede asignar → 400', r.status === 400 && (await roleOf(id('nobuyer'))) === 'moderator', String(r.status));
    r = await call('POST', `/admin/team/${id('nobuyer')}/suspend`, 'ale', { reason: 'prueba de suspensión', days: 1, confirmUsername: touched.nobuyer.username });
    ok('el co-administrador suspende a alguien del equipo de nivel inferior', r.status === 200, String(r.status));
    r = await call('POST', `/admin/team/${id('nobuyer')}/restore`, 'ale', { note: 'se levanta la prueba', confirmUsername: touched.nobuyer.username });
    ok('el co-administrador restaura esa cuenta', r.status === 200, String(r.status));

    // ---- No puede dar rangos de administración ----
    for (const role of ['admin', 'coadmin']) {
      r = await call('POST', `/admin/team/${id('seller')}/role`, 'ale', { role, confirmUsername: touched.seller.username });
      ok(`el co-administrador no puede dar el rol ${role} → 403`, r.status === 403 && (await roleOf(id('seller'))) === 'user', String(r.status));
    }

    // ---- No puede actuar sobre administradores ni sobre la propietaria ----
    for (const [label, who] of [['un administrador', 'jeffry'], ['la cuenta propietaria', 'jerry']]) {
      for (const [action, body] of [['role', { role: 'user' }], ['suspend', { reason: 'intento no permitido', days: 1 }], ['close', { reason: 'intento no permitido' }], ['restore', { note: 'intento no permitido' }]]) {
        r = await call('POST', `/admin/team/${id(who)}/${action}`, 'ale', { ...body, confirmUsername: NAMES[who] });
        ok(`el co-administrador no puede ${action} sobre ${label} → 403`, r.status === 403, String(r.status));
      }
    }
    ok('el administrador y la propietaria siguen con su rol', (await roleOf(id('jeffry'))) === 'admin' && (await roleOf(id('jerry'))) === 'admin' && (await user('jerry')).isOwner === true);
    r = await call('POST', `/admin/users/${touched.jeffry.username}/plan`, 'ale', { planKey: 'pro', reason: 'cambio a un administrador', days: 3 });
    ok('no puede cambiar el plan de un administrador → 403', r.status === 403, String(r.status));
    r = await call('PUT', `/admin/users/${touched.jeffry.username}/profile`, 'ale', { name: 'Nombre Cambiado', reason: 'cambio a un administrador' });
    ok('no puede editar los datos de un administrador → 403', r.status === 403, String(r.status));
    r = await call('PUT', `/admin/users/${touched.jerry.username}/profile`, 'ale', { name: 'Nombre Cambiado', reason: 'cambio a la propietaria' });
    ok('no puede editar los datos de la propietaria → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/users/${touched.jeffry.username}/subscription/cancel`, 'ale', { reason: 'cancelar a un administrador' });
    ok('no puede cancelar la suscripción de un administrador → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/users/${touched.jeffry.username}/role`, 'ale', { role: 'user' });
    ok('por la vía de «Personas y medidas» tampoco puede quitar el rol a un administrador → 403', r.status === 403, String(r.status));
    r = await call('POST', `/admin/users/${touched.seller.username}/sanctions`, 'ale', { type: 'warning', reason: 'advertencia de prueba' });
    ok('sigue pudiendo aplicar medidas a personas', r.status === 201, String(r.status));

    // ---- Un administrador sí puede dar el rango y quitarlo, y la propietaria sigue protegida ----
    r = await call('POST', `/admin/team/${id('ignacio')}/role`, 'jeffry', { role: 'coadmin', confirmUsername: touched.ignacio.username });
    ok('un administrador da el rol de co-administrador', r.status === 200 && (await roleOf(id('ignacio'))) === 'coadmin', String(r.status));
    r = await call('POST', `/admin/team/${id('ignacio')}/role`, 'ale', { role: 'user', confirmUsername: touched.ignacio.username });
    ok('un co-administrador no puede quitarle el rol a otro co-administrador → 403', r.status === 403 && (await roleOf(id('ignacio'))) === 'coadmin', String(r.status));
    r = await call('POST', `/admin/team/${id('ignacio')}/role`, 'jeffry', { role: 'moderator', confirmUsername: touched.ignacio.username });
    ok('un administrador baja a un co-administrador a moderador', r.status === 200 && (await roleOf(id('ignacio'))) === 'moderator', String(r.status));
    r = await call('POST', `/admin/team/${id('ale')}/role`, 'jeffry', { role: 'user', confirmUsername: touched.ale.username });
    ok('un administrador puede quitarle el rango a una co-administradora', r.status === 200 && (await roleOf(id('ale'))) === 'user', String(r.status));
    r = await call('POST', `/admin/team/${id('jerry')}/role`, 'jeffry', { role: 'user', confirmUsername: touched.jerry.username });
    ok('ni un administrador puede quitarle el rango a la cuenta original → 403', r.status === 403 && (await roleOf(id('jerry'))) === 'admin', String(r.status));

    // ---- Lista del equipo ----
    r = await call('GET', '/admin/team', 'jeffry');
    ok('la jerarquía muestra a los co-administradores con su propio nivel', r.status === 200 && r.j.team.every((m) => m.role !== 'coadmin' || m.rank === 2.5), JSON.stringify(r.j.team?.map((m) => `${m.username}:${m.rank}`)));
  } finally {
    // Se deja todo como estaba: roles, datos y lo que esta prueba creó (plan, medida y presentación)
    for (const who of Object.keys(touched)) await prisma.user.update({ where: { id: touched[who].id }, data: { role: touched[who].role, isOwner: touched[who].isOwner, bio: touched[who].bio } }).catch(() => {});
    if (touched.seller) {
      await prisma.planGrant.deleteMany({ where: { userId: touched.seller.id, reason: 'prueba del co-administrador' } }).catch(() => {});
      if (sellerGrants.length) await prisma.planGrant.updateMany({ where: { id: { in: sellerGrants } }, data: { revokedAt: null } }).catch(() => {});
      await prisma.sanction.deleteMany({ where: { userId: touched.seller.id, reason: 'advertencia de prueba' } }).catch(() => {});
    }
    if (touched.nobuyer) await prisma.sanction.deleteMany({ where: { userId: touched.nobuyer.id, reason: { in: ['prueba de suspensión', 'se levanta la prueba'] } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
