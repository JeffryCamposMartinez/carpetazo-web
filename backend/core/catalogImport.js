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
  return { fatal: '', cards, errors, extraLinks, generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt.slice(0, 40) : '' };
};

// --- Plan contra la base --------------------------------------------------------------------------------------

const digestOf = (cards, links) => createHash('sha256')
  .update(JSON.stringify([[...cards].sort((a, b) => a.productId.localeCompare(b.productId)), links]))
  .digest('hex');

// Compara el archivo con la base y dice qué se crearía. No escribe nada.
export const buildImportPlan = async (db, raw) => {
  const file = normalizeIncrementalFile(raw);
  if (file.fatal) return { fatal: file.fatal };
  const errors = [...file.errors];
  const cards = file.cards;

  const groupIds = [...new Set(cards.map((card) => card.groupId))];
  const physicalIds = [...new Set([...cards.map((card) => card.physicalProductId), ...file.extraLinks.map((link) => link.physicalProductId)].filter((id) => id !== null))];
  const [groups, physicals, existingRows] = await Promise.all([
    db.tcgGroup.findMany({ where: { groupId: { in: groupIds }, categoryId: IMPORT_CATEGORY_ID }, select: { groupId: true, name: true, blockId: true, block: { select: { name: true } } } }),
    db.tcgPhysicalProduct.findMany({ where: { id: { in: physicalIds }, categoryId: IMPORT_CATEGORY_ID }, select: { id: true, name: true, blockId: true } }),
    db.tcgProduct.findMany({ where: { productId: { in: cards.map((card) => card.productId) } }, select: { productId: true, cleanName: true, groupId: true, categoryId: true, physicalLinks: { select: { physicalProductId: true } } } })
  ]);
  const groupById = new Map(groups.map((group) => [group.groupId, group]));
  const physicalById = new Map(physicals.map((product) => [product.id, product]));
  const existingById = new Map(existingRows.map((row) => [row.productId, row]));

  const ready = [];
  for (const card of cards) {
    const problem = (message) => errors.push({ productId: card.productId, name: card.name, message });
    const group = groupById.get(card.groupId);
    if (!group) { problem(`La edición ${card.groupId} no existe en la base.`); continue; }
    const physical = card.physicalProductId === null ? null : physicalById.get(card.physicalProductId);
    if (card.physicalProductId !== null && !physical) { problem(`El producto físico ${card.physicalProductId} no existe en la base.`); continue; }
    if (physical && physical.blockId !== group.blockId) { problem('El producto físico no pertenece al bloque de la edición.'); continue; }
    const edition = card.extData.find((entry) => entry.name === 'Edition').value;
    if (cleanName(edition) !== cleanName(group.name)) { problem(`La edición del archivo ("${edition}") no coincide con la de la base ("${group.name}").`); continue; }
    const existing = existingById.get(card.productId);
    if (existing && (existing.categoryId !== IMPORT_CATEGORY_ID || existing.groupId !== card.groupId || existing.cleanName !== card.cleanName)) {
      problem('Ese ID ya está usado por otra carta; no se mezcla.');
      continue;
    }
    // Las cartas existentes quedan intactas; las nuevas llevan el formato del bloque como las demás
    const extData = card.extData.some((entry) => entry.name === 'Format') || !group.block?.name ? card.extData : [...card.extData, { name: 'Format', value: group.block.name }];
    ready.push({ ...card, extData, blockName: group.block?.name || '', editionName: group.name, physicalName: physical?.name || '', status: existing ? 'exists' : 'new', linked: existing ? existing.physicalLinks.some((link) => link.physicalProductId === card.physicalProductId) : false });
  }

  const okIds = new Set(ready.map((card) => card.productId));
  const links = new Map();
  for (const card of ready) if (card.physicalProductId !== null) links.set(`${card.productId}|${card.physicalProductId}`, { productId: card.productId, physicalProductId: card.physicalProductId });
  for (const link of file.extraLinks) {
    if (okIds.has(link.productId) && physicalById.has(link.physicalProductId)) links.set(`${link.productId}|${link.physicalProductId}`, link);
  }

  const editions = new Map();
  for (const card of ready) {
    const key = card.groupId;
    const entry = editions.get(key) || { groupId: key, name: card.editionName, block: card.blockName, new: 0, exists: 0 };
    entry[card.status === 'new' ? 'new' : 'exists']++;
    editions.set(key, entry);
  }
  const products = new Map();
  for (const card of ready) {
    if (card.physicalProductId === null) continue;
    const entry = products.get(card.physicalProductId) || { id: card.physicalProductId, name: card.physicalName, block: card.blockName, cards: 0 };
    entry.cards++;
    products.set(card.physicalProductId, entry);
  }

  const linkList = [...links.values()];
  const haveLink = new Set(existingRows.flatMap((row) => row.physicalLinks.map((link) => `${row.productId}|${link.physicalProductId}`)));
  const newLinks = linkList.filter((link) => !haveLink.has(`${link.productId}|${link.physicalProductId}`)).length;
  return {
    fatal: '',
    cards: ready,
    links: linkList,
    errors,
    generatedAt: file.generatedAt,
    counts: {
      total: cards.length + file.errors.length,
      new: ready.filter((card) => card.status === 'new').length,
      exists: ready.filter((card) => card.status === 'exists').length,
      links: linkList.length,
      newLinks,
      rejected: errors.length
    },
    editions: [...editions.values()],
    physicalProducts: [...products.values()],
    digest: digestOf(ready.map((card) => ({ productId: card.productId, groupId: card.groupId, physicalProductId: card.physicalProductId, name: card.name, imageUrl: card.imageUrl, extData: card.extData })), linkList)
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
