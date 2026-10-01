import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ReportButton from './ReportButton';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

// Lista pública de cartas que busca un jugador. Se muestra junto a sus carpetas (perfil y catálogo).
// variant "profile": bloque con título; variant "catalog": franja plegable, compacta para el móvil.
export default function WishlistSection({ username, seller, isOwner = false, variant = 'profile', colors = {} }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(variant === 'profile');

  const primary = colors.primary || '#12315f';
  const accent = colors.accent || '#facc15';
  const text = colors.text || '#12315f';
  const muted = { color: text, opacity: 0.7 };
  const displayName = seller?.name || username;

  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    setLoading(true);
    api.getPublicWishlist(username, 1)
      .then((res) => {
        if (cancelled || !res.success) return;
        setItems(res.items || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
        setPage(1);
        setHidden(Boolean(res.hidden));
      })
      .catch(() => { /* sin lista visible: el bloque no se muestra */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.getPublicWishlist(username, page + 1);
      if (res.success) {
        setItems((previous) => [...previous, ...(res.items || [])]);
        setPage(page + 1);
        setPages(res.pages || 1);
      }
    } catch (_error) { /* se puede reintentar */ } finally {
      setLoadingMore(false);
    }
  };

  const offerCard = (item) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    navigate('/mensajes', {
      state: {
        startChatWith: {
          id: seller?.id,
          name: displayName,
          avatar: seller?.avatar || seller?.photoURL || '',
          draft: `Hola, tengo "${item.name}" que buscas en tu lista de Carpetazo.`,
        },
      },
    });
  };

  if (loading || hidden) return null;

  if (total === 0) {
    // Solo el dueño ve la invitación a llenar su lista
    return isOwner && variant === 'profile' ? (
      <div className="rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: `${primary}55`, color: text }}>
        <p className="text-lg font-extrabold">Aún no tienes cartas deseadas</p>
        <p className="mt-1 text-sm font-medium" style={muted}>Agrega las cartas que buscas y quien entre a tus carpetas podrá ofrecértelas.</p>
        <Link to="/dashboard?tab=deseadas" className="mt-3 inline-flex h-11 items-center rounded-full px-6 text-sm font-extrabold" style={{ backgroundColor: primary, color: '#fff' }}>Armar mi lista</Link>
      </div>
    ) : null;
  }

  const grid = (
    <ul className={`grid gap-3 ${variant === 'profile' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white text-[#12315f] shadow-sm ring-1 ring-black/10">
          <div className="relative w-full bg-slate-100" style={{ aspectRatio: '63 / 88' }}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs font-semibold text-slate-400">Sin imagen</span>
            )}
            {item.quantity > 1 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-[#12315f] px-2 py-0.5 text-xs font-extrabold tabular-nums text-white shadow">x{item.quantity}</span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-2.5">
            <p className="line-clamp-2 text-sm font-bold leading-tight">{item.name}</p>
            {(item.detail || item.tcg) && <p className="line-clamp-2 text-xs text-slate-500">{[item.tcg, item.detail].filter(Boolean).join(' · ')}</p>}
            {item.maxPrice != null && <p className="text-xs font-bold tabular-nums text-slate-700">Paga hasta {formatCLP(item.maxPrice)}</p>}
            {item.note && <p className="line-clamp-2 text-xs italic text-slate-500">{item.note}</p>}
            {!isOwner && item.id && <div><ReportButton targetType="wishlist_item" targetId={item.id} /></div>}
            {!isOwner && (
              <button
                type="button"
                onClick={() => offerCard(item)}
                className="mt-auto flex h-10 items-center justify-center gap-1 whitespace-nowrap rounded-full px-1 text-[12.5px] font-extrabold transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#12315f]"
                style={{ backgroundColor: accent, color: '#12315f' }}
              >
                <span translate="no" className="material-symbols-outlined hidden text-[18px] min-[430px]:inline">sell</span>
                Tengo esta carta
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  const more = page < pages && (
    <div className="mt-4 flex justify-center">
      <button type="button" onClick={loadMore} disabled={loadingMore} className="h-11 rounded-full px-6 text-sm font-extrabold ring-2 disabled:opacity-60" style={{ color: text, '--tw-ring-color': `${primary}66` }}>
        {loadingMore ? 'Cargando…' : 'Ver más cartas'}
      </button>
    </div>
  );

  if (variant === 'catalog') {
    return (
      <section className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 md:mb-5" aria-label="Cartas que busca el vendedor">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left md:min-h-14 md:py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e40af]">
          <span translate="no" className="material-symbols-outlined text-[24px] text-[#1e40af]">favorite</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold text-[#12315f]">{displayName} busca {total} {total === 1 ? 'carta' : 'cartas'}</span>
            <span className="hidden text-xs font-medium text-slate-500 sm:block">{isOwner ? 'Así ven tu lista los demás' : '¿Tienes alguna? Ofrécesela.'}</span>
          </span>
          <span translate="no" className={`material-symbols-outlined text-[24px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
        {open && <div className="border-t border-slate-100 bg-slate-50 p-3">{grid}{more}</div>}
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Cartas que busca este jugador">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-black leading-tight" style={{ color: text }}>Busca estas cartas</h2>
          <p className="text-sm font-medium" style={muted}>{isOwner ? 'Así ven tu lista los demás.' : '¿Tienes alguna? Ofrécesela.'}</p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums" style={{ backgroundColor: primary, color: '#fff' }}>{total}</span>
      </div>
      {grid}
      {more}
    </section>
  );
}
