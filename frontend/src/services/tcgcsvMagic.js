// Magic: The Gathering en TCGCSV (categoría 1) más lo que TCGCSV no trae (colores, valor de maná, formatos, habilidades),
// que sale de public/magic-meta.json (generado con scripts/catalog/build_magic_meta.cjs a partir de Scryfall).

export const MAGIC_CATEGORY = 1;
export const MAGIC_MARKER = 'magic'; // valor de searchCategory en la carpeta

export const MAGIC_COLORS = [
  { value: 'W', label: 'Blanco', hex: '#f5efd0', dark: true },
  { value: 'U', label: 'Azul', hex: '#2f80d1' },
  { value: 'B', label: 'Negro', hex: '#3f3a46' },
  { value: 'R', label: 'Rojo', hex: '#dc3d2f' },
  { value: 'G', label: 'Verde', hex: '#1f9d55' },
  { value: 'C', label: 'Incoloro', hex: '#a3a3ad', dark: true },
];

export const MAGIC_COLOR_MODES = [
  { value: 'include', label: 'Contiene' },
  { value: 'exact', label: 'Exacto' },
  { value: 'max', label: 'Solo estos' },
];

export const MAGIC_TYPES = [
  { value: 'Creature', label: 'Criatura' },
  { value: 'Instant', label: 'Instantáneo' },
  { value: 'Sorcery', label: 'Conjuro' },
  { value: 'Enchantment', label: 'Encantamiento' },
  { value: 'Artifact', label: 'Artefacto' },
  { value: 'Land', label: 'Tierra' },
  { value: 'Planeswalker', label: 'Planeswalker' },
  { value: 'Battle', label: 'Batalla' },
  { value: 'Token', label: 'Ficha' },
];

export const MAGIC_SUPERTYPES = [
  { value: 'Legendary', label: 'Legendario' },
  { value: 'Basic', label: 'Básica' },
  { value: 'Snow', label: 'Nevado' },
  { value: 'World', label: 'Mundo' },
];

export const MAGIC_RARITIES = [
  { value: 'C', label: 'Común' },
  { value: 'U', label: 'Poco común' },
  { value: 'R', label: 'Rara' },
  { value: 'M', label: 'Mítica' },
  { value: 'S', label: 'Especial' },
  { value: 'L', label: 'Tierra básica' },
  { value: 'P', label: 'Promo' },
  { value: 'T', label: 'Ficha' },
];

export const MAGIC_FORMAT_LABELS = {
  standard: 'Standard', pioneer: 'Pioneer', modern: 'Modern', legacy: 'Legacy', vintage: 'Vintage', commander: 'Commander', pauper: 'Pauper',
};

export const MAGIC_VERSIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'borderless', label: 'Sin bordes (Borderless)' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'extended', label: 'Arte extendido' },
  { value: 'retro', label: 'Marco retro' },
  { value: 'fullart', label: 'Arte completo' },
  { value: 'foil', label: 'Foil especial' },
  { value: 'alt', label: 'Arte alternativo' },
  { value: 'promo', label: 'Promo o evento' },
];

export const MAGIC_COLLECTIONS = [
  { value: 'expansion', label: 'Expansiones y bloques' },
  { value: 'commander', label: 'Commander' },
  { value: 'masters', label: 'Masters y reimpresiones' },
  { value: 'promo', label: 'Promos y eventos' },
  { value: 'lair', label: 'Secret Lair' },
  { value: 'art', label: 'Art Series' },
  { value: 'token', label: 'Fichas y emblemas' },
  { value: 'other', label: 'Otros' },
];

export const MAGIC_MV = [...Array.from({ length: 8 }, (_, i) => String(i)), '8+'];
export const MAGIC_STATS = [...Array.from({ length: 10 }, (_, i) => String(i)), '10+', '*'];

export const EMPTY_MAGIC_FILTERS = {
  colors: [], colorMode: 'include', identity: false, type: '', supertype: '', subtype: '', keyword: '', rarity: '',
  mv: '', power: '', toughness: '', format: '', version: '', collection: '', text: '', commander: false,
};

// Nombre sin mayúsculas, tildes ni signos: igual que en el script que genera magic-meta.json
export const normalizeMagicName = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let metaPromise = null;
export const loadMagicMeta = () => {
  if (!metaPromise) {
    metaPromise = fetch('/magic-meta.json')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    metaPromise.then((meta) => { if (!meta) metaPromise = null; });
  }
  return metaPromise;
};

