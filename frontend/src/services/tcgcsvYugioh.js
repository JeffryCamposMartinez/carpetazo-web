// Yu-Gi-Oh! en TCGCSV (categoría 2) más lo que TCGCSV no trae (nivel o rango, escala, arquetipo, lista de prohibidas),
// que sale de public/yugioh-meta.json (generado con scripts/catalog/build_yugioh_meta.cjs a partir de YGOPRODeck).

export const YUGIOH_CATEGORY = 2;
export const YUGIOH_MARKER = 'yugioh'; // valor de searchCategory en la carpeta

export const YGO_KINDS = [
  { value: '', label: 'Todo', short: 'Todo' },
  { value: 'Monster', label: 'Monstruo', short: 'Monstruo' },
  { value: 'Spell', label: 'Mágica', short: 'Mágica' },
  { value: 'Trap', label: 'Trampa', short: 'Trampa' },
];

export const YGO_ATTRIBUTES = [
  { value: 'DARK', label: 'Oscuridad', hex: '#6d28d9' },
  { value: 'LIGHT', label: 'Luz', hex: '#eab308' },
  { value: 'EARTH', label: 'Tierra', hex: '#92400e' },
  { value: 'WATER', label: 'Agua', hex: '#2563eb' },
  { value: 'FIRE', label: 'Fuego', hex: '#dc2626' },
  { value: 'WIND', label: 'Viento', hex: '#16a34a' },
  { value: 'DIVINE', label: 'Divino', hex: '#b45309' },
];

// Categorías de monstruo, mágica y trampa (el selector muestra solo las del tipo elegido)
export const YGO_MONSTER_CATEGORIES = [
  { value: 'Normal', label: 'Normal' }, { value: 'Effect', label: 'Efecto' }, { value: 'Fusion', label: 'Fusión' },
  { value: 'Ritual', label: 'Ritual' }, { value: 'Synchro', label: 'Sincro' }, { value: 'Xyz', label: 'Xyz' },
  { value: 'Pendulum', label: 'Péndulo' }, { value: 'Link', label: 'Enlace' }, { value: 'Tuner', label: 'Cantante (Tuner)' },
  { value: 'Flip', label: 'Volteo' }, { value: 'Toon', label: 'Toon' }, { value: 'Spirit', label: 'Espíritu' },
  { value: 'Union', label: 'Unión' }, { value: 'Gemini', label: 'Géminis' }, { value: 'Token', label: 'Ficha' },
];
export const YGO_SPELL_CATEGORIES = [
  { value: 'Normal', label: 'Normal' }, { value: 'Quick-Play', label: 'De juego rápido' }, { value: 'Continuous', label: 'Continua' },
  { value: 'Field', label: 'De campo' }, { value: 'Equip', label: 'De equipo' }, { value: 'Ritual', label: 'Ritual' },
];
export const YGO_TRAP_CATEGORIES = [
  { value: 'Normal', label: 'Normal' }, { value: 'Continuous', label: 'Continua' }, { value: 'Counter', label: 'De contraefecto' },
];

export const YGO_RACES = [
  ['Aqua', 'Aqua'], ['Beast', 'Bestia'], ['Beast-Warrior', 'Bestia Guerrera'], ['Creator-God', 'Dios Creador'], ['Cyberse', 'Cyberso'],
  ['Dinosaur', 'Dinosaurio'], ['Divine-Beast', 'Bestia Divina'], ['Dragon', 'Dragón'], ['Fairy', 'Hada'], ['Fiend', 'Demonio'],
  ['Fish', 'Pez'], ['Illusion', 'Ilusión'], ['Insect', 'Insecto'], ['Machine', 'Máquina'], ['Plant', 'Planta'], ['Psychic', 'Psíquico'],
  ['Pyro', 'Piro'], ['Reptile', 'Reptil'], ['Rock', 'Roca'], ['Sea Serpent', 'Serpiente Marina'], ['Spellcaster', 'Lanzador de Conjuros'],
  ['Thunder', 'Trueno'], ['Warrior', 'Guerrero'], ['Winged Beast', 'Bestia Alada'], ['Wyrm', 'Wyrm'], ['Zombie', 'Zombi'],
].map(([value, label]) => ({ value, label }));

export const YGO_RARITIES = [
  ['Common', 'Común'], ['Short Print', 'Impresión corta'], ['Super Short Print', 'Súper impresión corta'], ['Rare', 'Rara'],
  ['Super Rare', 'Súper rara'], ['Ultra Rare', 'Ultra rara'], ['Ultimate Rare', 'Última rara (Ultimate)'], ['Secret Rare', 'Secreta'],
  ['Prismatic Secret Rare', 'Secreta prismática'], ['Quarter Century Secret Rare', 'Secreta 25.º aniversario'], ['Starlight Rare', 'Starlight'],
  ['Ghost Rare', 'Fantasma (Ghost)'], ['Ghost/Gold Rare', 'Fantasma y dorada'], ['Gold Rare', 'Dorada'], ['Premium Gold Rare', 'Dorada premium'],
  ['Gold Secret Rare', 'Dorada secreta'], ['Platinum Rare', 'Platino'], ['Platinum Secret Rare', 'Platino secreta'], ['Mosaic Rare', 'Mosaico'],
  ['Shatterfoil Rare', 'Shatterfoil'], ['Starfoil Rare', 'Starfoil'], ["Collector's Rare", 'De coleccionista'], ['Grand Master Rare', 'Gran Maestro'],
].map(([value, label]) => ({ value, label }));

