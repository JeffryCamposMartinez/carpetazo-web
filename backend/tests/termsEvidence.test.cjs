// Evidencia legal de aceptación de Términos: qué se guarda, que reactivar una cuenta no borra el historial
// y la consulta solo para administradores (por usuario, por correo y comprobando una IP).
const { prisma, B, NAMES, call, ok } = require('./fixtures.cjs');

// Cuenta propia de esta prueba (fuera de la lista de fixtures; la limpieza la borra por el prefijo cztest-)
const UID = 'cztest-evid';
const as = async (method, path, body, ip) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'PruebaNavegador/1.0 (Android)', Authorization: 'Bearer test-' + UID, ...(ip ? { 'X-Forwarded-For': ip } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, j: await r.json().catch(() => null) };
};
const accept = async (ip) => {
  const versions = (await call('GET', '/legal/versions')).j;
  return as('POST', '/users/me/accept-terms', { adult: true, termsVersion: versions.termsVersion, privacyVersion: versions.privacyVersion }, ip);
};

(async () => {
  try {
    let r = await as('POST', '/users/sync', { displayName: 'Prueba evidencia', username: 'cztest_evid' });
    ok('crear la cuenta de la prueba → 200', r.status === 200, String(r.status));
    const userId = r.j.user.id;
    r = await accept('8.8.4.4');
    ok('aceptar los términos → 200', r.status === 200, String(r.status));

    // 1) Qué queda guardado en cada aceptación
    const first = await prisma.termsAcceptance.findFirst({ where: { userId }, orderBy: { acceptedAt: 'desc' } });
    ok('guarda versión de términos y política', Boolean(first?.termsVersion && first?.privacyVersion));
    ok('guarda la declaración de mayoría de edad', first?.isAdult === true);
    ok('guarda el método de ingreso (google.com)', first?.method === 'google.com', String(first?.method));
    ok('guarda el navegador/dispositivo', first?.userAgent === 'PruebaNavegador/1.0 (Android)', String(first?.userAgent));
    ok('guarda la huella del correo (no el correo)', /^[0-9a-f]{64}$/.test(first?.emailHash || '') && !String(first?.emailHash).includes('@'));
    ok('guarda la huella de la conexión (no la IP)', /^[0-9a-f]{32}$/.test(first?.connectionHash || ''));

    // 2) Borrar la cuenta y volver: la aceptación anterior NO se borra, se anula y se pide aceptar de nuevo
    r = await as('DELETE', '/users/me');
    ok('borrar la cuenta → 200', r.status === 200, String(r.status));
    r = await as('POST', '/users/sync', { displayName: 'Prueba evidencia', username: 'cztest_evid' });
    ok('volver a entrar con la misma cuenta → 200', r.status === 200, String(r.status));
    ok('...y se le pide aceptar de nuevo', r.j?.legal?.accepted === false, JSON.stringify(r.j?.legal));
    const kept = await prisma.termsAcceptance.findMany({ where: { userId } });
    ok('...la aceptación anterior se conserva como evidencia', kept.length === 1, String(kept.length));
    ok('...marcada como anulada', kept[0]?.voidedAt instanceof Date);
    r = await accept('8.8.8.8');
    ok('aceptar otra vez → 200 y queda vigente', r.status === 200 && r.j?.legal?.accepted === true, String(r.status));
    ok('el historial tiene las dos aceptaciones', (await prisma.termsAcceptance.count({ where: { userId } })) === 2);

    // 3) y 4) Consulta para administradores
    ok('una persona sin rol de administrador no puede consultar → 403', (await call('POST', '/admin/terms/evidence', 'ale', { username: 'cztest_evid' })).status === 403);
    ok('sin usuario ni correo → 400', (await call('POST', '/admin/terms/evidence', 'admin', {})).status === 400);
    ok('correo con formato inválido → 400', (await call('POST', '/admin/terms/evidence', 'admin', { email: 'no-es-correo' })).status === 400);
    r = await call('POST', '/admin/terms/evidence', 'admin', { username: 'cztest_evid', ip: '8.8.4.4' });
    ok('por usuario → 200 con todo el historial', r.status === 200 && r.j.acceptances.length === 2, String(r.status));
    const [latest, older] = r.j.acceptances;
    ok('...la más reciente está vigente y la anterior anulada', latest.voidedAt === null && Boolean(older.voidedAt));
    ok('...con método, navegador y versiones', latest.method === 'google.com' && latest.userAgent && latest.termsVersion);
    ok('...indica qué aceptación se hizo desde la IP consultada', older.ipMatches === true && latest.ipMatches === false);
    ok('...y no expone huellas ni correo', !JSON.stringify(r.j).includes('emailHash') && !JSON.stringify(r.j).includes('connectionHash') && !JSON.stringify(r.j).includes('@test.local'));
    r = await call('POST', '/admin/terms/evidence', 'admin', { email: 'CZTEST-EVID@test.local' });
    ok('por correo (sin importar mayúsculas) → encuentra las dos', r.status === 200 && r.j.acceptances.length === 2 && r.j.acceptances.every((row) => row.emailMatches === true), String(r.j?.acceptances?.length));

    // Tras borrar la cuenta: se anonimiza, pero el correo sigue permitiendo encontrar su evidencia
    await as('DELETE', '/users/me');
    r = await call('POST', '/admin/terms/evidence', 'admin', { email: 'cztest-evid@test.local' });
    ok('cuenta borrada: el correo aún encuentra su evidencia', r.status === 200 && r.j.acceptances.length === 2 && r.j.acceptances.every((row) => row.accountDeleted), String(r.j?.acceptances?.length));
    const audit = await prisma.moderationAudit.count({ where: { action: 'terms.evidence_viewed' } });
    ok('cada consulta queda en la auditoría', audit >= 3, String(audit));

    // Retención (Política, sección 6): a los 5 años de borrada la cuenta, su registro de aceptación se elimina
    r = await call('POST', '/admin/retention/run', 'admin');
    ok('retención con la cuenta recién borrada → no borra la evidencia', r.status === 200 && (await prisma.termsAcceptance.count({ where: { userId } })) === 2, String(r.status));
    await prisma.$executeRaw`UPDATE "User" SET "updatedAt" = NOW() - INTERVAL '1830 days' WHERE "id" = ${userId}`;
    r = await call('POST', '/admin/retention/run', 'admin');
    ok('...y pasados 5 años de borrada → se elimina', r.status === 200 && (await prisma.termsAcceptance.count({ where: { userId } })) === 0, JSON.stringify(r.j?.counts || r.j));
  } finally {
    await prisma.$disconnect();
  }
})();
