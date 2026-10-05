import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
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
  const [finderOpen, setFinderOpen] = useState(false); // el buscador se abre al pedirlo; con la lista vacía ya viene abierto
  // Botones flotantes: limpiar los filtros del buscador y volver arriba (este aparece tras bajar un poco)
  const resetFinderRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  // Desde 1024 px el buscador queda fijo a la derecha de la lista (solo se monta cuando se ve: al montar descarga el catálogo)
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = (event) => setIsWide(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // PC: la columna de la lista acompaña al bajar y se queda centrada en la altura libre bajo el header (si es más alta, ocupa todo ese alto: se desplazan las cartas y el ajuste de visibilidad queda siempre a la vista)
  const listColumnRef = useRef(null);
  const [listColumn, setListColumn] = useState({ top: 128, maxHeight: 600 });
  useEffect(() => {
    const el = listColumnRef.current;
    if (!isWide || !el) return undefined;
    const place = () => {
      const header = [...document.querySelectorAll('header')].find((node) => node.offsetHeight > 0);
      const headerHeight = header ? header.offsetHeight : 0;
      const free = window.innerHeight - headerHeight;
      const top = Math.round(headerHeight + Math.max(16, (free - el.offsetHeight) / 2));
      const maxHeight = Math.round(free - 32);
      setListColumn((prev) => (prev.top === top && prev.maxHeight === maxHeight ? prev : { top, maxHeight }));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [isWide, loading]);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [matches, setMatches] = useState({});
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState({ maxPrice: '', note: '', priceVisible: false });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getMyWishlist(), api.getMe()])
      .then(([list, me]) => {
        if (cancelled) return;
        setItems(list.items || []);
        setFinderOpen((list.items || []).length === 0);
        setLimit(list.limit || LIMIT_FALLBACK);
        const theme = (me.user || me)?.publicTheme;
        setVisible(!(theme && typeof theme === 'object' && theme.showWishlist === 'off'));
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Coincidencias con lo que venden otros: no bloquea la lista si falla
    api.getWishlistMatches().then((res) => { if (!cancelled && res.success) setMatches(res.matches || {}); }).catch(() => {});
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

  const iconButton = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-40 disabled:active:scale-100';

  return (
    <div className="flex w-full flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      {/* Columna de la lista: en PC acompaña al bajar (si es larga, se desplaza por dentro); en móvil sus partes se intercalan con el buscador (display: contents + order) */}
      <div ref={listColumnRef} style={isWide ? { top: listColumn.top, maxHeight: listColumn.maxHeight } : undefined} className="contents lg:sticky lg:-m-1 lg:flex lg:flex-col lg:gap-4 lg:overflow-hidden lg:p-1">
      {/* Barra principal: cuántas cartas llevas y la acción de agregar (en móvil el buscador aparece solo al pedirlo) */}
      <div className="order-1 flex min-h-11 items-center justify-between gap-3 lg:shrink-0">
        <p className="min-w-0 text-sm font-semibold text-slate-600">
          <span className="font-extrabold tabular-nums text-[#12315f]">{items.length}</span> de {limit} cartas
        </p>
        <button
          type="button"
          onClick={() => setFinderOpen((open) => !open)}
          aria-expanded={finderOpen}
          aria-controls="wishlist-finder"
          className={`group inline-flex h-11 lg:hidden shrink-0 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-extrabold transition-[transform,filter,background-color] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#DBEAFE] ${finderOpen ? 'bg-white text-[#1e40af] ring-1 ring-slate-300 hover:bg-slate-50' : 'bg-[#1e40af] text-white shadow-[0_1px_2px_rgba(8,18,42,0.35),0_6px_14px_-6px_rgba(30,64,175,0.7)] hover:brightness-110'}`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${finderOpen ? 'bg-[#1e40af] text-white' : 'bg-[#facc15] text-[#12315f]'}`}>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px] font-bold">{finderOpen ? 'close' : 'add'}</span>
          </span>
          {finderOpen ? 'Cerrar buscador' : 'Agregar carta'}
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="order-3 rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-lg font-extrabold text-[#12315f]">Tu lista está vacía</p>
          <p className="mt-1 text-sm text-slate-600">Busca una carta y agrégala. También puedes tocar el corazón en cualquier carta de la sección Cartas.</p>
        </div>
      ) : (
        <ul className="order-3 space-y-3 lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:py-1">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start gap-x-3 sm:flex-nowrap sm:items-center">
                <span className="h-[84px] w-[60px] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[10px] font-semibold text-slate-400">Sin imagen</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-extrabold leading-tight text-[#12315f]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[item.game, item.detail].filter(Boolean).join(' · ') || (item.productId ? 'Del catálogo' : 'Escrita a mano')}
                  </p>
                  {item.maxPrice != null && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-700">
                      Hasta <span className="tabular-nums">{formatCLP(item.maxPrice)}</span>
                      <span className="font-medium text-slate-500">· {item.priceVisible ? 'visible' : 'oculto'}</span>
                    </p>
                  )}
                  {item.note && <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">{item.note}</p>}
                </div>
              <div className="mt-2 flex w-full items-center gap-1 border-t border-slate-100 pt-2 sm:mt-0 sm:w-auto sm:shrink-0 sm:border-0 sm:pt-0">
                <div className="flex items-center rounded-full bg-slate-100">
                  <button type="button" aria-label="Quitar una copia" disabled={busyId === item.id || item.quantity <= 1} onClick={() => changeQuantity(item, -1)} className={`${iconButton} text-[#12315f] hover:bg-slate-200`}><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">remove</span></button>
                  <span className="w-8 text-center text-sm font-extrabold tabular-nums text-[#12315f]" aria-label={`${item.quantity} copias`}>{item.quantity}</span>
                  <button type="button" aria-label="Agregar una copia" disabled={busyId === item.id || item.quantity >= 99} onClick={() => changeQuantity(item, 1)} className={`${iconButton} text-[#12315f] hover:bg-slate-200`}><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span></button>
                </div>
                <button type="button" onClick={() => (editingId === item.id ? setEditingId('') : openDetails(item))} aria-expanded={editingId === item.id} className="h-11 rounded-full px-4 text-sm font-bold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Detalles</button>
                <button type="button" aria-label={`Quitar ${item.name}`} disabled={busyId === item.id} onClick={() => removeItem(item)} className={`${iconButton} ml-auto sm:ml-2 text-[#475569] hover:bg-red-50 hover:text-[#b91c1c]`}><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">delete</span></button>
              </div>
              </div>
              {matches[item.id] && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-2.5 ring-1 ring-emerald-200">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                    Disponible ahora · {matches[item.id].count} {matches[item.id].count === 1 ? 'oferta' : 'ofertas'}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {matches[item.id].offers.map((offer) => (
                      <li key={offer.cardId}>
                        <Link to={`/c/${offer.folder.id}`} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm shadow-sm transition-transform duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                          <span className="min-w-0 flex-1 truncate font-bold text-[#12315f]">{offer.seller.name || offer.seller.username || 'Vendedor'}<span className="font-medium text-slate-500"> · {offer.folder.name}</span></span>
                          <span className="shrink-0 font-extrabold tabular-nums text-emerald-700">{formatCLP(offer.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {editingId === item.id && (
                <div className="tab-panel mt-3 space-y-3 border-t border-slate-100 pt-3">
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
                    <button type="button" onClick={() => setEditingId('')} className="h-11 flex-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700 transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Cancelar</button>
                    <button type="button" disabled={busyId === item.id} onClick={() => saveDetails(item)} className="h-11 flex-[1.4] rounded-full bg-[#12315f] text-sm font-extrabold text-white transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 disabled:opacity-60">Guardar detalles</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Visibilidad en el perfil: un ajuste, no la acción principal; va al final */}
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        onClick={toggleVisibility}
        disabled={savingVisibility}
        className="order-4 flex w-full items-center justify-between lg:shrink-0 gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition-transform duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold text-[#12315f]">Mostrar mi lista en mi perfil</span>
          <span className="block text-sm text-slate-600">{visible ? 'Quien vea tus carpetas verá las cartas que buscas.' : 'Tu lista está oculta para los demás.'}</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${visible ? 'bg-[#12315f]' : 'bg-slate-300'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${visible ? 'left-6' : 'left-1'}`} />
        </span>
      </button>
      </div>

      {(finderOpen || isWide) && (
        <section id="wishlist-finder" className="tab-panel order-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:order-none lg:p-5" aria-label="Agregar una carta">
          <h2 className="mb-3 text-lg font-extrabold text-[#12315f]">Agregar una carta</h2>
          <WishlistCardFinder onAdd={addItem} addedKeys={addedKeys} busyKey={busyId} resetRef={resetFinderRef} />
        </section>
      )}

      {/* Botones que siguen al bajar y quedan dentro del panel celeste, sobre el contenido: «sticky» de alto cero pegado al borde inferior de la pantalla
          (con «fixed» quedarían sobre el fondo oscuro o, dentro del panel animado, no seguirían) */}
      <div className="pointer-events-none sticky bottom-5 z-30 h-0 w-full lg:col-span-2 md:bottom-8">
      <div className="pointer-events-auto absolute bottom-0 right-[-0.5rem] flex flex-col items-center gap-2.5 sm:right-[-1.25rem]">
        {(finderOpen || isWide) && (
          <button
            type="button"
            onClick={() => resetFinderRef.current?.()}
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-600 shadow-[0_2px_4px_rgba(8,18,42,0.18),0_10px_22px_-8px_rgba(8,18,42,0.45)] ring-1 ring-slate-200 transition-[color,transform] duration-150 hover:text-[#1e40af] active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px]">filter_alt_off</span>
          </button>
        )}
        <button
          type="button"
          onClick={scrollToTop}
          title="Volver arriba"
          aria-label="Volver arriba"
          tabIndex={showScrollTop ? 0 : -1}
          aria-hidden={!showScrollTop}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-[0_2px_4px_rgba(8,18,42,0.25),0_10px_22px_-8px_rgba(30,64,175,0.7)] ring-2 ring-white/40 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94] focus:outline-none focus-visible:ring-white motion-reduce:transition-opacity ${showScrollTop ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'}`}
        >
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[26px]">arrow_upward</span>
        </button>
      </div>
      </div>
    </div>
  );
}
