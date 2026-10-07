// One Piece Card Game en TCGCSV (categoría 68): lectura de cada carta y filtros del buscador de "agregar cartas".

export const ONE_PIECE_CATEGORY = 68;

export const OP_COLORS = [
  { value: 'Red', label: 'Rojo', hex: '#dc2626' },
  { value: 'Green', label: 'Verde', hex: '#16a34a' },
  { value: 'Blue', label: 'Azul', hex: '#2563eb' },
  { value: 'Purple', label: 'Morado', hex: '#7c3aed' },
  { value: 'Black', label: 'Negro', hex: '#27272a' },
  { value: 'Yellow', label: 'Amarillo', hex: '#facc15' },
];

export const OP_CARD_TYPES = [
  { value: '', label: 'Todo', short: 'Todo' },
  { value: 'Leader', label: 'Líder', short: 'Líder' },
  { value: 'Character', label: 'Personaje', short: 'Person.' },
  { value: 'Event', label: 'Evento', short: 'Evento' },
  { value: 'Stage', label: 'Escenario', short: 'Escen.' },
];

export const OP_RARITIES = [
  { value: 'L', label: 'L · Líder' },
  { value: 'C', label: 'C · Común' },
  { value: 'UC', label: 'UC · Poco común' },
  { value: 'R', label: 'R · Rara' },
  { value: 'SR', label: 'SR · Súper rara' },
  { value: 'SEC', label: 'SEC · Secreta' },
  { value: 'TR', label: 'TR · Tesoro' },
  { value: 'PR', label: 'PR · Promocional' },
];

export const OP_ATTRIBUTES = [
  { value: 'Slash', label: 'Corte' },
  { value: 'Strike', label: 'Golpe' },
  { value: 'Ranged', label: 'A distancia' },
  { value: 'Special', label: 'Especial' },
  { value: 'Wisdom', label: 'Sabiduría' },
];

export const OP_COUNTERS = [
  { value: 'none', label: 'Sin contador' },
  { value: '1000', label: '+1000' },
  { value: '2000', label: '+2000' },
];

export const OP_VARIANTS = [
  { value: 'normal', label: 'Normal' },
  { value: 'alt', label: 'Arte alternativo' },
  { value: 'manga', label: 'Manga' },
  { value: 'sp', label: 'SP' },
  { value: 'full', label: 'Arte completo' },
  { value: 'foil', label: 'Foil especial' },
  { value: 'promo', label: 'Promo o evento' },
  { value: 'reprint', label: 'Reimpresión' },
];

export const OP_COLLECTIONS = [
  { value: 'booster', label: 'Boosters (OP)' },
  { value: 'extra', label: 'Extra Boosters (EB)' },
  { value: 'premium', label: 'Premium Boosters (PRB)' },
  { value: 'starter', label: 'Starter Decks (ST)' },
  { value: 'promo', label: 'Promos y eventos' },
  { value: 'other', label: 'Otros mazos y packs' },
];

export const OP_COSTS = Array.from({ length: 11 }, (_, i) => String(i));
export const OP_LIFES = ['2', '3', '4', '5', '6'];
export const OP_POWERS = Array.from({ length: 14 }, (_, i) => String(i * 1000));

export const EMPTY_OP_FILTERS = {
  colors: [], multicolor: false, cardType: '', rarity: '', cost: '', power: '', counter: '',
  attribute: '', family: '', variant: '', collection: '', life: '',
};

const splitList = (value) => String(value || '').split(';').map((part) => part.trim()).filter(Boolean);
const toNumber = (value) => (value === undefined || value === null || value === '' || Number.isNaN(Number(value)) ? null : Number(value));

