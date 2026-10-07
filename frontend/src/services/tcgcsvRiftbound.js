// Riftbound: League of Legends TCG en TCGCSV (categoría 89): lectura de cada carta y filtros del buscador de "agregar cartas".

export const RIFTBOUND_CATEGORY = 89;
export const RIFTBOUND_MARKER = 'riftbound'; // valor de searchCategory en la carpeta

export const RB_DOMAINS = [
  { value: 'Fury', label: 'Furia' },
  { value: 'Calm', label: 'Calma' },
  { value: 'Body', label: 'Cuerpo' },
  { value: 'Mind', label: 'Mente' },
  { value: 'Order', label: 'Orden' },
  { value: 'Chaos', label: 'Caos' },
];

export const RB_DOMAIN_MODES = [
  { value: 'include', label: 'Contiene' },
  { value: 'exact', label: 'Exacto' },
  { value: 'max', label: 'Solo estos' },
];

export const RB_TYPES = [
  { value: 'Unit', label: 'Unidad' },
  { value: 'Champion Unit', label: 'Unidad campeón' },
  { value: 'Spell', label: 'Hechizo' },
  { value: 'Gear', label: 'Equipo' },
  { value: 'Legend', label: 'Leyenda' },
  { value: 'Battlefield', label: 'Campo de batalla' },
  { value: 'Rune', label: 'Runa' },
  { value: 'Token', label: 'Ficha' },
];

export const RB_RARITIES = [
  { value: 'Common', label: 'Común' },
  { value: 'Uncommon', label: 'Poco común' },
  { value: 'Rare', label: 'Rara' },
  { value: 'Epic', label: 'Épica' },
  { value: 'Showcase', label: 'Showcase' },
  { value: 'Promo', label: 'Promo' },
];

export const RB_VERSIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'alt', label: 'Arte alternativo' },
  { value: 'overnumbered', label: 'Sobrenumerada' },
  { value: 'signature', label: 'Firma (Signature)' },
  { value: 'metal', label: 'Metal' },
  { value: 'prize', label: 'Prize Wall' },
  { value: 'serial', label: 'Numerada' },
  { value: 'oversized', label: 'Sobredimensionada' },
  { value: 'event', label: 'Evento o torneo' },
];

export const RB_COLLECTIONS = [
  { value: 'set', label: 'Sets principales' },
  { value: 'proving', label: 'Proving Grounds' },
  { value: 'promo', label: 'Promos y Organized Play' },
  { value: 'bundle', label: 'Bundles y Worlds' },
  { value: 'judge', label: 'Promos de jueces' },
];

export const RB_ENERGY = Array.from({ length: 13 }, (_, i) => String(i));
export const RB_POWER = Array.from({ length: 6 }, (_, i) => String(i));
export const RB_MIGHT = Array.from({ length: 13 }, (_, i) => String(i));

export const EMPTY_RB_FILTERS = {
  domains: [], domainMode: 'include', type: '', signature: false, rarity: '', energy: '', power: '', might: '',
  tag: '', version: '', collection: '', text: '',
};

