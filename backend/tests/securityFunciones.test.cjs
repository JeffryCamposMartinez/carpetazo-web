// 20 pruebas de seguridad de las funciones por plan, el catálogo y la bandeja de reclamos: entradas hostiles, propiedad ajena,
// asignación masiva, falsificación de cabeceras, límites y roles.
const { prisma, B, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.82.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());
const raw = async (method, path, who, body, headers = {}) => {
  const res = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip(), ...(who ? { Authorization: 'Bearer test-cztest-' + who } : {}), ...headers }, body });
  let j = null; let text = '';
  try { text = await res.text(); j = JSON.parse(text); } catch (_) { /* sin JSON */ }
  return { status: res.status, j, text, headers: res.headers };
};
const noServerError = (statuses) => statuses.every((status) => status < 500);

(async () => {
  const restorePlans = await snapshotPlans(['nobuyer', 'ignacio', 'seller', 'ale']);
  const startedAt = new Date();
  const folders = [];
  const roleSaved = {};
  try {
    const uid = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true, role: true } }));
    const me = await uid('nobuyer'); const other = await uid('ignacio'); const seller = await uid('seller'); const ale = await uid('ale');
    await prisma.planGrant.updateMany({ where: { userId: { in: [me.id, other.id, seller.id, ale.id] }, revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.subscription.deleteMany({ where: { userId: { in: [me.id, other.id, seller.id, ale.id] } } });
    const folder = async (userId, name) => { const f = await prisma.folder.create({ data: { name, userId, tcg: 'Pokemon', isPublic: true } }); folders.push(f.id); return f; };
    const card = (folderId, name, extra = {}) => prisma.card.create({ data: { folderId, tcgId: 'tst-sg', name, price: 900, stock: 2, ...extra } });
    const mine = await folder(me.id, 'SG propia'); const theirs = await folder(other.id, 'SG ajena');
    const myCard = await card(mine.id, 'SG mi carta'); const theirCard = await card(theirs.id, 'SG su carta');
    await plan('nobuyer', 'free');
    let r;

    // SEG 01: texto de búsqueda con SQL, comodines y caracteres de control
    const odd = ["' OR 1=1 --", '"; DROP TABLE "Card"; --', '%', '_', '\\', 'a\u0000b', '\u{1F600}'.repeat(30), '<script>alert(1)</script>'];
    const sCodes = [];
    for (const q of odd) { sCodes.push((await raw('GET', '/cards/search?q=' + encodeURIComponent(q))).status); sCodes.push((await raw('GET', '/tcg/search-index?q=' + encodeURIComponent(q))).status); }
    ok('SEG 01 · buscar con SQL, comodines, NUL, emojis y HTML nunca da error del servidor', noServerError(sCodes), JSON.stringify(sCodes));

    // SEG 02: el filtro de juego del catálogo no acepta comodines ni caracteres especiales
    const gameCodes = [];
    for (const g of ['%', 'Magic%', 'Magic;', 'Ma gic,\\', '../x', "Magic'", 'Magic\u0000']) gameCodes.push((await raw('GET', '/tcg/search-index?q=dragon&game=' + encodeURIComponent(g))).status);
    // «_» es válido (hay juegos como One_Piece) pero se compara por nombre exacto, no como comodín: no trae nada; el salto de línea final se recorta
    const underscore = await raw('GET', '/tcg/search-index?q=dragon&game=_'); const trimmed = await raw('GET', '/tcg/search-index?q=dragon&game=' + encodeURIComponent('Magic\n')); const plain = await raw('GET', '/tcg/search-index?q=dragon&game=Magic');
    ok('SEG 02 · el filtro de juego rechaza comodines y caracteres especiales (400); «_» no actúa como comodín', gameCodes.every((s) => s === 400) && underscore.status === 200 && underscore.j.cards.length === 0 && trimmed.j.total === plain.j.total, JSON.stringify({ gameCodes, underscore: underscore.j?.cards?.length }));

    // SEG 03: parámetros repetidos o como arreglo en el orden y el juego
    const dup = [(await raw('GET', '/cards/search?q=a&sort=price_asc&sort=best_selling')).status, (await raw('GET', '/cards/search?q=a&sort[]=recent')).status, (await raw('GET', '/tcg/search-index?q=dragon&game=Magic&game=YuGiOh')).status, (await raw('GET', '/tcg/search-index?q=dragon&sort=latest_edition&sort=best_selling')).status, (await raw('GET', '/cards/search?q[]=a&q[]=b')).status];
    ok('SEG 03 · parámetros repetidos o en forma de arreglo no rompen nada (nunca 5xx)', noServerError(dup), JSON.stringify(dup));

    // SEG 04: páginas y límites absurdos en las listas públicas y de moderación
    const pages = [];
    for (const p of ['-1', '0', '1.5', 'NaN', '1e9', '99999999999999999999', '0x10', ' 2 ']) { pages.push((await raw('GET', '/cards/search?q=a&page=' + encodeURIComponent(p))).status); pages.push((await raw('GET', '/tcg/search-index?q=dragon&page=' + encodeURIComponent(p))).status); pages.push((await raw('GET', '/admin/feedback?page=' + encodeURIComponent(p), 'admin')).status); }
    ok('SEG 04 · páginas negativas, decimales, NaN y enormes nunca dan error del servidor', noServerError(pages), JSON.stringify([...new Set(pages)]));

    // SEG 05: ids hostiles al destacar cartas
    const featureCodes = [];
    for (const bad of ["' OR '1'='1", '../../x', '%00', '<img>', 'a'.repeat(300), '00000000-0000-0000-0000-000000000000', mine.id.toUpperCase() + ' ']) featureCodes.push((await raw('PUT', `/folders/${encodeURIComponent(bad)}/cards/${encodeURIComponent(bad)}/featured`, 'nobuyer', JSON.stringify({ featured: true }))).status);
    ok('SEG 05 · destacar con ids hostiles → 404 (nunca 5xx ni éxito)', featureCodes.every((s) => s === 404), JSON.stringify(featureCodes));

    // SEG 06: cuerpos que no son un objeto con «featured» booleano
    const bodies = ['[]', 'null', '"true"', '1', '{"featured":1}', '{"featured":"false"}', '{"featured":[true]}', '{"featured":{"a":true}}', '', '{"featured":'];
    const bodyCodes = [];
    for (const body of bodies) bodyCodes.push((await raw('PUT', `/folders/${mine.id}/cards/${myCard.id}/featured`, 'nobuyer', body)).status);
    ok('SEG 06 · destacar con cuerpos inválidos → 400 y la carta no cambia', bodyCodes.every((s) => s === 400) && !(await prisma.card.findUnique({ where: { id: myCard.id } })).featuredAt, JSON.stringify(bodyCodes));

    // SEG 07: el detalle de visitas de una persona no muestra carpetas de otra
    await plan('nobuyer', 'premium'); await plan('ignacio', 'premium');
    const day = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    await prisma.folderVisitDay.upsert({ where: { folderId_day_source: { folderId: theirs.id, day, source: 'direct' } }, create: { folderId: theirs.id, day, source: 'direct', count: 99 }, update: { count: 99 } });
    r = await call('GET', '/visits/mine?days=90', 'nobuyer', undefined, ip());
    ok('SEG 07 · /visits/mine solo trae carpetas propias (la ajena con 99 visitas no aparece)', r.status === 200 && r.j.folders.every((f) => f.id !== theirs.id) && !JSON.stringify(r.j).includes(theirs.id), String(r.status));

    // SEG 08: exportar el inventario con el id de carpeta ajeno en varias formas
    await plan('nobuyer', 'enthusiast');
    const forms = ['?folderId=' + theirs.id, '?folderId=' + theirs.id.toUpperCase(), '?folderId=' + theirs.id + '%20', '?folderId[]=' + theirs.id, '?folderId=' + theirs.id + '&folderId=' + mine.id, '?folderId=' + mine.id + '&folderId=' + theirs.id, '?folderId=%00' + theirs.id];
    const leaks = []; const exportCodes = [];
    for (const q of forms) { const e = await raw('GET', '/inventory/export' + q, 'nobuyer'); exportCodes.push(e.status); if (/SG su carta/.test(e.text)) leaks.push(q); }
    ok('SEG 08 · exportar con el id de una carpeta ajena (mayúsculas, espacio, arreglo, repetido, NUL) nunca filtra sus cartas', leaks.length === 0 && noServerError(exportCodes), JSON.stringify({ exportCodes, leaks }));

    // SEG 09: la ruta de exportar no acepta cuerpos ni métodos de escritura
    const methods = [];
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) methods.push((await raw(m, '/inventory/export', 'nobuyer', '{}')).status);
    ok('SEG 09 · /inventory/export solo responde a GET (el resto → 404/405)', methods.every((s) => s === 404 || s === 405), JSON.stringify(methods));

    // SEG 10: cabeceras para disfrazar el método no permiten escribir donde no se puede
    const tunnel = [];
    for (const h of ['X-HTTP-Method-Override', 'X-Method-Override', 'X-HTTP-Method']) tunnel.push((await raw('POST', `/folders/${mine.id}/cards/${theirCard.id}/featured`, 'nobuyer', JSON.stringify({ featured: true }), { [h]: 'PUT' })).status);
    ok('SEG 10 · X-HTTP-Method-Override no convierte un POST en PUT (y la carta ajena sigue sin destacar)', tunnel.every((s) => s === 404 || s === 405) && !(await prisma.card.findUnique({ where: { id: theirCard.id } })).featuredAt, JSON.stringify(tunnel));

    // SEG 11: asignación masiva al crear y editar cartas: no se puede destacar saltándose el límite
    await plan('nobuyer', 'free');
    const created = await call('POST', `/folders/${mine.id}/cards`, 'nobuyer', { tcgId: 'sg-masivo', name: 'SG masivo', price: 100, stock: 1, data: { language: 'English' }, featuredAt: new Date().toISOString(), moderationState: 'hidden', folderId: theirs.id, id: 'x' }, ip());
    const cid = created.j?.card?.id;
    const edits = [];
    if (cid) {
      edits.push((await call('PUT', `/folders/${mine.id}/cards/${cid}`, 'nobuyer', { price: 150, featuredAt: new Date().toISOString(), moderationState: 'removed', folderId: theirs.id }, ip())).status);
      edits.push((await call('PUT', `/folders/${mine.id}/cards-bulk`, 'nobuyer', { updates: [{ id: cid, price: 160, featuredAt: new Date().toISOString() }] }, ip())).status);
    }
    const saved = cid ? await prisma.card.findUnique({ where: { id: cid } }) : null;
    ok('SEG 11 · «featuredAt», «moderationState» y «folderId» enviados al crear o editar se ignoran', Boolean(saved) && !saved.featuredAt && saved.moderationState === 'visible' && saved.folderId === mine.id, JSON.stringify({ created: created.status, edits, featured: saved?.featuredAt }));

    // SEG 12: ni el perfil ni los pedidos aceptan campos de plan o de rol
    const attack = { planKey: 'store', plan: { key: 'store', featuredCards: 999 }, subscription: { planKey: 'store' }, role: 'admin', isOwner: true, wishlistLists: 99, socialLinks: 99 };
    await call('PUT', '/users/me', 'nobuyer', attack, ip()); await call('POST', '/users/sync', 'nobuyer', { ...attack, displayName: 'X' }, ip());
    const state = (await call('GET', '/billing/me', 'nobuyer', undefined, ip())).j; const after = await prisma.user.findUnique({ where: { id: me.id }, select: { role: true, isOwner: true } });
    ok('SEG 12 · enviar «planKey», «role», «isOwner» o topes inventados por el perfil o la sincronización no cambia plan ni rol', state.plan.key === 'free' && state.plan.featuredCards === 3 && after.role === 'user' && after.isOwner === false, JSON.stringify([state.plan.key, state.plan.featuredCards, after.role]));

    // SEG 13: cabeceras y parámetros que pretenden cambiar el plan se ignoran
    const spoof = await raw('PUT', `/folders/${mine.id}/cards/${myCard.id}/featured?plan=store&planKey=store`, 'nobuyer', JSON.stringify({ featured: true }), { 'X-Plan': 'store', 'X-Plan-Key': 'store', 'X-Role': 'admin', 'X-User-Plan': 'store' });
    await prisma.card.updateMany({ where: { folder: { userId: me.id } }, data: { featuredAt: null } });
    const extras = [];
    for (let i = 0; i < 4; i += 1) extras.push(await card(mine.id, 'SG extra ' + i));
    const flood = [];
    for (const c of [myCard, ...extras]) flood.push((await raw('PUT', `/folders/${mine.id}/cards/${c.id}/featured?plan=store`, 'nobuyer', JSON.stringify({ featured: true }), { 'X-Plan': 'store' })).status);
    ok('SEG 13 · «?plan=store» y «X-Plan: store» no suben el tope (con Free, la cuarta destacada → 403)', spoof.status === 200 && flood.filter((s) => s === 200).length === 3 && flood.filter((s) => s === 403).length === 2, JSON.stringify(flood));
    await prisma.card.updateMany({ where: { folder: { userId: me.id } }, data: { featuredAt: null } });

    // SEG 14: límite de exportaciones por conexión (20 por hora)
    await plan('nobuyer', 'enthusiast');
    const sameIp = '10.82.250.250'; const rate = [];
    for (let i = 0; i < 22; i += 1) rate.push((await raw('GET', '/inventory/export', 'nobuyer', undefined, { 'X-Forwarded-For': sameIp })).status);
    ok('SEG 14 · exportar el inventario más de 20 veces por hora desde la misma conexión → 429', rate.slice(0, 20).every((s) => s === 200) && rate.slice(20).every((s) => s === 429), JSON.stringify([rate.filter((s) => s === 200).length, rate.filter((s) => s === 429).length]));

    // SEG 15: nadie se da prioridad de soporte enviando el campo
    await plan('nobuyer', 'free');
    await prisma.feedback.deleteMany({ where: { userId: me.id } });
    r = await call('POST', '/feedback', 'nobuyer', { kind: 'complaint', title: 'SG15 intento de prioridad', message: 'Texto de prueba suficiente', priority: true, prioritySupport: true, plan: 'store', userId: other.id, status: 'corrected' }, ip());
    const list = await call('GET', '/admin/feedback?status=all', 'admin', undefined, ip());
    const row = list.j.feedback.find((f) => f.title === 'SG15 intento de prioridad');
    const stored15 = await prisma.feedback.findFirst({ where: { title: 'SG15 intento de prioridad' } });
    ok('SEG 15 · «priority», «plan», «userId» y «status» enviados en un reclamo se ignoran (sin prioridad, a nombre propio, abierto)', r.status === 201 && row && row.priority === false && stored15.userId === me.id && stored15.status === 'open', JSON.stringify([r.status, row?.priority, stored15?.status]));

    // SEG 16: la bandeja de reclamos sigue cerrada sin sesión y a las personas normales
    const closed = [(await raw('GET', '/admin/feedback')).status, (await raw('GET', '/admin/feedback', 'nobuyer')).status, (await raw('GET', '/admin/feedback?status=all&page=1', 'seller')).status];
    ok('SEG 16 · la bandeja de reclamos: sin sesión → 401 y persona normal → 403', closed[0] === 401 && closed[1] === 403 && closed[2] === 403, JSON.stringify(closed));
    await prisma.feedback.deleteMany({ where: { title: 'SG15 intento de prioridad' } });

    // SEG 17: el origen de la visita solo acepta los tres valores conocidos
    const visited = await folder(other.id, 'SG visitas');
    const sources = ['direct; DROP TABLE', ['internal'], { a: 1 }, '', null, 'EXTERNAL', 'x'.repeat(5000), 7];
    const visitCodes = [];
    for (const source of sources) visitCodes.push((await raw('POST', '/folders/' + visited.id + '/visit', undefined, JSON.stringify({ source }), { 'User-Agent': 'Mozilla/5.0 (X11; Linux) SG' })).status);
    const stored = await prisma.folderVisitDay.findMany({ where: { folderId: visited.id } });
    ok('SEG 17 · el origen de la visita inventado o con formato raro se guarda como «direct» (nunca otro texto)', noServerError(visitCodes) && stored.length > 0 && stored.every((v) => ['direct', 'internal', 'external'].includes(v.source)), JSON.stringify(stored.map((v) => v.source)));

    // SEG 18: repetir la misma visita muchas veces desde una conexión no infla el contador
    const flooded = await folder(other.id, 'SG inflar visitas');
    const same = '10.82.251.1';
    for (let i = 0; i < 40; i += 1) await raw('POST', '/folders/' + flooded.id + '/visit', undefined, '{}', { 'User-Agent': 'Mozilla/5.0 (X11; Linux) SG', 'X-Forwarded-For': same });
    const sum = (await prisma.folderVisitDay.findMany({ where: { folderId: flooded.id } })).reduce((s, v) => s + v.count, 0);
    ok('SEG 18 · 40 visitas a la misma carpeta desde la misma conexión cuentan 1', sum === 1, String(sum));

    // SEG 19: fórmulas de planilla en el CSV (tabulación, retorno de carro, signos) se neutralizan
    const evil = ['\t=1+1', '\r=cmd|calc', '=2+2', '+SUM(A1)', '-1+1', '@HYPERLINK("x")', '=HYPERLINK("http://evil.test")'];
    for (const [i, name] of evil.entries()) await card(mine.id, name, { tcgId: 'sg-csv-' + i });
    await plan('nobuyer', 'enthusiast');
    const exp = await raw('GET', '/inventory/export?folderId=' + mine.id, 'nobuyer');
    const cells = exp.text.split('\r\n').slice(1).filter(Boolean).map((line) => line.split(',')[2]);
    const dangerous = cells.filter((cell) => /^"?[=+\-@\t\r]/.test(cell));
    ok('SEG 19 · en el CSV ninguna celda empieza con = + - @ tabulación o retorno de carro (se antepone una comilla)', exp.status === 200 && dangerous.length === 0 && evil.every((_, i) => exp.text.includes('sg-csv-' + i)), JSON.stringify(dangerous));

    // SEG 20: el rol de equipo no regala funciones de plan (un co-administrador con plan Free sigue con los topes de Free)
    roleSaved.ale = ale.role;
    await prisma.user.update({ where: { id: ale.id }, data: { role: 'coadmin' } });
    const aleFolder = await folder(ale.id, 'SG ale');
    const aleCards = []; for (let i = 0; i < 5; i += 1) aleCards.push(await card(aleFolder.id, 'SG ale ' + i));
    const aleResults = []; for (const c of aleCards) aleResults.push((await call('PUT', `/folders/${aleFolder.id}/cards/${c.id}/featured`, 'ale', { featured: true }, ip())).status);
    const aleExport = await raw('GET', '/inventory/export', 'ale'); const aleVisits = await call('GET', '/visits/mine', 'ale', undefined, ip());
    ok('SEG 20 · co-administrador con plan Free: 3 destacadas máximo, sin exportar ni detalle de visitas', aleResults.filter((s) => s === 200).length === 3 && aleResults.filter((s) => s === 403).length === 2 && aleExport.status === 403 && aleVisits.status === 403, JSON.stringify([aleResults, aleExport.status, aleVisits.status]));
  } finally {
    if (roleSaved.ale) await prisma.user.updateMany({ where: { firebaseUid: 'cztest-ale' }, data: { role: roleSaved.ale } }).catch(() => {});
    await prisma.card.deleteMany({ where: { OR: [{ tcgId: { startsWith: 'tst-sg' } }, { tcgId: { startsWith: 'sg-' } }, { name: { startsWith: 'SG ' } }] } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { id: { in: folders } } }).catch(() => {});
    await prisma.feedback.deleteMany({ where: { title: { startsWith: 'SG15' } } }).catch(() => {});
    const owners = (await prisma.user.findMany({ where: { firebaseUid: { in: ['cztest-nobuyer', 'cztest-ignacio', 'cztest-seller', 'cztest-ale'] } }, select: { id: true } })).map((u) => u.id);
    await prisma.report.deleteMany({ where: { createdAt: { gte: startedAt }, targetOwnerId: { in: owners } } }).catch(() => {});
    void NAMES;
    await restorePlans().catch(() => {});
    await prisma.$disconnect();
  }
})();
