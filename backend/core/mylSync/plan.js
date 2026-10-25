// Sincronización de Mitos y Leyendas con mazos.cl: lo que CarpetazoUpdate hace a mano, pero sin pasar por el disco.
// Este archivo solo tiene funciones puras (sin red ni base): convertir las cartas de mazos.cl, ubicarlas por producto y compararlas con la base.
export const MYL_CATEGORY = 99;
// Bloques: `key` es el nombre que usa mazos.cl; `folder` el de las carpetas de R2 (`<folder>_DB/<folder>_Images`)
export const MYL_BLOCKS = [
  { key: 'primer-bloque', name: 'Primer Bloque', folder: 'Primer_Bloque' },
  { key: 'furia-extendido', name: 'Furia Extendido', folder: 'Furia_Extendido' },
  { key: 'primera-era', name: 'Primera Era', folder: 'Primera_Era' },
  { key: 'imperio', name: 'Imperio', folder: 'Imperio' },
];

// Igual que CarpetazoUpdate (SanitizeFileName): reemplaza los caracteres que Windows no permite en nombres de carpeta
export const safeName = (value) => {
  const text = String(value ?? '');
  if (!text.trim()) return 'Desconocido';
  return text.replace(/[\u0000-\u001f"<>|:*?\\/]/g, '_').trim();
};

// Igual que el script de importación: sin tildes ni símbolos (también quita los emojis que mazos.cl pone delante de las ediciones)
export const cleanName = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

// Atributos de la carta en la forma que ya usa la base: lista de { name, value }, un valor por entrada (razas y mecánicas pueden ser varias)
export const cardExtData = (json) => {
  const races = Array.isArray(json.race) ? json.race : [json.race];
  const items = [
    ['Type', json.type], ['Cost', json.cost], ['Fuerza', json.attack],
    ...races.map((race) => ['Race', race]),
    ['Edition', json.edition?.name], ['Frequency', json.frequency], ['Number', json.collectorCode],
    ['Format', json.format], ['Slug', json.slug], ['Effect', json.effect],
    ...(Array.isArray(json.mechanics) ? json.mechanics.map((mechanic) => ['Mechanics', mechanic?.name]) : []),
  ];
  return items.map(([name, value]) => ({ name, value: text(value) })).filter((item) => item.value !== '');
};

// Producto "de relleno" para las cartas que mazos.cl no enlaza a ningún producto: el código de colección sin su número, o la edición
export const pseudoProduct = (json) => {
  const fromCode = text(json.collectorCode).replace(/(?:[-\s]+)\d+[/\-\d]*\s*[a-zA-Z]*$/, '').trim();
  return safeName(fromCode || json.edition?.name || 'Cartas_Sueltas');
};

// Une lo que mazos.cl dice de un bloque: cartas de cada producto y, aparte, el catálogo completo (las que ningún producto trae)
export const collectBlock = ({ productCards, catalogCards }) => {
  const cards = new Map(); // id -> { json, products:Set, fromProduct }
  for (const { name, cards: list } of productCards) {
    for (const json of list) {
      const id = String(json.id);
      if (!cards.has(id)) cards.set(id, { json, products: new Set(), fromProduct: true });
      cards.get(id).products.add(safeName(name));
    }
  }
  for (const json of catalogCards) {
    const id = String(json.id);
    if (cards.has(id)) continue;
    cards.set(id, { json, products: new Set([pseudoProduct(json)]), fromProduct: false });
  }
  return cards;
};

// Atributos que se comparan. «Mechanics» solo viene en las cartas que salen de un producto; «Format» no lo pide ninguna consulta.
const COMPARED_ATTRIBUTES = ['Type', 'Cost', 'Fuerza', 'Race', 'Edition', 'Frequency', 'Number', 'Effect', 'Mechanics'];
const plain = (value) => String(value ?? '').replace(/<\s*br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const grouped = (list) => {
  const map = new Map();
  for (const { name, value } of list || []) map.set(name, map.has(name) ? `${map.get(name)} | ${value}` : value);
  if (map.has('Effect')) map.set('Effect', plain(map.get('Effect')));
  return map;
};

// Compara una carta que ya está en la base con lo que mazos.cl dice hoy, igual que la sincronización de TCGplayer:
// un dato que la base ya tenía y mazos.cl cambió es una corrección (se revisa a mano); un dato que a la base le falta es algo por completar.
// Solo cuenta lo que mazos.cl entrega.
export const cardChanges = (existing, json, { withMechanics }) => {
  const before = grouped(existing.extData);
  const after = grouped(cardExtData(json));
  const changes = {};
  const missing = [];
  const compare = (key, was, now) => {
    if (!now || was === now) return;
    if (!was) missing.push(key); else changes[key] = { before: was, after: now };
  };
  compare('name', text(existing.name), text(json.name));
  for (const key of COMPARED_ATTRIBUTES) {
    if (key === 'Mechanics' && !withMechanics) continue;
    const was = before.get(key) ?? '';
    const now = after.get(key) ?? '';
    if (key === 'Edition' && cleanName(was) === cleanName(now)) continue;
    compare(key, was, now);
  }
  return { changes, missing };
};

// Informe de un bloque contra la base (sin escribir nada).
// db: { existingById:Map(id -> carta), groupNames:Set(cleanName de las ediciones del bloque), productNames:Set(nombre de los productos del bloque), blockCardIds:Set }
export const planBlock = (block, cards, db) => {
  const report = {
    bloque: block.name, cartasEnMazos: cards.size, nuevas: [], correcciones: [], porCompletar: {}, enOtroBloque: [], edicionesNuevas: [], productosNuevos: [], sinImagenEnMazos: 0,
    enLaBaseYNoEnMazos: 0, sinCambios: 0, nuevasSinEdicion: [],
  };
  const newEditions = new Set();
  const newProducts = new Set();
  for (const [id, entry] of cards) {
    const { json, products } = entry;
    const edition = text(json.edition?.name);
    if (!text(json.imageUrl)) report.sinImagenEnMazos++;
    const existing = db.existingById.get(id);
    if (!existing) {
      // Edición y producto nuevos: solo importan para las cartas que van a entrar (las que ya están tienen los suyos)
      if (!edition) report.nuevasSinEdicion.push({ id, name: text(json.name) });
      else if (!db.groupNames.has(cleanName(edition))) newEditions.add(edition);
      for (const product of products) if (!db.productNames.has(product)) newProducts.add(product);
      report.nuevas.push({ id, name: text(json.name), edition, product: [...products][0] });
      continue;
    }
    if (existing.blockId !== undefined && existing.blockId !== null && existing.blockId !== block.id) { report.enOtroBloque.push({ id, name: existing.name }); continue; }
    const { changes, missing } = cardChanges(existing, json, { withMechanics: entry.fromProduct });
    for (const key of missing) report.porCompletar[key] = (report.porCompletar[key] || 0) + 1;
    if (Object.keys(changes).length) report.correcciones.push({ id, name: existing.name, changes }); else if (!missing.length) report.sinCambios++;
  }
  report.edicionesNuevas = [...newEditions].sort();
  report.productosNuevos = [...newProducts].sort();
  for (const id of db.blockCardIds) if (!cards.has(id)) report.enLaBaseYNoEnMazos++;
  return report;
};
