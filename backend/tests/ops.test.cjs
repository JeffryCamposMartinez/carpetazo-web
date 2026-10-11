// Operación: estado del servicio, errores de la web y del servidor (sin datos personales), y embudo para el equipo.
const { prisma, call, ok } = require('./fixtures.cjs');

(async () => {
  try {
    const { recordError, normalizeRoute, scrub } = await import('../core/errorLog.js');

    // Estado del servicio
    let r = await call('GET', '/health');
    ok('estado del servicio: responde ok con la base de datos', r.status === 200 && r.j.status === 'ok' && r.j.db === 'ok', JSON.stringify(r.j));

    // Funciones de limpieza
    ok('la ruta se guarda sin identificadores', normalizeRoute('/api/cards/0f3b6c1e-2b7a-4f0e-9a3c-1d2e3f4a5b6c/offers?x=1') === '/api/cards/:id/offers' && normalizeRoute('/api/orders/123456') === '/api/orders/:id');
    const cleaned = scrub('fallo con juan.perez@example.com, rut 12.345.678-5 y Bearer abcdefghijklmnopqrstuvwxyz0123456789');
    ok('se limpian correos, RUT y tokens', !/@|12\.345|abcdefghijklmnop/.test(cleaned) && cleaned.includes('[correo]') && cleaned.includes('[rut]'), cleaned);

    // Errores de la web: validaciones
    for (const [label, body] of [['sin mensaje', {}], ['mensaje vacío', { message: ' ' }], ['mensaje no es texto', { message: 123 }], ['mensaje enorme', { message: 'x'.repeat(601) }], ['ruta inválida', { message: 'x', path: 'sin-barra' }], ['detalle enorme', { message: 'x', stack: 'y'.repeat(4001) }]]) {
      r = await call('POST', '/client-errors', null, body);
      ok(`error de la web rechazado (${label})`, r.status === 400, String(r.status));
    }
    const text = 'CZTEST fallo de pantalla de prueba contacto@ejemplo.cl';
    r = await call('POST', '/client-errors', null, { message: text, path: '/carta/0f3b6c1e-2b7a-4f0e-9a3c-1d2e3f4a5b6c', stack: 'Error: x\n    at Foo (https://carpetazo.cl/assets/index.js:1:1)' });
    ok('error de la web aceptado', r.status === 202 && r.j.success === true, String(r.status));
    await call('POST', '/client-errors', null, { message: text, path: '/carta/0f3b6c1e-2b7a-4f0e-9a3c-1d2e3f4a5b6c', stack: 'Error: x\n    at Foo (https://carpetazo.cl/assets/index.js:1:1)' });

    // Error del servidor registrado directamente (lo que hace console.error en el servidor)
    await recordError({ kind: 'server', message: 'Error: CZTEST consulta fallida', route: 'GET /api/cards/0f3b6c1e-2b7a-4f0e-9a3c-1d2e3f4a5b6c/offers', stack: 'Error: x\n    at a (/app/routes/cards.js:1:1)' });

    // Lista para el equipo
    r = await call('GET', '/admin/ops/errors');
    ok('sin sesión no se ve la lista → 401', r.status === 401, String(r.status));
    r = await call('GET', '/admin/ops/errors', 'seller');
    ok('quien no es del equipo no ve la lista → 403', r.status === 403, String(r.status));
    r = await call('GET', '/admin/ops/errors', 'admin');
    const clientRow = r.j.errors?.find((row) => row.message.startsWith('CZTEST fallo de pantalla'));
    const serverRow = r.j.errors?.find((row) => row.message.includes('CZTEST consulta fallida'));
    ok('el equipo ve el error de la web, agrupado y contado', r.status === 200 && clientRow?.count === 2 && clientRow.kind === 'client', JSON.stringify(clientRow));
    ok('el error de la web se guardó sin el correo y con la ruta sin identificadores', clientRow && !clientRow.message.includes('@') && clientRow.message.includes('[correo]') && clientRow.route === '/carta/:id', JSON.stringify(clientRow));
    ok('el error del servidor se guardó con su ruta limpia', serverRow?.kind === 'server' && serverRow.route === 'GET /api/cards/:id/offers', JSON.stringify(serverRow));
    ok('la lista indica cuántos errores hubo en 24 h', typeof r.j.last24h === 'number' && r.j.last24h >= 2);

    // Marcar como resuelto
    r = await call('DELETE', '/admin/ops/errors/' + clientRow.id, 'seller');
    ok('quien no es del equipo no puede resolver errores → 403', r.status === 403, String(r.status));
    r = await call('DELETE', '/admin/ops/errors/no-es-uuid', 'admin');
    ok('id inválido → 400', r.status === 400, String(r.status));
    r = await call('DELETE', '/admin/ops/errors/' + clientRow.id, 'admin');
    const gone = await prisma.errorEvent.findUnique({ where: { id: clientRow.id } });
    ok('el equipo resuelve un error y desaparece', r.status === 200 && gone === null);

    // Embudo
    r = await call('GET', '/admin/ops/funnel?days=30', 'seller');
    ok('el embudo es solo para el equipo → 403', r.status === 403, String(r.status));
    for (const days of ['0', '400', 'abc']) {
      r = await call('GET', '/admin/ops/funnel?days=' + days, 'admin');
      ok(`período inválido (${days}) → 400`, r.status === 400, String(r.status));
    }
    r = await call('GET', '/admin/ops/funnel?days=30', 'admin');
    const steps = r.j.sellers || [];
    ok('el embudo trae los pasos de vendedores y compradores', r.status === 200 && steps.length === 5 && (r.j.buyers || []).length === 3 && steps[0].key === 'signups', JSON.stringify(r.j).slice(0, 200));
    ok('ningún paso supera a las personas registradas', steps.every((step) => step.count <= steps[0].count) && r.j.buyers.every((step) => step.count <= r.j.buyers[0].count));
    ok('trae totales del sitio', r.j.totals && typeof r.j.totals.users === 'number' && typeof r.j.totals.cardsOnSale === 'number', JSON.stringify(r.j.totals));
  } catch (error) {
    ok('la prueba terminó sin excepciones', false, error.stack || error.message);
  } finally {
    await prisma.errorEvent.deleteMany({ where: { message: { contains: 'CZTEST' } } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  }
})();
