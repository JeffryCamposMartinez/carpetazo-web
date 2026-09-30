import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import WishlistCardFinder from './WishlistCardFinder';

const LIMIT_FALLBACK = 200;

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

// Administración de la lista de cartas deseadas (panel del jugador). Pensada primero para el móvil.
export default function WishlistTab({ showToast = () => {} }) {
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(LIMIT_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState({ maxPrice: '', note: '', priceVisible: false });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getMyWishlist(), api.getMe()])
      .then(([list, me]) => {
        if (cancelled) return;
        setItems(list.items || []);
        setLimit(list.limit || LIMIT_FALLBACK);
        const theme = (me.user || me)?.publicTheme;
        setVisible(!(theme && typeof theme === 'object' && theme.showWishlist === 'off'));
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const upsertLocal = (item) => setItems((previous) => (previous.some((row) => row.id === item.id) ? previous.map((row) => (row.id === item.id ? item : row)) : [item, ...previous]));

  const addItem = async (payload, label, key) => {
    setBusyId(key || payload.productId || 'manual');
    try {
      const res = await api.addWishlistItem(payload);
      upsertLocal(res.item);
      showToast(`${label} agregada a tu lista`, 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    } finally {
      setBusyId('');
    }
  };

  const changeQuantity = async (item, delta) => {
    const quantity = Math.min(99, Math.max(1, item.quantity + delta));
    if (quantity === item.quantity) return;
    setBusyId(item.id);
    try {
      const res = await api.updateWishlistItem(item.id, { quantity });
      upsertLocal(res.item);
    } catch (error) {
      showToast(error.message || 'No se pudo cambiar la cantidad', 'error');
    } finally {
      setBusyId('');
    }
  };

  const removeItem = async (item) => {
    setBusyId(item.id);
    try {
      await api.deleteWishlistItem(item.id);
      setItems((previous) => previous.filter((row) => row.id !== item.id));
      showToast('Carta quitada de tu lista', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo quitar la carta', 'error');
    } finally {
      setBusyId('');
    }
  };

  const openDetails = (item) => {
    setEditingId(item.id);
    setDraft({ maxPrice: item.maxPrice != null ? String(item.maxPrice) : '', note: item.note || '', priceVisible: Boolean(item.priceVisible) });
  };

  const saveDetails = async (item) => {
    setBusyId(item.id);
    try {
      const price = draft.maxPrice.trim();
      const res = await api.updateWishlistItem(item.id, {
        maxPrice: price === '' ? null : Number(price),
        priceVisible: price === '' ? false : draft.priceVisible,
        note: draft.note.trim() || null,
      });
      upsertLocal(res.item);
      setEditingId('');
      showToast('Detalles guardados', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudieron guardar los detalles', 'error');
    } finally {
      setBusyId('');
    }
  };

  // El interruptor vive en el tema del perfil: se conserva el resto del tema tal como está
  const toggleVisibility = async () => {
    const next = !visible;
    setSavingVisibility(true);
    try {
      const me = await api.getMe();
      const theme = (me.user || me)?.publicTheme;
      const current = theme && typeof theme === 'object' ? theme : {};
      await api.updateProfile({ publicTheme: { ...current, showWishlist: next ? 'on' : 'off' } });
      setVisible(next);
      showToast(next ? 'Tu lista es visible en tu perfil' : 'Tu lista quedó oculta', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo cambiar la visibilidad', 'error');
    } finally {
      setSavingVisibility(false);
    }
  };

  const addedKeys = new Set(items.map((item) => item.productId).filter(Boolean));
  const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70';

  if (loading) {
    return <div className="space-y-3" role="status" aria-label="Cargando tu lista">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />)}</div>;
  }
  if (failed) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-900/5" role="alert">
        <p className="text-lg font-extrabold text-[#12315f]">No pudimos cargar tu lista</p>
        <p className="mt-1 text-sm text-slate-600">Revisa tu conexión y recarga la página.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Visibilidad */}
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        onClick={toggleVisibility}
        disabled={savingVisibility}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-900/5 disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold text-[#12315f]">Mostrar mi lista en mi perfil</span>
          <span className="block text-sm text-slate-500">{visible ? 'Quien vea tus carpetas verá las cartas que buscas.' : 'Tu lista está oculta para los demás.'}</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${visible ? 'bg-[#12315f]' : 'bg-slate-300'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${visible ? 'left-6' : 'left-1'}`} />
        </span>
      </button>

      {/* Agregar */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5" aria-label="Agregar una carta">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#12315f]">Agregar una carta</h2>
          <span className="text-sm font-semibold tabular-nums text-slate-500">{items.length} de {limit}</span>
        </div>
        <WishlistCardFinder onAdd={addItem} addedKeys={addedKeys} busyKey={busyId} />
      </section>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5">
          <p className="text-lg font-extrabold text-[#12315f]">Tu lista está vacía</p>
          <p className="mt-1 text-sm text-slate-600">Busca una carta arriba y agrégala. También puedes tocar el corazón en cualquier carta de la sección Cartas.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-start gap-3">
                <span className="h-[84px] w-[60px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[10px] font-semibold text-slate-400">Sin imagen</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-extrabold leading-tight text-[#12315f]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[item.game, item.detail].filter(Boolean).join(' · ') || (item.productId ? 'Del catálogo' : 'Escrita a mano')}
                    {item.maxPrice != null && ` · Hasta ${formatCLP(item.maxPrice)}${item.priceVisible ? ' (visible)' : ' (oculto)'}`}
                  </p>
                  {item.note && <p className="mt-0.5 line-clamp-2 text-xs italic text-slate-500">{item.note}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-full bg-slate-100">
                      <button type="button" aria-label="Quitar una copia" disabled={busyId === item.id || item.quantity <= 1} onClick={() => changeQuantity(item, -1)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#12315f] disabled:opacity-30"><span translate="no" className="material-symbols-outlined text-[20px]">remove</span></button>
                      <span className="w-8 text-center text-sm font-extrabold tabular-nums text-[#12315f]" aria-label={`${item.quantity} copias`}>{item.quantity}</span>
                      <button type="button" aria-label="Agregar una copia" disabled={busyId === item.id || item.quantity >= 99} onClick={() => changeQuantity(item, 1)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#12315f] disabled:opacity-30"><span translate="no" className="material-symbols-outlined text-[20px]">add</span></button>
                    </div>
                    <button type="button" onClick={() => (editingId === item.id ? setEditingId('') : openDetails(item))} aria-expanded={editingId === item.id} className="h-10 rounded-full px-3 text-sm font-bold text-[#1e40af] hover:bg-blue-50">Detalles</button>
                    <button type="button" aria-label={`Quitar ${item.name}`} disabled={busyId === item.id} onClick={() => removeItem(item)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><span translate="no" className="material-symbols-outlined text-[22px]">delete</span></button>
                  </div>
                </div>
              </div>
              {editingId === item.id && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <label className="block text-sm font-bold text-slate-600">
                    Precio máximo por copia (CLP)
                    <input type="number" inputMode="numeric" min="0" max="100000000" value={draft.maxPrice} onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })} placeholder="Sin precio máximo" className={`${inputClass} mt-1`} />
                  </label>
                  <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={draft.priceVisible} disabled={draft.maxPrice.trim() === ''} onChange={(event) => setDraft({ ...draft, priceVisible: event.target.checked })} className="h-5 w-5 rounded border-slate-300" />
                    Mostrar este precio a quien vea mi perfil
                  </label>
                  <label className="block text-sm font-bold text-slate-600">
                    Nota (opcional)
                    <input type="text" maxLength={140} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="En español, edición Imperio, estado NM…" className={`${inputClass} mt-1`} />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingId('')} className="h-11 flex-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700">Cancelar</button>
                    <button type="button" disabled={busyId === item.id} onClick={() => saveDetails(item)} className="h-11 flex-[1.4] rounded-full bg-[#12315f] text-sm font-extrabold text-white disabled:opacity-60">Guardar detalles</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
