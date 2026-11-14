import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import LiquidTabs from '../ui/LiquidTabs';
import LoadingState from '../ui/LoadingState';

const RANGES = [{ value: 1, label: 'Hoy' }, { value: 7, label: '7 días' }, { value: 30, label: '30 días' }];
const METHODS = { cash: 'Efectivo', transfer: 'Transferencia', debit: 'Débito', credit: 'Crédito', unspecified: 'Sin medio', orders: 'Pedidos en línea' };
const dayLabel = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// Cierre de caja: totales del período por medio de pago y detalle por día
export default function StoreCashPanel() {
  const [days, setDays] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    api.getStoreCash(days).then((r) => { if (alive) setData(r); }).catch(() => { if (alive) setData({ error: true }); });
    return () => { alive = false; };
  }, [days]);

  return (
    <div className="space-y-4">
      <LiquidTabs ariaLabel="Período de la caja" layout="inline" options={RANGES} value={days} onChange={setDays}
        className="inline-flex rounded-2xl bg-white p-1 ring-1 ring-slate-200" buttonClassName="h-9 rounded-xl px-4 text-sm font-bold" indicatorClassName="rounded-xl bg-[#1e40af]" indicatorStyle={{ top: 4, bottom: 4 }}
        activeTextClassName="text-white" inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]" />
      {!data ? <LoadingState variant="compact" label="Sumando la caja" /> : data.error ? <p className="text-sm text-slate-600">No se pudo cargar la caja.</p> : (
        <>
          <div className="rounded-2xl bg-[#12315f] p-4 text-white">
            <p className="text-sm text-blue-100">{days === 1 ? 'Ventas de hoy' : `Ventas de los últimos ${days} días`} · {data.totals.count} {data.totals.count === 1 ? 'venta' : 'ventas'}</p>
            <p className="text-3xl font-black tabular-nums text-[#facc15]">{formatCLP(data.totals.total)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {Object.entries(METHODS).filter(([m]) => data.totals.byMethod[m]).map(([m, label]) => (
                <div key={m} className="flex justify-between gap-2"><dt className="text-blue-100">{label}</dt><dd className="font-bold tabular-nums">{formatCLP(data.totals.byMethod[m])}</dd></div>
              ))}
            </dl>
          </div>
          {days > 1 && (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {data.days.map((d) => (
                <li key={d.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-bold text-[#1a2b4b]">{dayLabel(d.date)}</span>
                  <span className="truncate text-xs text-slate-500">{Object.entries(METHODS).filter(([m]) => d.byMethod[m]).map(([m, l]) => `${l} ${formatCLP(d.byMethod[m])}`).join(' · ') || 'Sin ventas'}</span>
                  <span className="shrink-0 font-black tabular-nums text-[#12315f]">{formatCLP(d.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">Incluye las ventas en persona (con su medio de pago) y los pedidos que confirmaste. Las ventas en persona se registran desde cada carpeta, en «Venta presencial».</p>
        </>
      )}
    </div>
  );
}