// Primera etiqueta que importa del nombre: "Nami (Alternate Art)", "Zoro (SP) (Reprint)"…
const variantOf = (name) => {
  const tags = [...String(name || '').matchAll(/\(([^)]*)\)/g)]
    .map((match) => match[1].trim())
    .filter((tag) => tag && !/^\d+$/.test(tag) && !/^[A-Z]{1,4}-?\d{1,2}-\d{2,3}$/.test(tag));
  if (tags.length === 0) return 'normal';
  const has = (test) => tags.some((tag) => test.test(tag));
  if (has(/manga/i)) return 'manga';
  if (has(/^SP\b/)) return 'sp';
  if (has(/full art/i)) return 'full';
  if (has(/alternate art|parallel/i)) return 'alt';
  if (has(/foil/i)) return 'foil';
  if (has(/^reprint$/i)) return 'reprint';
  return 'promo';
};

// Línea de producto de la edición, según su abreviatura (OP08, EB-02, PRB-01, ST-14…)
const collectionOf = (group) => {
  const abbr = String(group?.abbreviation || '');
  const name = String(group?.name || '');
  if (/^OP-PR/i.test(abbr) || /\b(RE|PRE|ANN)\b/.test(abbr) || /release event|pre-release|tournament|promotion/i.test(name)) return 'promo';
  if (/^OP\d/i.test(abbr)) return 'booster';
  if (/^EB/i.test(abbr)) return 'extra';
  if (/^PRB/i.test(abbr)) return 'premium';
  if (/^ST-?\d/i.test(abbr)) return 'starter';
  return 'other';
};

// Datos de la carta que usan los filtros (la carta conserva además los campos originales de TCGCSV)
export const onePieceExt = (ext, group, name) => {
  const counter = toNumber(ext.Counterplus);
  const variant = variantOf(name);
  return {
    op: {
      colors: splitList(ext.Color),
      cardType: String(ext.CardType || ''),
      cost: toNumber(ext.Cost),
      power: toNumber(ext.Power),
      counter: counter && counter >= 1000 ? counter : 0,
      life: toNumber(ext.Life),
      attributes: splitList(ext.Attribute),
      families: splitList(ext.Subtypes),
      variant,
      variantRank: OP_VARIANTS.findIndex((item) => item.value === variant),
      collection: collectionOf(group),
    },
  };
};

// Texto del buscador: nombre, código (OP08-001) o familia
export const onePieceMatchesQuery = (card, q) => !q
  || card.name.toLowerCase().includes(q)
  || String(card.extData?.Number || '').toLowerCase().includes(q)
  || (card.extData?.op?.families || []).some((family) => family.toLowerCase().includes(q));

export const filterOnePieceCards = (cards, filters) => cards.filter((card) => {
  const op = card.extData?.op;
  if (!op) return true;
  if (filters.colors.length > 0 && !op.colors.some((color) => filters.colors.includes(color))) return false;
  if (filters.multicolor && op.colors.length < 2) return false;
  if (filters.cardType && op.cardType !== filters.cardType) return false;
  if (filters.rarity && String(card.extData?.Rarity || '') !== filters.rarity) return false;
  if (filters.cost !== '' && op.cost !== Number(filters.cost)) return false;
  if (filters.power !== '' && op.power !== Number(filters.power)) return false;
  if (filters.counter) {
    if (filters.counter === 'none' ? op.counter !== 0 : op.counter !== Number(filters.counter)) return false;
  }
  if (filters.attribute && !op.attributes.includes(filters.attribute)) return false;
  if (filters.family && !op.families.includes(filters.family)) return false;
  if (filters.variant && op.variant !== filters.variant) return false;
  if (filters.collection && op.collection !== filters.collection) return false;
  if (filters.life !== '' && op.life !== Number(filters.life)) return false;
  return true;
});

// Cuántos filtros hay activos (sin contar el buscador de texto)
export const countOnePieceFilters = (filters) => Object.entries(filters)
  .reduce((total, [key, value]) => total + (key === 'colors' ? value.length : value && value !== '' ? 1 : 0), 0);

// "OP08 · Two Legends": la edición con su código para reconocerla rápido
export const onePieceGroupLabel = (group) => {
  const abbr = String(group.abbreviation || '').trim();
  return abbr && !group.name.includes(abbr) ? `${abbr} · ${group.name}` : group.name;
};
