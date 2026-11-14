import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import { chileToday } from '../../utils/storeHours';

const STATUS = { pending: 'Por retirar', completed: 'Retirada', expired: 'Vencida', cancelled: 'Cancelada', rejected: 'Rechazada' };
const until = (iso) => new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const isToday = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) === chileToday();
const btn = 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition active:scale-[0.97] disabled:opacity-60';

function PickupRow({ p, role, onChange, showToast }) {
  const [busy, setBusy] = useState(null);
  const run = async (action) => {
    setBusy(action);
    try {
      if (action === 'ready') onChange((await api.markPickupReady(p.id)).pickup);
      if (action === 'done') { await api.completeOrder(p.id); onChange({ ...p, status: 'completed' }); showToast('Retiro confirmado. Stock actualizado.', 'success'); }
      if (action === 'cancel') onChange((await api.cancelPickup(p.id)).pickup);
    } catch (error) {
      showToast(error.message || 'No se pudo completar', 'error');
    } finally { setBusy(null); }
  };
  const open = p.status === 'pending';
  return (
    <li className={`rounded-2xl border bg-white p-3 ${open && isToday(p.pickupBy) ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-[#1a2b4b]">{role === 'store' ? p.buyerName : p.store?.name || p.store?.username} · <span className="font-mono tracking-widest text-[#1e40af]">{p.pickupCode}</span></p>
          <p className="text-sm text-slate-600">{p.items.reduce((n, i) => n + i.quantity, 0)} cartas · {formatCLP(p.total)} · {open ? `retirar hasta ${until(p.pickupBy)}` : STATUS[p.status]}</p>
          <p className="truncate text-xs text-slate-500">{p.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
        </div>
        {open && <span className={`rounded-full px-2.5 py-1 text-xs font-black ${p.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.ready ? 'Lista para retirar' : 'Preparando'}</span>}
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {role === 'store' && !p.ready && <button type="button" disabled={busy} onClick={() => run('ready')} className={`${btn} bg-blue-50 text-[#1e40af] hover:bg-blue-100`}>{busy === 'ready' && <ButtonSpinner />}Avisar que está lista</button>}
          {role === 'store' && <button type="button" disabled={busy} onClick={() => run('done')} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>{busy === 'done' && <ButtonSpinner tone="dark" />}Entregada</button>}
          {role === 'buyer' && p.store?.username && <Link to={`/mensajes?c=${encodeURIComponent(p.store.username)}`} className={`${btn} text-slate-700 ring-1 ring-slate-300 hover:ring-[#1e40af]`}>Escribir</Link>}
          {role === 'buyer' && <button type="button" disabled={busy} onClick={() => run('cancel')} className={`${btn} text-red-700 hover:bg-red-50`}>{busy === 'cancel' && <ButtonSpinner />}Cancelar reserva</button>}
        </div>
      )}
    </li>
  );
}

// role 'store': retiros de la tienda («de hoy» primero) · role 'buyer': mis reservas
export default function PickupsPanel({ role, showToast, hideWhenEmpty = false, title }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (role === 'store' ? api.getStorePickups() : api.getMyPickups()).then((r) => setRows(r.pickups || [])).catch(() => setRows([]));
  }, [role]);
  if (!rows) return hideWhenEmpty ? null : <LoadingState variant="compact" label="Cargando retiros" />;
  if (hideWhenEmpty && !rows.some((p) => p.status === 'pending')) return null;
  const today = rows.filter((p) => p.status === 'pending' && isToday(p.pickupBy));
  const update = (next) => setRows((list) => list.map((x) => (x.id === next.id ? { ...x, ...next } : x)));
  return (
    <div className="space-y-3">
      {title && <h3 className="text-base font-black text-[#1a2b4b]">{title}</h3>}
      {role === 'store' && <p className="text-sm font-bold text-[#12315f]">Retiros que vencen hoy: {today.length}</p>}
      {!rows.length ? <p className="text-sm text-slate-600">Aún no hay reservas. En tus carpetas públicas aparece el botón «Reservar y retirar en tienda» cuando tu local está visible.</p> : (
        <ul className="space-y-2">{rows.map((p) => <PickupRow key={p.id} p={p} role={role} showToast={showToast} onChange={update} />)}</ul>
      )}
    </div>
  );
}
