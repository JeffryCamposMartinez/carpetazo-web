// Datos para agregar una carta vendida (de una carpeta) a la lista de deseadas.
// Pokémon no está en la base propia: se envía como TCGCSV (inglés 3, japonés 85). Mitos y Leyendas va por su id de catálogo.
export const wishlistPayloadFromCard = (card, tcg) => {
  const isPokemon = /pok[eé]mon/i.test(tcg || '');
  const id = card.tcgId !== undefined && card.tcgId !== null ? String(card.tcgId) : '';
  const set = typeof card.set === 'string' ? card.set : card.set?.name;
  const detail = [set, card.language].filter(Boolean).join(' · ').slice(0, 100);
  return {
    name: card.name,
    imageUrl: card.imageUrl || undefined,
    game: tcg || undefined,
    detail: detail || undefined,
    ...(id && isPokemon ? { external: { categoryId: /jap/i.test(card.language || '') ? 85 : 3, productId: id } } : {}),
    ...(id && !isPokemon ? { productId: id } : {}),
  };
};
