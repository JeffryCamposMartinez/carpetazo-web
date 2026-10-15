// Importación del catálogo de TCGplayer desde los archivos "cartas_incrementales_tcg_*.json" que exporta TcgplayerUpdate.
// Aquí vive todo lo que no es una ruta: validación del archivo y plan contra la base (qué se crearía, qué se corrige, qué ya está).
import { createHash } from 'node:crypto';
import { cleanName, repairText } from './catalogImport.js';

export const TCG_IMPORT_FORMAT = 'carpetazo-tcg-catalog-incremental';
export const MAX_TCG_IMPORT_CARDS = 5000;
const MAX_SETS = 4000;
const MAX_GAMES = 100;
const MYL_CATEGORY_ID = 99; // Mitos y Leyendas tiene su propio catálogo y su propia carga
const SEGMENT = /^[^\\/\u0000-\u001f]{1,120}$/;
const FOLDER = /^[A-Za-z0-9_\-]{1,60}$/;
const SOURCE_IMAGE_HOSTS = new Set(['tcgplayer-cdn.tcgplayer.com', 'product-images.tcgplayer.com']);

// --- Textos y valores -----------------------------------------------------------------------------------------------

const stripControls = (text) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const oneLine = (value) => stripControls(repairText(value)).replace(/\s+/g, ' ').trim();
const block = (value) => stripControls(repairText(value)).split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const asInt = (value, min = 1, max = 2_000_000_000) => (Number.isInteger(value) && value >= min && value <= max ? value : null);
const optionalText = (value, max) => {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const text = oneLine(value);
  return text.length > max ? { ok: false } : { ok: true, value: text || null };
};
const asDate = (value) => {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string' || value.length > 40) return { ok: false };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, value: date };
};

// Ruta de un objeto en R2: solo tramos normales, empieza por Carpetazo.cl/<carpeta del juego>/ y no sale de ahí
export const validR2Key = (key, gameFolder) => {
  if (typeof key !== 'string' || key.length > 500) return false;
  const parts = key.split('/');
  if (parts.length < 5 || parts[0] !== 'Carpetazo.cl' || parts[1] !== gameFolder) return false;
  return parts.every((part) => part !== '.' && part !== '..' && SEGMENT.test(part) && part === part.trim());
};

