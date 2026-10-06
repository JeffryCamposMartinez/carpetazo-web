// Datos que se muestran bajo la carta ampliada de una lista de deseos
const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;

export const describeWishlistItem = (item) => ({
  subtitle: [item.game || item.tcg, item.detail].filter(Boolean).join(' · '),
  chips: [
    item.quantity > 1 ? `Busca ${item.quantity} copias` : 'Busca 1 copia',
    ...(item.maxPrice != null ? [`Paga hasta ${formatCLP(item.maxPrice)}`] : []),
  ],
  note: item.note || '',
});
