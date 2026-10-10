import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const dateLabel = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
const W = 320;
const H = 140;
const PAD = { left: 6, right: 6, top: 12, bottom: 14 };

// Historial del precio más bajo publicado en Carpetazo, con el precio de referencia como línea de comparación
export default function CardPriceHistory({ cardId, reference }) {
  const [points, setPoints] = useState(null);

  useEffect(() => {
    let active = true;
    setPoints(null);
    api.getCardPriceHistory(cardId).then((response) => { if (active) setPoints(response.points || []); }).catch(() => { if (active) setPoints([]); });
    return () => { active = false; };
  }, [cardId]);

  const chart = useMemo(() => {
    if (!points || points.length < 2) return null;
    const lows = points.map((point) => point.lowest);
    // La línea de referencia solo se dibuja si está cerca de los precios publicados; si no, aplastaría el gráfico
    const showRef = reference > 0 && reference >= Math.min(...lows) / 3 && reference <= Math.max(...lows) * 3;
    const values = lows.concat(showRef ? [reference] : []);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max * 0.1 || 1;
    const lo = min - span * 0.12;
    const hi = max + span * 0.12;
    const t0 = new Date(points[0].day).getTime();
    const t1 = new Date(points[points.length - 1].day).getTime();
    const x = (day) => PAD.left + ((new Date(day).getTime() - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right);
    const y = (value) => PAD.top + (1 - (value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.day).toFixed(1)} ${y(point.lowest).toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    return { line, area: `${line} L${x(last.day).toFixed(1)} ${H - PAD.bottom} L${x(points[0].day).toFixed(1)} ${H - PAD.bottom} Z`, refY: showRef ? y(reference) : null, lastX: x(last.day), lastY: y(last.lowest), min: Math.min(...points.map((point) => point.lowest)), max: Math.max(...points.map((point) => point.lowest)), last };
  }, [points, reference]);

  if (points === null) return null;

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5" aria-labelledby="price-history-title">
      <h2 id="price-history-title" className="text-base font-extrabold text-[#12315f]">Historial de precio</h2>
      {!chart ? (
        <div className="mt-1">
          {points.length === 1 && (
            <div className="mb-2 flex items-end justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500">Precio más bajo hoy · {dateLabel(points[0].day)}</p>
                <p className="text-xl font-black tabular-nums text-[#12315f]">{formatCLP(points[0].lowest)}</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">{points[0].offers} {points[0].offers === 1 ? 'oferta' : 'ofertas'}</p>
            </div>
          )}
          <p className="text-sm text-slate-500">Carpetazo registra el precio de esta carta todos los días. {points.length === 1 ? 'Desde mañana verás aquí cómo cambia.' : 'En cuanto haya al menos dos días registrados, verás aquí cómo cambia.'}</p>
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-slate-500">Precio más bajo publicado en Carpetazo, últimos {Math.max(2, Math.round((new Date(points[points.length - 1].day) - new Date(points[0].day)) / 86400000))} días.</p>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Precio más bajo: de ${formatCLP(points[0].lowest)} a ${formatCLP(chart.last.lowest)}`} className="mt-2 h-auto w-full">
            <defs>
              <linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e40af" stopOpacity="0.22" /><stop offset="1" stopColor="#1e40af" stopOpacity="0" /></linearGradient>
            </defs>
            {chart.refY !== null && <line x1={PAD.left} x2={W - PAD.right} y1={chart.refY} y2={chart.refY} stroke="#eab308" strokeWidth="1.5" strokeDasharray="5 4" />}
            <path d={chart.area} fill="url(#price-area)" />
            <path d={chart.line} fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={chart.lastX} cy={chart.lastY} r="4.5" fill="#facc15" stroke="#12315f" strokeWidth="2" />
          </svg>
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{dateLabel(points[0].day)}</span>
            <span>{dateLabel(chart.last.day)}</span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[11px] font-bold text-slate-500">Mínimo</dt><dd className="text-sm font-black tabular-nums text-[#12315f]">{formatCLP(chart.min)}</dd></div>
            <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[11px] font-bold text-slate-500">Hoy</dt><dd className="text-sm font-black tabular-nums text-[#12315f]">{formatCLP(chart.last.lowest)}</dd></div>
            <div className="rounded-xl bg-slate-50 p-2"><dt className="text-[11px] font-bold text-slate-500">Máximo</dt><dd className="text-sm font-black tabular-nums text-[#12315f]">{formatCLP(chart.max)}</dd></div>
          </dl>
          {chart.refY !== null && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><span aria-hidden="true" className="inline-block h-0 w-5 border-t-2 border-dashed border-[#eab308]" />Línea punteada: precio de referencia ({formatCLP(reference)}).</p>}
        </>
      )}
    </section>
  );
}
