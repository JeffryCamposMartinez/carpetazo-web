import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const parseDay = (day) => new Date(`${day}T12:00:00`).getTime();
const formatDate = (day, year = false) => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }).format(new Date(`${day}T12:00:00`));
const RANGES = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1A', days: 365 }];
const W = 640;
const H = 170;
const PAD = { left: 68, right: 16, top: 14, bottom: 30 };

export default function CatalogPriceHistory({ productId, cardId }) {
  const chartId = cardId || productId;
  const [data, setData] = useState(null);
  const [range, setRange] = useState(30);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let mounted = true;
    setData(null);
    setActive(null);
    const request = cardId ? api.getCardPriceHistory(cardId) : api.getCatalogCardPriceHistory(productId);
    request
      .then((response) => { if (mounted) setData({ points: (response.points || []).map((point) => ({ ...point, price: point.price ?? point.lowest })), sales: response.sales || [] }); })
      .catch(() => { if (mounted) setData({ points: [], sales: [] }); });
    return () => { mounted = false; };
  }, [productId, cardId]);

  const chart = useMemo(() => {
    if (!data) return null;
    const end = new Date();
    const start = new Date(end.getTime() - range * 86400000);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    const events = [
      ...data.points.map((point) => ({ ...point, source: 'publicado', label: 'Precio más bajo publicado en Carpetazo' })),
      ...data.sales.map((sale) => ({ ...sale, source: sale.source || 'confirmada', label: sale.source === 'presencial' ? 'Venta presencial registrada por el vendedor' : 'Venta confirmada en Carpetazo' })),
    ].filter((event) => event.day >= from && event.day <= to && Number(event.price) > 0)
      .sort((a, b) => parseDay(a.day) - parseDay(b.day));
    if (!events.length) return { events, from, to, min: null, max: null, latest: null, change: null };

    const min = Math.min(...events.map((event) => Number(event.price)));
    const max = Math.max(...events.map((event) => Number(event.price)));
    const spread = Math.max(max - min, max * 0.15, 100);
    const low = Math.max(0, min - spread * 0.18);
    const high = max + spread * 0.18;
    const t0 = parseDay(from);
    const t1 = parseDay(to);
    const x = (day) => PAD.left + ((parseDay(day) - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (price) => PAD.top + (1 - (Number(price) - low) / Math.max(1, high - low)) * (H - PAD.top - PAD.bottom);
    const path = events.map((event, index) => `${index ? 'L' : 'M'}${x(event.day).toFixed(1)} ${y(event.price).toFixed(1)}`).join(' ');
    const first = Number(events[0].price);
    const latest = events[events.length - 1];
    const change = first > 0 ? ((Number(latest.price) - first) / first) * 100 : null;
    return { events, from, to, min, max, latest, change, x, y, path, low, high };
  }, [data, range]);

  if (!data) return (
    <section className="rounded-2xl bg-white p-3 ring-1 ring-slate-900/5" aria-label="Historial de precios">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="mt-3 h-40 animate-pulse rounded-xl bg-slate-50" />
    </section>
  );

  const tooltip = active === null ? null : chart.events[active];
  const tooltipEvent = tooltip ? { ...tooltip, x: chart.x(tooltip.day), y: chart.y(tooltip.price) } : null;
  const tooltipLeft = tooltipEvent ? Math.min(75, Math.max(10, (tooltipEvent.x / W) * 100)) : 0;
  const tooltipTop = tooltipEvent ? Math.max(8, (tooltipEvent.y / H) * 100 - 35) : 0;

  return (
    <section className="rounded-2xl bg-white p-3 ring-1 ring-slate-900/5" aria-labelledby="catalog-price-history-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="catalog-price-history-title" className="text-sm font-extrabold text-[#12315f]">Historial de precios</h2>
          <p className="text-[11px] text-slate-500">Solo precios y ventas registrados en Carpetazo</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Período del historial">
          {RANGES.map((option) => (
            <button key={option.days} type="button" onClick={() => { setRange(option.days); setActive(null); }} aria-pressed={range === option.days}
              className={`min-w-9 px-2 py-1 text-[11px] font-bold transition-colors ${range === option.days ? 'bg-[#1e40af] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {chart.events.length === 0 ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-6 text-center">
          <p className="text-xs font-bold text-[#12315f]">Aún no hay historial para este período</p>
          <p className="mt-1 text-xs text-slate-500">Cuando haya publicaciones o ventas registradas en Carpetazo, aparecerán aquí.</p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-slate-500">Último registro en Carpetazo</p>
              <p className="text-xl font-black tabular-nums text-[#12315f]">{formatCLP(chart.latest.price)}</p>
            </div>
            {chart.change !== null && (
              <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold tabular-nums ${chart.change > 0 ? 'bg-rose-50 text-rose-700' : chart.change < 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {chart.change > 0 ? '▲' : chart.change < 0 ? '▼' : '●'} {Math.abs(chart.change).toFixed(1)}% en el período
              </span>
            )}
          </div>

          <div className="relative mt-1">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Historial de precios en Carpetazo desde ${formatDate(chart.from, true)} hasta ${formatDate(chart.to, true)}`} className="h-auto w-full touch-pan-y overflow-visible">
              <defs><linearGradient id={`catalog-price-fill-${chartId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e40af" stopOpacity="0.19" /><stop offset="1" stopColor="#1e40af" stopOpacity="0.01" /></linearGradient></defs>
              {[0, 1, 2, 3].map((step) => {
                const price = chart.high - ((chart.high - chart.low) * step) / 3;
                const y = PAD.top + ((H - PAD.top - PAD.bottom) * step) / 3;
                return <g key={step}><line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e8edf5" strokeWidth="1" /><text x={PAD.left - 7} y={y + 3} textAnchor="end" fill="#8190a8" fontSize="10">{formatCLP(price)}</text></g>;
              })}
              {chart.events.length > 1 && <path d={`${chart.path} L${chart.x(chart.events[chart.events.length - 1].day)} ${H - PAD.bottom} L${chart.x(chart.events[0].day)} ${H - PAD.bottom} Z`} fill={`url(#catalog-price-fill-${chartId})`} />}
              {chart.events.length > 1 && <path d={chart.path} fill="none" stroke="#1e40af" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
              {chart.events.map((event, index) => {
                const sold = event.source !== 'publicado';
                const selected = active === index;
                return <circle key={`${event.day}-${event.source}-${index}`} cx={chart.x(event.day)} cy={chart.y(event.price)} r={selected ? 7 : sold ? 5 : 4}
                  fill={sold ? '#16a34a' : '#1e40af'} stroke="#fff" strokeWidth="2" tabIndex="0" role="button"
                  aria-label={`${event.label}: ${formatCLP(event.price)}${event.quantity ? `, ${event.quantity} unidades` : ''}, ${formatDate(event.day, true)}`}
                  onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} />;
              })}
            </svg>
            {tooltipEvent && (
              <div className="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl" style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}>
                <p className="font-extrabold text-[#12315f]">{formatDate(tooltip.day, true)}</p>
                <p className="mt-1 text-slate-600">{tooltip.label}</p>
                <p className="mt-1 font-bold text-[#12315f]">{formatCLP(tooltip.price)}{tooltip.quantity ? ` · ${tooltip.quantity} ${tooltip.quantity === 1 ? 'unidad' : 'unidades'}` : ''}</p>
                {tooltip.source === 'presencial' && <p className="mt-1 text-[10px] text-slate-500">Precio publicado por unidad; el total del lote puede haber tenido ajuste.</p>}
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] font-semibold text-slate-500"><span>{formatDate(chart.from)}</span><span>{formatDate(chart.to)}</span></div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-600">
            <li className="flex items-center gap-1.5"><span className="inline-block h-1 w-5 rounded-full bg-[#1e40af]" />Precios registrados en Carpetazo</li>
            {chart.events.some((event) => event.source !== 'publicado') && <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Ventas en Carpetazo</li>}
          </ul>
          <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-slate-50 p-1.5"><dt className="text-[10px] font-bold text-slate-500">Mínimo</dt><dd className="text-xs font-black tabular-nums text-[#12315f]">{formatCLP(chart.min)}</dd></div>
            <div className="rounded-lg bg-slate-50 p-1.5"><dt className="text-[10px] font-bold text-slate-500">Último</dt><dd className="text-xs font-black tabular-nums text-[#12315f]">{formatCLP(chart.latest.price)}</dd></div>
            <div className="rounded-lg bg-slate-50 p-1.5"><dt className="text-[10px] font-bold text-slate-500">Máximo</dt><dd className="text-xs font-black tabular-nums text-[#12315f]">{formatCLP(chart.max)}</dd></div>
          </dl>
        </>
      )}
    </section>
  );
}
