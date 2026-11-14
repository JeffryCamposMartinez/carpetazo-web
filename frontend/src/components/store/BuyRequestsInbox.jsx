import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import { BUY_STATUS, totalCards } from './sellCollection';

const STATUS_TONE = { pending: 'bg-amber-100 text-amber-800', offered: 'bg-blue-100 text-[#1e40af]', accepted: 'bg-emerald-100 text-emerald-800', rejected: 'bg-slate-100 text-slate-700', cancelled: 'bg-slate-100 text-slate-700' };
const when = (iso) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

function RequestCard({ r, role, onChange, showToast }) {
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState(r.offerClp ?? '');
  const [offerNote, setOfferNote] = useState(r.offerNote || '');
  const [busy, setBusy] = useState(null);
  const other = role === 'store' ? r.seller : r.store;
  const run = async (action, data) => {
    setBusy(action);
    try {
      const res = role === 'store' ? await api.storeBuyAction(r.id, action, data) : await api.myBuyAction(r.id, action);
      onChange(res.request);
    } catch (error) {
      showToast(error.message || 'No se pudo completar', 'error');
    } finally { setBusy(null); }
  };
  const btn = 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition active:scale-[0.97] disabled:opacity-60';
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block font-black text-[#1a2b4b]">{other?.name || other?.username} <span className="font-semibold text-slate-500">@{other?.username}</span></span>
          <span className="block text-sm text-slate-600">{totalCards(r.items)} cartas{r.game ? ` de ${r.game}` : ''} · {when(r.createdAt)}{r.offerClp !== null ? ` · oferta ${formatCLP(r.offerClp)}` : ''}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${STATUS_TONE[r.status]}`}>{BUY_STATUS[r.status]}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <ul className="max-h-56 overflow-y-auto text-sm text-slate-700">
            {r.items.map((i, k) => <li key={k} className="flex justify-between gap-2 py-0.5"><span>{i.name}{i.set ? <span className="text-slate-500"> · {i.set}</span> : ''}{i.condition ? <span className="text-slate-500"> · {i.condition}</span> : ''}</span><span className="tabular-nums font-bold">×{i.quantity}</span></li>)}
          </ul>
          {r.photos?.length > 0 && <div className="flex gap-2 overflow-x-auto">{r.photos.map((p) => <a key={p} href={p} target="_blank" rel="noopener noreferrer"><img src={p} alt="Foto de la colección" className="h-20 w-20 rounded-xl object-cover" /></a>)}</div>}
          {r.note && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-2.5 text-sm text-slate-700">{r.note}</p>}
          {r.offerNote && <p className="whitespace-pre-line rounded-xl bg-blue-50 p-2.5 text-sm text-[#12315f]"><span className="font-black">Nota de la oferta: </span>{r.offerNote}</p>}
          {role === 'store' && ['pending', 'offered'].includes(r.status) && (
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <input type="number" min={0} step={500} inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Oferta $" aria-label="Oferta en pesos" className="h-11 rounded-xl border border-slate-300 px-3 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20" />
              <input type="text" maxLength={1000} value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder="Nota (opcional): forma de pago, cartas que no compras…" className="h-11 rounded-xl border border-slate-300 px-3 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20" />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {other?.username && <Link to={`/mensajes?c=${encodeURIComponent(other.username)}`} className={`${btn} text-slate-700 ring-1 ring-slate-300 hover:ring-[#1e40af]`}>Escribir</Link>}
            {role === 'store' && ['pending', 'offered'].includes(r.status) && <>
              <button type="button" disabled={busy} onClick={() => run('decline')} className={`${btn} text-red-700 hover:bg-red-50`}>{busy === 'decline' && <ButtonSpinner />}No me interesa</button>
              <button type="button" disabled={busy || offer === ''} onClick={() => run('offer', { offerClp: Number(offer), offerNote })} className={`${btn} bg-[#1e40af] text-white hover:bg-[#12315f]`}>{busy === 'offer' && <ButtonSpinner tone="dark" />}{r.status === 'offered' ? 'Cambiar oferta' : 'Enviar oferta'}</button>
            </>}
            {role === 'seller' && r.status === 'offered' && <>
              <button type="button" disabled={busy} onClick={() => run('reject')} className={`${btn} text-red-700 hover:bg-red-50`}>{busy === 'reject' && <ButtonSpinner />}Rechazar</button>
              <button type="button" disabled={busy} onClick={() => run('accept')} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>{busy === 'accept' && <ButtonSpinner tone="dark" />}Aceptar {formatCLP(r.offerClp)}</button>
            </>}
            {role === 'seller' && ['pending', 'offered'].includes(r.status) && <button type="button" disabled={busy} onClick={() => run('cancel')} className={`${btn} text-slate-600 hover:bg-slate-100`}>{busy === 'cancel' && <ButtonSpinner />}Cancelar solicitud</button>}
          </div>
        </div>
      )}
    </li>
  );
}

// role 'store': solicitudes recibidas por la tienda · role 'seller': las que yo envié
export default function BuyRequestsInbox({ role, showToast, hideWhenEmpty = false, title }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (role === 'store' ? api.getStoreBuyRequests() : api.getMyBuyRequests()).then((r) => setRows(r.requests || [])).catch(() => setRows([]));
  }, [role]);
  if (!rows) return hideWhenEmpty ? null : <LoadingState variant="compact" label="Cargando solicitudes" />;
  if (!rows.length && hideWhenEmpty) return null;
  return (
    <div className="space-y-2">
      {title && <h3 className="text-base font-black text-[#1a2b4b]">{title}</h3>}
      {!rows.length ? <p className="text-sm text-slate-600">Aún no te han ofrecido colecciones. Activa «Juegos que compras» en Compra y venta para que aparezca el botón «Vende tu colección» en tu perfil.</p> : (
        <ul className="space-y-2">{rows.map((r) => <RequestCard key={r.id} r={r} role={role} showToast={showToast} onChange={(next) => setRows((list) => list.map((x) => (x.id === next.id ? { ...x, ...next } : x)))} />)}</ul>
      )}
    </div>
  );
}
