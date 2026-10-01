// Ingreso: la sincronización de la cuenta con el servidor no debe dejar a nadie fuera.
// Caso real: la misma persona entra con otro identificador de Firebase (cambió de método de ingreso o se recreó la cuenta)
// y su correo y su usuario ya existen en la base; antes el servidor respondía 409 y la sesión quedaba sin cuenta (todo daba 401).
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    // --- Mismo correo verificado, otro identificador ---
    const oldRow = await prisma.user.create({ data: { firebaseUid: 'cztest-relink-old', email: 'cztest-relink@test.local', username: 'cztest_relink', name: 'Cuenta Antigua', role: 'user', bio: 'biografía que debe conservarse' } });
    let r = await call('POST', '/users/sync', 'relink', { displayName: 'Cuenta Nueva' });
    ok('mismo correo verificado y otro identificador → 200 (la cuenta se reenlaza)', r.status === 200 && r.j.user?.id === oldRow.id, r.status + ' ' + JSON.stringify(r.j).slice(0, 120));
    const relinked = await prisma.user.findUnique({ where: { id: oldRow.id } });
    ok('la fila conserva su usuario y sus datos, con el identificador nuevo', relinked.firebaseUid === 'cztest-relink' && relinked.username === 'cztest_relink' && relinked.bio === 'biografía que debe conservarse');
    ok('no se duplicó la cuenta', (await prisma.user.count({ where: { email: 'cztest-relink@test.local' } })) === 1);
    ok('la sesión nueva ya funciona (GET /users/me)', (await call('GET', '/users/me', 'relink')).status === 200);
    ok('y las rutas que dependían de la cuenta dejan de dar 401 (chats)', (await call('GET', '/chats', 'relink')).status === 200);

    // --- Cuenta eliminada: su correo ya no cuenta como el de nadie ---
    await prisma.user.create({ data: { firebaseUid: 'cztest-deleted-old', email: 'cztest-gone@deleted.invalid', username: null, name: 'Eliminada', role: 'deleted' } });
    r = await call('POST', '/users/sync', 'syncb', { displayName: 'Persona Distinta' });
    ok('una cuenta eliminada no se reenlaza ni estorba', r.status === 200 && r.j.user?.firebaseUid === 'cztest-syncb');

    // --- Usuario derivado del nombre que ya está tomado: se agrega un número, no se bloquea el ingreso ---
    await prisma.user.create({ data: { firebaseUid: 'cztest-dupname-existing', email: 'cztest-otra-persona@test.local', username: 'cztest_dupname', name: 'Otra Persona', role: 'user' } });
    r = await call('POST', '/users/sync', 'dupname', { displayName: 'cztest dupname' });
    ok('usuario derivado ya tomado → 200 con un número agregado', r.status === 200 && /^cztest_dupname\d+$/.test(r.j.user?.username || ''), r.status + ' ' + JSON.stringify(r.j).slice(0, 140));
    ok('...y el usuario original no se tocó', (await prisma.user.findUnique({ where: { firebaseUid: 'cztest-dupname-existing' } })).username === 'cztest_dupname');

    // --- Usuario elegido a mano que ya está tomado: sigue siendo un error claro ---
    r = await call('POST', '/users/sync', 'syncc', { displayName: 'Temp', username: 'cztest_dupname' });
    ok('usuario elegido por la persona y ya tomado → 409 con mensaje', r.status === 409 && /usuario/i.test(r.j.error || ''));

    // --- Un ingreso normal sigue igual ---
    r = await call('POST', '/users/sync', 'syncd', { displayName: 'Persona Normal Prueba' });
    ok('cuenta nueva sin choques → 200 y fila nueva', r.status === 200 && r.j.user?.firebaseUid === 'cztest-syncd');
    r = await call('POST', '/users/sync', 'syncd', { displayName: 'Persona Normal Prueba' });
    ok('sincronizar dos veces es inofensivo', r.status === 200 && (await prisma.user.count({ where: { firebaseUid: 'cztest-syncd' } })) === 1);
  } finally {
    await prisma.$disconnect();
  }
})();