const SUPERTYPES = ['Legendary', 'Basic', 'Snow', 'World', 'Ongoing', 'Elite', 'Host'];
const TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Planeswalker', 'Battle', 'Tribal', 'Kindred', 'Token', 'Emblem'];

// "Legendary Creature � Human Wizard" (TCGCSV pierde la raya) -> supertipos, tipos y subtipos
const parseTypeLine = (raw) => {
  const line = String(raw || '').replace(/\s*�\s*/g, ' — ');
  const [left, right = ''] = line.split(' — ');
  const words = left.split(/\s+/).filter(Boolean);
  return {
    typeLine: line,
    supertypes: words.filter((word) => SUPERTYPES.includes(word)),
    types: words.filter((word) => TYPES.includes(word)),
    subtypes: right.split(/\s+/).filter(Boolean),
  };
};

const statNumber = (value) => (/^\d+$/.test(String(value ?? '')) ? Number(value) : null);

// Versión de la carta según las etiquetas del nombre: "Omniscience (Borderless) (Mana Foil)"
const versionOf = (name) => {
  const tags = [...String(name || '').matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim()).filter((tag) => tag && !/^\d+(\/\d+)?$/.test(tag));
  if (tags.length === 0) return 'normal';
  const has = (test) => tags.some((tag) => test.test(tag));
  if (has(/prerelease|promo|serial|bundle|buy-a-box|buy a box|judge|release|gift|launch|fnm|friday night|store championship|game day|league|convention|open house|draft weekend|magicfest|regional|world championship|gen con|sdcc|comic.?con|mtg arena|player rewards|celebration/i)) return 'promo';
  if (has(/showcase/i)) return 'showcase';
  if (has(/borderless/i)) return 'borderless';
  if (has(/extended/i)) return 'extended';
  if (has(/retro/i)) return 'retro';
  if (has(/full.?art|textless/i)) return 'fullart';
  if (has(/alternate art|anime|japan|godzilla|manga|neon ink|ukiyo|dracula|jp\b/i)) return 'alt';
  if (has(/foil|etched|halo|galaxy|gilded|ripple|confetti|oil slick|step.and.compleat|rainbow/i)) return 'foil';
  return 'normal';
};

// Línea de producto de la edición, según su nombre
const collectionOf = (group) => {
  const name = String(group?.name || '');
  if (/token|emblem/i.test(name)) return 'token';
  if (/art series/i.test(name)) return 'art';
  if (/secret lair/i.test(name)) return 'lair';
  if (/commander|brawl|planechase|archenemy|conspiracy|duel decks|from the vault|spellbook|signature/i.test(name)) return 'commander';
  if (/promo|prerelease|pre-release|judge|gift|arena|league|fnm|friday night|game day|championship|convention|launch|release|buy.?a.?box|player rewards|magicfest|celebration|world championship|open house|summer of magic|ugin/i.test(name)) return 'promo';
  if (/masters|remaster|anthology|chronicles|collector.?s edition|jumpstart|mystery booster|modern horizons|battlebond|commander legends|eternal.?legal/i.test(name)) return 'masters';
  if (group?.isSupplemental) return 'other';
  return 'expansion';
};

const readText = (value) => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// Datos de la carta que usan los filtros; `meta` es magic-meta.json (puede faltar)
export const magicExt = (ext, group, name, meta) => {
  const type = parseTypeLine(ext.SubType);
  const front = normalizeMagicName(String(name || '').replace(/\([^)]*\)/g, '').split(' // ')[0]
    .replace(/ art card$/i, ''));
  const entry = meta?.cards?.[front] || meta?.cards?.[normalizeMagicName(front.split(' - ')[0])];
  let scryfall = null;
  if (entry) {
    const [colors, identity, mv, legal, keywords] = entry.split(';');
    scryfall = {
      colors: colors.split('').filter(Boolean),
      identity: identity.split('').filter(Boolean),
      mv: Number(mv),
      formats: meta.formats.filter((_, index) => legal[index] === '1'),
      keywords: keywords ? keywords.split(',').map((index) => meta.keywords[Number(index)]).filter(Boolean) : [],
    };
  }
  const isToken = ext.Rarity === 'T' || type.types.includes('Token') || type.types.includes('Emblem') || /token|emblem|theme card/i.test(ext.SubType || '');
  return {
    magic: {
      ...type,
      types: isToken && !type.types.includes('Token') ? [...type.types, 'Token'] : type.types,
      power: ext.P ?? null,
      toughness: ext.T ?? null,
      powerNum: statNumber(ext.P),
      toughnessNum: statNumber(ext.T),
      text: readText(ext.OracleText),
      version: versionOf(name),
      collection: collectionOf(group),
      ...(scryfall || { colors: null, identity: null, mv: null, formats: null, keywords: null }),
    },
  };
};

