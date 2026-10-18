// Datos privados del perfil: RUT con dígito verificador y teléfono con formato, validados en el servidor; el valor antiguo se conserva.
const { prisma, NAMES, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    let r = await call('PUT', '/users/me', 'seller', { rut: '11111111-2' });
    ok('un RUT con dígito verificador incorrecto → 400', r.status === 400 && /RUT/.test(r.j?.error || ''), JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'seller', { rut: 'abc' });
    ok('un RUT con letras → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/users/me', 'seller', { phone: 'hola' });
    ok('un teléfono con letras → 400', r.status === 400 && /tel/i.test(r.j?.error || ''), JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'seller', { phone: '<script>alert(1)</script>' });
    ok('un teléfono con HTML → 400', r.status === 400, String(r.status));
    r = await call('PUT', '/users/me', 'seller', { phone: '12345' });
    ok('un teléfono demasiado corto → 400', r.status === 400, String(r.status));

    r = await call('PUT', '/users/me', 'seller', { rut: '12.345.678-5', phone: '+56 9 1234 5678' });
    ok('un RUT y un teléfono válidos → 200', r.status === 200, JSON.stringify(r.j));
    const saved = await prisma.user.findUnique({ where: { username: NAMES.seller }, select: { rut: true, phone: true } });
    ok('...y se guardan', saved?.rut === '12.345.678-5' && saved?.phone === '+56 9 1234 5678', JSON.stringify(saved));

    r = await call('PUT', '/users/me', 'seller', { rut: '', phone: '' });
    ok('vaciar RUT y teléfono → 200', r.status === 200, String(r.status));

    // Valor anterior a la regla: se conserva mientras no se cambie (otras secciones reenvían todo el perfil)
    await prisma.user.update({ where: { username: NAMES.seller }, data: { phone: 'llamar en la tarde' } });
    r = await call('PUT', '/users/me', 'seller', { phone: 'llamar en la tarde', bio: 'sigo guardando mi bio' });
    ok('un teléfono antiguo sin cambios no bloquea otros guardados → 200', r.status === 200, JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'seller', { phone: 'otro texto libre' });
    ok('...pero uno nuevo inválido sí se rechaza → 400', r.status === 400, String(r.status));
    await prisma.user.update({ where: { username: NAMES.seller }, data: { phone: null, rut: null, bio: null } });

    // Usuario reservado: mensaje propio
    r = await call('PUT', '/users/me', 'seller', { username: 'admin' });
    ok('un usuario reservado → 400 con mensaje propio', r.status === 400 && /no está disponible/.test(r.j?.error || ''), JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'seller', { username: 'ab' });
    ok('un usuario demasiado corto → 400 con el mensaje de formato', r.status === 400 && /entre 3 y 20/.test(r.j?.error || ''), JSON.stringify(r.j));
  } finally {
    await prisma.$disconnect();
  }
})();
