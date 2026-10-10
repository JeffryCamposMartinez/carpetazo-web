// Precio de referencia de una carta: la mediana en Carpetazo (Mitos y Leyendas) o el precio de mercado más bajo de TCGplayer entre sus acabados
export const referencePrice = (reference, ranges) => {
  if (reference?.clp > 0) return reference.clp;
  const markets = (ranges || []).map((range) => range.market).filter((value) => value > 0);
  return markets.length ? Math.min(...markets) : null;
};
