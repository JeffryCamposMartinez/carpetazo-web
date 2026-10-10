// Importación de cartas nuevas desde "cartas_incrementales.json" (el archivo que genera Carpetazo Update).
// Aquí vive todo lo que no es una ruta: limpieza de textos, validación del archivo y el plan contra la base.
import { createHash } from 'node:crypto';
import { isAllowedStoredImageUrl } from './validation.js';

export const IMPORT_FILE_NAME = 'cartas_incrementales.json';
export const IMPORT_FORMAT = 'carpetazo-card-catalog-incremental';
export const IMPORT_CATEGORY_ID = 99; // Mitos y Leyendas
export const MAX_IMPORT_CARDS = 5000;

const FIELD_LIMITS = {
  Type: 40, Cost: 10, Fuerza: 10, Power: 10, Race: 60, Edition: 120, Frequency: 40, Number: 60, Format: 60,
  Slug: 160, Effect: 4000, Mechanics: 80, R2DataKey: 500, R2ImageKey: 500, SourceImageUrl: 600
};
const MULTI_FIELDS = new Set(['Race', 'Mechanics']); // pueden repetirse

// --- Textos ---------------------------------------------------------------------------------------------------

// Caracteres de Windows-1252 que no coinciden con su código Unicode (0x80-0x9F)
const CP1252 = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
]);
const utf8 = new TextDecoder('utf-8', { fatal: true });

// El archivo trae los textos con doble codificación ("TÃ³tem", "ðŸ€"): se devuelven a UTF-8. Si no es ese caso, queda igual.
export const repairText = (value) => {
  const text = String(value ?? '');
  if (!/[ÃÂâð]/.test(text)) return text;
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 256) bytes.push(code);
    else if (CP1252.has(code)) bytes.push(CP1252.get(code));
    else return text;
  }
  try {
    const fixed = utf8.decode(Uint8Array.from(bytes));
    return fixed.includes('�') ? text : fixed;
  } catch (_error) {
    return text;
  }
};

const ENTITIES = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ' };
const htmlToText = (html) => String(html)
  .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*(script|style)\s*>/gi, '')
  .replace(/<\s*br\s*\/?>/gi, '\n')
  .replace(/<\/\s*(p|div|li)\s*>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });

const stripControls = (text) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const cleanLine = (text) => stripControls(text).replace(/\s+/g, ' ').trim();
const cleanBlock = (text) => stripControls(text).split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');

export const cleanName = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// "🍀 La Ira del Nahual" -> "La Ira del Nahual" (los nombres de edición de la base no llevan emoji)
const plainEdition = (value) => cleanLine(value).replace(/^[^\p{L}\p{N}]+/u, '');

// --- Archivo --------------------------------------------------------------------------------------------------

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const asInt = (value) => (Number.isInteger(Number(value)) && String(value).trim() !== '' ? Number(value) : null);

