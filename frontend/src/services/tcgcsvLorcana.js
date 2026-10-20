// Disney Lorcana en TCGCSV (categoría 71): lectura de cada carta y filtros del buscador de "agregar cartas".

export const LORCANA_CATEGORY = 71;
export const LORCANA_MARKER = 'lorcana'; // valor de searchCategory en la carpeta

export const LC_INKS = [
  { value: 'Amber', label: 'Ámbar', color: '#f5b82e' },
  { value: 'Amethyst', label: 'Amatista', color: '#8b4fc9' },
  { value: 'Emerald', label: 'Esmeralda', color: '#27a05a' },
  { value: 'Ruby', label: 'Rubí', color: '#d6313f' },
  { value: 'Sapphire', label: 'Zafiro', color: '#2f7fd6' },
  { value: 'Steel', label: 'Acero', color: '#8d99a6' },
];

export const LC_INK_MODES = [
  { value: 'include', label: 'Contiene' },
  { value: 'exact', label: 'Exacto' },
  { value: 'max', label: 'Solo estas' },
];

export const LC_TYPES = [
  { value: 'Character', label: 'Personaje' },
  { value: 'Action', label: 'Acción' },
  { value: 'Song', label: 'Canción' },
  { value: 'Item', label: 'Objeto' },
  { value: 'Location', label: 'Lugar' },
];

export const LC_RARITIES = [
  { value: 'Common', label: 'Común' },
  { value: 'Uncommon', label: 'Poco común' },
  { value: 'Rare', label: 'Rara' },
  { value: 'Super Rare', label: 'Súper rara' },
  { value: 'Legendary', label: 'Legendaria' },
  { value: 'Epic', label: 'Épica' },
  { value: 'Iconic', label: 'Icónica' },
  { value: 'Enchanted', label: 'Encantada (Enchanted)' },
  { value: 'Quest', label: 'Quest' },
  { value: 'Promo', label: 'Promo' },
];

export const LC_INKWELL = [
  { value: 'yes', label: 'Con tintero' },
  { value: 'no', label: 'Sin tintero' },
];

export const LC_VERSIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'foil', label: 'Foil' },
  { value: 'enchanted', label: 'Encantada (Enchanted)' },
  { value: 'promo', label: 'Promo o evento' },
];

export const LC_COLLECTIONS = [
  { value: 'set', label: 'Sets principales' },
  { value: 'quest', label: "Illumineer's Quest" },
  { value: 'promo', label: 'Promos y eventos' },
];

export const LC_COSTS = Array.from({ length: 11 }, (_, i) => String(i));
export const LC_STATS = [...Array.from({ length: 10 }, (_, i) => String(i)), '10+'];
export const LC_WILLPOWER = [...Array.from({ length: 9 }, (_, i) => String(i + 1)), '10+'];
export const LC_LORE = ['1', '2', '3', '4', '5'];

export const EMPTY_LC_FILTERS = {
  inks: [], inkMode: 'include', type: '', rarity: '', cost: '', strength: '', willpower: '', lore: '', inkwell: '',
  classification: '', franchise: '', version: '', collection: '', text: '',
};

const splitList = (value) => String(value || '').split(';').map((part) => part.trim()).filter(Boolean);
const toNumber = (value) => (/^\d+$/.test(String(value ?? '').trim()) ? Number(value) : null);
const readText = (value) => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const versionOf = (name, ext) => {
  const tags = [...String(name || '').matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim());
  if (ext.Rarity === 'Enchanted' || tags.some((tag) => /enchanted/i.test(tag))) return 'enchanted';
  if (tags.some((tag) => /foil/i.test(tag))) return 'foil';
  if (ext.PromoType || ext.Rarity === 'Promo') return 'promo';
  return 'normal';
};

