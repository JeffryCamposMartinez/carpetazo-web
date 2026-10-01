// Términos y Condiciones: bloqueo de escrituras sin aceptación, declaración de 18+, versiones, usuario al aceptar y "Salir".
const fs = require('fs');
const path = require('path');
const { prisma, NAMES, call, ok, acceptTerms } = require('./fixtures.cjs');

(async () => {
  try {
    const versions = (await call('GET', '/legal/versions')).j;
    ok('versiones públicas', versions.success && /^\d{4}-\d{2}-\d{2}/.test(versions.termsVersion) && /^\d{4}-\d{2}-\d{2}/.test(versions.privacyVersion));

    // Las versiones del servidor y las que muestran las páginas del sitio deben coincidir
    const front = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'legal', 'versions.js'), 'utf8');
    ok('las versiones de las páginas coinciden con las del servidor', front.includes(`'${versions.termsVersion}'`) && front.includes(`'${versions.privacyVersion}'`));

    // Cuenta nueva sin aceptar
    let r = await call('POST', '/users/sync', 'newbie', { displayName: 'Persona Nueva Prueba', username: 'cztest_newbie' });
    ok('cuenta nueva: el estado legal dice "sin aceptar" y puede elegir su usuario', r.status === 200 && r.j.legal.accepted === false && r.j.legal.canChooseUsername === true && r.j.legal.current.termsVersion === versions.termsVersion);
    r = await call('GET', '/users/me', 'newbie');
    ok('GET /users/me también trae el estado legal', r.status === 200 && r.j.legal?.accepted === false);
    ok('sin aceptar puede leer (GET carpetas propias)', (await call('GET', '/folders/me', 'newbie')).status === 200);

    const writes = [
      ['crear carpeta', () => call('POST', '/folders', 'newbie', { name: 'x', tcg: 'Pokemon' })],
      ['editar perfil', () => call('PUT', '/users/me', 'newbie', { bio: 'hola' })],
      ['enviar mensaje', () => call('POST', '/messages/' + NAMES.seller, 'newbie', { content: 'hola' })],
      ['crear reseña', () => call('POST', '/reviews', 'newbie', { orderId: '00000000-0000-4000-8000-000000000000', rating: 5 })],
      ['agregar a la lista de deseos', () => call('POST', '/wishlist', 'newbie', { name: 'carta' })]
    ];
    for (const [label, run] of writes) {
      const x = await run();
      ok('sin aceptar no puede: ' + label + ' → 403 terms_required', x.status === 403 && x.j?.code === 'terms_required', x.status + ' ' + x.j?.code);
    }
    const { folderId, cardId } = JSON.parse(process.env.CZ_FIXTURES || '{}');
    if (folderId) {
      const x = await call('POST', '/orders/create', 'newbie', { folderId, items: [{ id: cardId, quantity: 1 }] }, '3.3.3.9');
      ok('sin aceptar no puede hacer pedidos con su sesión → 403', x.status === 403 && x.j?.code === 'terms_required', String(x.status));
      const anon = await call('POST', '/orders/create', null, { folderId, items: [{ id: cardId, quantity: 1 }] }, '3.3.3.8');
      ok('un visitante sin sesión sigue pudiendo pedir (no hay cuenta que aceptar)', anon.status === 200, String(anon.status));
    }

    // Aceptar
    const base = { termsVersion: versions.termsVersion, privacyVersion: versions.privacyVersion };
    ok('sin sesión → 401', (await call('POST', '/users/me/accept-terms', null, { adult: true, ...base })).status === 401);
    ok('sin declarar 18+ → 400', (await call('POST', '/users/me/accept-terms', 'newbie', base)).status === 400);
    ok('declarar adult=false → 400', (await call('POST', '/users/me/accept-terms', 'newbie', { adult: false, ...base })).status === 400);
    ok('adult como texto "true" → 400 (debe ser booleano)', (await call('POST', '/users/me/accept-terms', 'newbie', { adult: 'true', ...base })).status === 400);
    r = await call('POST', '/users/me/accept-terms', 'newbie', { adult: true, termsVersion: 'vieja', privacyVersion: versions.privacyVersion });
    ok('versión vieja → 409 terms_version_changed', r.status === 409 && r.j?.code === 'terms_version_changed');
    ok('usuario inválido al aceptar → 400', (await call('POST', '/users/me/accept-terms', 'newbie', { adult: true, ...base, username: 'a' })).status === 400);
    ok('usuario reservado ("terminos") → 400', (await call('POST', '/users/me/accept-terms', 'newbie', { adult: true, ...base, username: 'terminos' })).status === 400);
    ok('usuario ya tomado → 409', (await call('POST', '/users/me/accept-terms', 'newbie', { adult: true, ...base, username: NAMES.seller })).status === 409);
    ok('tras los intentos fallidos sigue sin aceptar', (await call('GET', '/users/me', 'newbie')).j.legal.accepted === false);

    r = await call('POST', '/users/me/accept-terms', 'newbie', { adult: true, ...base, username: 'cztest_newbie_ok' });
    ok('aceptar eligiendo usuario → 200', r.status === 200 && r.j.legal.accepted === true && r.j.legal.canChooseUsername === false, JSON.stringify(r.j?.legal));
    r = await call('GET', '/users/me', 'newbie');
    ok('el usuario elegido quedó guardado', r.j.user.username === 'cztest_newbie_ok');
    const rows = await prisma.termsAcceptance.findMany({ where: { user: { firebaseUid: 'cztest-newbie' } } });
    ok('quedó una aceptación con versiones, mayoría de edad y sin IP', rows.length === 1 && rows[0].isAdult === true && rows[0].termsVersion === versions.termsVersion && rows[0].connectionHash && !/\d+\.\d+\.\d+\.\d+/.test(rows[0].connectionHash));
    ok('ahora sí puede escribir (editar perfil)', (await call('PUT', '/users/me', 'newbie', { bio: 'ya acepté' })).status === 200);
    ok('después de aceptar no puede volver a cambiar el usuario por esta vía', (await call('POST', '/users/me/accept-terms', 'newbie', { adult: true, ...base, username: 'otro_usuario_x' })).status === 400);

    // Si cambia la versión, hay que aceptar de nuevo
    await prisma.termsAcceptance.updateMany({ where: { user: { firebaseUid: 'cztest-newbie' } }, data: { termsVersion: '2000-01-01' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    r = await call('GET', '/users/me', 'newbie');
    ok('con una versión anterior vuelve a figurar sin aceptar', r.j.legal.accepted === false && r.j.legal.canChooseUsername === false);

    // Cuenta con actividad (antigua): nadie la borra con "Salir" y no puede elegir usuario
    r = await call('POST', '/users/sync', 'oldie', { displayName: 'Persona Antigua', username: 'cztest_oldie' });
    await prisma.user.updateMany({ where: { firebaseUid: 'cztest-oldie' }, data: { createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } });
    r = await call('GET', '/users/me', 'oldie');
    ok('cuenta antigua: debe aceptar pero no puede cambiar el usuario', r.j.legal.accepted === false && r.j.legal.canChooseUsername === false);
    r = await call('DELETE', '/users/me/unaccepted', 'oldie');
    ok('"Salir" con una cuenta antigua no la borra', r.status === 200 && r.j.deleted === false && (await prisma.user.count({ where: { firebaseUid: 'cztest-oldie' } })) === 1);
    ok('puede eliminar su cuenta aunque no haya aceptado', (await call('DELETE', '/users/me', 'oldie')).status === 200);

    // "Salir" con una cuenta recién creada y sin actividad: se borra por completo
    r = await call('POST', '/users/sync', 'leaver', { displayName: 'Persona Temporal', username: 'cztest_leaver' });
    r = await call('DELETE', '/users/me/unaccepted', 'leaver');
    ok('"Salir" con una cuenta recién creada sin actividad la borra', r.status === 200 && r.j.deleted === true && (await prisma.user.count({ where: { firebaseUid: 'cztest-leaver' } })) === 0);
    ok('sin sesión → 401', (await call('DELETE', '/users/me/unaccepted')).status === 401);

    // Nadie puede aceptar por otra persona: la aceptación es siempre de la cuenta de la sesión
    r = await call('POST', '/users/me/accept-terms', 'ghost', { adult: true, ...base });
    ok('sesión sin cuenta en la base → 404', r.status === 404);
    await acceptTerms('jerry'); // ya aceptado: aceptar de nuevo es válido y no rompe nada
    ok('aceptar de nuevo la misma versión es inofensivo', (await call('GET', '/users/me', 'jerry')).j.legal.accepted === true);

    // Correos: solo a cuentas con los términos aceptados (el envío real queda en memoria durante las pruebas)
    ok('correo de prueba: usuario común → 403', (await call('POST', '/admin/test-email', 'jerry', {})).status === 403);
    ok('correo de prueba: sin sesión → 401', (await call('POST', '/admin/test-email', null, {})).status === 401);
    r = await call('POST', '/admin/test-email', 'admin', {});
    ok('correo de prueba al propio administrador (aceptó) → se envía', r.status === 200 && r.j.sent === true, JSON.stringify(r.j));
    r = await call('POST', '/admin/test-email', 'admin', { username: NAMES.jerry });
    ok('correo a una cuenta que aceptó → se envía', r.status === 200 && r.j.sent === true, JSON.stringify(r.j));
    await call('POST', '/users/sync', 'mailnew', { displayName: 'Sin Aceptar', username: 'cztest_mailnew' });
    r = await call('POST', '/admin/test-email', 'admin', { username: 'cztest_mailnew' });
    ok('correo a una cuenta que NO aceptó → no se envía', r.status === 200 && r.j.sent === false && r.j.reason === 'terms_not_accepted', JSON.stringify(r.j));
    r = await call('POST', '/admin/test-email', 'admin', { username: 'no_existe_xyz' });
    ok('correo a un usuario inexistente → 404', r.status === 404);
    ok('correo con usuario inválido → 400', (await call('POST', '/admin/test-email', 'admin', { username: 'a' })).status === 400);
  } finally {
    await prisma.$disconnect();
  }
})();
