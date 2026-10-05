import { apiUrl } from './api';

// Búsqueda de cartas Pokémon en TCGCSV (inglés = categoría 3, japonés = 85), con los mismos criterios
// que usa la búsqueda de "agregar cartas" de las carpetas.

const TYPE_ES = {
  grass: 'Planta', fire: 'Fuego', water: 'Agua', lightning: 'Rayo', psychic: 'Psíquico', fighting: 'Lucha',
  darkness: 'Oscura', dark: 'Oscura', metal: 'Metálica', fairy: 'Hada', dragon: 'Dragón', colorless: 'Incolora',
};

// Clasifica una carta (Card Type) en la categoría y los tipos que usan los filtros
export const classifyTcgcsvCard = (name, ext) => {
  const cardType = String(ext['Card Type'] || ext.CardType || '');
  const types = [...new Set((cardType.match(/[A-Za-z]+/g) || []).map((w) => TYPE_ES[w.toLowerCase()]).filter(Boolean))];
  let category;
  if (/energy|^special$/i.test(cardType)) category = 'Energía';
  else if (/trainer|supporter|item|stadium|tool|machine/i.test(cardType)) category = 'Entrenador';
  else if (cardType || ext.HP || ext.Stage) category = 'Pokémon';
  else if (/\bEnergy\b/i.test(name)) category = 'Energía';
  const nameTypes = category === 'Energía' && types.length === 0
    ? [...new Set((name.match(/[A-Za-z]+/g) || []).map((w) => TYPE_ES[w.toLowerCase()]).filter(Boolean))]
    : types;
  return { category, types: nameTypes };
};

export const pokemonCategoryForLang = (lang) => (lang === 'ja' ? 85 : 3);

const groupsCache = new Map();
const productsCache = new Map();

// Ediciones ya publicadas, de la más nueva a la más vieja. Igual que en las carpetas: se omiten las que solo tienen
// sellado y las que TCGCSV fecha el mismo día de importación (promos y varios) van al final por nombre.
export const fetchPokemonGroups = async (lang, signal) => {
  const catId = pokemonCategoryForLang(lang);
  if (groupsCache.has(catId)) return groupsCache.get(catId);
  const [json, emptyGroups] = await Promise.all([
    fetch(apiUrl(`/tcgcsv/tcgplayer/${catId}/groups`), { signal }).then((r) => r.json()),
    fetch('/empty-groups-tcgcsv.json', { signal }).then((r) => r.json()).catch(() => ({})),
  ]);
  const results = json.results || [];
  const perDay = {};
  results.forEach((g) => { const day = g.publishedOn.slice(0, 10); perDay[day] = (perDay[day] || 0) + 1; });
  const undated = (g) => perDay[g.publishedOn.slice(0, 10)] >= 8;
  const groups = results
    .filter((g) => new Date(g.publishedOn) <= new Date())
    .filter((g) => emptyGroups[catId]?.[g.groupId] !== g.modifiedOn)
    .sort((a, b) => (undated(a) - undated(b)) || (undated(a) ? a.name.localeCompare(b.name) : new Date(b.publishedOn) - new Date(a.publishedOn)))
    .map((g) => ({ groupId: g.groupId, id: g.groupId, name: g.name, publishedOn: g.publishedOn }));
  groupsCache.set(catId, groups);
  return groups;
};

// Cartas de una edición (solo las que tienen número)
export const fetchPokemonGroupCards = async (lang, group, signal) => {
  const catId = pokemonCategoryForLang(lang);
  const key = `${catId}-${group.groupId}`;
  if (productsCache.has(key)) return productsCache.get(key);
  const json = await (await fetch(apiUrl(`/tcgcsv/tcgplayer/${catId}/${group.groupId}/products`), { signal })).json();
  const list = (json.results || [])
    .map((product) => {
      const ext = {};
      (product.extendedData || []).forEach((entry) => { ext[entry.name] = entry.value; });
      return { product, ext };
    })
    .filter(({ ext }) => ext.Number)
    .map(({ product, ext }) => ({
      productId: String(product.productId),
      catId,
      name: product.name,
      number: ext.Number,
      imageUrl: (product.imageUrl || '').replace('_200w', '_400w'),
      setName: group.name,
      language: catId === 85 ? 'Japonés' : 'Inglés',
      ...classifyTcgcsvCard(product.name, ext),
    }));
  productsCache.set(key, list);
  return list;
};

const ENERGY_TYPE_ES = { Psychic: 'Psíquic', Metal: 'Metálic' };
const TYPE_LABEL = {
  Grass: 'Planta', Fire: 'Fuego', Water: 'Agua', Lightning: 'Rayo', Psychic: 'Psíquico', Fighting: 'Lucha',
  Darkness: 'Oscura', Metal: 'Metálica', Fairy: 'Hada', Dragon: 'Dragón', Colorless: 'Incolora',
};
const CATEGORY_BY_SUPERTYPE = { 'Pokémon': 'Pokémon', Trainer: 'Entrenador', Energy: 'Energía' };

// Nombre o número, categoría (Pokémon / Entrenador / Energía) y tipo
export const filterPokemonCards = (cards, { query = '', supertype = '', type = '' }) => {
  let list = cards;
  const q = query.trim().toLowerCase();
  if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || String(c.number).toLowerCase().includes(q));
  if (supertype) list = list.filter((c) => c.category === CATEGORY_BY_SUPERTYPE[supertype]);
  if (type) {
    const target = TYPE_LABEL[type] || type;
    const targetEnergy = ENERGY_TYPE_ES[type] ? TYPE_LABEL[type].slice(0, -1) : target;
    list = list.filter((c) => (c.types?.length ? c.types.includes(target) : c.category === 'Energía' && c.name.includes(targetEnergy)));
  }
  return list;
};