const collectionOf = (group) => {
  const name = String(group?.name || '');
  const abbr = String(group?.abbreviation || '');
  if (/illumineer'?s quest/i.test(name) || /^Q\d/i.test(abbr)) return 'quest';
  if (/promo/i.test(name) || /^(D23|D100|DLPC)/i.test(abbr)) return 'promo';
  return 'set';
};

// Datos de la carta que usan los filtros (la carta conserva además los campos originales de TCGCSV)
export const lorcanaExt = (ext, group, name) => {
  const classes = splitList(ext.Classification);
  const types = [ext.CardType].filter(Boolean);
  if (classes.includes('Song')) types.push('Song');
  const inkwell = String(ext.InkwellIcononCard || '').toLowerCase();
  return {
    lc: {
      inks: splitList(ext.InkType),
      types,
      classes,
      franchise: String(ext.Property || '').trim(),
      cost: toNumber(ext['Cost Ink']),
      strength: toNumber(ext.Strength),
      willpower: toNumber(ext.Willpower),
      lore: toNumber(ext['Lore Value']),
      inkwell: inkwell === 'yes' ? true : inkwell === 'no' ? false : null,
      text: readText(ext.Description),
      version: versionOf(name, ext),
      collection: collectionOf(group),
    },
  };
};

// Texto del buscador: nombre, número, versión del personaje o clasificación
export const lorcanaMatchesQuery = (card, q) => !q
  || card.name.toLowerCase().includes(q)
  || String(card.extData?.Number || '').toLowerCase().includes(q)
  || (card.extData?.lc?.classes || []).some((item) => item.toLowerCase().includes(q));

const statMatches = (wanted, value) => {
  if (wanted === '') return true;
  if (value === null) return false;
  return wanted === '10+' ? value >= 10 : value === Number(wanted);
};

export const filterLorcanaCards = (cards, f) => {
  const text = f.text.trim().toLowerCase();
  return cards.filter((card) => {
    const lc = card.extData?.lc;
    if (!lc) return true;
    if (f.inks.length > 0) {
      const have = lc.inks;
      if (f.inkMode === 'include' && !f.inks.every((ink) => have.includes(ink))) return false;
      if (f.inkMode === 'exact' && !(f.inks.length === have.length && f.inks.every((ink) => have.includes(ink)))) return false;
      if (f.inkMode === 'max' && !(have.length > 0 && have.every((ink) => f.inks.includes(ink)))) return false;
    }
    if (f.type && !lc.types.includes(f.type)) return false;
    if (f.rarity && String(card.extData?.Rarity || '') !== f.rarity) return false;
    if (f.cost !== '' && lc.cost !== Number(f.cost)) return false;
    if (!statMatches(f.strength, lc.strength)) return false;
    if (!statMatches(f.willpower, lc.willpower)) return false;
    if (f.lore !== '' && lc.lore !== Number(f.lore)) return false;
    if (f.inkwell === 'yes' && lc.inkwell !== true) return false;
    if (f.inkwell === 'no' && lc.inkwell !== false) return false;
    if (f.classification && !lc.classes.includes(f.classification)) return false;
    if (f.franchise && lc.franchise !== f.franchise) return false;
    if (f.version && lc.version !== f.version) return false;
    if (f.collection && lc.collection !== f.collection) return false;
    if (text && !lc.text.toLowerCase().includes(text)) return false;
    return true;
  });
};

// Cuántos filtros hay activos (sin contar el buscador de texto principal)
export const countLorcanaFilters = (f) => Object.entries(f).reduce((total, [key, value]) => {
  if (key === 'inkMode') return total;
  if (key === 'inks') return total + value.length;
  return total + (String(value).trim() !== '' ? 1 : 0);
}, 0);

export const lorcanaGroupLabel = (group) => {
  const abbr = String(group.abbreviation || '').trim();
  return abbr && !group.name.includes(abbr) && /^[A-Z0-9]{1,5}$/.test(abbr) ? `${abbr} · ${group.name}` : group.name;
};
