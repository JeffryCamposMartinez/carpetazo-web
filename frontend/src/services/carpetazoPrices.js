import { apiUrl } from './api';

// Precio referencial de Mitos y Leyendas: mediana de lo que piden los vendedores en Carpetazo (en pesos).
// Devuelve { [tcgId]: { clp, sellers } } solo para las cartas que tienen suficientes vendedores.
export const fetchCarpetazoPrices = async (ids) => {
  const response = await fetch(apiUrl(`/cards/reference-prices?ids=${ids.map(encodeURIComponent).join(',')}`));
  if (!response.ok) throw new Error('No se pudo obtener la referencia');
  return (await response.json()).prices || {};
};
