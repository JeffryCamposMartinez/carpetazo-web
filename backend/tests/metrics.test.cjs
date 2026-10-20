// Contadores de actividad: qué acepta la web, que no guardan datos de personas, qué se cuenta en las búsquedas y el informe de Operación.
const { prisma, B, U, call, ok } = require('./fixtures.cjs');

const GAME_ID = 98006;
const CARD_ID = 98000611;
const NAMES = ['plans_view', 'plan_cta', 'share_card', 'share_folder', 'search_empty', 'search_no_offers', 'catalog_view', 'catalog_crawl'];
const post = (body, ip) => fetch(B + '/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(body) });
const settle = () => new Promise((resolve) => setTimeout(resolve, 400)); // los contadores se escriben sin hacer esperar a quien los provoca
const count = async (name, key = '') => (await prisma.metricDay.aggregate({ where: { name, key }, _sum: { count: true } }))._sum.count || 0;

(async () => {
  const saved = await prisma.metricDay.findMany({ where: { name: { in: NAMES } } });
  const role = (await prisma.user.findUnique({ where: { firebaseUid: U.jeffry } })).role;
  try {
    await prisma.catalogGame.create({ data: { categoryId: GAME_ID, name: 'CZTEST_Metricas', folder: 'CZTEST_Metricas' } });
    await prisma.catalogSet.create({ data: { groupId: 98000601, categoryId: GAME_ID, name: 'CZTEST Edición M', folder: 'M' } });
    await prisma.catalogCard.create({ data: { productId: CARD_ID, categoryId: GAME_ID, groupId: 98000601, kind: 'card', name: 'CZTEST Métrica', cleanName: 'cztest metrica', folder: 'm', imageKey: 'Carpetazo.cl/CZTEST_Metricas/x/x.webp' } });

    // --- Lo que la web puede registrar
    const before = await count('plans_view');
    let r = await post({ name: 'plans_view' }, '10.66.0.1');
    ok('plans_view → 204 y suma 1 al contador de hoy', r.status === 204 && (await settle(), await count('plans_view')) === before + 1);
    ok('plan de pago → 204', (await post({ name: 'plan_cta', key: 'premium' }, '10.66.0.2')).status === 204);
    ok('compartidos → 204', (await post({ name: 'share_card' }, '10.66.0.3')).status === 204 && (await post({ name: 'share_folder' }, '10.66.0.4')).status === 204);
    await settle();
    ok('plan_cta guarda el plan elegido', (await count('plan_cta', 'premium')) >= 1);
    ok('nombre desconocido → 400', (await post({ name: 'borrar_todo' }, '10.66.0.5')).status === 400 && (await post({ name: 'catalog_view' }, '10.66.0.6')).status === 400 && (await post({ name: 'search_empty', key: 'x' }, '10.66.0.7')).status === 400);
    ok('plan inválido, gratis o de administradores → 400', (await post({ name: 'plan_cta', key: 'oro' }, '10.66.1.1')).status === 400 && (await post({ name: 'plan_cta', key: 'free' }, '10.66.1.2')).status === 400 && (await post({ name: 'plan_cta', key: 'test' }, '10.66.1.3')).status === 400 && (await post({ name: 'plan_cta' }, '10.66.1.4')).status === 400);
    ok('cuerpo inválido → 400', (await post({}, '10.66.1.5')).status === 400 && (await post({ name: ['plans_view'] }, '10.66.1.6')).status === 400 && (await post({ name: { toString: 'x' } }, '10.66.1.7')).status === 400);
    ok('una clave extra en un contador sin clave no se guarda', (await post({ name: 'plans_view', key: 'persona@correo.cl' }, '10.66.1.8')).status === 204 && (await settle(), (await prisma.metricDay.count({ where: { name: 'plans_view', key: { not: '' } } }))) === 0);

    // --- Búsquedas
    await call('GET', '/tcg/search-index?q=zzqxkwv%20imposible', null);
    await call('GET', '/cards/search?q=zzqxkwv%20imposible', null);
    await settle();
    ok('una búsqueda sin resultados en el catálogo se cuenta con su texto', (await count('search_empty', 'zzqxkwv imposible')) === 1);
    ok('una búsqueda sin ofertas se cuenta con su texto', (await count('search_no_offers', 'zzqxkwv imposible')) === 1);
    await call('GET', '/tcg/search-index?q=correo%40ejemplo.cl%20zzqx', null);
    await call('GET', '/tcg/search-index?q=%2B56912345678%20zzqx', null);
    await call('GET', '/cards/search?q=zz', null);
    await settle();
    ok('un texto que parece correo, teléfono o es muy corto no se guarda', (await prisma.metricDay.count({ where: { name: { in: ['search_empty', 'search_no_offers'] }, OR: [{ key: { contains: '@' } }, { key: { contains: '5691234' } }, { key: 'zz' }] } })) === 0);

    // --- Fichas del catálogo y rastreadores
    await call('GET', `/tcg/card/${CARD_ID}`, null);
    await fetch(`${B}/seo/catalog/${CARD_ID}`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } });
    await fetch(`${B}/seo/catalog/${CARD_ID}`, { headers: { 'User-Agent': 'curl/8' } });
    await settle();
    ok('la visita a una ficha se cuenta por juego', (await count('catalog_view', 'CZTEST Metricas')) === 1);
    ok('el rastreo se cuenta por familia (Google y otros)', (await count('catalog_crawl', 'google')) >= 1 && (await count('catalog_crawl', 'otro')) >= 1);

    // --- Informe de Operación
    const route = '/admin/ops/metrics?days=30';
    ok('sin sesión → 401, cuenta normal → 403', (await call('GET', route, null)).status === 401 && (await call('GET', route, 'seller')).status === 403);
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role: 'moderator' } });
    ok('un moderador no lo ve (solo administradores) → 403', (await call('GET', route, 'jeffry')).status === 403);
    r = await call('GET', route, 'admin');
    ok('el administrador ve el informe con lo buscado y nadie vende', r.status === 200 && r.j.searchNoOffers.top.some((row) => row.query === 'zzqxkwv imposible' && row.count === 1) && r.j.searchEmpty.top.some((row) => row.query === 'zzqxkwv imposible'), JSON.stringify(r.j.searchEmpty));
    ok('trae el embudo de planes, compartidos y catálogo', r.j.plans.map((step) => step.key).join() === 'view,cta,paid' && r.j.plans[0].count >= 1 && r.j.plans[1].count >= 1 && r.j.shares.card >= 1 && r.j.shares.folder >= 1 && r.j.catalog.views >= 1 && r.j.catalog.crawls.google >= 1 && r.j.planChoices.premium >= 1);
    ok('el informe no trae correos, usuarios ni conexiones', !/@|firebaseUid|"ip"|userId/i.test(JSON.stringify(r.j)));
    ok('período inválido → 400', (await call('GET', '/admin/ops/metrics?days=0', 'admin')).status === 400 && (await call('GET', '/admin/ops/metrics?days=999', 'admin')).status === 400);
    r = await call('GET', '/admin/ops/funnel?days=30', 'admin');
    ok('el embudo de vendedores ahora tiene el paso «Agregaron una carta»', r.status === 200 && r.j.sellers.map((step) => step.key).join() === 'signups,folder,added,cards,orders,sales');
  } catch (error) {
    ok('las métricas no lanzaron errores inesperados', false, error.stack);
  } finally {
    await prisma.user.update({ where: { firebaseUid: U.jeffry }, data: { role } }).catch(() => {});
    await prisma.metricDay.deleteMany({ where: { name: { in: NAMES } } });
    if (saved.length) await prisma.metricDay.createMany({ data: saved });
    await prisma.catalogCard.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogSet.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.catalogGame.deleteMany({ where: { categoryId: GAME_ID } });
    await prisma.$disconnect();
  }
})();
