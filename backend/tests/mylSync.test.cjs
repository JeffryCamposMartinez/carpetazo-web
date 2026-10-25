// Sincronización de Mitos y Leyendas con mazos.cl (etapa de simulación): conversión de cartas, productos de relleno y comparación con la base.
// Son funciones puras: no usa red ni base.
const path = require('path');
const { pathToFileURL } = require('url');
const { ok, prisma } = require('./fixtures.cjs');

const root = path.join(__dirname, '..');
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

(async () => {
  const plan = await load('core/mylSync/plan.js');
  const card = (id, extra = {}) => ({ id, name: `Carta ${id}`, slug: `carta-${id}`, type: 'ALIADO', cost: 3, attack: 0, race: ['Sombra'], frequency: 'VASALLO', collectorCode: `DO-${id}-100`, effect: 'Texto', edition: { name: '💛 Dominios de RA' }, imageUrl: 'https://x/y.webp', ...extra });

  // --- Nombres
  ok('caracteres que Windows no permite pasan a _ (igual que CarpetazoUpdate)', plan.safeName('A:B*C?') === 'A_B_C_' && plan.safeName('  ') === 'Desconocido');
  ok('el nombre de edición ignora emojis, tildes y mayúsculas', plan.cleanName('💛 Dominios de RA') === plan.cleanName('dominios de ra') && plan.cleanName('Helénica') === 'helenica');
  ok('producto de relleno: el código sin su número, o la edición', plan.pseudoProduct({ collectorCode: 'DO-123-100' }) === 'DO' && plan.pseudoProduct({ collectorCode: '', edition: { name: 'Zodiaco' } }) === 'Zodiaco' && plan.pseudoProduct({}) === 'Cartas_Sueltas');

  // --- Atributos con la forma de la base
  const ext = plan.cardExtData(card(1, { race: ['Sombra', 'Bestia'], cost: 0, mechanics: [{ name: 'Furia' }] }));
  ok('un atributo con varios valores es una entrada por valor, y los ceros se conservan', ext.filter((x) => x.name === 'Race').length === 2 && ext.some((x) => x.name === 'Cost' && x.value === '0') && ext.some((x) => x.name === 'Mechanics' && x.value === 'Furia'));

  // --- Unir productos y catálogo
  const collected = plan.collectBlock({
    productCards: [{ name: 'Kit A', cards: [card(1), card(2)] }, { name: 'Kit B', cards: [card(2)] }],
    catalogCards: [card(2), card(3, { collectorCode: 'ZZ-3-9' })],
  });
  ok('una carta en dos productos se guarda una vez y queda en los dos', collected.size === 3 && [...collected.get('2').products].join('|') === 'Kit A|Kit B');
  ok('la carta que ningún producto trae va a su producto de relleno', collected.get('3').fromProduct === false && [...collected.get('3').products][0] === 'ZZ');

  // --- Comparación con la base
  const stored = (c, over = {}) => ({ name: c.name, extData: plan.cardExtData(c), blockId: 7, ...over });
  const same = card(10);
  ok('sin diferencias: nada que corregir ni completar', JSON.stringify(plan.cardChanges(stored(same), same, { withMechanics: true })) === '{"changes":{},"missing":[]}');
  const changed = plan.cardChanges(stored(same), { ...same, cost: 5, effect: 'Otro texto' }, { withMechanics: false });
  ok('un dato que la base tenía y mazos.cl cambió es una corrección', changed.changes.Cost.before === '3' && changed.changes.Cost.after === '5' && changed.changes.Effect.after === 'Otro texto' && changed.missing.length === 0);
  const incomplete = plan.cardChanges({ name: same.name, extData: plan.cardExtData({ ...same, effect: '' }) }, same, { withMechanics: false });
  ok('un dato que a la base le falta se marca por completar, no como corrección', incomplete.missing.includes('Effect') && !incomplete.changes.Effect);
  ok('si mazos.cl no entrega el dato, no se toca', Object.keys(plan.cardChanges(stored(same), { ...same, effect: '', edition: null }, { withMechanics: false }).changes).length === 0);
  ok('la edición con otro emoji o tilde no cuenta como cambio', Object.keys(plan.cardChanges(stored(same), { ...same, edition: { name: '❤️ dominios de ra' } }, { withMechanics: false }).changes).length === 0);

  ok('la habilidad se compara sin HTML ni espacios duros', Object.keys(plan.cardChanges({ name: same.name, extData: [{ name: 'Effect', value: '<p>Texto&nbsp;con   espacios</p>' }] }, { ...same, effect: 'Texto con espacios' }, { withMechanics: false }).changes).length === 0);

  // --- Informe del bloque
  const block = { id: 7, name: 'Imperio' };
  const cards = plan.collectBlock({ productCards: [], catalogCards: [card(20), card(21, { cost: 9 }), card(22), card(23, { edition: { name: 'Edición Nueva' } })] });
  const report = plan.planBlock(block, cards, {
    existingById: new Map([['20', stored(card(20))], ['21', stored(card(21, { cost: 1 }))], ['22', stored(card(22), { blockId: 4 })]]),
    groupNames: new Set([plan.cleanName('Dominios de RA')]),
    productNames: new Set(['DO']),
    blockCardIds: new Set(['20', '21', '99']),
  });
  ok('informe: 1 nueva, 1 corrección, 1 en otro bloque, 1 sin cambios, 1 en la base y no en mazos.cl',
    report.nuevas.length === 1 && report.nuevas[0].id === '23' && report.correcciones.length === 1 && report.correcciones[0].id === '21' && report.enOtroBloque.length === 1 && report.sinCambios === 1 && report.enLaBaseYNoEnMazos === 1,
    JSON.stringify(report));
  ok('informe: edición nueva y producto nuevo detectados', report.edicionesNuevas.join('|') === 'Edición Nueva' && report.productosNuevos.length === 0);
  const noEdition = plan.planBlock(block, plan.collectBlock({ productCards: [], catalogCards: [card(30, { edition: null, collectorCode: 'QQ-30-1' })] }), { existingById: new Map(), groupNames: new Set(), productNames: new Set(), blockCardIds: new Set() });
  ok('una carta nueva sin edición se informa aparte y no inventa una edición', noEdition.nuevasSinEdicion.length === 1 && noEdition.edicionesNuevas.length === 0 && noEdition.productosNuevos.join('|') === 'QQ');
  const existingOnly = plan.planBlock(block, plan.collectBlock({ productCards: [], catalogCards: [card(40, { collectorCode: 'ZZ-40-1' })] }), { existingById: new Map([['40', stored(card(40, { collectorCode: 'ZZ-40-1' }))]]), groupNames: new Set(), productNames: new Set(), blockCardIds: new Set() });
  ok('las cartas que ya están no generan productos ni ediciones nuevas', existingOnly.productosNuevos.length === 0 && existingOnly.edicionesNuevas.length === 0);

  // --- Sincronización completa contra la base local (mazos.cl y R2 simulados; bloque propio de la prueba)
  const t0 = new Date();
  const BLOCK = { key: 'cztest', name: 'CZTEST Bloque', folder: 'CZTEST_Bloque' };
  const hadCategory = Boolean(await prisma.tcgCategory.findUnique({ where: { categoryId: 99 } }));
  const wipe = async () => {
    const dbBlock = await prisma.tcgBlock.findFirst({ where: { categoryId: 99, name: BLOCK.name } });
    await prisma.tcgProduct.deleteMany({ where: { productId: { startsWith: '9000' } } });
    await prisma.mylSyncFinding.deleteMany({ where: { productId: { startsWith: '9000' } } });
    if (dbBlock) {
      await prisma.tcgPhysicalProduct.deleteMany({ where: { blockId: dbBlock.id } });
      await prisma.tcgGroup.deleteMany({ where: { blockId: dbBlock.id } });
      await prisma.tcgBlock.delete({ where: { id: dbBlock.id } });
    }
    await prisma.catalogSyncRun.deleteMany({ where: { source: 'myl', startedAt: { gte: t0 } } });
    if (!hadCategory) await prisma.tcgCategory.deleteMany({ where: { categoryId: 99 } });
  };
  try {
    await wipe();
    if (!hadCategory) await prisma.tcgCategory.create({ data: { categoryId: 99, name: 'Mitos y Leyendas', modifiedOn: new Date() } });
    await prisma.tcgBlock.create({ data: { categoryId: 99, name: BLOCK.name } });
    const imageOf = (n) => `https://cdn.mazos.cl/CZTEST/${n}.webp`;
    const mk = (id, name, extra = {}) => ({ id: Number(id), name, slug: name.toLowerCase(), type: 'ALIADO', cost: 2, attack: 1, race: ['Sombra'], frequency: 'VASALLO', collectorCode: `CZ-${id}-9`, effect: 'Texto', edition: { name: '💛 Edición Uno' }, imageUrl: imageOf(id), ...extra });
    let data = { products: [mk(9000001, 'Carta A'), mk(9000002, 'Repetida'), mk(9000003, 'Repetida')], catalog: [mk(9000004, 'Carta D', { edition: { name: 'Edición Dos' }, collectorCode: 'ZZ-4-1' }), mk(9000005, 'Sin Edición', { edition: null })] };
    const client = {
      products: async () => [{ id: 1, name: 'Kit: Uno' }],
      productCards: async () => data.products,
      catalog: async function* () { yield { page: 1, pages: 1, cards: [...data.products, ...data.catalog] }; },
    };
    const uploads = new Map();
    const failing = new Set([imageOf(9000002)]);
    const blocked = new Set();
    const run = (extra = {}) => load('core/mylSync/sync.js').then(({ runMylSync }) => runMylSync({
      blocks: [BLOCK], client, log: () => {}, upload: async (key, body) => { uploads.set(key, body); },
      fetchImage: async (url) => { if (blocked.has(url)) throw Object.assign(new Error('origen no permitido'), { code: 'ORIGIN_NOT_ALLOWED' }); if (failing.has(url)) throw new Error('falla simulada'); return Buffer.from(url); }, ...extra,
    }));
    const row = (id) => prisma.tcgProduct.findUnique({ where: { productId: String(id) }, include: { group: true, physicalProduct: true } });

    await run({ dryRun: true });
    ok('simular no escribe nada', (await prisma.tcgProduct.count({ where: { productId: { startsWith: '9000' } } })) === 0 && uploads.size === 0);

    let result = await run();
    const A = await row(9000001); const B = await row(9000002); const C = await row(9000003); const D = await row(9000004);
    ok('entran las cartas nuevas con su edición (sin el emoji) y su producto', result.newCards === 4 && A.group.name === 'Edición Uno' && D.group.name === 'Edición Dos' && A.physicalProduct.name === 'Kit_ Uno' && D.physicalProduct.name === 'ZZ', JSON.stringify(result));
    ok('la carta sin edición no entra y se informa', (await row(9000005)) === null && result.noEdition === 1);
    ok('la imagen sube con la misma ruta que CarpetazoUpdate', A.imageUrl.endsWith('/CZTEST_Bloque_DB/CZTEST_Bloque_Images/Kit_%20Uno/Carta%20A/Carta%20A.webp') && uploads.has('Carpetazo.cl/Mitos_y_Leyendas/CZTEST_Bloque_DB/CZTEST_Bloque_Images/Kit_ Uno/Carta A/Carta A.webp'));
    ok('dos cartas con el mismo nombre: la segunda lleva «2» en su carpeta', C.imageUrl.includes('/Repetida%202/Repetida.webp') && uploads.has('Carpetazo.cl/Mitos_y_Leyendas/CZTEST_Bloque_DB/CZTEST_Bloque_Images/Kit_ Uno/Repetida 2/Repetida.webp'), `${B.imageUrl} | ${C.imageUrl}`);
    ok('si la imagen falla, la carta entra igual sin imagen', B.imageUrl === '' && result.imagesFailed === 1);
    ok('la carta sin edición queda como hallazgo para revisar', (await prisma.mylSyncFinding.count({ where: { kind: 'noEdition', productId: '9000005' } })) === 1);
    const first = await prisma.catalogSyncRun.findFirst({ where: { source: 'myl', startedAt: { gte: t0 } }, orderBy: { startedAt: 'desc' } });
    ok('el resumen de la corrida guarda las listas que muestra el panel', first.summary.lists.cards.length === 4 && first.summary.lists.cards[0].block === 'CZTEST Bloque' && first.summary.lists.editions.length === 2 && first.summary.lists.products.length === 2 && first.summary.noEdition === 1, JSON.stringify(first.summary).slice(0, 300));
    ok('queda registrada la corrida de Mitos y Leyendas (no se mezcla con TCGplayer)', (await prisma.catalogSyncRun.count({ where: { source: 'myl', startedAt: { gte: t0 }, status: 'partial' } })) === 1);

    failing.clear();
    result = await run();
    ok('la noche siguiente completa la imagen que faltaba y no repite lo que ya entró', result.newCards === 0 && result.imagesFilled === 1 && (await row(9000002)).imageUrl.includes('/Repetida/Repetida.webp'), JSON.stringify(result));
    blocked.add(imageOf(9000003));
    await prisma.tcgProduct.update({ where: { productId: '9000003' }, data: { imageUrl: '' } });
    result = await run();
    ok('una imagen de un origen no permitido no marca la corrida como incompleta', result.imagesBlocked === 1 && result.imagesFailed === 0 && result.status !== 'partial', JSON.stringify({ b: result.imagesBlocked, f: result.imagesFailed, s: result.status }));
    blocked.clear();
    result = await run();
    ok('cuando el origen se permite, la imagen se completa', (await row(9000003)).imageUrl !== '');

    data = { ...data, products: [mk(9000001, 'Carta A', { cost: 7 }), data.products[1], data.products[2]] };
    result = await run();
    ok('una corrección de mazos.cl se cuenta pero no se aplica', result.corrections === 1 && (await row(9000001)).extData.find((x) => x.name === 'Cost').value === '2');
    let finding = await prisma.mylSyncFinding.findMany({ where: { kind: 'correction', productId: '9000001' } });
    ok('la corrección queda guardada con el antes y el después', finding.length === 1 && finding[0].before.Cost === '2' && finding[0].after.Cost === '7');
    await run();
    ok('repetir la corrida no duplica el hallazgo', (await prisma.mylSyncFinding.count({ where: { kind: 'correction', productId: '9000001' } })) === 1);

    await prisma.tcgProduct.update({ where: { productId: '9000004' }, data: { extData: D.extData.filter((x) => x.name !== 'Effect') } });
    result = await run();
    ok('un dato en blanco se completa solo', result.filledData === 1 && (await row(9000004)).extData.some((x) => x.name === 'Effect' && x.value === 'Texto'), JSON.stringify(result));

    data = { ...data, catalog: [data.catalog[0], mk(9000005, 'Sin Edición', { edition: { name: 'Edición Dos' } })] };
    await run();
    ok('cuando la carta consigue edición entra y deja de estar pendiente', (await row(9000005)) !== null && (await prisma.mylSyncFinding.count({ where: { kind: 'noEdition', productId: '9000005' } })) === 0);

    data = { products: [], catalog: [] };
    await run();
    ok('nunca borra: lo que mazos.cl ya no trae sigue en la base', (await prisma.tcgProduct.count({ where: { productId: { startsWith: '9000' } } })) === 5);

    data = { products: [mk(9000006, 'Carta F')], catalog: [] };
    await prisma.catalogSyncRun.create({ data: { status: 'running', source: 'myl' } });
    result = await run();
    ok('con otra corrida en curso no hace nada (candado)', result.status === 'skipped' && (await row(9000006)) === null);
    await prisma.catalogSyncRun.deleteMany({ where: { source: 'myl', status: 'running' } });
  } finally {
    await wipe();
  }
})().catch((error) => { ok('la prueba de Mitos y Leyendas no lanzó errores inesperados', false, error.stack); });