// Revisa la forma del archivo y devuelve las cartas ya limpias. Cada problema queda en `errors`, nunca se lanza.
export const normalizeIncrementalFile = (raw) => {
  const errors = [];
  const cards = [];
  if (!isPlainObject(raw) || raw.format !== IMPORT_FORMAT || raw.version !== 1 || !Array.isArray(raw.products)) {
    return { fatal: 'El archivo no es un cartas_incrementales.json válido de Carpetazo Update.', cards, errors };
  }
  if (raw.products.length === 0) return { fatal: 'El archivo no trae cartas.', cards, errors };
  if (raw.products.length > MAX_IMPORT_CARDS) return { fatal: `El archivo supera el máximo de ${MAX_IMPORT_CARDS} cartas por carga.`, cards, errors };

  const seen = new Set();
  for (const item of raw.products) {
    const label = isPlainObject(item) ? cleanLine(repairText(item.name)).slice(0, 80) || String(item.productId ?? '?') : '?';
    const problem = (message) => errors.push({ productId: isPlainObject(item) ? String(item.productId ?? '') : '', name: label, message });
    if (!isPlainObject(item)) { problem('Entrada inválida.'); continue; }

    const productId = String(item.productId ?? '');
    const groupId = asInt(item.groupId);
    const physicalProductId = item.physicalProductId === null || item.physicalProductId === undefined ? null : asInt(item.physicalProductId);
    const name = cleanLine(repairText(item.name));
    if (!/^\d{1,12}$/.test(productId)) { problem('El ID de la carta no es válido.'); continue; }
    if (seen.has(productId)) { problem('ID repetido dentro del archivo.'); continue; }
    seen.add(productId);
    if (asInt(item.categoryId) !== IMPORT_CATEGORY_ID) { problem('Solo se pueden cargar cartas de Mitos y Leyendas.'); continue; }
    if (groupId === null || groupId <= 0) { problem('Falta la edición (groupId).'); continue; }
    if (item.physicalProductId !== null && item.physicalProductId !== undefined && (physicalProductId === null || physicalProductId <= 0)) { problem('El producto físico no es válido.'); continue; }
    if (!name || name.length > 120) { problem('El nombre falta o supera los 120 caracteres.'); continue; }
    if (typeof item.imageUrl !== 'string' || !isAllowedStoredImageUrl(item.imageUrl)) { problem('La URL de la imagen no está permitida.'); continue; }
    if (!Array.isArray(item.extData) || item.extData.length > 60) { problem('Los datos de la carta no son válidos.'); continue; }

    const extData = [];
    let bad = '';
    for (const entry of item.extData) {
      const field = isPlainObject(entry) ? String(entry.name ?? '') : '';
      if (!Object.hasOwn(FIELD_LIMITS, field)) { bad = `Campo no permitido: ${field.slice(0, 30) || 'vacío'}.`; break; }
      if (typeof entry.value !== 'string' && typeof entry.value !== 'number') { bad = `El campo ${field} no es texto.`; break; }
      let value = repairText(entry.value);
      if (field === 'Effect') value = cleanBlock(htmlToText(value));
      else if (field === 'Edition') value = plainEdition(value);
      else value = cleanLine(value);
      if (value.length > FIELD_LIMITS[field]) { bad = `El campo ${field} es demasiado largo.`; break; }
      if (!value) continue;
      if (!MULTI_FIELDS.has(field) && extData.some((existing) => existing.name === field)) { bad = `El campo ${field} está repetido.`; break; }
      extData.push({ name: field, value });
    }
    if (bad) { problem(bad); continue; }
    if (!extData.some((entry) => entry.name === 'Edition')) { problem('Falta la edición en los datos de la carta.'); continue; }

    cards.push({ productId, groupId, physicalProductId, name, cleanName: cleanName(name), imageUrl: item.imageUrl, extData });
  }

  // Enlaces a productos físicos: solo valen los de cartas del archivo
  const extraLinks = [];
  if (Array.isArray(raw.physicalLinks)) {
    for (const link of raw.physicalLinks.slice(0, MAX_IMPORT_CARDS * 4)) {
      const productId = String(link?.productId ?? '');
      const physicalProductId = asInt(link?.physicalProductId);
      if (seen.has(productId) && physicalProductId !== null && physicalProductId > 0) extraLinks.push({ productId, physicalProductId });
    }
  }
  // Ediciones y productos físicos que usan las cartas, con su nombre y bloque: así se pueden encontrar (o crear) en una base cuyos ids son otros
  const readDefs = (list) => {
    const map = new Map();
    for (const item of Array.isArray(list) ? list.slice(0, 2000) : []) {
      const id = asInt(item?.groupId ?? item?.id);
      const name = cleanLine(repairText(item?.name));
      const blockName = cleanLine(repairText(item?.blockName));
      if (id !== null && id > 0 && name && name.length <= 120 && blockName && blockName.length <= 120) map.set(id, { name, blockName });
    }
    return map;
  };
  const groupDefs = readDefs(raw.groups);
  const physicalDefs = readDefs(raw.physicalProducts);
  return { fatal: '', cards, errors, extraLinks, groupDefs, physicalDefs, generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt.slice(0, 40) : '' };
};

