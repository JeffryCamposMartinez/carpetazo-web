export const TCG_CONFIG = {
  Pokemon: {
    categoryId: '3',
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
    categoryId: '1',
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
    categoryId: '62',
    defaultLanguage: 'English',
    inventoryFilters: ['edition'],
    addFilters: ['edition', 'rarity', 'sealed'],
  },
};

export const getTcgConfig = (tcg) => TCG_CONFIG[tcg] || TCG_CONFIG.Pokemon;
