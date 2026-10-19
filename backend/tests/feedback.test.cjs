// Reclamos y sugerencias: tipo, asunto y mensaje validados en el servidor; cada persona solo ve las suyas.
const { prisma, NAMES, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { username: NAMES.seller }, select: { id: true } });
    let r = await call('POST', '/feedback', 'seller', { kind: 'otro', title: 'Asunto válido', message: 'Un mensaje con suficiente largo' });
    ok('un tipo que no existe → 400', r.status === 400, String(r.status));
    r = await call('POST', '/feedback', 'seller', { kind: 'suggestion', title: '   ', message: 'Un mensaje con suficiente largo' });
    ok('un asunto de solo espacios → 400', r.status === 400, String(r.status));
    r = await call('POST', '/feedback', 'seller', { kind: 'suggestion', title: 'Asunto válido', message: 'corto' });
    ok('un mensaje demasiado corto → 400', r.status === 400, String(r.status));
    r = await call('POST', '/feedback', 'seller', { kind: 'suggestion', title: 'a'.repeat(500), message: 'Un mensaje con suficiente largo' });
    ok('un asunto larguísimo → 400', r.status === 400, String(r.status));
    r = await call('POST', '/feedback', 'seller', { kind: 'suggestion', title: 'Asunto válido', message: 'm'.repeat(20000) });
    ok('un mensaje larguísimo → 400', r.status === 400, String(r.status));
    r = await call('POST', '/feedback', 'seller', { kind: 'suggestion', title: ['x'], message: { a: 1 } });
    ok('asunto y mensaje que no son texto → 400', r.status === 400, String(r.status));
    r = await call('POST', '/feedback', null, { kind: 'suggestion', title: 'Asunto válido', message: 'Un mensaje con suficiente largo' });
    ok('sin sesión → 401', r.status === 401, String(r.status));

    r = await call('POST', '/feedback', 'seller', { kind: 'suggestion', title: 'Prueba de QA', message: 'Mensaje de prueba automática' });
    ok('una sugerencia válida → 201', r.status === 201, JSON.stringify(r.j).slice(0, 160));
    r = await call('GET', '/feedback/mine', 'seller');
    ok('...aparece en las propias', (r.j?.feedback || []).some((f) => f.title === 'Prueba de QA'), JSON.stringify(r.j).slice(0, 160));
    r = await call('GET', '/feedback/mine', 'jerry');
    ok('...y otra persona no la ve', !(r.j?.feedback || []).some((f) => f.title === 'Prueba de QA'));
    await prisma.feedback.deleteMany({ where: { userId: user.id } });
  } finally {
    await prisma.$disconnect();
  }
})();
