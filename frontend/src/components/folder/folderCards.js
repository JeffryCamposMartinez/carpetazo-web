// Utilidades de las cartas de una carpeta: orden del catálogo, páginas del álbum y datos de la carta.

export const CATALOG_CARDS_PER_PAGE = 9;

export const getCatalogOrderValue = (card, fallbackIndex = 0) => {
  const value = Number(card?.catalogOrder);
  return Number.isFinite(value) ? value : fallbackIndex + 100000;
};

export const sortCatalogCards = (cardArray = []) => (
  [...cardArray].sort((a, b) => {
    const orderDiff = getCatalogOrderValue(a) - getCatalogOrderValue(b);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  })
);

export const chunkCardsByPage = (cardArray = []) => {
  const pages = [];
  for (let i = 0; i < cardArray.length; i += CATALOG_CARDS_PER_PAGE) {
    pages.push(cardArray.slice(i, i + CATALOG_CARDS_PER_PAGE));
  }
  return pages;
};

export const getPreviewReorderedCards = (cardArray = [], dragCardId, targetIndex) => {
  if (!dragCardId || targetIndex === null || targetIndex === undefined) return cardArray;
  const fromIndex = cardArray.findIndex(card => card.id === dragCardId);
  if (fromIndex < 0) return cardArray;

  const nextCards = [...cardArray];
  const [movedCard] = nextCards.splice(fromIndex, 1);
  const dropIndex = Math.min(Math.max(Number(targetIndex), 0), nextCards.length);
  nextCards.splice(dropIndex, 0, movedCard);
  return nextCards;
};

export const normalizeTcgProductId = (value) => (value === undefined || value === null ? '' : String(value));

// Nombre + numeración (xxx/xxx); no duplica el número si el nombre ya lo trae
export const cardLabel = (card) => {
  const num = card?.extData?.Number;
  const name = card?.name || '';
  return num && !name.includes(num) ? `${name} - ${num}` : name;
};

export const getExtDataValue = (extData, fieldName) => {
  if (Array.isArray(extData)) {
    return extData.find(item => String(item?.name || '').toLowerCase() === fieldName.toLowerCase())?.value || '';
  }
  if (extData && typeof extData === 'object') {
    return extData[fieldName] || extData[fieldName.toLowerCase()] || '';
  }
  return '';
};

// Información que se ve en cada carta del inventario (botón del ojo): se pasa de uno a otro en este orden
export const DETAIL_MODES = {
  basic: { icon: 'sell', label: 'Solo precio y stock', next: 'full' },
  full: { icon: 'visibility', label: 'Toda la información', next: 'none' },
  none: { icon: 'visibility_off', label: 'Sin información', next: 'basic' },
};