export const YGO_BANLIST = [
  { value: 'Forbidden', label: 'Prohibida' },
  { value: 'Limited', label: 'Limitada (1)' },
  { value: 'Semi-Limited', label: 'Semi-limitada (2)' },
];

export const YGO_LANGUAGES = [
  { value: 'EN', label: 'Inglés' }, { value: 'SP', label: 'Español' }, { value: 'PT', label: 'Portugués' }, { value: 'FR', label: 'Francés' },
  { value: 'DE', label: 'Alemán' }, { value: 'IT', label: 'Italiano' }, { value: 'JP', label: 'Japonés' }, { value: 'KR', label: 'Coreano' },
];

export const YGO_VERSIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'alt', label: 'Arte alternativo' },
  { value: 'extended', label: 'Arte extendido' },
  { value: 'emblazoned', label: 'Emblazoned' },
];

export const YGO_COLLECTIONS = [
  { value: 'booster', label: 'Boosters y expansiones' },
  { value: 'structure', label: 'Structure y Starter Decks' },
  { value: 'speed', label: 'Speed Duel' },
  { value: 'tin', label: 'Tins, colecciones y cajas' },
  { value: 'promo', label: 'Promos y torneos' },
];

export const YGO_LEVELS = Array.from({ length: 14 }, (_, i) => String(i));
export const YGO_LINKS = ['1', '2', '3', '4', '5', '6'];
export const YGO_STATS = [
  { value: '0', label: '0' }, { value: '1000', label: '1 a 1000' }, { value: '2000', label: '1100 a 2000' }, { value: '3000', label: '2100 a 3000' },
  { value: '4000', label: '3100 a 4000' }, { value: '4001', label: 'Más de 4000' }, { value: '?', label: '? (variable)' },
];

export const EMPTY_YGO_FILTERS = {
  kind: '', category: '', attributes: [], race: '', level: '', scale: '', link: '', atk: '', def: '', rarity: '',
  archetype: '', banlist: '', language: '', version: '', collection: '', text: '',
};

