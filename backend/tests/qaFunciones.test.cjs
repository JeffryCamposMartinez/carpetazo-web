// 20 pruebas funcionales de las funciones por plan, el catálogo y la lista de deseos (comportamiento esperado de punta a punta).
const { prisma, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.81.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());
const HOUR = 3600 * 1000;

(async () => {
  const restorePlans = await snapshotPlans(['nobuyer', 'ignacio', 'seller']);
  const startedAt = new Date();
  const fixtures = { folders: [], games: [], feedback: [] };
  try {
    const uid = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
    const me = await uid('nobuyer');
    const pro = await uid('ignacio');
    const seller = await uid('seller');
    await prisma.planGrant.updateMany({ where: { userId: { in: [me, pro, seller] }, revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.subscription.deleteMany({ where: { userId: { in: [me, pro, seller] } } });
    const folder = async (userId, name, extra = {}) => { const f = await prisma.folder.create({ data: { name, userId, tcg: 'Pokemon', isPublic: true, ...extra } }); fixtures.folders.push(f.id); return f; };
    const card = (folderId, name, extra = {}) => prisma.card.create({ data: { folderId, tcgId: 'tst-qa', name, price: 1200, stock: 2, ...extra } });
    await prisma.wishlistItem.deleteMany({ where: { userId: me } }); // parte con las deseadas vacías (otras pruebas comparten la cuenta)
    let r;

    // QA 01: el catálogo público no lista el plan de pruebas (solo para administradores)
    r = await call('GET', '/plans', undefined, undefined, ip());
    ok('QA 01 · /plans lista solo los 5 planes públicos (sin el plan de pruebas)', r.status === 200 && r.j.plans.map((p) => p.key).join() === 'free,enthusiast,premium,pro,store', r.j.plans?.map((p) => p.key).join());

    // QA 02: estado del plan de una cuenta nueva
    await plan('nobuyer', 'free');
    r = await call('GET', '/billing/me', 'nobuyer', undefined, ip());
    ok('QA 02 · /billing/me: plan Free, con uso por carpeta y sin el conteo por juego que se eliminó', r.status === 200 && r.j.plan.key === 'free' && typeof r.j.usage.folders === 'number' && 'byFolder' in r.j.usage && !('byTcg' in r.j.usage) && !('foldersPerTcg' in r.j.plan), JSON.stringify(Object.keys(r.j.usage || {})));

    // QA 03: repetir una carta deseada suma cantidad y no pasa de 99
    const wish = (body) => call('POST', '/wishlist', 'nobuyer', { name: 'QA cantidad máxima', game: 'Pokémon', ...body }, ip());
    await wish({ quantity: 60 }); r = await wish({ quantity: 60 });
    ok('QA 03 · la misma carta deseada dos veces suma cantidad con tope 99', r.status === 200 && r.j.item.quantity === 99, String(r.j?.item?.quantity));
    const itemId = r.j.item.id;

    // QA 04: cambiar una carta deseada solo lo hace su dueño
    const mine = await call('PUT', '/wishlist/' + itemId, 'nobuyer', { quantity: 3 }, ip());
    const foreign = await call('PUT', '/wishlist/' + itemId, 'jerry', { quantity: 50 }, ip());
    ok('QA 04 · editar una carta deseada: el dueño sí (200), otra persona no (404) y la cantidad queda como la fijó el dueño', mine.status === 200 && foreign.status === 404 && mine.j.item.quantity === 3, `${mine.status}/${foreign.status}`);

    // QA 05: al mover una carta destacada a otra carpeta propia, sigue destacada
    const fa = await folder(me, 'QA05 origen'); const fb = await folder(me, 'QA05 destino'); const moved = await card(fa.id, 'QA05 carta');
    await call('PUT', `/folders/${fa.id}/cards/${moved.id}/featured`, 'nobuyer', { featured: true }, ip());
    r = await call('POST', `/folders/${fa.id}/cards-bulk/move`, 'nobuyer', { ids: [moved.id], targetFolderId: fb.id }, ip());
    const after = await prisma.card.findUnique({ where: { id: moved.id } });
    ok('QA 05 · mover una carta destacada a otra carpeta propia: se mueve y conserva la estrella', r.status === 200 && after.folderId === fb.id && Boolean(after.featuredAt), `${r.status} ${JSON.stringify(r.j).slice(0, 80)}`);

    // QA 06: una carta destacada sin stock no se muestra en el perfil; al reponer, vuelve
    const pub = await folder(me, 'QA06 pública'); const stocked = await card(pub.id, 'QA06 destacada');
    await prisma.card.update({ where: { id: stocked.id }, data: { featuredAt: new Date() } });
    const names = async () => ((await call('GET', '/users/' + NAMES.nobuyer, undefined, undefined, ip())).j.user.featuredCards || []).map((c) => c.name);
    await prisma.card.update({ where: { id: stocked.id }, data: { stock: 0 } }); const withoutStock = await names();
    await prisma.card.update({ where: { id: stocked.id }, data: { stock: 4 } }); const restocked = await names();
    ok('QA 06 · destacada sin stock desaparece del perfil y reaparece al reponer', !withoutStock.includes('QA06 destacada') && restocked.includes('QA06 destacada'), JSON.stringify([withoutStock, restocked]));

    // QA 07: moderación oculta la carta → no sale; solo la imagen oculta → sale sin imagen
    await prisma.card.update({ where: { id: stocked.id }, data: { moderationState: 'hidden' } }); const hidden = await names();
    await prisma.card.update({ where: { id: stocked.id }, data: { moderationState: 'image_hidden', imageUrl: 'https://pub-cztest.r2.dev/x.webp' } });
    const profile = (await call('GET', '/users/' + NAMES.nobuyer, undefined, undefined, ip())).j.user.featuredCards.find((c) => c.name === 'QA06 destacada');
    ok('QA 07 · carta oculta por moderación no sale; con imagen oculta sale sin imagen', !hidden.includes('QA06 destacada') && profile && profile.imageUrl === null, JSON.stringify([hidden, profile]));
    await prisma.card.update({ where: { id: stocked.id }, data: { moderationState: 'visible' } });

    // QA 08: exportar una carpeta trae solo esa; una carpeta vacía trae solo el encabezado
    await plan('nobuyer', 'enthusiast');
    const empty = await folder(me, 'QA08 vacía');
    const csvOf = async (query = '') => { const res = await fetch(require('./fixtures.cjs').B + '/inventory/export' + query, { headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() } }); return { status: res.status, text: Buffer.from(await res.arrayBuffer()).toString('utf8') }; };
    const one = await csvOf('?folderId=' + pub.id); const none = await csvOf('?folderId=' + empty.id);
    ok('QA 08 · exportar una carpeta trae solo sus cartas; la vacía trae solo el encabezado', one.status === 200 && one.text.includes('QA06 destacada') && !one.text.includes('QA05 carta') && none.text.trim().split('\r\n').length === 1, `${one.status} ${none.text.trim().split('\r\n').length}`);

    // QA 09: el detalle de visitas respeta el período (7, 30 y 90 días)
    await plan('nobuyer', 'premium');
    const day = (daysAgo) => new Date(new Date(Date.now() - daysAgo * 24 * HOUR).toISOString().slice(0, 10) + 'T00:00:00Z');
    for (const [ago, count] of [[3, 5], [20, 7], [80, 11]]) await prisma.folderVisitDay.upsert({ where: { folderId_day_source: { folderId: pub.id, day: day(ago), source: 'direct' } }, create: { folderId: pub.id, day: day(ago), source: 'direct', count }, update: { count } });
    const totalFor = async (days) => (await call('GET', '/visits/mine?days=' + days, 'nobuyer', undefined, ip())).j.folders.find((f) => f.id === pub.id).total;
    ok('QA 09 · detalle de visitas: 7 días = 5, 30 días = 12 y 90 días = 23', (await totalFor(7)) === 5 && (await totalFor(30)) === 12 && (await totalFor(90)) === 23, JSON.stringify([await totalFor(7), await totalFor(30), await totalFor(90)]));

    // QA 10: una carpeta privada no registra visitas
    const priv = await folder(me, 'QA10 privada', { isPublic: false });
    const visit = (folderId, headers = {}) => fetch(require('./fixtures.cjs').B + '/folders/' + folderId + '/visit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux) QA', 'X-Forwarded-For': ip(), ...headers }, body: '{}' });
    r = await visit(priv.id);
    ok('QA 10 · visitar una carpeta privada → 404 y sin filas de visitas', r.status === 404 && (await prisma.folderVisitDay.count({ where: { folderId: priv.id } })) === 0, String(r.status));

    // QA 11: los programas automáticos no cuentan como visita
    const visited = await folder(me, 'QA11 visitas');
    for (const agent of ['curl/8.0', 'python-requests/2.0', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'node-fetch/1.0']) await visit(visited.id, { 'User-Agent': agent });
    const before = await prisma.folderVisitDay.count({ where: { folderId: visited.id } });
    await visit(visited.id);
    ok('QA 11 · curl, python, bots y node-fetch no cuentan; un navegador sí', before === 0 && (await prisma.folderVisitDay.count({ where: { folderId: visited.id } })) === 1, String(before));

    // QA 12 y 13: prioridad en los listados (Tienda 24 h, Pro 6 h) sin ocultar nada
    await prisma.card.deleteMany({ where: { name: { startsWith: 'QAPRIO' } } });
    const fSeller = await folder(seller, 'QA12 free'); const fPro = await folder(me, 'QA12 pro'); const fStore = await folder(pro, 'QA12 tienda');
    await card(fSeller.id, 'QAPRIO free', { createdAt: new Date(Date.now() - 1 * HOUR) });
    await card(fPro.id, 'QAPRIO pro', { createdAt: new Date(Date.now() - 20 * HOUR) });
    await card(fStore.id, 'QAPRIO tienda', { createdAt: new Date(Date.now() - 5 * HOUR) });
    const order = async () => (await call('GET', '/cards/search?q=QAPRIO&sort=recent', undefined, undefined, ip())).j;
    const plain = await order();
    await plan('nobuyer', 'pro'); await plan('ignacio', 'store');
    const boosted = await order();
    ok('QA 12 · con prioridad: Tienda (-5 h +24 h) > Free (-1 h) > Pro (-20 h +6 h)', boosted.cards.map((c) => c.name).join() === 'QAPRIO tienda,QAPRIO free,QAPRIO pro' && plain.cards.map((c) => c.name).join() === 'QAPRIO free,QAPRIO tienda,QAPRIO pro', boosted.cards.map((c) => c.name).join());
    ok('QA 13 · la prioridad no oculta ni agrega cartas: mismo total (3) y solo marca «featured» en Pro y Tienda', plain.total === 3 && boosted.total === 3 && boosted.cards.filter((c) => c.featured).map((c) => c.name).sort().join() === 'QAPRIO pro,QAPRIO tienda', JSON.stringify([plain.total, boosted.total]));

    // QA 14: soporte prioritario con varias páginas: los Pro/Tienda primero y sin repetir en la segunda
    await prisma.feedback.deleteMany({ where: { userId: { in: [seller, pro] } } });
    await prisma.feedback.createMany({ data: Array.from({ length: 33 }, (_, i) => ({ userId: seller, kind: 'suggestion', title: 'QA14 free ' + String(i).padStart(2, '0'), message: 'texto de prueba', createdAt: new Date(Date.now() - (100 - i) * 60000) })) });
    await prisma.feedback.createMany({ data: Array.from({ length: 3 }, (_, i) => ({ userId: pro, kind: 'complaint', title: 'QA14 tienda ' + i, message: 'texto de prueba', createdAt: new Date(Date.now() - i * 60000) })) });
    const page1 = (await call('GET', '/admin/feedback?page=1', 'admin', undefined, ip())).j; const page2 = (await call('GET', '/admin/feedback?page=2', 'admin', undefined, ip())).j;
    const mineRows = (p) => p.feedback.filter((f) => f.title.startsWith('QA14'));
    ok('QA 14 · bandeja con 36 mensajes: los 3 prioritarios abren la página 1 y la 2 no los repite', page1.feedback.slice(0, 3).every((f) => f.priority && f.title.startsWith('QA14 tienda')) && page1.feedback.length === 30 && mineRows(page2).every((f) => !f.priority) && page2.feedback.length >= 6 && new Set([...page1.feedback, ...page2.feedback].map((f) => f.id)).size === page1.feedback.length + page2.feedback.length, `${page1.feedback.length}/${page2.feedback.length}`);
    await prisma.feedback.deleteMany({ where: { title: { startsWith: 'QA14' } } });

    // QA 15 a 18: catálogo con juegos y ediciones de prueba
    const mkGame = async (id, name) => { await prisma.catalogGame.deleteMany({ where: { categoryId: id } }); await prisma.catalogGame.create({ data: { categoryId: id, name, folder: name.replace(/\W/g, '_') } }); fixtures.games.push(id); };
    const mkSet = (groupId, categoryId, name, publishedOn) => prisma.catalogSet.create({ data: { groupId, categoryId, name, folder: 's' + groupId, publishedOn } });
    const mkCard = (productId, categoryId, groupId, name) => ({ productId, categoryId, groupId, kind: 'card', name, cleanName: name.toLowerCase(), folder: 'x' });
    await mkGame(98081, 'CZQA Uno'); await mkGame(98082, 'CZQA Dos');
    await mkSet(98081001, 98081, 'Uno 1', new Date('2022-02-02T00:00:00Z')); await mkSet(98082001, 98082, 'Dos 1', new Date('2022-03-03T00:00:00Z'));
    await prisma.catalogCard.createMany({ data: [mkCard(98081001, 98081, 98081001, 'QAINDEX carta uno'), mkCard(98082001, 98082, 98082001, 'QAINDEX carta dos')] });
    const idx = (q) => call('GET', '/tcg/search-index?' + q, undefined, undefined, ip());
    r = await idx('q=QAINDEX&game=' + encodeURIComponent('CZQA Uno,CZQA Dos'));
    ok('QA 15 · filtro de varios juegos (coma) trae las cartas de ambos', r.status === 200 && r.j.cards.map((c) => c.name).sort().join() === 'QAINDEX carta dos,QAINDEX carta uno', JSON.stringify(r.j.cards?.map((c) => c.name)));
    r = await idx('q=QAINDEX&game=' + encodeURIComponent('CZQA Uno'));
    ok('QA 16 · filtro de un solo juego trae solo ese; sin filtro trae de todos', r.status === 200 && r.j.cards.length === 1 && r.j.cards[0].name === 'QAINDEX carta uno' && (await idx('q=QAINDEX')).j.cards.length === 2, JSON.stringify(r.j.cards?.map((c) => c.name)));
    await mkGame(98083, 'CZQA Tres'); await mkSet(98083001, 98083, 'Tres con fecha', new Date('2021-01-01T00:00:00Z')); await mkSet(98083002, 98083, 'Tres sin fecha', null);
    await prisma.catalogCard.createMany({ data: [mkCard(98083001, 98083, 98083002, 'QAEDIC sin fecha'), mkCard(98083002, 98083, 98083001, 'QAEDIC con fecha')] });
    r = await idx('q=QAEDIC&game=' + encodeURIComponent('CZQA Tres') + '&sort=latest_edition');
    ok('QA 17 · «Última edición»: una edición sin fecha va después de la que tiene fecha', r.status === 200 && r.j.cards.map((c) => c.name).join() === 'QAEDIC con fecha,QAEDIC sin fecha', JSON.stringify(r.j.cards?.map((c) => c.name)));
    await mkGame(98084, 'CZQA Cuatro'); await mkSet(98084001, 98084, 'Cuatro con fecha', new Date('2019-09-09T00:00:00Z')); await mkSet(98084002, 98084, 'Cuatro sin fecha', null);
    await prisma.catalogCard.createMany({ data: [...Array.from({ length: 61 }, (_, i) => mkCard(98084100 + i, 98084, 98084001, 'QAPAG fecha ' + String(i).padStart(2, '0'))), ...Array.from({ length: 3 }, (_, i) => mkCard(98084200 + i, 98084, 98084002, 'QAPAG nada ' + i))] });
    const p1 = await idx('q=QAPAG&game=' + encodeURIComponent('CZQA Cuatro') + '&sort=latest_edition&page=1'); const p2 = await idx('q=QAPAG&game=' + encodeURIComponent('CZQA Cuatro') + '&sort=latest_edition&page=2'); const p3 = await idx('q=QAPAG&game=' + encodeURIComponent('CZQA Cuatro') + '&sort=latest_edition&page=3');
    ok('QA 18 · «Última edición» pagina bien entre los dos grupos: p1 = 60 con fecha, p2 = 1 con fecha + 3 sin fecha, p3 vacía', p1.j.cards.length === 60 && p1.j.cards.every((c) => c.name.startsWith('QAPAG fecha')) && p2.j.cards.map((c) => c.name.slice(0, 11)).join() === 'QAPAG fecha,QAPAG nada ,QAPAG nada ,QAPAG nada ' && p3.j.cards.length === 0 && p1.j.total === 64, `${p1.j.cards.length}/${p2.j.cards.length}/${p3.j.cards.length} total ${p1.j.total}`);

    // QA 19: con plan Free se puede volver al estilo de fábrica (omitir el estilo) y seguir con los interruptores
    await plan('nobuyer', 'free');
    await prisma.user.update({ where: { id: me }, data: { publicTheme: { primary: '#112233', accent: '#445566', showWishlist: 'on' } } });
    r = await call('PUT', '/users/me', 'nobuyer', { publicTheme: { showWishlist: 'off' } }, ip());
    const stored = (await prisma.user.findUnique({ where: { id: me }, select: { publicTheme: true } })).publicTheme;
    ok('QA 19 · Free puede quitar su estilo (volver al de fábrica) dejando solo los interruptores', r.status === 200 && !('primary' in stored) && stored.showWishlist === 'off', JSON.stringify(stored));

    // QA 20: Free puede quitar y reemplazar redes sociales, pero no agregar otra por encima de su tope
    await prisma.user.update({ where: { id: me }, data: { facebookUrl: 'https://facebook.com/qa', instagramUrl: 'https://instagram.com/qa', youtubeUrl: 'https://youtube.com/@qa' } });
    const swap = await call('PUT', '/users/me', 'nobuyer', { instagramUrl: 'https://instagram.com/qa_nueva' }, ip());
    const dropOne = await call('PUT', '/users/me', 'nobuyer', { facebookUrl: null }, ip());
    await prisma.user.update({ where: { id: me }, data: { facebookUrl: null } });
    const addMore = await call('PUT', '/users/me', 'nobuyer', { facebookUrl: 'https://facebook.com/otra' }, ip());
    ok('QA 20 · redes con plan Free: reemplazar (200) y quitar (200) sí; volver a sumar sobre su tope → 403', swap.status === 200 && dropOne.status === 200 && addMore.status === 403, `${swap.status}/${dropOne.status}/${addMore.status}`);
  } finally {
    await prisma.card.deleteMany({ where: { OR: [{ tcgId: 'tst-qa' }, { name: { startsWith: 'QAPRIO' } }] } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { id: { in: fixtures.folders } } }).catch(() => {});
    await prisma.catalogGame.deleteMany({ where: { categoryId: { in: [98081, 98082, 98083, 98084] } } }).catch(() => {});
    await prisma.feedback.deleteMany({ where: { title: { startsWith: 'QA14' } } }).catch(() => {});
    await prisma.wishlistItem.deleteMany({ where: { name: 'QA cantidad máxima' } }).catch(() => {});
    await prisma.user.updateMany({ where: { firebaseUid: 'cztest-nobuyer' }, data: { facebookUrl: null, instagramUrl: null, youtubeUrl: null, publicTheme: null } }).catch(() => {});
    const owners = (await prisma.user.findMany({ where: { firebaseUid: { in: ['cztest-nobuyer', 'cztest-ignacio', 'cztest-seller'] } }, select: { id: true } })).map((u) => u.id);
    await prisma.report.deleteMany({ where: { createdAt: { gte: startedAt }, targetOwnerId: { in: owners } } }).catch(() => {});
    await restorePlans().catch(() => {});
    await prisma.$disconnect();
  }
})();
