// Digimon Card Game en TCGCSV (categoría 63): lectura de cada carta y filtros del buscador de "agregar cartas".

export const DIGIMON_CATEGORY = 63;
export const DIGIMON_MARKER = 'digimon'; // valor de searchCategory en la carpeta

export const DG_COLORS = [
  { value: 'Red', label: 'Rojo', color: '#e0383e' },
  { value: 'Blue', label: 'Azul', color: '#2f86e6' },
  { value: 'Yellow', label: 'Amarillo', color: '#f2c61f' },
  { value: 'Green', label: 'Verde', color: '#2fa84f' },
  { value: 'Black', label: 'Negro', color: '#2b2b33' },
  { value: 'Purple', label: 'Morado', color: '#8a49c8' },
  { value: 'White', label: 'Blanco', color: '#f3f4f6' },
];

export const DG_COLOR_MODES = [
  { value: 'include', label: 'Contiene' },
  { value: 'exact', label: 'Exacto' },
  { value: 'max', label: 'Solo estos' },
];

export const DG_TYPES = [
  { value: 'Digimon', label: 'Digimon' },
  { value: 'Tamer', label: 'Domador (Tamer)' },
  { value: 'Option', label: 'Opción' },
  { value: 'Digi-Egg', label: 'Digi-Huevo' },
];

export const DG_RARITIES = [
  { value: 'Common', label: 'Común' },
  { value: 'Uncommon', label: 'Poco común' },
  { value: 'Rare', label: 'Rara' },
  { value: 'Super Rare', label: 'Súper rara' },
  { value: 'Secret Rare', label: 'Secreta' },
  { value: 'Special Rare', label: 'Especial' },
  { value: 'Ultimate Rare', label: 'Última rara' },
  { value: 'Promo', label: 'Promo' },
];

export const DG_FORMS = [
  { value: 'In-Training', label: 'En entrenamiento' },
  { value: 'Rookie', label: 'Novato (Rookie)' },
  { value: 'Champion', label: 'Campeón' },
  { value: 'Ultimate', label: 'Definitivo (Ultimate)' },
  { value: 'Mega', label: 'Mega' },
  { value: 'Armor Form', label: 'Armadura' },
  { value: 'Hybrid', label: 'Híbrido' },
  { value: 'Appmon', label: 'Appmon' },
  { value: 'D-Reaper', label: 'D-Reaper' },
];

export const DG_ATTRIBUTES = [
  { value: 'Vaccine', label: 'Vacuna' },
  { value: 'Data', label: 'Dato' },
  { value: 'Virus', label: 'Virus' },
  { value: 'Free', label: 'Libre' },
  { value: 'Variable', label: 'Variable' },
  { value: 'Unknown', label: 'Desconocido' },
];

export const DG_VERSIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'alt', label: 'Arte alternativo' },
  { value: 'foil', label: 'Foil, textura o borde dorado' },
  { value: 'boxtopper', label: 'Box Topper' },
  { value: 'reprint', label: 'Reimpresión' },
  { value: 'event', label: 'Evento o torneo' },
];

export const DG_COLLECTIONS = [
  { value: 'booster', label: 'Boosters y Extra Boosters' },
  { value: 'starter', label: 'Starter Decks' },
  { value: 'prerelease', label: 'Pre-Release y Release Event' },
  { value: 'promo', label: 'Promos, torneos y packs' },
];

export const DG_LEVELS = ['2', '3', '4', '5', '6', '7'];
export const DG_COSTS = [...Array.from({ length: 18 }, (_, i) => String(i)), '20']; // no hay cartas de coste 18 ni 19
export const DG_DP = Array.from({ length: 17 }, (_, i) => String((i + 1) * 1000));

export const EMPTY_DG_FILTERS = {
  colors: [], colorMode: 'include', type: '', rarity: '', level: '', cost: '', dp: '', form: '', attribute: '',
  trait: '', version: '', collection: '', text: '',
};

