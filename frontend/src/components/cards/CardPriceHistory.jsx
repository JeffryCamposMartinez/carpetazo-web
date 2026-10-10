import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const dateLabel = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
const DAY_MS = 86400000;
const W = 320;
const H = 150;
const PAD = { left: 8, right: 8, top: 14, bottom: 14 };
const EMPTY = { points: [], market: [], sales: [] };

// Historial real de la carta: precio más bajo publicado en Carpetazo, precio de mercado de TCGplayer (Pokémon) y ventas completadas en Carpetazo
export default function CardPriceHistory({ cardId, reference }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    api.getCardPriceHistory(cardId).then((response) => { if (active) setData({ points: response.points || [], market: response.market || [], sales: response.sales || [] }); }).catch(() => { if (active) setData(EMPTY); });
    return () => { active = false; };
  }, [cardId]);

  const chart = useMemo(() => {
    if (!data) return null;
    const { points, market, sales } = data;
    const days = new Set([...points, ...market, ...sales].map((item) => item.day));
    if (days.size < 2) return null;
    const own = points.map((point) => point.lowest).concat(sales.map((sale) => sale.price));
    // Una serie de mercado muy lejana a los precios publicados aplastaría el gráfico: solo se dibuja si está en un rango razonable
    const marketOk = market.length > 0 && (own.length === 0 || (Math.min(...market.map((item) => item.clp)) >= Math.min(...own) / 4 && Math.max(...market.map((item) => item.clp)) <= Math.max(...own) * 4));
    const refOk = !marketOk && reference > 0 && own.length > 0 && reference >= Math.min(...own) / 3 && reference <= Math.max(...own) * 3;
    const values = own.concat(marketOk ? market.map((item) => item.clp) : []).concat(refOk ? [reference] : []);
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max * 0.1 || 1;
    const lo = min - span * 0.14;
    const hi = max + span * 0.14;
    const times = [...days].map((day) => new Date(day).getTime());
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const x = (day) => PAD.left + ((new Date(day).getTime() - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right);
    const y = (value) => PAD.top + (1 - (value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const path = (list, key) => list.map((item, index) => `${index ? 'L' : 'M'}${x(item.day).toFixed(1)} ${y(item[key]).toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    return {
      own: points.length >= 2 ? path(points, 'lowest') : null,
      area: points.length >= 2 ? `${path(points, 'lowest')} L${x(last.day).toFixed(1)} ${H - PAD.bottom} L${x(points[0].day).toFixed(1)} ${H - PAD.bottom} Z` : null,
      ownDots: points.length === 1 ? points : [],
      market: marketOk && market.length >= 2 ? path(market, 'clp') : null,
      marketDots: marketOk && market.length === 1 ? market : [],
      refY: refOk ? y(reference) : null,
      refShown: refOk,
      marketShown: marketOk,
      salesDots: sales.map((sale) => ({ ...sale, cx: x(sale.day), cy: y(sale.price) })),
      last, lastX: last ? x(last.day) : null, lastY: last ? y(last.lowest) : null,
      min: points.length ? Math.min(...points.map((point) => point.lowest)) : null,
      max: points.length ? Math.max(...points.map((point) => point.lowest)) : null,
      from: new Date(t0).toISOString().slice(0, 10), to: new Date(t1).toISOString().slice(0, 10),
      span: Math.max(2, Math.round((t1 - t0) / DAY_MS)),
      x, y,
    };
  }, [data, reference]);

  if (data === null) return null;
  const { points, market, sales } = data;
  const today = points[points.length - 1];

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5" aria-labelledby="price-history-title">
      <h2 id="price-history-title" className="text-base font-extrabold text-[#12315f]">Historial de precio</h2>
      {!chart ? (
        <div className="mt-1">
          {today && (
            <div className="mb-2 flex items-end justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500">Precio más bajo hoy · {dateLabel(today.day)}</p>
                <p className="text-xl font-black tabular-nums text-[#12315f]">{formatCLP(today.lowest)}</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">{today.offers} {today.offers === 1 ? 'oferta' : 'ofertas'}</p>
            </div>
          )}
          <p className="text-sm text-slate-500">Carpetazo registra el precio de esta carta todos los días. {today ? 'Desde mañana verás aquí cómo cambia.' : 'En cuanto haya al menos dos días registrados, verás aquí cómo cambia.'}</p>
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-slate-500">Últimos {chart.span} días · {dateLabel(chart.from)} al {dateLabel(chart.to)}</p>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico del historial de precio de la carta" className="mt-2 h-auto w-full">
            <defs>
              <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e40af" stopOpacity="0.2" /><stop offset="1" stopColor="#1e40af" stopOpacity="0" /></linearGradient>
            </defs>
            {chart.refY !== null && <line x1={PAD.left} x2={W - PAD.right} y1={chart.refY} y2={chart.refY} stroke="#eab308" strokeWidth="1.5" strokeDasharray="5 4" />}
            {chart.area && <path d={chart.area} fill="url(#price-area)" />}
            {chart.market && <path d={chart.market} fill="none" stroke="#eab308" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}
            {chart.marketDots.map((item) => <circle key={`m-${item.day}`} cx={chart.x(item.day)} cy={chart.y(item.clp)} r="3.5" fill="#eab308" />)}
            {chart.own && <path d={chart.own} fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
            {chart.ownDots.map((item) => <circle key={`o-${item.day}`} cx={chart.x(item.day)} cy={chart.y(item.lowest)} r="4" fill="#1e40af" />)}
            {chart.salesDots.map((sale, index) => (
              <g key={`s-${index}`}><title>{`Venta: ${sale.quantity} × ${formatCLP(sale.price)} · ${dateLabel(sale.day)}`}</title><circle cx={sale.cx} cy={sale.cy} r="5" fill="#16a34a" stroke="#ffffff" strokeWidth="2" /></g>
            ))}
            {chart.last && chart.own && <circle cx={chart.lastX} cy={chart.lastY} r="4.5" fill="#facc15" stroke="#12315f" strokeWidth="2" />}
          </svg>
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{dateLabel(chart.from)}</span>
            <span>{dateLabel(chart.to)}</span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
            {points.length > 0 && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-1 w-5 rounded-full bg-[#1e40af]" />Más barato en Carpetazo</li>}
            {chart.marketShown && market.length > 0 && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-1 w-5 rounded-full bg-[#eab308]" />Mercado (TCGplayer)</li>}
            {chart.refShown && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-0 w-5 border-t-2 border-dashed border-[#eab308]" />Referencia {formatCLP(reference)}</li>}
            {sales.length > 0 && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Ventas en Carpetazo</li>}
          </ul>
          {chart.min !== null && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[11px] font-bold text-slate-500">Mínimo</dt><dd className="text-sm font-black tabular-nums text-[#12315f]">{formatCLP(chart.min)}</dd></div>
              <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[11px] font-bold text-slate-500">Hoy</dt><dd className="text-sm font-black tabular-nums text-[#12315f]">{formatCLP(chart.last.lowest)}</dd></div>
              <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[11px] font-bold text-slate-500">Máximo</dt><dd className="text-sm font-black tabular-nums text-[#12315f]">{formatCLP(chart.max)}</dd></div>
            </dl>
          )}
        </>
      )}
    </section>
  );
}