const splitList = (value) => String(value || '').split(';').map((part) => part.trim()).filter((part) => part && part !== 'None');
const toNumber = (value) => (/^\d+$/.test(String(value ?? '')) ? Number(value) : null);
const readText = (value) => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// Etiquetas entre paréntesis del nombre: "Ahri, Alluring (Alternate Art)", "Jinx (Overnumbered)"…
const versionOf = (name, number) => {
  const tags = [...String(name || '').matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim()).filter((tag) => tag && !/^R\d+a?$/i.test(tag));
  const has = (test) => tags.some((tag) => test.test(tag));
  if (has(/serial/i)) return 'serial';
  if (has(/oversized/i)) return 'oversized';
  if (has(/metal/i)) return 'metal';
  if (has(/signature/i)) return 'signature';
  if (has(/overnumbered/i)) return 'overnumbered';
  if (has(/prize wall/i)) return 'prize';
  if (has(/alternate art/i)) return 'alt';
  if (has(/top \d+|champion|worlds|best of|bundle|regional|qualifier|vendetta|starter/i)) return 'event';
  // Las artes alternativas terminan el número con una letra (007a/298)
  if (/\d+[a-z]\//i.test(String(number || ''))) return 'alt';
  return 'normal';
};

const collectionOf = (group) => {
  const name = String(group?.name || '');
  if (/judge/i.test(name)) return 'judge';
  if (/bundle|worlds/i.test(name)) return 'bundle';
  if (/promotional|organized play/i.test(name)) return 'promo';
  if (/proving grounds/i.test(name)) return 'proving';
  return 'set';
};

// Datos de la carta que usan los filtros (la carta conserva además los campos originales de TCGCSV)
export const riftboundExt = (ext, group, name) => {
  const rawTypes = splitList(ext['Card Type']);
  const types = new Set();
  rawTypes.forEach((type) => {
    const base = type.replace(/^Signature\s+/, '');
    types.add(base);
    if (base === 'Champion Unit') types.add('Unit');
    if (type.startsWith('Signature')) types.add('Signature');
  });
  return {
    rb: {
      domains: splitList(ext.Domain),
      types: [...types],
      signature: types.has('Signature'),
      energy: toNumber(ext['Energy Cost']),
      power: toNumber(ext['Power Cost']),
      might: toNumber(ext.Might),
      tags: splitList(ext.Tag),
      text: readText(ext.Description),
      version: versionOf(name, ext.Number),
      collection: collectionOf(group),
    },
  };
};

// Texto del buscador: nombre, número o etiqueta
export const riftboundMatchesQuery = (card, q) => !q
  || card.name.toLowerCase().includes(q)
  || String(card.extData?.Number || '').toLowerCase().includes(q)
  || (card.extData?.rb?.tags || []).some((tag) => tag.toLowerCase().includes(q));

export const filterRiftboundCards = (cards, f) => {
  const text = f.text.trim().toLowerCase();
  return cards.filter((card) => {
    const rb = card.extData?.rb;
    if (!rb) return true;
    if (f.domains.length > 0) {
      const have = rb.domains;
      if (f.domainMode === 'include' && !f.domains.every((domain) => have.includes(domain))) return false;
      if (f.domainMode === 'exact' && !(f.domains.length === have.length && f.domains.every((domain) => have.includes(domain)))) return false;
      if (f.domainMode === 'max' && !(have.length > 0 && have.every((domain) => f.domains.includes(domain)))) return false;
    }
    if (f.type && !rb.types.includes(f.type)) return false;
    if (f.signature && !rb.signature) return false;
    if (f.rarity && String(card.extData?.Rarity || '') !== f.rarity) return false;
    if (f.energy !== '' && rb.energy !== Number(f.energy)) return false;
    if (f.power !== '' && rb.power !== Number(f.power)) return false;
    if (f.might !== '' && rb.might !== Number(f.might)) return false;
    if (f.tag && !rb.tags.includes(f.tag)) return false;
    if (f.version && rb.version !== f.version) return false;
    if (f.collection && rb.collection !== f.collection) return false;
    if (text && !rb.text.toLowerCase().includes(text)) return false;
    return true;
  });
};

// Cuántos filtros hay activos (sin contar el buscador de texto principal)
export const countRiftboundFilters = (f) => Object.entries(f).reduce((total, [key, value]) => {
  if (key === 'domainMode') return total;
  if (key === 'domains') return total + value.length;
  if (key === 'signature') return total + (value ? 1 : 0);
  return total + (String(value).trim() !== '' ? 1 : 0);
}, 0);

export const riftboundGroupLabel = (group) => {
  const abbr = String(group.abbreviation || '').trim();
  return abbr && !group.name.includes(abbr) && abbr.length <= 5 && /^[A-Z]{2,5}$/.test(abbr) ? `${abbr} · ${group.name}` : group.name;
};