const splitSlash = (value) => String(value || '').split('/').map((part) => part.trim()).filter((part) => part && part !== '-' && part !== '—');
const splitSemi = (value) => String(value || '').split(';').map((part) => part.trim()).filter(Boolean);
const toNumber = (value) => (/^\d+$/.test(String(value ?? '').trim()) ? Number(value) : null);
const readText = (value) => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const versionOf = (name) => {
  const tags = [...String(name || '').matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim());
  const has = (test) => tags.some((tag) => test.test(tag));
  if (has(/box topper/i)) return 'boxtopper';
  if (has(/regional|championship|tournament|participant|finalist|champion\b|top \d|store|event pack|fest|nycc|anniversary|demo deck|welcome tamers|party pack|entry pack|limited card pack|english exclusive|set\b/i)) return 'event';
  if (has(/alternate art|rare pull/i)) return 'alt';
  if (has(/foil|textured|gold border|\bsp\b/i)) return 'foil';
  if (has(/reprint/i)) return 'reprint';
  return 'normal';
};

const collectionOf = (group) => {
  const name = String(group?.name || '');
  if (/pre-?release|release event/i.test(name)) return 'prerelease';
  if (/starter deck|advanced deck|premium deck/i.test(name)) return 'starter';
  if (/promo|tournament|pack|demo|limited|revision|special|set$|anniversary|collection/i.test(name) && !/booster/i.test(name)) return 'promo';
  return 'booster';
};

// Datos de la carta que usan los filtros (la carta conserva además los campos originales de TCGCSV)
export const digimonExt = (ext, group, name) => ({
  dg: {
    colors: splitSemi(ext.Color),
    types: splitSlash(ext.CardType),
    level: toNumber(ext.LevelLv),
    cost: toNumber(ext.PlayCost),
    dp: toNumber(ext.DigimonPowerDP),
    form: String(ext.DigimonForm || '').trim(),
    attribute: String(ext.DigimonAttribute || '').trim(),
    traits: splitSlash(ext.DigimonType),
    text: readText(`${ext.Description || ''} ${ext['Inherited Effect'] || ''} ${ext['Security Effect'] || ''}`),
    version: versionOf(name),
    collection: collectionOf(group),
  },
});

// Texto del buscador: nombre, código (BT1-001) o tipo de Digimon
export const digimonMatchesQuery = (card, q) => !q
  || card.name.toLowerCase().includes(q)
  || String(card.extData?.Number || '').toLowerCase().includes(q)
  || (card.extData?.dg?.traits || []).some((trait) => trait.toLowerCase().includes(q));

export const filterDigimonCards = (cards, f) => {
  const text = f.text.trim().toLowerCase();
  return cards.filter((card) => {
    const dg = card.extData?.dg;
    if (!dg) return true;
    if (f.colors.length > 0) {
      const have = dg.colors;
      if (f.colorMode === 'include' && !f.colors.every((color) => have.includes(color))) return false;
      if (f.colorMode === 'exact' && !(f.colors.length === have.length && f.colors.every((color) => have.includes(color)))) return false;
      if (f.colorMode === 'max' && !(have.length > 0 && have.every((color) => f.colors.includes(color)))) return false;
    }
    if (f.type && !dg.types.includes(f.type)) return false;
    if (f.rarity && String(card.extData?.Rarity || '') !== f.rarity) return false;
    if (f.level !== '' && dg.level !== Number(f.level)) return false;
    if (f.cost !== '' && dg.cost !== Number(f.cost)) return false;
    if (f.dp !== '' && dg.dp !== Number(f.dp)) return false;
    if (f.form && !dg.form.split('/').includes(f.form) && dg.form !== f.form) return false;
    if (f.attribute && dg.attribute !== f.attribute) return false;
    if (f.trait && !dg.traits.includes(f.trait)) return false;
    if (f.version && dg.version !== f.version) return false;
    if (f.collection && dg.collection !== f.collection) return false;
    if (text && !dg.text.toLowerCase().includes(text)) return false;
    return true;
  });
};

// Cuántos filtros hay activos (sin contar el buscador de texto principal)
export const countDigimonFilters = (f) => Object.entries(f).reduce((total, [key, value]) => {
  if (key === 'colorMode') return total;
  if (key === 'colors') return total + value.length;
  return total + (String(value).trim() !== '' ? 1 : 0);
}, 0);

export const digimonGroupLabel = (group) => {
  const abbr = String(group.abbreviation || '').trim();
  return abbr && !group.name.includes(abbr) && /^[A-Z0-9_-]{2,8}$/i.test(abbr) && !/_/.test(abbr) ? `${abbr} · ${group.name}` : group.name;
};