const numberOf = (value) => (/^\d+$/.test(String(value ?? '')) ? Number(value) : null);
const readText = (value) => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// Nombre sin mayúsculas, tildes ni signos: igual que en el script que genera yugioh-meta.json
export const normalizeYugiohName = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// "Junk Synchron (German) - "Gerumpel..."" y "Dragon (Alternate Art)" -> el nombre en inglés
const baseName = (name) => String(name || '').replace(/\([^)]*\)/g, '').replace(/\s+-\s+".*$/, '').trim();

let metaPromise = null;
export const loadYugiohMeta = () => {
  if (!metaPromise) {
    metaPromise = fetch('/yugioh-meta.json')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    metaPromise.then((meta) => { if (!meta) metaPromise = null; });
  }
  return metaPromise;
};

// 'Xyz/Effect Monster' -> monstruo con categorías Xyz y Efecto; 'Quick-Play Spell' -> mágica de juego rápido
const parseCardType = (raw) => {
  const text = String(raw || '').trim();
  if (/Monster/i.test(text)) return { kind: 'Monster', categories: text.replace(/\s*Monster$/i, '').split('/').map((part) => part.trim()).filter(Boolean) };
  if (/Spell/i.test(text)) return { kind: 'Spell', categories: [text.replace(/\s*Spell$/i, '').trim() || 'Normal'] };
  if (/Trap/i.test(text)) return { kind: 'Trap', categories: [text.replace(/\s*Trap$/i, '').trim() || 'Normal'] };
  return { kind: '', categories: text ? [text] : [] };
};

const LANGUAGE_TAGS = { German: 'DE', French: 'FR', Italian: 'IT', Spanish: 'SP', Portuguese: 'PT', Japanese: 'JP', Korean: 'KR' };
const LANGUAGE_LETTER = { E: 'EN', F: 'FR', G: 'DE', I: 'IT', S: 'SP', P: 'PT', J: 'JP', K: 'KR' };
const languageOf = (number, name) => {
  const tag = Object.keys(LANGUAGE_TAGS).find((language) => new RegExp(`\\(${language}\\)`, 'i').test(name));
  if (tag) return LANGUAGE_TAGS[tag];
  const code = String(number || '').match(/-([A-Z]{1,2})\d/)?.[1];
  if (!code) return 'EN';
  if (code.length === 1) return LANGUAGE_LETTER[code] || 'EN';
  if (code === 'ES') return 'SP';
  if (code === 'JA') return 'JP';
  return ['EN', 'SP', 'PT', 'FR', 'DE', 'IT', 'JP', 'KR'].includes(code) ? code : 'EN';
};

const versionOf = (name) => {
  const tags = [...String(name || '').matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim());
  if (tags.some((tag) => /emblazoned/i.test(tag))) return 'emblazoned';
  if (tags.some((tag) => /extended art/i.test(tag))) return 'extended';
  if (tags.some((tag) => /alternate art/i.test(tag))) return 'alt';
  return 'normal';
};

const collectionOf = (group) => {
  const name = String(group?.name || '');
  if (/speed duel/i.test(name)) return 'speed';
  if (/promo|ots |tournament|championship|winner|prize|sneak preview|opening|astral pack|limited pack|jump|shonen|gift|bonus/i.test(name)) return 'promo';
  if (/structure deck|starter deck|super starter|legendary .*decks?|egyptian god deck|duelist deck|battle pack|2-player/i.test(name)) return 'structure';
  if (/\btin\b|mega.?pack|collection|gold series|maximum gold|premium pack|advent calendar|movie pack|\bbox\b/i.test(name)) return 'tin';
  return 'booster';
};

const bucketOf = (value) => {
  const n = numberOf(value);
  if (n === null) return '?';
  if (n === 0) return '0';
  if (n <= 1000) return '1000';
  if (n <= 2000) return '2000';
  if (n <= 3000) return '3000';
  if (n <= 4000) return '4000';
  return '4001';
};

// Datos de la carta que usan los filtros (la carta conserva además los campos originales de TCGCSV)
export const yugiohExt = (ext, group, name, meta) => {
  const type = parseCardType(ext['Card Type']);
  const entry = meta?.cards?.[normalizeYugiohName(baseName(name))];
  let extra = { level: null, scale: null, archetype: null, banlist: null };
  if (entry) {
    const [level, scale, archetype, ban] = entry.split(';');
    extra = {
      level: numberOf(level),
      scale: numberOf(scale),
      archetype: archetype === '' ? null : meta.archetypes[Number(archetype)] || null,
      banlist: { 1: 'Forbidden', 2: 'Limited', 3: 'Semi-Limited' }[ban] || null,
    };
  }
  return {
    ygo: {
      ...type,
      attribute: ext.Attribute ? String(ext.Attribute).toUpperCase() : null,
      race: ext.MonsterType || null,
      atk: ext.Attack ?? null,
      def: ext.Defense ?? null,
      atkBucket: type.kind === 'Monster' ? bucketOf(ext.Attack) : null,
      defBucket: type.kind === 'Monster' && !type.categories.includes('Link') ? bucketOf(ext.Defense) : null,
      link: numberOf(ext.LinkRating),
      text: readText(ext.Description),
      language: languageOf(ext.Number, name),
      version: versionOf(name),
      collection: collectionOf(group),
      known: Boolean(entry),
      ...extra,
    },
  };
};

// Texto del buscador: nombre, código (SDMY-EN001) o arquetipo
export const yugiohMatchesQuery = (card, q) => !q
  || card.name.toLowerCase().includes(q)
  || String(card.extData?.Number || '').toLowerCase().includes(q)
  || String(card.extData?.ygo?.archetype || '').toLowerCase().includes(q);

export const filterYugiohCards = (cards, f) => {
  const text = f.text.trim().toLowerCase();
  return cards.filter((card) => {
    const y = card.extData?.ygo;
    if (!y) return true;
    if (f.kind && y.kind !== f.kind) return false;
    if (f.category && !y.categories.includes(f.category)) return false;
    if (f.attributes.length > 0 && !f.attributes.includes(y.attribute)) return false;
    if (f.race && y.race !== f.race) return false;
    if (f.level !== '' && y.level !== Number(f.level)) return false;
    if (f.scale !== '' && y.scale !== Number(f.scale)) return false;
    if (f.link !== '' && y.link !== Number(f.link)) return false;
    if (f.atk && y.atkBucket !== f.atk) return false;
    if (f.def && y.defBucket !== f.def) return false;
    if (f.rarity && String(card.extData?.Rarity || '') !== f.rarity) return false;
    if (f.archetype && y.archetype !== f.archetype) return false;
    if (f.banlist && y.banlist !== f.banlist) return false;
    if (f.language && y.language !== f.language) return false;
    if (f.version && y.version !== f.version) return false;
    if (f.collection && y.collection !== f.collection) return false;
    if (text && !y.text.toLowerCase().includes(text)) return false;
    return true;
  });
};

// Cuántos filtros hay activos (sin contar el buscador de texto principal)
export const countYugiohFilters = (f) => Object.entries(f).reduce((total, [key, value]) => (
  total + (key === 'attributes' ? value.length : String(value).trim() !== '' ? 1 : 0)
), 0);

export const yugiohGroupLabel = (group) => {
  const abbr = String(group.abbreviation || '').trim();
  return abbr && !group.name.includes(abbr) && /^[A-Z0-9]{2,6}$/.test(abbr) ? `${abbr} · ${group.name}` : group.name;
};

