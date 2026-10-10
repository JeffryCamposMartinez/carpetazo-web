// ¿Es justo el precio? Compara lo que pide un vendedor con el precio de referencia (en pesos).
// Es solo una guía: el estado de la carta, el idioma o el acabado cambian el valor real.
export const priceVerdict = (price, reference) => {
  const value = Number(price);
  const ref = Number(reference);
  if (!(value > 0) || !(ref > 0)) return null;
  if (value < ref * 0.1 || value > ref * 20) return null; // una referencia tan lejana casi seguro está mal: mejor no opinar
  const diff = Math.round((value / ref - 1) * 100);
  const sign = diff > 0 ? '+' : '';
  const detail = Math.abs(diff) < 3 ? 'igual al mercado' : `${sign}${diff}% vs. mercado`;
  if (value <= ref * 0.85) return { key: 'low', label: 'Buen precio', detail, tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200', icon: 'trending_down' };
  if (value <= ref * 1.15) return { key: 'fair', label: 'Precio justo', detail, tone: 'bg-blue-100 text-[#1e40af] ring-blue-200', icon: 'balance' };
  if (value <= ref * 1.5) return { key: 'high', label: 'Algo sobre el mercado', detail, tone: 'bg-amber-100 text-amber-800 ring-amber-200', icon: 'trending_up' };
  return { key: 'veryHigh', label: 'Muy sobre el mercado', detail, tone: 'bg-red-100 text-red-800 ring-red-200', icon: 'priority_high' };
};

// Precio de referencia de una carta: la mediana en Carpetazo (Mitos y Leyendas) o el precio de mercado más bajo de TCGplayer entre sus acabados
export const referencePrice = (reference, ranges) => {
  if (reference?.clp > 0) return reference.clp;
  const markets = (ranges || []).map((range) => range.market).filter((value) => value > 0);
  return markets.length ? Math.min(...markets) : null;
};
