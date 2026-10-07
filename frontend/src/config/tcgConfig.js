export const TCG_CONFIG = {
  Pokemon: {
    categoryId: '1',
    defaultLanguage: 'English',
    inventoryFilters: ['edition'],
    addFilters: ['edition', 'rarity', 'sealed'],
  },
  YuGiOh: {
    categoryId: '2',
    defaultLanguage: 'English',
    inventoryFilters: ['edition'],
    addFilters: ['edition', 'rarity', 'sealed'],
  },
  Magic: {
    categoryId: 'magic', // se busca directo en TCGCSV (categoría 1), con datos de Scryfall
    defaultLanguage: 'English',
    inventoryFilters: ['edition'],
    addFilters: ['edition', 'rarity', 'sealed'],
  },
  'Mitos y Leyendas': {
    categoryId: '99',
    defaultLanguage: 'Spanish',
    inventoryFilters: ['edition'],
    addFilters: ['block', 'product', 'edition', 'type', 'race', 'cost'],
  },
  OnePiece: {
    categoryId: '68', // categoría de TCGCSV: One Piece se busca directo en TCGCSV, como Pokémon
    defaultLanguage: 'English',
    inventoryFilters: ['edition'],
    addFilters: ['edition', 'rarity', 'sealed'],
  },
  Riftbound: {
    categoryId: 'riftbound', // se busca directo en TCGCSV (categoría 89)
    defaultLanguage: 'English',
    inventoryFilters: ['edition'],
    addFilters: ['edition', 'rarity'],
  },
};

export const getTcgConfig = (tcg) => TCG_CONFIG[tcg] || TCG_CONFIG.Pokemon;

