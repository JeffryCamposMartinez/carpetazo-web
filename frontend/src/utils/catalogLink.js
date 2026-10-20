// Dirección de la ficha de una carta del catálogo de TCGplayer: /catalogo/<id>/<nombre> (el mismo nombre que arma el servidor)
export const catalogSlug = (name) => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'carta';

// null si la carta no viene del catálogo de TCGplayer (por ejemplo, Mitos y Leyendas tiene su propio catálogo)
export const catalogLink = (card) => {
  const id = String(card?.tcgProductId || card?.productId || '');
  return /^[1-9]\d{0,9}$/.test(id) ? `/catalogo/${id}/${catalogSlug(card?.name)}` : null;
};
