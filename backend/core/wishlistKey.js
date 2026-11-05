// Una carta deseada de TCGplayer se guarda como `tcgcsv:<categoría>:<id>`; un acabado distinto del normal (Reverse Holofoil…) suma `~<acabado>`.
export const finishSlug = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);

// Id de la carta y acabado ('' = normal) a partir de lo guardado
export const splitWishKey = (productId) => {
  const [base, finish = ''] = String(productId).split('~');
  return { base, finish };
};

// Acabado con que está publicada una carta de carpeta (`data.finish`; las antiguas son normales)
export const cardFinishSlug = (data) => finishSlug(data && typeof data === 'object' ? data.finish : '');