// Parecido entre dos nombres (0 a 1): sirve para distinguir una corrección de nombre ("Johny Ringo" -> "Johnny Ringo") de un ID usado por otra carta
const similarity = (a, b) => {
  if (a === b) return 1;
  if (!a || !b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
};
const MIN_SAME_CARD_SIMILARITY = 0.55;
const sameExtData = (a, b) => {
  const key = (list) => JSON.stringify((Array.isArray(list) ? list : []).map((entry) => [String(entry?.name ?? ''), String(entry?.value ?? '')]).sort());
  return key(a) === key(b);
};

// --- Plan contra la base --------------------------------------------------------------------------------------

const digestOf = (cards, links, newGroups, newProducts) => createHash('sha256')
  .update(JSON.stringify([[...cards].sort((a, b) => a.productId.localeCompare(b.productId)), links, newGroups, newProducts]))
  .digest('hex');

// Compara el archivo con la base y dice qué se crearía (cartas, y también ediciones y productos físicos que aún no existan). No escribe nada.
export const buildImportPlan = async (db, raw) => {
  const file = normalizeIncrementalFile(raw);
  if (file.fatal) return { fatal: file.fatal };
  const errors = [...file.errors];
  const cards = file.cards;

  const [blocks, groupRows, physicalRows, existingRows] = await Promise.all([
    db.tcgBlock.findMany({ where: { categoryId: IMPORT_CATEGORY_ID }, select: { id: true, name: true } }),
    db.tcgGroup.findMany({ where: { categoryId: IMPORT_CATEGORY_ID }, select: { groupId: true, name: true, blockId: true } }),
    db.tcgPhysicalProduct.findMany({ where: { categoryId: IMPORT_CATEGORY_ID }, select: { id: true, name: true, blockId: true } }),
    db.tcgProduct.findMany({ where: { productId: { in: cards.map((card) => card.productId) } }, select: { productId: true, name: true, cleanName: true, imageUrl: true, extData: true, groupId: true, categoryId: true, physicalLinks: { select: { physicalProductId: true } } } })
  ]);
  const blockByClean = new Map(blocks.map((block) => [cleanName(block.name), block]));
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const groupById = new Map(groupRows.map((group) => [group.groupId, group]));
  const groupByBlockName = new Map(groupRows.map((group) => [`${group.blockId}|${cleanName(group.name)}`, group]));
  const physicalById = new Map(physicalRows.map((product) => [product.id, product]));
  const physicalByBlockName = new Map(physicalRows.map((product) => [`${product.blockId}|${cleanName(product.name)}`, product]));
  const existingById = new Map(existingRows.map((row) => [row.productId, row]));

  const newGroups = new Map(); // clave -> { blockId, name }
  const newProducts = new Map();

  // Edición de una carta: la que tenga ese nombre en su bloque, y si no existe se crea. Sin definición en el archivo se usa el id tal cual.
  const resolveGroup = (groupId) => {
    const def = file.groupDefs.get(groupId);
    if (!def) {
      const group = groupById.get(groupId);
      return group ? { groupId: group.groupId, key: `id:${group.groupId}`, name: group.name, blockId: group.blockId, isNew: false } : { error: `La edición ${groupId} no existe en la base.` };
    }
    const block = blockByClean.get(cleanName(def.blockName));
    if (!block) return { error: `El bloque "${def.blockName}" no existe en la base.` };
    const found = groupByBlockName.get(`${block.id}|${cleanName(def.name)}`);
    if (found) return { groupId: found.groupId, key: `id:${found.groupId}`, name: found.name, blockId: block.id, isNew: false };
    const key = `new:${block.id}|${cleanName(def.name)}`;
    newGroups.set(key, { blockId: block.id, name: def.name });
    return { groupId: null, key, name: def.name, blockId: block.id, isNew: true };
  };
  const resolvePhysical = (physicalProductId, group) => {
    const def = file.physicalDefs.get(physicalProductId);
    if (!def) {
      const product = physicalById.get(physicalProductId);
      if (!product) return { error: `El producto físico ${physicalProductId} no existe en la base.` };
      if (product.blockId !== group.blockId) return { error: 'El producto físico no pertenece al bloque de la edición.' };
      return { id: product.id, key: `id:${product.id}`, name: product.name, isNew: false };
    }
    if (cleanName(def.blockName) !== cleanName(blockById.get(group.blockId)?.name)) return { error: 'El producto físico no pertenece al bloque de la edición.' };
    const found = physicalByBlockName.get(`${group.blockId}|${cleanName(def.name)}`);
    if (found) return { id: found.id, key: `id:${found.id}`, name: found.name, isNew: false };
    const key = `new:${group.blockId}|${cleanName(def.name)}`;
    newProducts.set(key, { blockId: group.blockId, name: def.name });
    return { id: null, key, name: def.name, isNew: true };
  };

  const ready = [];
  const groupOfCard = new Map();
  for (const card of cards) {
    const problem = (message) => errors.push({ productId: card.productId, name: card.name, message });
    const group = resolveGroup(card.groupId);
    if (group.error) { problem(group.error); continue; }
    let physical = null;
    if (card.physicalProductId !== null) {
      physical = resolvePhysical(card.physicalProductId, group);
      if (physical.error) { problem(physical.error); continue; }
    }
    const edition = card.extData.find((entry) => entry.name === 'Edition').value;
    if (cleanName(edition) !== cleanName(group.name)) { problem(`La edición del archivo ("${edition}") no coincide con la de la base ("${group.name}").`); continue; }
    // Un ID que ya existe en la misma edición y con un nombre parecido es la misma carta (se actualiza); si no, es de otra carta y no se mezcla
    const existing = existingById.get(card.productId);
    let status = 'new';
    let previousName = '';
    if (existing) {
      if (existing.categoryId !== IMPORT_CATEGORY_ID || existing.groupId !== group.groupId) { problem(`Ese ID ya lo usa "${existing.name}" en otra edición o juego; no se mezcla.`); continue; }
      if (existing.cleanName !== card.cleanName && similarity(existing.cleanName, card.cleanName) < MIN_SAME_CARD_SIMILARITY) { problem(`Ese ID ya lo usa otra carta ("${existing.name}"); no se mezcla.`); continue; }
      const changed = existing.name !== card.name || existing.cleanName !== card.cleanName || existing.imageUrl !== card.imageUrl;
      status = changed ? 'update' : 'exists';
      previousName = existing.name;
    }
    const blockName = blockById.get(group.blockId)?.name || '';
    // Las cartas existentes quedan intactas; las nuevas llevan el formato del bloque como las demás
    const extData = card.extData.some((entry) => entry.name === 'Format') || !blockName ? card.extData : [...card.extData, { name: 'Format', value: blockName }];
    groupOfCard.set(card.productId, group);
    ready.push({ ...card, extData, groupKey: group.key, groupId: group.groupId, physicalKey: physical?.key ?? null, physicalProductId: physical?.id ?? null, blockName, editionName: group.name, editionIsNew: group.isNew, physicalName: physical?.name || '', physicalIsNew: Boolean(physical?.isNew), status, previousName, existingExt: existing?.extData ?? null });
  }

  // Enlaces carta-producto: los de cada carta y los extra del archivo (resueltos igual que el producto de la carta)
  const okIds = new Set(ready.map((card) => card.productId));
  const links = new Map();
  for (const card of ready) if (card.physicalKey) links.set(`${card.productId}|${card.physicalKey}`, { productId: card.productId, physicalKey: card.physicalKey });
  for (const link of file.extraLinks) {
    if (!okIds.has(link.productId)) continue;
    const physical = resolvePhysical(link.physicalProductId, groupOfCard.get(link.productId));
    if (!physical.error) links.set(`${link.productId}|${physical.key}`, { productId: link.productId, physicalKey: physical.key });
  }

  const editions = new Map();
  for (const card of ready) {
    const entry = editions.get(card.groupKey) || { groupId: card.groupId, name: card.editionName, block: card.blockName, isNew: card.editionIsNew, new: 0, updated: 0, exists: 0 };
    entry[card.status === 'new' ? 'new' : card.status === 'update' ? 'updated' : 'exists']++;
    editions.set(card.groupKey, entry);
  }
  const products = new Map();
  for (const card of ready) {
    if (!card.physicalKey) continue;
    const entry = products.get(card.physicalKey) || { id: card.physicalProductId, name: card.physicalName, block: card.blockName, isNew: card.physicalIsNew, cards: 0 };
    entry.cards++;
    products.set(card.physicalKey, entry);
  }

  const linkList = [...links.values()];
  const haveLink = new Set(existingRows.flatMap((row) => row.physicalLinks.map((link) => `${row.productId}|id:${link.physicalProductId}`)));
  const newLinks = linkList.filter((link) => !haveLink.has(`${link.productId}|${link.physicalKey}`)).length;
  const groupsToCreate = [...newGroups.entries()].filter(([key]) => ready.some((card) => card.groupKey === key));
  const productsToCreate = [...newProducts.entries()].filter(([key]) => ready.some((card) => card.physicalKey === key) || linkList.some((link) => link.physicalKey === key));
  return {
    fatal: '',
    cards: ready,
    links: linkList,
    newGroups: groupsToCreate.map(([key, value]) => ({ key, ...value })),
    newProducts: productsToCreate.map(([key, value]) => ({ key, ...value })),
    errors,
    generatedAt: file.generatedAt,
    counts: {
      total: cards.length + file.errors.length,
      new: ready.filter((card) => card.status === 'new').length,
      exists: ready.filter((card) => card.status === 'exists').length,
      updated: ready.filter((card) => card.status === 'update').length,
      links: linkList.length,
      newLinks,
      newGroups: groupsToCreate.length,
      newProducts: productsToCreate.length,
      rejected: errors.length
    },
    editions: [...editions.values()],
    physicalProducts: [...products.values()],
    digest: digestOf(ready.map((card) => ({ status: card.status, productId: card.productId, groupKey: card.groupKey, physicalKey: card.physicalKey, name: card.name, imageUrl: card.imageUrl, extData: card.extData })), linkList, groupsToCreate, productsToCreate)
  };
};

// Comprueba (sin descargar) que las imágenes de las cartas nuevas ya estén en R2. Solo consulta el dominio público propio.
export const checkImages = async (cards, limit = 300) => {
  let host = '';
  try { host = new URL(process.env.R2_PUBLIC_URL || '').hostname.toLowerCase(); } catch (_error) { return { checked: 0, missing: [], skipped: true }; }
  const targets = cards.filter((card) => card.status === 'new').slice(0, limit);
  const missing = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const card = targets[cursor++];
      try {
        const url = new URL(card.imageUrl);
        if (url.hostname.toLowerCase() !== host) { missing.push(card.productId); continue; }
        const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(4000) });
        if (!response.ok) missing.push(card.productId);
      } catch (_error) {
        missing.push(card.productId);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { checked: targets.length, missing, skipped: false };
};