export const magicMatchesQuery = (card, q) => !q
  || card.name.toLowerCase().includes(q)
  || String(card.extData?.Number || '').toLowerCase().includes(q)
  || String(card.extData?.magic?.typeLine || '').toLowerCase().includes(q);

const statMatches = (filter, text, num) => {
  if (filter === '') return true;
  if (filter === '*') return text !== null && !/^\d+$/.test(text);
  if (filter === '10+') return num !== null && num >= 10;
  return num === Number(filter);
};

// Puede ser comandante: criatura legendaria, carta que lo dice en su texto, trasfondo (Background) o vehículo/nave legendaria con fuerza y resistencia
const canBeCommander = (m) => {
  if (!m.supertypes.includes('Legendary')) return /can be your commander/i.test(m.text);
  return m.types.includes('Creature') || m.subtypes.includes('Background') || /can be your commander/i.test(m.text)
    || ((m.subtypes.includes('Vehicle') || m.subtypes.includes('Spacecraft')) && m.power !== null);
};

export const filterMagicCards = (cards, f) => {
  const wanted = f.colors.filter((color) => color !== 'C');
  const wantsColorless = f.colors.includes('C');
  const text = f.text.trim().toLowerCase();
  return cards.filter((card) => {
    const m = card.extData?.magic;
    if (!m) return true;
    if (f.colors.length > 0) {
      const have = f.identity ? m.identity : m.colors;
      if (!have) return false; // sin datos de color no se puede asegurar
      if (wantsColorless && have.length > 0 && f.colorMode !== 'max') return false;
      if (f.colorMode === 'include' && !wanted.every((color) => have.includes(color))) return false;
      if (f.colorMode === 'exact' && !(wanted.length === have.length && wanted.every((color) => have.includes(color)))) return false;
      if (f.colorMode === 'max' && !have.every((color) => wanted.includes(color))) return false;
    }
    if (f.type && !m.types.includes(f.type)) return false;
    if (f.supertype && !m.supertypes.includes(f.supertype)) return false;
    if (f.commander && !canBeCommander(m)) return false;
    if (f.subtype && !m.subtypes.includes(f.subtype)) return false;
    if (f.keyword && !(m.keywords || []).includes(f.keyword)) return false;
    if (f.rarity && String(card.extData?.Rarity || '') !== f.rarity) return false;
    if (f.mv !== '') {
      if (m.mv === null) return false;
      if (f.mv === '8+' ? m.mv < 8 : m.mv !== Number(f.mv)) return false;
    }
    if (!statMatches(f.power, m.power, m.powerNum)) return false;
    if (!statMatches(f.toughness, m.toughness, m.toughnessNum)) return false;
    if (f.format && !(m.formats || []).includes(f.format)) return false;
    if (f.version && m.version !== f.version) return false;
    if (f.collection && m.collection !== f.collection) return false;
    if (text && !m.text.toLowerCase().includes(text)) return false;
    return true;
  });
};

// Cuántos filtros hay activos (sin contar el buscador de texto principal)
export const countMagicFilters = (f) => Object.entries(f).reduce((total, [key, value]) => {
  if (key === 'colorMode' || key === 'identity') return total;
  if (key === 'commander') return total + (value ? 1 : 0);
  if (key === 'colors') return total + value.length;
  return total + (String(value).trim() !== '' ? 1 : 0);
}, 0);

// Art Series, fichas, promos y Secret Lair van al final de la lista de ediciones (0 = principal, 1 = al final)
export const magicGroupRank = (group) => (['expansion', 'commander', 'masters'].includes(collectionOf(group)) && !group.isSupplemental ? 0 : 1);

export const magicGroupLabel = (group) => {
  const abbr = String(group.abbreviation || '').trim();
  return abbr && !group.name.includes(abbr) ? `${abbr} · ${group.name}` : group.name;
};
