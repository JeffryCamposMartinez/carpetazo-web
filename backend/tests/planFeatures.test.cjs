// Funciones por plan: listas y cartas de deseos, banner, Estudio y redes del perfil, exportar inventario, detalle de visitas,
// cartas destacadas, soporte prioritario y prioridad en los listados. Todo se valida en el servidor.
const { prisma, B, NAMES, call, ok, snapshotPlans } = require('./fixtures.cjs');

let hit = 0;
const ip = () => '10.70.' + Math.floor(++hit / 250) + '.' + (hit % 250);
const plan = (who, planKey) => call('POST', '/billing/test-plan', who, { planKey }, ip());
const feature = (r) => r.j?.feature;

(async () => {
  const startedAt = new Date();
  const restorePlans = await snapshotPlans(['nobuyer', 'ignacio']); // otras pruebas dejan planes en estas cuentas: se devuelven al terminar
  try {
    const id = async (who) => (await prisma.user.findFirst({ where: { firebaseUid: 'cztest-' + who }, select: { id: true } })).id;
    const me = await id('nobuyer');
    const other = await id('ignacio');
    const admin = await id('admin');
    let r;
    // Se parte de cero: sin concesiones ni suscripciones vigentes
    await prisma.planGrant.updateMany({ where: { userId: { in: [me, other] }, revokedAt: null }, data: { revokedAt: new Date() } });
    await prisma.subscription.deleteMany({ where: { userId: { in: [me, other] } } });

    // ---- Catálogo
    r = await call('GET', '/plans', null, null, ip());
    const by = Object.fromEntries(r.j.plans.map((p) => [p.key, p]));
    const row = (key, fields) => fields.map((f) => by[key][f]).join('/');
    ok('listas de deseos 1/3/6/10/10', ['free', 'enthusiast', 'premium', 'pro', 'store'].map((k) => by[k].wishlistLists).join('/') === '1/3/6/10/10');
    ok('cartas por lista 25/50/100/150/300', ['free', 'enthusiast', 'premium', 'pro', 'store'].map((k) => by[k].wishlistItems).join('/') === '25/50/100/150/300');
    ok('redes 1/2/3/3/3 y cartas destacadas 3/6/12/24/48', ['free', 'enthusiast', 'premium', 'pro', 'store'].map((k) => by[k].socialLinks).join('/') === '1/2/3/3/3' && ['free', 'enthusiast', 'premium', 'pro', 'store'].map((k) => by[k].featuredCards).join('/') === '3/6/12/24/48');
    ok('banner, Estudio, visitas, exportar y soporte por plan', row('free', ['profileBanner', 'profileStudio', 'visitsDetail', 'inventoryExport', 'prioritySupport']) === 'false/false/false/false/false'
      && row('enthusiast', ['profileBanner', 'profileStudio', 'visitsDetail', 'inventoryExport', 'prioritySupport']) === 'true/false/false/true/false'
      && row('premium', ['profileBanner', 'profileStudio', 'visitsDetail', 'inventoryExport', 'prioritySupport']) === 'true/true/true/true/false'
      && row('pro', ['profileBanner', 'profileStudio', 'visitsDetail', 'inventoryExport', 'prioritySupport', 'listingBoost']) === 'true/true/true/true/true/1'
      && row('store', ['listingBoost']) === '2');

    // ---- Listas y cartas de deseos
    await plan('nobuyer', 'free');
    r = await call('GET', '/wishlist/me', 'nobuyer', null, ip());
    ok('Free: la respuesta trae el máximo de su plan (1 lista, 25 cartas)', r.status === 200 && r.j.maxLists === 1 && r.j.limit === 25, JSON.stringify([r.j.maxLists, r.j.limit]));
    r = await call('POST', '/wishlists', 'nobuyer', { name: 'Otra lista' }, ip());
    ok('Free: no crea una segunda lista → 403 con la función', r.status === 403 && r.j.code === 'plan_feature_locked' && feature(r) === 'wishlistLists' && r.j.limit === 1, JSON.stringify(r.j));
    const wish = (n, extra = {}) => call('POST', '/wishlist', 'nobuyer', { name: 'Carta deseada ' + n, game: 'Pokémon', ...extra }, ip());
    for (let n = 1; n <= 25; n++) r = await wish(n);
    ok('Free: agrega hasta 25 cartas', r.status === 200, String(r.status));
    r = await wish(26);
    ok('Free: la carta 26 → 403', r.status === 403 && feature(r) === 'wishlistItems' && r.j.limit === 25, JSON.stringify(r.j));
    r = await wish(25);
    ok('...pero repetir una carta que ya está suma cantidad y no se bloquea', r.status === 200, String(r.status));
    await plan('nobuyer', 'enthusiast');
    r = await wish(26);
    ok('Entusiasta: la carta 26 entra (límite 50)', r.status === 200, String(r.status));
    for (let n = 1; n <= 2; n++) r = await call('POST', '/wishlists', 'nobuyer', { name: 'Lista extra ' + n }, ip());
    ok('Entusiasta: crea hasta 3 listas', r.status === 200, String(r.status));
    r = await call('POST', '/wishlists', 'nobuyer', { name: 'Lista cuarta' }, ip());
    ok('Entusiasta: la cuarta lista → 403', r.status === 403 && feature(r) === 'wishlistLists', String(r.status));
    await plan('nobuyer', 'premium');
    for (let n = 4; n <= 6; n++) r = await call('POST', '/wishlists', 'nobuyer', { name: 'Lista extra ' + n }, ip());
    ok('Premium: llega a 6 listas', r.status === 200, String(r.status));
    await plan('nobuyer', 'free');
    r = await call('GET', '/wishlist/me', 'nobuyer', null, ip());
    ok('al bajar a Free conserva sus 6 listas y sus cartas', r.status === 200 && r.j.lists.length === 6 && r.j.items.length >= 26 && r.j.maxLists === 1, JSON.stringify([r.j.lists?.length, r.j.items?.length]));
    r = await call('POST', '/wishlists', 'nobuyer', { name: 'No entra' }, ip());
    ok('...pero no puede crear otra', r.status === 403, String(r.status));

    // ---- Redes, banner y Estudio de perfil
    const user = (field) => prisma.user.findUnique({ where: { id: me }, select: { [field]: true } }).then((row) => row[field]);
    await prisma.user.update({ where: { id: me }, data: { facebookUrl: null, instagramUrl: null, youtubeUrl: null, bannerBase64: null, wallpaperBase64: null, publicTheme: null } });
    r = await call('PUT', '/users/me', 'nobuyer', { instagramUrl: 'https://instagram.com/cz_test' }, ip());
    ok('Free: guarda su primera red social', r.status === 200, String(r.status));
    r = await call('PUT', '/users/me', 'nobuyer', { youtubeUrl: 'https://youtube.com/@cz_test' }, ip());
    ok('Free: la segunda red → 403', r.status === 403 && feature(r) === 'socialLinks' && (await user('youtubeUrl')) === null, JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'nobuyer', { instagramUrl: 'https://instagram.com/cz_otro' }, ip());
    ok('Free: cambiar la que ya tiene sí se puede', r.status === 200, String(r.status));
    r = await call('PUT', '/users/me', 'nobuyer', { youtubeUrl: 'https://youtube.com/@cz_test', instagramUrl: null }, ip());
    ok('Free: cambiar una red por otra (queda 1) sí se puede', r.status === 200, String(r.status));
    r = await call('PUT', '/users/me', 'nobuyer', { bannerBase64: 'https://lh3.googleusercontent.com/cz-banner' }, ip());
    ok('Free: subir un banner → 403', r.status === 403 && feature(r) === 'profileBanner' && (await user('bannerBase64')) === null, JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'nobuyer', { wallpaperBase64: 'https://lh3.googleusercontent.com/cz-fondo' }, ip());
    ok('Free: subir un fondo → 403', r.status === 403 && feature(r) === 'profileStudio', JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'nobuyer', { publicTheme: { accent: '#ff0000' } }, ip());
    ok('Free: cambiar el estilo del perfil → 403', r.status === 403 && feature(r) === 'profileStudio', JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'nobuyer', { bio: 'Presentación nueva', publicTheme: {} }, ip());
    ok('Free: editar su texto, aunque mande el estilo sin cambios, sí se puede', r.status === 200, JSON.stringify(r.j));
    await plan('nobuyer', 'enthusiast');
    r = await call('PUT', '/users/me', 'nobuyer', { bannerBase64: 'https://lh3.googleusercontent.com/cz-banner', instagramUrl: 'https://instagram.com/cz_test' }, ip());
    ok('Entusiasta: sube banner y tiene 2 redes', r.status === 200 && (await user('bannerBase64')).endsWith('cz-banner'), JSON.stringify(r.j));
    r = await call('PUT', '/users/me', 'nobuyer', { facebookUrl: 'https://facebook.com/cz.test' }, ip());
    ok('Entusiasta: la tercera red → 403', r.status === 403 && feature(r) === 'socialLinks', String(r.status));
    r = await call('PUT', '/users/me', 'nobuyer', { wallpaperBase64: 'https://lh3.googleusercontent.com/cz-fondo' }, ip());
    ok('Entusiasta: el fondo sigue bloqueado', r.status === 403, String(r.status));
    await plan('nobuyer', 'premium');
    r = await call('PUT', '/users/me', 'nobuyer', { wallpaperBase64: 'https://lh3.googleusercontent.com/cz-fondo', publicTheme: { accent: '#ff0000' }, facebookUrl: 'https://facebook.com/cz.test' }, ip());
    ok('Premium: fondo, estilo y 3 redes', r.status === 200, JSON.stringify(r.j));
    await plan('nobuyer', 'free');
    r = await call('PUT', '/users/me', 'nobuyer', { showTest: 'x', publicTheme: { accent: '#ff0000', showWishlist: 'off', showInstagram: 'on' } }, ip());
    ok('Free: los interruptores del perfil (mostrar redes, deseadas) siguen libres mientras el estilo no cambie', r.status === 200, JSON.stringify(r.j).slice(0, 160));
    r = await call('PUT', '/users/me', 'nobuyer', { bio: 'Sigue con lo que tenía' }, ip());
    ok('al bajar a Free conserva banner, fondo, estilo y redes y puede editar su texto', r.status === 200 && (await user('bannerBase64')) && (await user('wallpaperBase64')) && (await user('facebookUrl')), String(r.status));
    r = await call('PUT', '/users/me', 'nobuyer', { bannerBase64: null, wallpaperBase64: null, facebookUrl: null }, ip());
    ok('...y siempre puede quitarlos', r.status === 200 && (await user('bannerBase64')) === null, String(r.status));

    // ---- Subir banner y fondo (la subida también valida el plan, antes de tocar R2)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const upload = async (type) => {
      const form = new FormData();
      form.append('type', type);
      form.append('image', new Blob([png], { type: 'image/png' }), type + '.png');
      const res = await fetch(B + '/users/upload-image', { method: 'POST', headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() }, body: form });
      return { status: res.status, j: await res.json().catch(() => null) };
    };
    await plan('nobuyer', 'free');
    r = await upload('banner');
    ok('Free: subir un banner por la subida de imágenes → 403', r.status === 403 && feature(r) === 'profileBanner', JSON.stringify(r));
    r = await upload('wallpaper');
    ok('Free: subir un fondo → 403', r.status === 403 && feature(r) === 'profileStudio', JSON.stringify(r));
    r = await upload('avatar');
    ok('Free: la foto de perfil no depende del plan', r.status !== 403, String(r.status));
    await plan('nobuyer', 'enthusiast');
    r = await upload('banner');
    ok('Entusiasta: el banner pasa la validación del plan', r.status !== 403, String(r.status));
    r = await upload('wallpaper');
    ok('Entusiasta: el fondo sigue bloqueado', r.status === 403, String(r.status));
    await plan('nobuyer', 'premium');
    r = await upload('wallpaper');
    ok('Premium: el fondo pasa la validación del plan', r.status !== 403, String(r.status));

    // ---- Exportar inventario
    const folder = await prisma.folder.create({ data: { name: 'PF export', userId: me, tcg: 'Pokemon', isPublic: true } });
    const foreign = await prisma.folder.create({ data: { name: 'PF ajena', userId: other, tcg: 'Pokemon', isPublic: true } });
    const mk = (folderId, name, extra = {}) => prisma.card.create({ data: { folderId, tcgId: 'tst-pf', name, price: 1500, stock: 3, ...extra } });
    const cards = [];
    for (const name of ['PF Pikachu', '=HYPERLINK("http://evil.test","clic")', 'PF, con coma', '+cmd|calc', 'PF "comillas"']) cards.push(await mk(folder.id, name));
    await mk(foreign.id, 'PF carta ajena');
    await plan('nobuyer', 'free');
    r = await fetch(B + '/inventory/export', { headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() } });
    ok('Free: exportar el inventario → 403', r.status === 403 && (await r.json()).feature === 'inventoryExport', String(r.status));
    await plan('nobuyer', 'enthusiast');
    r = await fetch(B + '/inventory/export', { headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() } });
    const csv = Buffer.from(await r.arrayBuffer()).toString('utf8'); // fetch().text() quita el BOM: se lee en bytes
    ok('Entusiasta: descarga un CSV con nombre y sin caché', r.status === 200 && /text\/csv/.test(r.headers.get('content-type')) && /attachment; filename="carpetazo-inventario-\d{4}-\d{2}-\d{2}\.csv"/.test(r.headers.get('content-disposition')) && /no-store/.test(r.headers.get('cache-control')), r.status + ' ' + r.headers.get('content-type'));
    ok('...con encabezado, BOM y las cartas propias', csv.startsWith('﻿Carpeta,Juego,Carta,Idioma,Precio (CLP),Stock,Código') && csv.includes('PF Pikachu'), csv.slice(0, 120));
    ok('...sin cartas de otras personas', !csv.includes('PF carta ajena'), '');
    ok('...las fórmulas quedan como texto (comilla delante)', csv.includes(`'=HYPERLINK`) && csv.includes(`'+cmd`) && !/(^|,)=HYPERLINK/m.test(csv), '');
    ok('...las comas y comillas quedan escapadas', csv.includes('"PF, con coma"') && csv.includes('"PF ""comillas"""'), '');
    r = await fetch(B + '/inventory/export?folderId=' + foreign.id, { headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() } });
    ok('exportar la carpeta de otra persona → 404', r.status === 404, String(r.status));
    for (const bad of ['no-es-id', "' OR 1=1 --", '../x']) {
      r = await fetch(B + '/inventory/export?folderId=' + encodeURIComponent(bad), { headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() } });
      ok(`exportar con carpeta inválida «${bad}» → 404`, r.status === 404, String(r.status));
    }
    r = await fetch(B + '/inventory/export', { headers: { 'X-Forwarded-For': ip() } });
    ok('exportar sin sesión → 401', r.status === 401, String(r.status));
    r = await fetch(B + '/inventory/export?folderId=' + folder.id, { headers: { Authorization: 'Bearer test-cztest-nobuyer', 'X-Forwarded-For': ip() } });
    ok('exportar una carpeta propia trae solo esa', r.status === 200 && (await r.text()).split('\r\n').length === 7, String(r.status));

    // ---- Detalle de visitas
    const visit = (folderId, source, address) => fetch(B + '/folders/' + folderId + '/visit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux) PlanTest', 'X-Forwarded-For': address || ip() }, body: JSON.stringify(source === undefined ? {} : { source }) });
    await prisma.folderVisitDay.deleteMany({ where: { folderId: folder.id } });
    await visit(folder.id, 'internal');
    await visit(folder.id, 'external');
    await visit(folder.id, 'external');
    await visit(folder.id, 'cualquier-cosa');
    const sameIp = ip();
    await visit(folder.id, 'direct', sameIp);
    await visit(folder.id, 'direct', sameIp);
    const sums = Object.fromEntries((await prisma.folderVisitDay.findMany({ where: { folderId: folder.id } })).map((v) => [v.source, v.count]));
    ok('las visitas se guardan por origen; un origen desconocido cuenta como directo y la misma conexión no repite', sums.internal === 1 && sums.external === 2 && sums.direct === 2, JSON.stringify(sums));
    r = await call('GET', '/visits/mine', 'nobuyer', null, ip());
    ok('Enthusiasta: el detalle de visitas → 403', r.status === 403 && feature(r) === 'visitsDetail', String(r.status));
    await plan('nobuyer', 'premium');
    r = await call('GET', '/visits/mine?days=30', 'nobuyer', null, ip());
    const mine = (r.j?.folders || []).find((f) => f.id === folder.id);
    ok('Premium: ve el detalle por carpeta, por día y por origen', r.status === 200 && r.j.days === 30 && mine?.total === 5 && mine.sources.external === 2 && r.j.daily.reduce((s, d) => s + d.count, 0) >= 5, JSON.stringify(mine));
    ok('...solo trae sus carpetas', (r.j.folders || []).every((f) => f.id !== foreign.id), '');
    r = await call('GET', '/visits/mine?days=9999', 'nobuyer', null, ip());
    ok('...un período raro vuelve a 30 días', r.status === 200 && r.j.days === 30, String(r.status));
    r = await call('GET', '/visits/mine', undefined, null, ip());
    ok('el detalle de visitas sin sesión → 401', r.status === 401, String(r.status));

    // ---- Cartas destacadas
    const feat = (folderId, cardId, featured, who = 'nobuyer') => call('PUT', `/folders/${folderId}/cards/${cardId}/featured`, who, { featured }, ip());
    await prisma.card.updateMany({ where: { folder: { userId: { in: [me, other] } } }, data: { featuredAt: null } });
    const extra = [];
    for (let n = 0; n < 14; n++) extra.push(await mk(folder.id, 'PF extra ' + n));
    const all = [...cards, ...extra];
    await plan('nobuyer', 'free');
    for (let n = 0; n < 3; n++) r = await feat(folder.id, all[n].id, true);
    ok('Free: destaca 3 cartas', r.status === 200 && r.j.card.featured === true, JSON.stringify(r.j));
    r = await feat(folder.id, all[3].id, true);
    ok('Free: la cuarta → 403', r.status === 403 && feature(r) === 'featuredCards' && r.j.limit === 3 && r.j.current === 3, JSON.stringify(r.j));
    r = await feat(folder.id, all[0].id, true);
    ok('...repetir una ya destacada no cuenta ni falla', r.status === 200, String(r.status));
    r = await call('GET', '/featured-cards/mine', 'nobuyer', null, ip());
    ok('el contador muestra 3 de 3', r.status === 200 && r.j.count === 3 && r.j.limit === 3, JSON.stringify(r.j));
    r = await feat(folder.id, all[0].id, false);
    ok('quitar una destacada libera el cupo', r.status === 200 && r.j.card.featured === false, JSON.stringify(r.j));
    r = await feat(folder.id, all[3].id, true);
    ok('...y la cuarta ahora entra', r.status === 200, String(r.status));
    r = await feat(folder.id, (await prisma.card.findFirst({ where: { folderId: foreign.id } })).id, true);
    ok('destacar la carta de otra persona (con su carpeta) → 404', r.status === 404, String(r.status));
    const foreignCard = await prisma.card.findFirst({ where: { folderId: foreign.id } });
    r = await feat(foreign.id, foreignCard.id, true);
    ok('...ni usando la carpeta ajena → 404', r.status === 404 && !(await prisma.card.findUnique({ where: { id: foreignCard.id } })).featuredAt, String(r.status));
    r = await feat(folder.id, all[5].id, 'si');
    ok('«featured» que no es booleano → 400', r.status === 400, String(r.status));
    r = await feat('no-es-id', 'no-es-id', true);
    ok('ids inválidos → 404', r.status === 404, String(r.status));
    await plan('nobuyer', 'premium');
    const race = await Promise.all(all.slice(4, 16).map((card) => feat(folder.id, card.id, true)));
    const featuredNow = await prisma.card.count({ where: { featuredAt: { not: null }, folder: { userId: me } } });
    ok('Premium: 12 a la vez (ya tenía 3) → exactamente 9 entran, 3 se bloquean y nunca pasa de 12', featuredNow === 12 && race.filter((x) => x.status === 200).length === 9 && race.filter((x) => x.status === 403).length === 3, JSON.stringify([featuredNow, race.map((x) => x.status)]));
    await plan('nobuyer', 'free');
    r = await call('GET', '/users/' + NAMES.nobuyer, null, null, ip());
    ok('el perfil público muestra sus cartas destacadas (solo campos públicos)', r.status === 200 && r.j.user.featuredCards.length === 12 && r.j.user.featuredCards.every((c) => Object.keys(c).sort().join() === 'folderId,folderName,id,imageUrl,name,price,stock'), JSON.stringify(Object.keys(r.j.user.featuredCards[0] || {})));
    r = await feat(folder.id, extra[13].id, true);
    ok('al bajar a Free conserva las destacadas pero no destaca más', r.status === 403, String(r.status));
    await prisma.folder.update({ where: { id: folder.id }, data: { isPublic: false } });
    r = await call('GET', '/users/' + NAMES.nobuyer, null, null, ip());
    ok('una carpeta privada no muestra sus destacadas en el perfil', r.status === 200 && r.j.user.featuredCards.length === 0, String(r.j.user?.featuredCards?.length));
    await prisma.folder.update({ where: { id: folder.id }, data: { isPublic: true } });

    // ---- Soporte prioritario
    await prisma.feedback.deleteMany({ where: { userId: { in: [me, other] } } });
    const old = new Date(Date.now() - 3 * 3600 * 1000);
    await prisma.feedback.create({ data: { userId: me, kind: 'suggestion', title: 'PF de plan Free (más antiguo)', message: 'texto', createdAt: old } });
    await prisma.feedback.create({ data: { userId: other, kind: 'suggestion', title: 'PF de plan Pro (más nuevo)', message: 'texto' } });
    await plan('ignacio', 'pro');
    r = await call('GET', '/admin/feedback', 'admin', null, ip());
    const mineRows = (r.j?.feedback || []).filter((f) => f.title.startsWith('PF '));
    ok('el mensaje de un plan Pro va primero y lleva la marca', r.status === 200 && mineRows[0]?.title.includes('Pro') && mineRows[0].priority === true && mineRows[1]?.priority === false, JSON.stringify(mineRows.map((f) => [f.title, f.priority])));
    await plan('ignacio', 'free');
    r = await call('GET', '/admin/feedback', 'admin', null, ip());
    ok('al volver a Free pierde la prioridad', (r.j?.feedback || []).filter((f) => f.title.startsWith('PF ')).every((f) => f.priority === false), '');
    r = await call('GET', '/admin/feedback', 'jerry', null, ip());
    ok('una persona normal no ve la bandeja → 403', r.status === 403, String(r.status));

    // ---- Prioridad en los listados
    const unique = 'ZZPFBoost';
    await prisma.card.deleteMany({ where: { name: { startsWith: unique } } });
    const hour = 3600 * 1000;
    const proCard = await mk(folder.id, unique + ' pro', { createdAt: new Date(Date.now() - 5 * hour) });
    const freeCard = await mk(foreign.id, unique + ' free recent', { createdAt: new Date(Date.now() - 1 * hour) });
    const freeOld = await mk(foreign.id, unique + ' free old', { createdAt: new Date(Date.now() - 6 * hour) });
    const search = async () => (await call('GET', '/cards/search?q=' + unique + '&sort=recent', null, null, ip())).j.cards;
    let list = await search();
    ok('sin planes de pago el orden es solo por fecha', list.map((c) => c.name).join('|') === [freeCard, proCard, freeOld].map((c) => c.name).join('|') && list.every((c) => c.featured === false), JSON.stringify(list.map((c) => [c.name, c.featured])));
    await plan('nobuyer', 'pro');
    list = await search();
    ok('Pro sube 6 horas: su carta de hace 5 h pasa a la más reciente y se marca como destacada', list[0].name === proCard.name && list[0].featured === true && list.slice(1).every((c) => c.featured === false), JSON.stringify(list.map((c) => [c.name, c.featured])));
    await plan('nobuyer', 'store');
    await prisma.card.update({ where: { id: freeOld.id }, data: { createdAt: new Date(Date.now() - 30 * hour) } });
    await prisma.card.update({ where: { id: proCard.id }, data: { createdAt: new Date(Date.now() - 20 * hour) } });
    list = await search();
    ok('Tienda sube 24 horas: una carta de hace 20 h supera a una de hace 1 h', list[0].name === proCard.name, JSON.stringify(list.map((c) => c.name)));
    r = await call('GET', '/cards/search?q=' + unique + '&sort=price_asc', null, null, ip());
    ok('el orden por precio no se altera con la prioridad', r.status === 200 && r.j.cards.every((c) => c.featured === false), String(r.status));
    ok('la búsqueda pública no expone al dueño de la carta', !JSON.stringify(list).includes(me) && !('userId' in list[0]) && !('_boost' in list[0]), '');
    await plan('nobuyer', 'enthusiast');
    list = await search();
    ok('al bajar de plan la prioridad se pierde de inmediato', list[0].name === freeCard.name && list.every((c) => c.featured === false), JSON.stringify(list.map((c) => c.name)));

    void admin;
  } finally {
    await prisma.card.deleteMany({ where: { tcgId: 'tst-pf' } }).catch(() => {});
    await prisma.card.deleteMany({ where: { name: { startsWith: 'ZZPFBoost' } } }).catch(() => {});
    await prisma.folder.deleteMany({ where: { name: { in: ['PF export', 'PF ajena'] } } }).catch(() => {});
    await prisma.feedback.deleteMany({ where: { title: { startsWith: 'PF ' } } }).catch(() => {});
    // La detección automática puede abrir reportes por las cartas baratas de estas cuentas nuevas: no deben quedar en la cola de otras pruebas
    const owners = (await prisma.user.findMany({ where: { firebaseUid: { in: ['cztest-nobuyer', 'cztest-ignacio'] } }, select: { id: true } })).map((user) => user.id);
    await prisma.report.deleteMany({ where: { createdAt: { gte: startedAt }, targetOwnerId: { in: owners } } }).catch(() => {});
    // Las cartas y listas de deseos que se crearon para probar los topes no deben quedar en estas cuentas compartidas
    await prisma.wishlistItem.deleteMany({ where: { user: { firebaseUid: { in: ['cztest-nobuyer', 'cztest-ignacio'] } }, name: { startsWith: 'Carta deseada' } } }).catch(() => {});
    await prisma.wishlist.deleteMany({ where: { user: { firebaseUid: { in: ['cztest-nobuyer', 'cztest-ignacio'] } }, name: { in: ['Otra lista', 'Lista cuarta', 'No entra'] } } }).catch(() => {});
    await prisma.wishlist.deleteMany({ where: { user: { firebaseUid: { in: ['cztest-nobuyer', 'cztest-ignacio'] } }, name: { startsWith: 'Lista extra' } } }).catch(() => {});
    await restorePlans().catch(() => {});
    await prisma.$disconnect();
  }
})();