// URL pública de un objeto de R2 (cada tramo codificado, también los apóstrofes y paréntesis: la dirección se usa dentro de CSS)
export const r2PublicUrl = (key) => {
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!base || !key) return null;
  const encode = (part) => encodeURIComponent(part).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${base}/${key.split('/').map(encode).join('/')}`;
};

const cleanAttributes = (value) => {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (!isObject(value)) return { ok: false };
  const entries = Object.entries(value);
  if (entries.length > 60) return { ok: false };
  const out = {};
  for (const [name, raw] of entries) {
    const key = oneLine(name);
    if (!key || key.length > 60 || key === '__proto__') return { ok: false };
    if (typeof raw !== 'string' && typeof raw !== 'number') return { ok: false };
    const text = block(String(raw));
    if (text.length > 4000) return { ok: false };
    if (text) out[key] = text;
  }
  return { ok: true, value: Object.keys(out).length ? out : null };
};

// --- Archivo --------------------------------------------------------------------------------------------------------

// Revisa la forma del archivo y devuelve juegos, ediciones y cartas ya limpios. Cada problema queda en `errors`, nunca se lanza.
export const normalizeTcgFile = (raw) => {
  const errors = [];
  if (!isObject(raw) || raw.format !== TCG_IMPORT_FORMAT || raw.version !== 1 || !Array.isArray(raw.games) || !Array.isArray(raw.sets) || !Array.isArray(raw.cards)) {
    return { fatal: 'El archivo no es un catálogo de TCGplayer válido de TcgplayerUpdate.', errors, games: [], sets: [], cards: [] };
  }
  if (raw.cards.length === 0) return { fatal: 'El archivo no trae cartas.', errors, games: [], sets: [], cards: [] };
  if (raw.cards.length > MAX_TCG_IMPORT_CARDS) return { fatal: `El archivo supera el máximo de ${MAX_TCG_IMPORT_CARDS} cartas por carga.`, errors, games: [], sets: [], cards: [] };
  if (raw.sets.length > MAX_SETS || raw.games.length > MAX_GAMES) return { fatal: 'El archivo trae demasiadas ediciones o juegos.', errors, games: [], sets: [], cards: [] };

  const games = new Map();
  for (const item of raw.games) {
    const categoryId = isObject(item) ? asInt(item.categoryId, 1, 99998) : null;
    const name = isObject(item) && typeof item.name === 'string' ? oneLine(item.name) : '';
    const folder = isObject(item) && typeof item.folder === 'string' ? item.folder : '';
    if (categoryId === null || categoryId === MYL_CATEGORY_ID || !name || name.length > 120 || !FOLDER.test(folder) || games.has(categoryId)) {
      errors.push({ productId: '', name: name || String(item?.categoryId ?? '?'), message: 'Un juego del archivo no es válido o está repetido (Mitos y Leyendas se carga por su propia vía).' });
      continue;
    }
    games.set(categoryId, { categoryId, name, folder });
  }

  const sets = new Map();
  for (const item of raw.sets) {
    const groupId = isObject(item) ? asInt(item.groupId) : null;
    const categoryId = isObject(item) ? asInt(item.categoryId, 1, 99998) : null;
    const name = isObject(item) && typeof item.name === 'string' ? oneLine(item.name) : '';
    const folder = isObject(item) && typeof item.folder === 'string' ? oneLine(item.folder) : '';
    const abbreviation = optionalText(item?.abbreviation, 40);
    const publishedOn = asDate(item?.publishedOn);
    const modifiedOn = asDate(item?.modifiedOn);
    if (groupId === null || !games.has(categoryId) || !name || name.length > 120 || !SEGMENT.test(folder) || folder.length > 80 || !abbreviation.ok || !publishedOn.ok || !modifiedOn.ok || sets.has(groupId)) {
      errors.push({ productId: '', name: name || String(item?.groupId ?? '?'), message: 'Una edición del archivo no es válida, está repetida o su juego no viene en el archivo.' });
      continue;
    }
    sets.set(groupId, { groupId, categoryId, name, folder, abbreviation: abbreviation.value, publishedOn: publishedOn.value, modifiedOn: modifiedOn.value });
  }

  const cards = [];
  const seen = new Set();
  for (const item of raw.cards) {
    const label = isObject(item) && typeof item.name === 'string' ? oneLine(item.name).slice(0, 80) || String(item.productId ?? '?') : '?';
    const problem = (message) => errors.push({ productId: isObject(item) ? String(item.productId ?? '') : '', name: label, message });
    if (!isObject(item)) { problem('Entrada inválida.'); continue; }
    const productId = asInt(item.productId);
    const set = sets.get(asInt(item.groupId));
    const game = games.get(asInt(item.categoryId, 1, 99998));
    if (productId === null) { problem('El id de la carta no es válido.'); continue; }
    if (seen.has(productId)) { problem('ID repetido dentro del archivo.'); continue; }
    seen.add(productId);
    if (!game || !set || set.categoryId !== game.categoryId) { problem('La edición o el juego de la carta no coinciden con los del archivo.'); continue; }
    if (item.kind !== 'card' && item.kind !== 'product') { problem('El tipo debe ser carta o producto.'); continue; }
    const name = typeof item.name === 'string' ? oneLine(item.name) : '';
    if (!name || name.length > 200) { problem('El nombre falta o supera los 200 caracteres.'); continue; }
    const number = optionalText(item.number, 60);
    const rarity = optionalText(item.rarity, 60);
    const folder = typeof item.folder === 'string' ? oneLine(item.folder) : '';
    if (!number.ok || !rarity.ok) { problem('El número o la rareza no son válidos.'); continue; }
    if (!SEGMENT.test(folder) || folder.length > 80) { problem('El nombre de carpeta no es válido.'); continue; }
    const keys = {};
    let badKey = '';
    for (const field of ['imageKey', 'thumbKey', 'dataKey']) {
      const value = item[field];
      if (value === null || value === undefined || value === '') { keys[field] = null; continue; }
      if (!validR2Key(value, game.folder)) { badKey = field; break; }
      keys[field] = value;
    }
    if (badKey) { problem(`La ruta ${badKey} no es válida.`); continue; }
    const sourceImageUrl = optionalText(item.sourceImageUrl, 600);
    const tcgplayerUrl = optionalText(item.tcgplayerUrl, 600);
    let validUrls = sourceImageUrl.ok && tcgplayerUrl.ok;
    if (validUrls && sourceImageUrl.value) { try { const url = new URL(sourceImageUrl.value); validUrls = url.protocol === 'https:' && SOURCE_IMAGE_HOSTS.has(url.hostname); } catch { validUrls = false; } }
    if (validUrls && tcgplayerUrl.value) { try { const url = new URL(tcgplayerUrl.value); validUrls = url.protocol === 'https:' && (url.hostname === 'www.tcgplayer.com' || url.hostname === 'tcgplayer.com'); } catch { validUrls = false; } }
    if (!validUrls) { problem('Una dirección de TCGplayer no es válida.'); continue; }
    const attributes = cleanAttributes(item.attributes);
    const modifiedOn = asDate(item.modifiedOn);
    if (!attributes.ok || !modifiedOn.ok) { problem('Los datos de la carta no son válidos.'); continue; }
    cards.push({
      productId, categoryId: game.categoryId, groupId: set.groupId, kind: item.kind, name, cleanName: cleanName(name),
      number: number.value, rarity: rarity.value, folder, ...keys, sourceImageUrl: sourceImageUrl.value, tcgplayerUrl: tcgplayerUrl.value,
      attributes: attributes.value, modifiedOn: modifiedOn.value,
    });
  }
  return { fatal: '', errors, games: [...games.values()], sets: [...sets.values()], cards, generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt.slice(0, 40) : '' };
};

// --- Plan contra la base ----------------------------------------------------------------------------------------------

const stable = (value) => JSON.stringify(value, (_key, inner) => (isObject(inner) ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))) : inner));
const time = (value) => (value ? new Date(value).getTime() : null);
const CARD_FIELDS = ['groupId', 'kind', 'name', 'cleanName', 'number', 'rarity', 'folder', 'imageKey', 'thumbKey', 'dataKey', 'sourceImageUrl', 'tcgplayerUrl'];

const sameCard = (existing, card) => CARD_FIELDS.every((field) => (existing[field] ?? null) === (card[field] ?? null))
  && time(existing.modifiedOn) === time(card.modifiedOn) && stable(existing.attributes ?? null) === stable(card.attributes ?? null);
const sameSet = (existing, set) => existing.name === set.name && existing.folder === set.folder && (existing.abbreviation ?? null) === set.abbreviation
  && time(existing.publishedOn) === time(set.publishedOn) && time(existing.modifiedOn) === time(set.modifiedOn);

// Compara el archivo con la base y dice qué se crearía y qué se corregiría. No escribe nada.
export const buildTcgImportPlan = async (db, raw) => {
  const file = normalizeTcgFile(raw);
  if (file.fatal) return { fatal: file.fatal };
  const errors = [...file.errors];
  const [gameRows, setRows, cardRows] = await Promise.all([
    db.catalogGame.findMany({ where: { categoryId: { in: file.games.map((game) => game.categoryId) } } }),
    db.catalogSet.findMany({ where: { groupId: { in: file.sets.map((set) => set.groupId) } } }),
    db.catalogCard.findMany({ where: { productId: { in: file.cards.map((card) => card.productId) } } }),
  ]);
  const gameById = new Map(gameRows.map((row) => [row.categoryId, row]));
  const setById = new Map(setRows.map((row) => [row.groupId, row]));
  const cardById = new Map(cardRows.map((row) => [row.productId, row]));

  const newGames = file.games.filter((game) => !gameById.has(game.categoryId));
  const changedGames = file.games.filter((game) => gameById.has(game.categoryId) && (gameById.get(game.categoryId).name !== game.name || gameById.get(game.categoryId).folder !== game.folder));
  const newSets = [];
  const changedSets = [];
  const conflictSets = new Set(); // ediciones cuyo id ya usa otro juego: no se mezclan
  for (const set of file.sets) {
    const existing = setById.get(set.groupId);
    if (!existing) newSets.push(set);
    else if (existing.categoryId !== set.categoryId) conflictSets.add(set.groupId);
    else if (!sameSet(existing, set)) changedSets.push(set);
  }

  const cards = [];
  for (const card of file.cards) {
    if (conflictSets.has(card.groupId)) { errors.push({ productId: String(card.productId), name: card.name, message: 'Su edición ya existe en otro juego; no se mezcla.' }); continue; }
    const existing = cardById.get(card.productId);
    let status = 'new';
    if (existing) {
      if (existing.categoryId !== card.categoryId) { errors.push({ productId: String(card.productId), name: card.name, message: `Ese id ya lo usa otra carta de otro juego ("${existing.name}"); no se mezcla.` }); continue; }
      status = sameCard(existing, card) ? 'exists' : 'update';
    }
    cards.push({ ...card, status, previousName: existing && existing.name !== card.name ? existing.name : '' });
  }
  const used = new Set(cards.map((card) => card.groupId));
  const perGame = file.games.map((game) => {
    const own = cards.filter((card) => card.categoryId === game.categoryId);
    return { categoryId: game.categoryId, name: game.name, isNew: !gameById.has(game.categoryId), new: own.filter((card) => card.status === 'new').length, updated: own.filter((card) => card.status === 'update').length, exists: own.filter((card) => card.status === 'exists').length };
  }).filter((game) => game.new + game.updated + game.exists > 0);

  const digestSource = [
    file.games.map((game) => [game.categoryId, game.name, game.folder]),
    file.sets.filter((set) => used.has(set.groupId)).map((set) => [set.groupId, set.categoryId, set.name, set.folder, set.abbreviation, time(set.publishedOn), time(set.modifiedOn)]),
    [...cards].sort((a, b) => a.productId - b.productId).map((card) => [card.status, ...CARD_FIELDS.map((field) => card[field] ?? null), time(card.modifiedOn), stable(card.attributes)]),
  ];
  return {
    fatal: '',
    games: file.games, sets: file.sets.filter((set) => used.has(set.groupId)), cards,
    newGames, changedGames, newSets, changedSets,
    errors, generatedAt: file.generatedAt, perGame,
    counts: {
      total: file.cards.length + file.errors.length,
      new: cards.filter((card) => card.status === 'new').length,
      updated: cards.filter((card) => card.status === 'update').length,
      exists: cards.filter((card) => card.status === 'exists').length,
      newGames: newGames.length, newSets: newSets.length, changedSets: changedSets.length,
      rejected: errors.length,
    },
    digest: createHash('sha256').update(JSON.stringify(digestSource)).digest('hex'),
  };
};

// Comprueba (sin descargar) que las imágenes de algunas cartas nuevas ya estén en R2. Solo consulta el dominio público propio.
export const checkTcgImages = async (cards, limit = 200) => {
  let host = '';
  try { host = new URL(process.env.R2_PUBLIC_URL || '').hostname.toLowerCase(); } catch { return { checked: 0, missing: [], skipped: true }; }
  const withImage = cards.filter((card) => card.status === 'new' && card.imageKey);
  const step = Math.max(1, Math.floor(withImage.length / limit));
  const targets = withImage.filter((_card, index) => index % step === 0).slice(0, limit);
  const missing = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const card = targets[cursor++];
      try {
        const url = new URL(r2PublicUrl(card.imageKey));
        if (url.hostname.toLowerCase() !== host) { missing.push(card.productId); continue; }
        const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(4000) });
        if (!response.ok) missing.push(card.productId);
      } catch { missing.push(card.productId); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { checked: targets.length, sampled: step > 1, withImage: withImage.length, missing };
};
