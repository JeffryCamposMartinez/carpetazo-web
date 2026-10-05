// Tema del perfil público: solo colores hexadecimales, fuentes de la lista del editor y opciones con forma de id.
const { prisma, NAMES, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    let r = await call('PUT', '/users/me', 'seller', { publicTheme: {
      id: 'custom', primary: 'url(https://evil.test/pixel.png)', accent: '#facc15', card: 'transparent',
      font: 'Comic Sans MS', bodyFont: 'Lora', dataFont: 'DM Mono',
      cardStyle: 'soft', profileLayout: 'poster; color:red', showWishlist: 'maybe', showInstagram: 'off', extra: 'x'
    } });
    ok('guardar un tema con valores mezclados → 200', r.status === 200, String(r.status));
    r = await call('GET', '/users/' + NAMES.seller, null);
    const theme = r.j?.user?.publicTheme || {};
    ok('...descarta un color que no es hexadecimal (url)', !('primary' in theme), JSON.stringify(theme));
    ok('...conserva colores válidos y «transparent»', theme.accent === '#facc15' && theme.card === 'transparent');
    ok('...descarta una fuente fuera de la lista', !('font' in theme));
    ok('...guarda las fuentes de contenido y cifras', theme.bodyFont === 'Lora' && theme.dataFont === 'DM Mono');
    ok('...descarta opciones con caracteres raros', theme.cardStyle === 'soft' && !('profileLayout' in theme));
    ok('...los interruptores solo aceptan on/off', theme.showInstagram === 'off' && !('showWishlist' in theme));
    ok('...y no guarda campos desconocidos', !('extra' in theme));

    // Temas antiguos guardados sin limpiar: también se limpian al mostrarlos
    const user = await prisma.user.findFirst({ where: { username: NAMES.seller }, select: { id: true } });
    await prisma.user.update({ where: { id: user.id }, data: { publicTheme: { primary: 'url(https://evil.test/a.png)', secondary: '#123456' } } });
    r = await call('GET', '/users/' + NAMES.seller, null);
    ok('un tema antiguo con url() no sale en el perfil público', !('primary' in (r.j?.user?.publicTheme || {})) && r.j.user.publicTheme.secondary === '#123456', JSON.stringify(r.j?.user?.publicTheme));

    r = await call('PUT', '/users/me', 'seller', { publicTheme: ['no', 'es', 'objeto'] });
    ok('un tema que no es objeto → 400', r.status === 400, String(r.status));
    await call('PUT', '/users/me', 'seller', { publicTheme: {} });
  } finally {
    await prisma.$disconnect();
  }
})();
