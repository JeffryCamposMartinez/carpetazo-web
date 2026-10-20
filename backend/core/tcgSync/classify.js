// ¿Es una carta o un producto sellado? Misma clasificación que TcgplayerUpdate (classify.js, versión 2).
export const CLASSIFIER_VERSION = 2;

const NO_RARITY = /^(none|n\/a|na|-|sealed|code card)$/i;
const RETAIL_ATTRIBUTES = ['UPC', 'GTIN', 'SKU', 'MSRP'];
const CARD_ATTRIBUTES = [
  'OracleText', 'CardText', 'FlavorText', 'Card Type', 'CardType', 'SubType', 'MonsterType', 'HP', 'Stage', 'Attack', 'Defense',
  'Attack 1', 'Attack 2', 'Attack 3', 'Attack 4', 'Weakness', 'Resistance', 'RetreatCost', 'P', 'T', 'Elements', 'PrimaryOrder', 'SecondaryOrder',
];
const STRONG_SEALED = /\b(booster (box|pack|display|case|bundle)|display( case| box)?|box set|starter deck|theme deck|trial deck|challenger series deck|prerelease kit|collector.?s tin|elite trainer box|case)\b/i;
const SEALED_NAME = /\b(booster|display|case|box|bundle|packs?|decks?|tins?|collections?|sets?|kits?|sleeves?|play ?mats?|binders?|portfolio|storage|starter|theme|prerelease|blisters?|troves?|vaults?|carton|lots?|accessor\w*|dice|toolkit|elite trainer|etb|premium)\b/i;
const SEALED_DESCRIPTION = /\b(booster (box|pack|display)|display box|contains? \d+|includes? \d+|is an? (set|box|pack|collection|tin|deck|bundle)|set (containing|that contains|of \d+)|each (pack|box|deck) (contains|includes))\b/i;

export const classifyProduct = (product, attributes) => {
  const text = (name) => (attributes[name] === undefined || attributes[name] === null ? '' : String(attributes[name]).trim());
  const has = (name) => text(name) !== '';
  const name = String(product.name || '');
  if (has('Number')) return { kind: 'card', reason: 'numero' };
  if (STRONG_SEALED.test(name)) return { kind: 'product', reason: 'nombre-de-producto-sellado' };
  if (has('Rarity') && !NO_RARITY.test(text('Rarity'))) return { kind: 'card', reason: 'rareza' };
  if (RETAIL_ATTRIBUTES.some(has)) return { kind: 'product', reason: 'codigo-de-tienda' };
  if (SEALED_NAME.test(name)) return { kind: 'product', reason: 'nombre-de-producto' };
  if (CARD_ATTRIBUTES.some(has)) return { kind: 'card', reason: 'atributo-de-carta' };
  if (has('Description')) return SEALED_DESCRIPTION.test(text('Description')) ? { kind: 'product', reason: 'descripcion-de-producto' } : { kind: 'card', reason: 'descripcion-de-carta' };
  return { kind: 'card', reason: 'por-descarte' };
};
