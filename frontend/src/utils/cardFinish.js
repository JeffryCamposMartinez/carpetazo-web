// Acabado de una carta de carpeta ('' = normal): viene en `data.finish`, o suelto cuando la carta ya trae `data` mezclado
export const finishOfCard = (card) => (typeof card?.finish === 'string' && card.finish) || (typeof card?.data?.finish === 'string' ? card.data.finish : '');

// Carta deseada con acabado distinto del normal (Reverse Holofoil…): el id guardado lleva `~acabado` y el nombre del acabado cierra el detalle
export const wishlistFinishOf = (item) => (item?.productId?.includes('~') ? String(item.detail || '').split(' · ').pop() : '');

// Imagen de TCGplayer a partir del id guardado: es la misma para todos los acabados (sirve para las cartas agregadas sin imagen)
export const wishlistImageFallback = (item) => {
  const id = item?.productId?.match(/^tcgcsv:\d+:(\d+)/)?.[1];
  return id ? `https://tcgplayer-cdn.tcgplayer.com/product/${id}_400w.jpg` : '';
};
