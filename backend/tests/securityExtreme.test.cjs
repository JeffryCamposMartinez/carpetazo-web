// Seguridad extrema sobre lo nuevo: venta presencial, respaldo y cambio de roles, con entradas hostiles y concurrencia.
const zlib = require('node:zlib');
const { prisma, B, U, call, ok } = require('./fixtures.cjs');

const rid = () => 'sx' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
let hit = 0;
const raw = async (method, path, who, rawBody, headers = {}) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.90.0.' + (++hit), ...(who ? { Authorization: 'Bearer test-' + U[who] } : {}), ...headers }, body: rawBody });
  let j = null;
  try { j = JSON.parse(await r.text()); } catch (_) { /* sin JSON */ }
  return { status: r.status, j };
};

(async () => {
  const startedAt = new Date();
  const touched = [];
  try {
    const user = (who) => prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true, role: true, isOwner: true, username: true } });
    const seller = await user('seller');
    const jerry = await user('jerry');
    const ignacio = await user('ignacio');
    const ale = await user('ale');
    touched.push(ale);
    const folder = await prisma.folder.create({ data: { name: 'SX presencial', userId: seller.id, tcg: 'Pokemon', isPublic: true } });
    const jerryFolder = await prisma.folder.create({ data: { name: 'SX de jerry', userId: jerry.id, tcg: 'Pokemon', isPublic: true } });
    const card = (folderId, name, price, stock) => prisma.card.create({ data: { folderId, tcgId: 'tst-sx', name, price, stock } });
    const A = await card(folder.id, 'SX A', 1000, 10);
    const Last = await card(folder.id, 'SX ultima unidad', 500, 1);
    const Same = await card(folder.id, 'SX misma solicitud', 500, 5);
    const Big = await card(folder.id, 'SX grande', 100000000, 100000);
    const J = await card(jerryFolder.id, 'SX de jerry', 700, 3);
    const stock = async (c) => (await prisma.card.findUnique({ where: { id: c.id } })).stock;
    const url = '/folders/' + folder.id + '/in-person-sales';
    const sell = (who, items, extra = {}, path = url) => call('POST', path, who, { requestId: rid(), items, ...extra }, '10.94.' + Math.floor(++hit / 250) + '.' + (hit % 250));
    let r;

    // ---- Asignación masiva y campos que el cliente no manda
    const salesBefore = await prisma.inPersonSale.count({ where: { userId: seller.id } });
    r = await sell('seller', [{ cardId: A.id, quantity: 2, total: 1, units: 99, userId: jerry.id, name: 'otro', price: 1, stock: 5 }], { total: 1, units: 99, userId: jerry.id, folderId: jerryFolder.id, folderName: 'falso', createdAt: '2000-01-01', id: 'x' });
    const made = await prisma.inPersonSale.findFirst({ where: { userId: seller.id }, orderBy: { createdAt: 'desc' } });
    ok('campos extra (total, unidades, dueño, carpeta, fecha) se ignoran: lo calcula el servidor', r.status === 201 && made.total === 2000 && made.units === 2 && made.userId === seller.id && made.folderId === folder.id && made.folderName === 'SX presencial' && made.createdAt.getFullYear() > 2020 && (await stock(A)) === 8, JSON.stringify(made).slice(0, 160));
    ok('no se creó ninguna venta a nombre de otra persona', (await prisma.inPersonSale.count({ where: { userId: jerry.id } })) === 0, '');

    // ---- Cantidades y precios hostiles (ninguna debe descontar stock ni dar 5xx)
    const hostile = [
      ['cantidad 0', { cardId: A.id, quantity: 0 }], ['cantidad negativa', { cardId: A.id, quantity: -5 }], ['cantidad decimal', { cardId: A.id, quantity: 1.5 }],
      ['cantidad «1e2»', { cardId: A.id, quantity: '1e2' }], ['cantidad NaN', { cardId: A.id, quantity: 'NaN' }], ['cantidad Infinity', { cardId: A.id, quantity: 'Infinity' }],
      ['cantidad enorme', { cardId: A.id, quantity: 1e308 }], ['cantidad objeto', { cardId: A.id, quantity: { $gt: 0 } }], ['cantidad arreglo', { cardId: A.id, quantity: [1] }],
      ['cantidad pasa el máximo', { cardId: A.id, quantity: 100001 }], ['precio negativo', { cardId: A.id, quantity: 1, unitPrice: -1 }],
      ['precio NaN', { cardId: A.id, quantity: 1, unitPrice: 'NaN' }], ['precio Infinity', { cardId: A.id, quantity: 1, unitPrice: 'Infinity' }],
      ['precio sobre el máximo', { cardId: A.id, quantity: 1, unitPrice: 100000001 }], ['precio objeto', { cardId: A.id, quantity: 1, unitPrice: { a: 1 } }],
      ['carta con inyección SQL', { cardId: "' OR '1'='1", quantity: 1 }], ['carta con comodín', { cardId: '%', quantity: 1 }], ['carta con ruta', { cardId: '../../etc/passwd', quantity: 1 }],
      ['carta como arreglo', { cardId: [A.id], quantity: 1 }], ['carta como objeto', { cardId: { in: [A.id] }, quantity: 1 }], ['carta nula', { cardId: null, quantity: 1 }], ['línea nula', null], ['línea numérica', 7]
    ];
    const before = await stock(A);
    for (const [name, line] of hostile) {
      r = await sell('seller', [line]);
      ok(`entrada hostil rechazada: ${name}`, r.status >= 400 && r.status < 500, String(r.status));
    }
    ok('ninguna entrada hostil tocó el stock', (await stock(A)) === before, String(await stock(A)));

    // ---- Forma de la petición
    for (const [name, items] of [['sin líneas', []], ['líneas como texto', 'abc'], ['líneas como objeto', { 0: { cardId: A.id, quantity: 1 } }], ['101 líneas', Array.from({ length: 101 }, () => ({ cardId: A.id, quantity: 1 }))], ['línea repetida', [{ cardId: A.id, quantity: 1 }, { cardId: A.id, quantity: 1 }]]]) {
      r = await sell('seller', items);
      ok(`forma inválida rechazada: ${name}`, r.status === 400, String(r.status));
    }
    for (const bad of ['', 'corto', 'a'.repeat(65), 'con espacio 123', "x'; DROP TABLE \"User\";--", '../../../x', '<script>1</script>', '%00%00%00%00%00', 'ñññññññññ']) {
      r = await call('POST', url, 'seller', { requestId: bad, items: [{ cardId: A.id, quantity: 1 }] });
      ok(`solicitud inválida rechazada: ${JSON.stringify(bad).slice(0, 30)}`, r.status === 400, String(r.status));
    }
    for (const body of ['{"requestId":"abc12345678","items":[{"cardId":"' + A.id + '","quantity":1}], "__proto__": {"admin": true}}', '{"requestId":"abc12345679","constructor":{"prototype":{"x":1}},"items":[{"cardId":"' + A.id + '","quantity":1,"__proto__":{"price":1}}]}']) {
      r = await raw('POST', url, 'seller', body);
      ok('«__proto__» y «constructor» en el cuerpo no rompen nada', r.status === 201 || r.status === 200, String(r.status));
    }
    ok('la contaminación de prototipos no llegó al servidor', ({}).admin === undefined && (await call('GET', '/health')).status === 200, '');
    r = await raw('POST', url, 'seller', '{"requestId":');
    ok('JSON roto → 400 sin detalles internos', r.status === 400 && !/at |node_modules|SyntaxError/.test(JSON.stringify(r.j)), JSON.stringify(r.j).slice(0, 100));
    r = await raw('POST', url, 'seller', JSON.stringify({ requestId: rid(), items: [{ cardId: A.id, quantity: 1, pad: 'x'.repeat(3 * 1024 * 1024) }] }));
    ok('cuerpo de 3 MB → 413', r.status === 413, String(r.status));
    r = await raw('POST', url, 'seller', JSON.stringify({ requestId: rid(), items: [{ cardId: A.id, quantity: 1 }] }), { 'Content-Type': 'text/plain' });
    ok('sin «application/json» no se procesa', r.status >= 400 && r.status < 500, String(r.status));
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      r = await raw(method, url, 'seller', '{}');
      ok(`${method} sobre la venta presencial no existe`, r.status === 404 || r.status === 405, String(r.status));
    }

    // ---- Propiedad: nadie vende ni lee lo ajeno
    r = await sell('jerry', [{ cardId: A.id, quantity: 1 }]);
    ok('otra persona no puede vender de mi carpeta → 404', r.status === 404, String(r.status));
    r = await sell('jerry', [{ cardId: A.id, quantity: 1 }], {}, '/folders/' + jerryFolder.id + '/in-person-sales');
    ok('ni usando su carpeta con una carta mía → 400', r.status === 400, String(r.status));
    r = await sell('seller', [{ cardId: J.id, quantity: 1 }]);
    ok('una carta de otra carpeta no se puede vender en la mía → 400', r.status === 400 && (await stock(J)) === 3, String(r.status));
    r = await call('GET', url, 'jerry');
    ok('otra persona no lee mi historial → 404', r.status === 404, String(r.status));
    r = await call('GET', '/in-person-sales/mine', 'jerry');
    ok('«mis ventas» de otra persona no incluyen las mías', r.status === 200 && r.j.sales.length === 0, JSON.stringify(r.j).slice(0, 80));
    r = await call('GET', '/in-person-sales/mine', 'seller');
    ok('«mis ventas» solo trae las mías', r.status === 200 && r.j.sales.length > 0 && r.j.sales.every((s) => s.folderId === folder.id), String(r.status));
    ok('la venta no expone el dueño ni la solicitud', r.j.sales.every((s) => !('userId' in s) && !('requestId' in s)), Object.keys(r.j.sales[0] || {}).join(','));
    const adminPeek = await call('GET', url, 'admin');
    ok('ni siquiera un administrador lee el historial presencial de otra persona por esta ruta → 404', adminPeek.status === 404, String(adminPeek.status));
    for (const bad of ['../x', '%2e%2e%2f', "1' OR '1'='1", 'null', 'undefined', 'a'.repeat(300), '00000000-0000-0000-0000-000000000000']) {
      r = await call('GET', '/folders/' + encodeURIComponent(bad) + '/in-person-sales', 'seller');
      ok(`carpeta hostil «${bad.slice(0, 20)}» → 404`, r.status === 404, String(r.status));
    }
    // Una solicitud repetida de OTRA persona nunca devuelve la venta de la primera
    const shared = rid();
    r = await call('POST', url, 'seller', { requestId: shared, items: [{ cardId: A.id, quantity: 1 }] });
    const stolen = await call('POST', '/folders/' + jerryFolder.id + '/in-person-sales', 'jerry', { requestId: shared, items: [{ cardId: J.id, quantity: 1 }] });
    ok('la misma «requestId» en otra cuenta crea su propia venta y no revela la mía', r.status === 201 && stolen.status === 201 && stolen.j.sale.id !== r.j.sale.id && stolen.j.sale.folderId === jerryFolder.id, JSON.stringify(stolen.j).slice(0, 120));

    // ---- Concurrencia
    const aBefore = await stock(Last);
    const race = await Promise.all(Array.from({ length: 25 }, () => sell('seller', [{ cardId: Last.id, quantity: 1 }])));
    ok('25 ventas a la vez de la última unidad: exactamente 1 sale y las demás 409', race.filter((x) => x.status === 201).length === 1 && race.filter((x) => x.status === 409).length === 24 && (await stock(Last)) === aBefore - 1, JSON.stringify(race.map((x) => x.status)));
    const same = rid();
    const dup = await Promise.all(Array.from({ length: 20 }, () => call('POST', url, 'seller', { requestId: same, items: [{ cardId: Same.id, quantity: 2 }] }, '10.95.0.' + (++hit % 250))));
    ok('20 envíos con la misma solicitud: una sola venta y el stock baja una vez', dup.every((x) => x.status === 200 || x.status === 201) && (await prisma.inPersonSale.count({ where: { userId: seller.id, requestId: same } })) === 1 && (await stock(Same)) === 3, JSON.stringify(dup.map((x) => x.status)));
    const mix = await Promise.all([...Array.from({ length: 10 }, () => sell('seller', [{ cardId: A.id, quantity: 1 }])), ...Array.from({ length: 10 }, () => sell('seller', [{ cardId: A.id, quantity: 2 }]))]);
    ok('ventas mezcladas a la vez: el stock nunca queda negativo', (await stock(A)) >= 0 && mix.every((x) => x.status === 201 || x.status === 409), String(await stock(A)));

    // ---- Números extremos que sí son válidos
    r = await sell('seller', [{ cardId: Big.id, quantity: 100000 }]);
    ok('la venta más grande permitida no desborda (total 1e13)', r.status === 201 && r.j.sale.total === 1e13 && (await stock(Big)) === 0, JSON.stringify(r.j).slice(0, 100));
    for (const price of [0.1, 1500.5, 1e-9]) {
      r = await sell('seller', [{ cardId: Same.id, quantity: 1, unitPrice: price }]);
      ok('el precio debe ser en pesos justos, sin decimales: ' + price + ' → 400', r.status === 400, String(r.status));
    }

    // ---- Respaldo: cuerpo hostil, rutas y roles
    for (const body of ['{}', '{"confirm":"true"}', '{"confirm":1}', '{"confirm":[true]}', '{"confirm":{"a":true}}', '{"confirm":null}', 'null', '[]', '"true"']) {
      r = await raw('POST', '/admin/backup', 'admin', body);
      ok(`respaldo con cuerpo hostil ${body.slice(0, 22)} → 400`, r.status === 400, String(r.status));
    }
    r = await raw('GET', '/admin/backup', 'admin');
    ok('GET no descarga el respaldo', r.status === 404 || r.status === 405, String(r.status));
    for (const who of ['seller', 'jerry', 'ignacio']) {
      r = await raw('POST', '/admin/backup', who, '{"confirm":true}');
      ok(`${who} (persona normal) no descarga el respaldo`, r.status === 403, String(r.status));
    }
    r = await raw('POST', '/admin/backup', undefined, '{"confirm":true}', { Authorization: 'Bearer ' });
    ok('«Bearer» vacío → 401', r.status === 401, String(r.status));
    r = await raw('POST', '/admin/backup', undefined, '{"confirm":true}', { Authorization: 'Bearer ' + 'a'.repeat(20000) });
    ok('token de 20 KB → 401 o 431, nunca 5xx', [401, 431, 400].includes(r.status), String(r.status));
    r = await raw('POST', '/admin/backup', undefined, '{"confirm":true}', { Authorization: 'Bearer test-cztest-admin\r\nX-Role: admin' }).catch(() => ({ status: 0 }));
    ok('inyección de cabeceras en el token no da acceso', r.status !== 200, String(r.status));
    r = await raw('POST', '/admin/backup', undefined, '{"confirm":true}', { 'X-Role': 'admin', 'X-User-Id': seller.id, 'X-Forwarded-User': 'admin' });
    ok('cabeceras de rol falsas sin sesión → 401', r.status === 401, String(r.status));

    // Moderador, soporte y co-administrador: nunca el respaldo; el soporte solo lee
    for (const [role, expectBackup] of [['moderator', 403], ['support', 403], ['coadmin', 403]]) {
      await prisma.user.update({ where: { id: ale.id }, data: { role } });
      r = await raw('POST', '/admin/backup', 'ale', '{"confirm":true}');
      ok(`rol «${role}» no descarga el respaldo`, r.status === expectBackup, String(r.status));
      r = await call('GET', '/admin/backup/status', 'ale');
      ok(`rol «${role}» no ve el estado del respaldo`, r.status === 403, String(r.status));
    }
    await prisma.user.update({ where: { id: ale.id }, data: { role: 'support' } });
    for (const [method, path, body] of [['POST', '/admin/team/' + jerry.id + '/role', { role: 'admin', confirmUsername: jerry.username }], ['POST', '/admin/users/' + jerry.username + '/plan', { planKey: 'pro', reason: 'x', days: 1 }], ['GET', '/admin/users/' + jerry.username + '/details'], ['POST', '/admin/team/' + ignacio.id + '/suspend', { reason: 'x', days: 1, confirmUsername: ignacio.username }]]) {
      r = await call(method, path, 'ale', body);
      ok(`soporte no puede ${method} ${path.replace(jerry.id, ':id').replace(ignacio.id, ':id').replace(jerry.username, ':usuario').slice(0, 40)}`, r.status === 403, String(r.status));
    }
    await prisma.user.update({ where: { id: ale.id }, data: { role: 'moderator' } });
    r = await call('POST', '/admin/team/' + jerry.id + '/role', 'ale', { role: 'moderator', confirmUsername: jerry.username });
    ok('un moderador no puede dar roles', r.status === 403, String(r.status));
    await prisma.user.update({ where: { id: ale.id }, data: { role: 'coadmin' } });
    for (const role of ['admin', 'coadmin']) {
      r = await call('POST', '/admin/team/' + jerry.id + '/role', 'ale', { role, confirmUsername: jerry.username });
      ok(`un co-administrador no puede dar el rol «${role}»`, r.status === 403, String(r.status));
    }
    r = await call('POST', '/admin/team/' + ale.id + '/role', 'ale', { role: 'admin', confirmUsername: ale.username });
    ok('un co-administrador no puede subirse el rol a sí mismo', r.status === 403 && (await prisma.user.findUnique({ where: { id: ale.id } })).role === 'coadmin', String(r.status));
    for (const role of ['superadmin', 'owner', 'ADMIN', '', null, ['admin'], { role: 'admin' }]) {
      r = await call('POST', '/admin/team/' + ignacio.id + '/role', 'admin', { role, confirmUsername: ignacio.username });
      ok(`rol inventado ${JSON.stringify(role)} → 400`, r.status === 400 && (await prisma.user.findUnique({ where: { id: ignacio.id } })).role === 'user', String(r.status));
    }
    r = await call('POST', '/admin/team/' + ignacio.id + '/role', 'admin', { role: 'moderator', confirmUsername: 'otra_persona' });
    ok('dar un rol sin escribir el usuario correcto se rechaza', r.status >= 400 && r.status < 500 && (await prisma.user.findUnique({ where: { id: ignacio.id } })).role === 'user', String(r.status));
    // Una persona normal no se sube el rol editando su propio perfil
    for (const body of [{ role: 'admin' }, { isOwner: true }, { role: 'admin', isOwner: true, email: 'x@x.cl' }, { 'role': { set: 'admin' } }]) {
      await call('PUT', '/users/me', 'ignacio', body);
      await call('PATCH', '/users/me', 'ignacio', body);
      await call('PUT', '/users/me/profile', 'ignacio', body);
    }
    const iAfter = await prisma.user.findUnique({ where: { id: ignacio.id }, select: { role: true, isOwner: true } });
    ok('editar el perfil con «role»/«isOwner» no cambia el rol', iAfter.role === 'user' && iAfter.isOwner === false, JSON.stringify(iAfter));

    // ---- El respaldo completo: contenido sensible y consistencia
    await prisma.user.update({ where: { id: ale.id }, data: { role: ale.role } });
    r = await fetch(B + '/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.91.0.1', Authorization: 'Bearer test-cztest-admin' }, body: JSON.stringify({ confirm: true }) });
    const text = zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
    const lines = text.trim().split('\n').map((line) => JSON.parse(line));
    ok('el respaldo del administrador se descarga completo', r.status === 200 && lines[lines.length - 1].complete === true, String(r.status));
    const keys = new Set(lines.filter((line) => line.rows).flatMap((line) => line.rows.flatMap((row) => Object.keys(row))));
    const secretKeys = [...keys].filter((key) => /password|passwd|secret|private.?key|api.?key|access.?token|refresh.?token/i.test(key));
    ok('el respaldo no contiene columnas de contraseñas, claves ni tokens', secretKeys.length === 0, JSON.stringify(secretKeys));
    ok('el respaldo no trae la clave del servidor ni variables de entorno', !/IP_HASH_SALT|DATABASE_URL|MERCADOPAGO_ACCESS|sk_live|APP_USR-/i.test(text), '');
    const backupAudit = await prisma.moderationAudit.count({ where: { action: 'backup.download' } });
    ok('cada descarga y cada intento permitido quedó en la auditoría', backupAudit >= 1, String(backupAudit));
    // Límite por conexión: la sexta descarga de la misma conexión en una hora se frena
    const same6 = [];
    for (let i = 0; i < 7; i++) same6.push((await raw('POST', '/admin/backup', 'admin', '{"confirm":true}', { 'X-Forwarded-For': '10.92.0.1' })).status);
    ok('el límite de descargas por conexión frena la ráfaga (429)', same6.includes(429), JSON.stringify(same6));
    await prisma.moderationAudit.deleteMany({ where: { action: 'backup.download' } });
  } finally {
    for (const person of touched) await prisma.user.update({ where: { id: person.id }, data: { role: person.role, isOwner: person.isOwner } }).catch(() => {});
    await prisma.card.deleteMany({ where: { tcgId: 'tst-sx' } });
    await prisma.inPersonSale.deleteMany({ where: { folderName: { in: ['SX presencial', 'SX de jerry'] } } });
    await prisma.folder.deleteMany({ where: { name: { in: ['SX presencial', 'SX de jerry'] } } });
    // La detección automática puede abrir reportes por las cartas baratas de cuentas nuevas: no deben quedar en la cola de otras pruebas
    const owners = (await prisma.user.findMany({ where: { firebaseUid: { in: ['cztest-seller', 'cztest-jerry'] } }, select: { id: true } })).map((user) => user.id);
    await prisma.report.deleteMany({ where: { createdAt: { gte: startedAt }, targetOwnerId: { in: owners } } }).catch(() => {});
    await prisma.$disconnect();
  }
})();
