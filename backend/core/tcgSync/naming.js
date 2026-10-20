// Nombres de carpetas y rutas de R2 del catálogo de TCGplayer. Es la misma lógica de TcgplayerUpdate (naming.js):
// las cartas nuevas tienen que caer exactamente donde TcgplayerUpdate las habría dejado.
//   Carpetazo.cl/<Juego>/<Juego>_DB/<Juego>_Images/<Edición>/<Carta (número)>/<Carta (número)>.webp
export const R2_ROOT = 'Carpetazo.cl';
const ILLEGAL = /[\/:*?"<>|\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_SEGMENT = 80;
export const MAX_NAME = 45;

export const safeSegment = (value, fallback = 'Sin_nombre', max = MAX_SEGMENT) => {
  let text = String(value ?? '').normalize('NFC').replace(ILLEGAL, '_').replace(/\s+/g, ' ').trim();
  text = text.replace(/[. ]+$/, '');
  if (text.length > max) text = text.slice(0, max).replace(/[. ]+$/, '');
  if (!text || /^\.+$/.test(text)) return fallback;
  return RESERVED.test(text) ? `_${text}` : text;
};

const GAME_NAMES = { 1: 'Magic', 2: 'YuGiOh', 3: 'Pokemon', 85: 'Pokemon_Japan', 68: 'One_Piece', 89: 'Riftbound' };
export const gameFolderName = (category) => GAME_NAMES[category.categoryId] || safeSegment(category.displayName || category.name, `Juego_${category.categoryId}`).replace(/ /g, '_');

const numberText = (number) => String(number ?? '').replace(/[\/]/g, '-').trim();

export const itemBaseName = (name, number) => {
  const base = String(name ?? '').trim() || 'Sin nombre';
  const text = numberText(number);
  if (!text || base.includes(text)) return safeSegment(base, 'Sin_nombre', MAX_NAME);
  const suffix = ` (${text})`;
  return safeSegment(`${safeSegment(base, 'Sin_nombre', Math.max(8, MAX_NAME - suffix.length))}${suffix}`, 'Sin_nombre', MAX_NAME);
};

// Nombre con el id al final: "Crustle (052-086) [593294]"
export const withId = (base, id) => {
  const suffix = ` [${id}]`;
  return safeSegment(`${safeSegment(base, 'Sin_nombre', Math.max(8, MAX_NAME - suffix.length))}${suffix}`, 'Sin_nombre', MAX_NAME);
};

// Nombres únicos dentro de una carpeta: los que chocan (sin distinguir mayúsculas) llevan su id al final
export const uniqueNames = (items) => {
  const groups = new Map();
  for (const item of items) {
    const key = item.base.toLowerCase();
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  const names = new Map();
  for (const list of groups.values()) {
    for (const item of list) names.set(String(item.id), list.length > 1 ? withId(item.base, item.id) : item.base);
  }
  return names;
};

// Carpetas de un juego y archivo de un elemento (carta o producto sellado) en R2
const TREES = { card: ['Data', 'Images', 'Thumbs'], product: ['Productos_Data', 'Productos_Images', 'Productos_Thumbs'] };
export const itemKeys = (gameFolder, kind, editionFolder, itemFolder) => {
  const [data, images, thumbs] = TREES[kind].map((suffix) => `${R2_ROOT}/${gameFolder}/${gameFolder}_DB/${gameFolder}_${suffix}/${editionFolder}/${itemFolder}`);
  return { dataKey: `${data}/data.json`, imageKey: `${images}/${itemFolder}.webp`, thumbKey: `${thumbs}/${itemFolder}.webp` };
};
