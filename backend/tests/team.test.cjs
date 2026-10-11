// Equipo: buscador con fotos y rol de administrador con doble confirmación (pantalla en dos pasos + usuario escrito exacto en el servidor).
const { prisma, call, ok, NAMES } = require('./fixtures.cjs');

(async () => {
  let ale = null;
  try {
    ale = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-ale' }, select: { id: true, role: true, username: true } });
    await prisma.user.update({ where: { id: ale.id }, data: { photoURL: 'https://lh3.googleusercontent.com/a/cztest-foto', role: 'user' } });
    const username = NAMES.ale; // "cztest_ale"

    // Acceso
    let r = await call('GET', '/admin/team/search?q=cztest');
    ok('buscar sin sesión → 401', r.status === 401, String(r.status));
    r = await call('GET', '/admin/team/search?q=cztest', 'seller');
    ok('buscar sin ser administrador → 403', r.status === 403, String(r.status));
    r = await call('GET', '/admin/team', 'seller');
    ok('ver el equipo sin ser administrador → 403', r.status === 403, String(r.status));

    // Buscador
    for (const q of ['', 'a', 'x'.repeat(41)]) {
      r = await call('GET', '/admin/team/search?q=' + encodeURIComponent(q), 'admin');
      ok(`búsqueda inválida (${q.length} letras) → 400`, r.status === 400, String(r.status));
    }
    r = await call('GET', '/admin/team/search?q=' + encodeURIComponent('@' + username.toUpperCase()), 'admin');
    const found = r.j.people?.find((person) => person.username === username);
    ok('encuentra por usuario (sin importar mayúsculas ni la @) y trae la foto', r.status === 200 && found?.photoURL === 'https://lh3.googleusercontent.com/a/cztest-foto' && found.role === 'user', JSON.stringify(found));
    ok('el resultado trae solo lo necesario, sin correo ni datos privados', found && Object.keys(found).sort().join() === 'comuna,createdAt,id,name,photoURL,role,username' && !JSON.stringify(r.j).includes('@test.local'), JSON.stringify(Object.keys(found || {})));
    ok('el usuario exacto sale primero', r.j.people[0].username === username, r.j.people[0]?.username);
    r = await call('GET', '/admin/team/search?q=zzzznadie', 'admin');
    ok('sin coincidencias devuelve una lista vacía', r.status === 200 && r.j.people.length === 0);

    // Dar el rol: validaciones
    r = await call('POST', '/admin/team/admins', null, { userId: ale.id, confirmUsername: username });
    ok('dar el rol sin sesión → 401', r.status === 401, String(r.status));
    r = await call('POST', '/admin/team/admins', 'seller', { userId: ale.id, confirmUsername: username });
    ok('dar el rol sin ser administrador → 403', r.status === 403, String(r.status));
    r = await call('POST', '/admin/team/admins', 'admin', { userId: 'no-uuid', confirmUsername: username });
    ok('id inválido → 400', r.status === 400, String(r.status));
    r = await call('POST', '/admin/team/admins', 'admin', { userId: ale.id });
    ok('sin escribir el usuario → 400', r.status === 400, String(r.status));
    r = await call('POST', '/admin/team/admins', 'admin', { userId: ale.id, confirmUsername: 'otra_persona' });
    ok('usuario escrito distinto → 400 y no cambia nada', r.status === 400 && (await prisma.user.findUnique({ where: { id: ale.id }, select: { role: true } })).role === 'user', String(r.status));
    r = await call('POST', '/admin/team/admins', 'admin', { userId: '00000000-0000-4000-8000-000000000000', confirmUsername: username });
    ok('persona inexistente → 404', r.status === 404, String(r.status));

    // Dar el rol: correcto
    r = await call('POST', '/admin/team/admins', 'admin', { userId: ale.id, confirmUsername: '@' + username.toUpperCase() });
    const after = await prisma.user.findUnique({ where: { id: ale.id }, select: { role: true } });
    ok('con la doble confirmación correcta la persona queda como administradora', r.status === 200 && r.j.person?.role === 'admin' && after.role === 'admin', JSON.stringify(r.j));
    const audit = await prisma.moderationAudit.findMany({ where: { action: 'role.admin_granted', targetId: ale.id } });
    ok('queda anotado en la auditoría con quién lo hizo', audit.length === 1 && audit[0].actorId && /otorgado a @cztest_ale/.test(audit[0].note) && audit[0].meta?.previousRole === 'user', JSON.stringify(audit));
    r = await call('POST', '/admin/team/admins', 'admin', { userId: ale.id, confirmUsername: username });
    ok('repetirlo → 409 y no duplica la auditoría', r.status === 409 && (await prisma.moderationAudit.count({ where: { action: 'role.admin_granted', targetId: ale.id } })) === 1, String(r.status));
    r = await call('GET', '/admin/team', 'admin');
    ok('la nueva administradora aparece en el equipo con su foto', r.status === 200 && r.j.team.some((person) => person.username === username && person.role === 'admin' && person.photoURL), JSON.stringify(r.j.team?.map((p) => p.username)));
    r = await call('GET', '/admin/team', 'ale');
    ok('la nueva administradora ya tiene acceso (nivel 3)', r.status === 200);

    // Cuenta eliminada: no se puede ascender
    const deleted = await prisma.user.findFirst({ where: { role: 'deleted' }, select: { id: true } });
    if (deleted) {
      r = await call('POST', '/admin/team/admins', 'admin', { userId: deleted.id, confirmUsername: 'x' });
      ok('una cuenta eliminada no se puede ascender → 404', r.status === 404, String(r.status));
    }
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    if (ale) {
      await prisma.moderationAudit.deleteMany({ where: { action: 'role.admin_granted', targetId: ale.id } }).catch(() => {});
      await prisma.user.update({ where: { id: ale.id }, data: { role: ale.role || 'user', photoURL: null } }).catch(() => {});
    }
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
})();
