// Rareza de una carta como número (mayor = más rara), para poder ordenar por rareza.
// Pokémon (nombres en inglés) y Mitos y Leyendas (de la más común a la más rara).
const POKEMON = {
  Common: 1, Uncommon: 2, Rare: 3, 'Rare Holo': 4, 'Rare Holo EX': 5, 'Rare Holo GX': 6,
  'Rare Holo V': 7, 'Rare Holo VMAX': 8, 'Rare Ultra': 9, 'Rare Secret': 10, Promo: 11,
};
const MITOS_Y_LEYENDAS = { VASALLO: 1, CORTESANO: 2, REAL: 3, ULTRA_REAL: 4, MEGA_REAL: 5, LEGENDARIA: 6, SECRETA: 7, PROMOCIONAL: 8 };

export const rarityRank = (rarity) => POKEMON[rarity] || MITOS_Y_LEYENDAS[String(rarity || '').trim().toUpperCase().replace(/\s+/g, '_')] || 0;
