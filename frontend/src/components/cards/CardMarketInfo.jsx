import { formatClp } from '../../services/tcgcsvPrices';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
const BOX = 'rounded-2xl bg-white p-4 ring-1 ring-slate-900/5';

// Referencia de TCGplayer (mínimo, mercado y máximo por acabado), en pesos
export function TcgplayerRange({ status, ranges }) {
  if (status === 'idle') return null;
  if (status === 'loading') return <div className={BOX}><p className="text-sm text-slate-500">Buscando precio de referencia…</p></div>;
  if (!ranges.length) return null;
  const cell = (value) => (value ? formatClp(value) : '—');
  return (
    <section className={BOX} aria-labelledby="tcgplayer-title">
      <h2 id="tcgplayer-title" className="text-base font-extrabold text-[#12315f]">Precio de referencia</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[17rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-slate-500">
              <th className="py-1 pr-2 font-bold">Acabado</th>
              <th className="px-2 py-1 text-right font-bold">Mín.</th>
              <th className="px-2 py-1 text-right font-bold">Mercado</th>
              <th className="py-1 pl-2 text-right font-bold">Máx.</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {ranges.map((range) => (
              <tr key={range.name} className="border-t border-slate-100">
                <td className="py-2 pr-2 font-semibold text-slate-700">{range.name}</td>
                <td className="px-2 py-2 text-right text-slate-500">{cell(range.low)}</td>
                <td className="px-2 py-2 text-right font-black text-[#12315f]">{cell(range.market)}</td>
                <td className="py-2 pl-2 text-right text-slate-500">{cell(range.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Según <strong className="font-extrabold text-[#1e40af]">TCGplayer</strong>, en pesos. Es solo una guía.</p>
    </section>
  );
}

// Copias a la venta y vendedores
export function CardAvailability({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={BOX}>
        <p className="text-xs font-bold text-slate-500">Copias disponibles</p>
        <p className="mt-0.5 text-2xl font-black tabular-nums text-[#12315f]">{stats.copies > 9999 ? '9999+' : stats.copies}</p>
      </div>
      <div className={BOX}>
        <p className="text-xs font-bold text-slate-500">{stats.sellers === 1 ? 'Vendedor' : 'Vendedores'}</p>
        <p className="mt-0.5 text-2xl font-black tabular-nums text-[#12315f]">{stats.sellers}</p>
      </div>
    </div>
  );
}

// Últimas ventas de esta carta en Carpetazo (solo fecha, cantidad y precio)
export function RecentSales({ sales }) {
  return (
    <section className={BOX} aria-labelledby="sales-title">
      <h2 id="sales-title" className="text-base font-extrabold text-[#12315f]">Últimas ventas</h2>
      {sales.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">Todavía no hay ventas registradas de esta carta.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {sales.map((sale, index) => (
            <li key={`${sale.at}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-slate-600">{new Date(sale.at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              <span className="font-bold tabular-nums text-[#12315f]">{sale.quantity}x <span className="ml-1">{formatCLP(sale.price)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
