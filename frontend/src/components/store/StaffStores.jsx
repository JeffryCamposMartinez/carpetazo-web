import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import LiquidTabs from '../ui/LiquidTabs';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';
import InPersonSale from '../folder/tabs/InPersonSale';
import PickupsPanel from './PickupsPanel';
import { CARD_CONDITIONS } from '../../config/cardConditions';
import { permissionsText } from './StoreTeamPanel';

const CARD = 'rounded-3xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.45)] ring-1 ring-slate-900/5';
const EASE_OUT = [0.23, 1, 0.32, 1];

function StockRow({ card, storeId, showToast, onSaved, canFolders, onRemoved }) {
  const [stock, setStock] = useState(String(card.stock));
  const [price, setPrice] = useState(card.price == null ? '' : String(card.price));
  const [condition, setCondition] = useState(card.condition == null ? '' : String(card.condition));
  const [busy, setBusy] = useState(false);
  const dirty = Number(stock) !== card.stock || (price === '' ? null : Number(price)) !== (card.price ?? null) || (canFolders && condition !== (card.condition == null ? '' : String(card.condition)));
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.updateStaffCard(storeId, card.id, { stock: Number(stock), price: price === '' ? null : Number(price), ...(canFolders ? { condition: condition === '' ? null : Number(condition) } : {}) });
      onSaved(r.card);
    } catch (error) { showToast(error.message || 'No se pudo guardar', 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.deleteStaffCard(storeId, card.id); onRemoved(card.id); } catch (error) { showToast(error.message || 'No se pudo quitar', 'error'); setBusy(false); }
  };
  const input = 'h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-center text-[15px] font-bold tabular-nums text-[#12315f] focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';
  return (
    <li className="flex gap-3 px-3 py-3">
      {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" className="h-[74px] w-[53px] shrink-0 rounded-md object-cover shadow-sm" /> : <span className="h-[74px] w-[53px] shrink-0 rounded-md bg-slate-100" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#1a2b4b]">{card.name}</p>
        {card.data?.set && <p className="truncate text-xs text-slate-500">{card.data.set}</p>}
        <div className="mt-2 flex items-end gap-2">
          <label className="w-16"><span className="mb-0.5 block text-[11px] font-bold text-slate-500">Cantidad</span><input type="number" inputMode="numeric" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className={`${input} w-full`} /></label>
          <label className="min-w-0 flex-1"><span className="mb-0.5 block text-[11px] font-bold text-slate-500">Precio $</span><input type="number" inputMode="numeric" min={0} step={100} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Sin precio" className={`${input} w-full`} /></label>
          <button type="button" disabled={!dirty || busy || stock === ''} onClick={save} aria-label={`Guardar ${card.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1e40af] text-white transition hover:bg-[#12315f] active:scale-[0.94] disabled:bg-slate-100 disabled:text-slate-400">{busy ? <ButtonSpinner tone="dark" /> : <SvgIcon name="check" className="text-lg" />}</button>
        </div>
        {canFolders && (
          <div className="mt-2 flex items-center gap-2">
            <select value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Estado de la carta" className={`${input} min-w-0 flex-1 text-left text-sm`}>
              <option value="">Sin estado</option>
              {CARD_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Quitar «${card.name}» de la carpeta?`)) remove(); }} className="h-10 shrink-0 rounded-full px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 active:scale-[0.97] disabled:opacity-50">Quitar</button>
          </div>
        )}
      </div>
    </li>
  );
}

