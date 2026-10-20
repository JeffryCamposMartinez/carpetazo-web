// Rareza de una carta como número (mayor = más rara), para poder ordenar por rareza.
// Pokémon, Lorcana, Digimon (nombres en inglés) y Mitos y Leyendas (de la más común a la más rara).
const POKEMON = {
  Common: 1, Uncommon: 2, Rare: 3, 'Rare Holo': 4, 'Rare Holo EX': 5, 'Rare Holo GX': 6,
  'Rare Holo V': 7, 'Rare Holo VMAX': 8, 'Rare Ultra': 9, 'Rare Secret': 10, Promo: 11,
  // Lorcana, Digimon y otros juegos con nombres en inglés
  Quest: 3, 'Super Rare': 4, Epic: 5, Legendary: 5, 'Ultra Rare': 5, Iconic: 6, 'Secret Rare': 6, 'Special Rare': 6, 'Ultimate Rare': 7, Enchanted: 7,
};
const MITOS_Y_LEYENDAS = { VASALLO: 1, CORTESANO: 2, REAL: 3, ULTRA_REAL: 4, MEGA_REAL: 5, LEGENDARIA: 6, SECRETA: 7, PROMOCIONAL: 8 };

export const rarityRank = (rarity) => POKEMON[rarity] || MITOS_Y_LEYENDAS[String(rarity || '').trim().toUpperCase().replace(/\s+/g, '_')] || 0;
