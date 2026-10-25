// Sincronización de Mitos y Leyendas con mazos.cl (etapa de simulación): conversión de cartas, productos de relleno y comparación con la base.
// Son funciones puras: no usa red ni base.
const path = require('path');
const { pathToFileURL } = require('url');
const { ok } = require('./fixtures.cjs');

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
})().catch((error) => { ok('la prueba de Mitos y Leyendas no lanzó errores inesperados', false, error.stack); });