// Lo que ve un empleado al trabajar en una tienda: caja (retiros y venta en persona) o stock (cantidades y precios)
function Workspace({ job, showToast }) {
  const [folders, setFolders] = useState(null);
  const [folderId, setFolderId] = useState('');
  const can = (p) => job.permissions.includes(p);
  const views = [
    ...(can('pickups') ? [{ value: 'retiros', label: 'Retiros' }] : []),
    ...(can('sales') ? [{ value: 'venta', label: 'Venta en persona' }] : []),
    ...(can('stock') || can('folders') ? [{ value: 'stock', label: can('folders') ? 'Carpetas' : 'Stock' }] : [])
  ];
  const [view, setView] = useState(views[0]?.value || 'stock');
  const [query, setQuery] = useState('');
  useEffect(() => {
    api.getStaffFolders(job.storeId).then((r) => { setFolders(r.folders || []); setFolderId(r.folders?.[0]?.id || ''); }).catch(() => setFolders([]));
  }, [job.storeId]);
  const folder = folders?.find((f) => f.id === folderId);
  const setCards = (update) => setFolders((list) => list.map((f) => (f.id === folderId ? { ...f, cards: typeof update === 'function' ? update(f.cards) : update } : f)));
  const shown = useMemo(() => (folder?.cards || []).filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 200), [folder, query]);

  if (!folders) return <LoadingState variant="compact" label="Abriendo la tienda" />;
  return (
    <div className="space-y-3 pt-3">
      {views.length > 1 && <LiquidTabs ariaLabel="Tareas" layout="inline" options={views} value={view} onChange={setView} className="flex rounded-[14px] bg-slate-900/[0.06] p-[3px]" buttonClassName="h-9 flex-1 rounded-[11px] text-sm font-bold" indicatorClassName="rounded-[11px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12)]" indicatorStyle={{ top: 3, bottom: 3 }} activeTextClassName="text-[#12315f]" inactiveTextClassName="text-slate-600" />}
      {view !== 'retiros' && folders.length > 0 && <ThemedSelect value={folderId} onChange={setFolderId} options={folders.map((f) => ({ value: f.id, label: f.name }))} ariaLabel="Carpeta" icon="folder" buttonClassName="!min-h-11 !rounded-xl" />}
      {view === 'retiros' && <PickupsPanel role="store" storeId={job.storeId} showToast={showToast} />}
      {view === 'venta' && folder && <InPersonSale key={folder.id} folderId={folder.id} cards={folder.cards} setCards={setCards} showToast={showToast} />}
      {view === 'stock' && folder && (
        <>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar carta" aria-label="Buscar carta" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20" />
          <ul className={`${CARD} divide-y divide-slate-100 overflow-hidden`}>
            {shown.map((c) => <StockRow key={c.id} card={c} storeId={job.storeId} showToast={showToast} canFolders={can('folders')} onRemoved={(id) => { setCards((cards) => cards.filter((x) => x.id !== id)); showToast('Carta quitada', 'success'); }} onSaved={(next) => { setCards((cards) => cards.map((x) => (x.id === next.id ? { ...x, ...next } : x))); showToast(`Guardado: ${next.stock} u. a ${next.price ? formatCLP(next.price) : 'sin precio'}`, 'success'); }} />)}
            {!shown.length && <li className="p-4 text-sm text-slate-500">No hay cartas que coincidan.</li>}
          </ul>
        </>
      )}
      {view !== 'retiros' && folders.length === 0 && <p className="text-sm text-slate-600">La tienda todavía no tiene carpetas.</p>}
    </div>
  );
}

// Tiendas donde trabajo: invitaciones por aceptar y acceso a cada tienda según mi rol
export default function StaffStores({ showToast }) {
  const [jobs, setJobs] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { api.getStaffStores().then((r) => setJobs(r.stores || [])).catch(() => setJobs([])); }, []);
  if (!jobs?.length) return null;

  const act = async (job, accept) => {
    setBusy(job.id);
    try {
      if (accept) { await api.acceptStaffInvite(job.id); setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, status: 'active' } : j))); showToast(`Ya eres parte del equipo de ${job.name || job.username}`, 'success'); }
      else { await api.leaveStaffStore(job.id); setJobs((list) => list.filter((j) => j.id !== job.id)); }
    } catch (error) { showToast(error.message || 'No se pudo completar', 'error'); } finally { setBusy(null); }
  };

  return (
    <section className="space-y-2">
      <h3 className="px-1 text-base font-black text-[#1a2b4b]">Tiendas donde trabajas</h3>
      {jobs.map((job) => (
        <div key={job.id} className={`${CARD} p-4`}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#12315f] text-[#facc15]"><SvgIcon name="storefront" className="text-xl" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-black text-[#1a2b4b]">{job.name || job.username}</span><span className="block text-xs text-slate-500">{job.status === 'invited' ? `Te invitó a su equipo: ${permissionsText(job.permissions)}` : permissionsText(job.permissions)}</span></span>
            {job.status === 'invited' ? null : (
              <button type="button" aria-expanded={open === job.id} onClick={() => setOpen(open === job.id ? null : job.id)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#facc15] px-4 text-xs font-black text-[#12315f] transition hover:bg-yellow-300 active:scale-[0.97]">{open === job.id ? 'Cerrar' : 'Trabajar'}<SvgIcon name={open === job.id ? 'expand_less' : 'chevron_right'} className="text-base" /></button>
            )}
          </div>
          {job.status === 'invited' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy === job.id} onClick={() => act(job, false)} className="h-10 rounded-full bg-slate-100 text-sm font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[0.97]">Rechazar</button>
              <button type="button" disabled={busy === job.id} onClick={() => act(job, true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1e40af] text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97]">{busy === job.id && <ButtonSpinner tone="dark" />}Aceptar</button>
            </div>
          )}
          <AnimatePresence initial={false}>
            {open === job.id && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                <Workspace job={job} showToast={showToast} />
                <button type="button" onClick={() => act(job, false)} className="mt-3 text-xs font-bold text-slate-500 underline-offset-2 hover:underline">Dejar esta tienda</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </section>
  );
}
