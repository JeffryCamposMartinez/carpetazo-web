// Respaldo de la base desde Moderación: solo administradores, hay que confirmarlo, se descarga completo y de solo lectura,
// deja registro en la auditoría y no incluye el catálogo de cartas.
const zlib = require('node:zlib');
const { prisma, B, U, call, ok } = require('./fixtures.cjs');

let hit = 0; // el límite (5 por hora) es por conexión: cada llamada de la prueba sale desde una distinta
const download = async (who, body, ip = '10.80.0.' + (++hit)) => {
  const r = await fetch(B + '/admin/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}), ...(ip ? { 'X-Forwarded-For': ip } : {}) },
    body: JSON.stringify(body)
  });
  const buffer = Buffer.from(await r.arrayBuffer());
  return { status: r.status, headers: r.headers, buffer };
};

(async () => {
  try {
    const users = async () => prisma.user.count();
    const before = await users();

    // ---- Acceso
    let r = await download(undefined, { confirm: true });
    ok('sin sesión → 401', r.status === 401, String(r.status));
    r = await download('ignacio', { confirm: true });
    ok('una persona normal → 403', r.status === 403, String(r.status));
    r = await call('GET', '/admin/backup/status', 'ignacio');
    ok('el estado del respaldo para una persona normal → 403', r.status === 403, String(r.status));

    // Un co-administrador tiene poderes de administrador, pero el respaldo de toda la base queda solo para administradores
    const jerry = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + 'jerry' }, select: { id: true, role: true } });
    await prisma.user.update({ where: { id: jerry.id }, data: { role: 'coadmin' } });
    r = await download('jerry', { confirm: true });
    ok('un co-administrador no puede descargar el respaldo → 403', r.status === 403, String(r.status));
    r = await call('GET', '/admin/backup/status', 'jerry');
    ok('...ni ver su estado → 403', r.status === 403, String(r.status));
    await prisma.user.update({ where: { id: jerry.id }, data: { role: jerry.role } });

    // ---- Confirmación
    r = await download('admin', {});
    ok('sin confirmar → 400', r.status === 400, String(r.status));
    r = await download('admin', { confirm: 'true' });
    ok('«confirm» que no es true → 400', r.status === 400, String(r.status));

    // ---- Descarga
    r = await download('admin', { confirm: true });
    ok('el administrador descarga el respaldo → 200 gzip, sin guardarse en caché', r.status === 200 && /gzip/.test(r.headers.get('content-type') || '') && /attachment; filename="carpetazo-respaldo-\d{12}\.ndjson\.gz"/.test(r.headers.get('content-disposition') || '') && /no-store/.test(r.headers.get('cache-control') || ''), r.status === 200 ? '' : r.buffer.toString().slice(0, 200));
    const lines = zlib.gunzipSync(r.buffer).toString('utf8').trim().split('\n').map((line) => JSON.parse(line));
    const header = lines[0];
    const footer = lines[lines.length - 1];
    ok('trae encabezado y totales, y quedó completo', header.type === 'header' && footer.type === 'footer' && footer.complete === true, JSON.stringify({ h: header.type, f: footer.type, c: footer.complete }));
    const tables = new Set(header.tables);
    ok('incluye las tablas de usuarios, carpetas, cartas, pedidos, planes y ventas presenciales', ['User', 'Folder', 'Card', 'Order', 'Subscription', 'InPersonSale', 'ModerationAudit', 'Message', 'SellerReview'].every((name) => tables.has(name)), JSON.stringify([...tables].slice(0, 40)));
    ok('no incluye el catálogo de cartas ni las tablas Tcg', ![...tables].some((name) => /^(Catalog|Tcg)/.test(name)), JSON.stringify([...tables].filter((name) => /^(Catalog|Tcg)/.test(name))));
    const rowsOf = (name) => lines.filter((line) => line.table === name).flatMap((line) => line.rows);
    ok('las filas coinciden con la base (usuarios)', rowsOf('User').length === before && footer.counts.User === before, rowsOf('User').length + ' vs ' + before);
    ok('incluye a las cuentas de prueba', rowsOf('User').some((row) => row.username === 'cztest_admin'), '');
    ok('el total del pie suma las filas escritas', footer.totalRows === lines.filter((line) => line.table).reduce((sum, line) => sum + line.rows.length, 0), String(footer.totalRows));
    ok('el respaldo no cambia datos (misma cantidad de usuarios)', (await users()) === before, '');

    // ---- Auditoría y estado
    const audit = await prisma.moderationAudit.findFirst({ where: { action: 'backup.download' }, orderBy: { createdAt: 'desc' } });
    const admin = await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + 'admin' }, select: { id: true } });
    ok('queda registrado en la auditoría con quién lo hizo', audit?.actorId === admin.id && audit.meta?.tables === header.tables.length, JSON.stringify(audit));
    r = await call('GET', '/admin/backup/status', 'admin');
    ok('el estado muestra el último respaldo y quién lo hizo', r.status === 200 && r.j.last?.by === 'cztest_admin' && r.j.tables === header.tables.length, JSON.stringify(r.j));

    // ---- Uno a la vez
    const burst = await Promise.all([1, 2, 3].map(() => download('admin', { confirm: true })));
    ok('descargas simultáneas: terminan bien o se rechazan con 409 (nunca error del servidor)', burst.every((x) => x.status === 200 || x.status === 409) && burst.some((x) => x.status === 200), JSON.stringify(burst.map((x) => x.status)));
    await prisma.moderationAudit.deleteMany({ where: { action: 'backup.download' } });
  } finally {
    await prisma.$disconnect();
  }
})();
