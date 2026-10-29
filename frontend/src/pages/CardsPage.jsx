import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { wishlistPayloadFromCard } from '../utils/wishlistPayload';
import useWishlistIndex, { wishlistKeyOf } from '../hooks/useWishlistIndex';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import CardTile, { CardTileSkeleton } from '../components/cards/CardTile';
import CardsFilters from '../components/cards/CardsFilters';
import { scrollToTopThen } from '../utils/scrollToTopThen';
import FloatingTools from '../components/ui/FloatingTools';
import CardsPagination from '../components/cards/CardsPagination';
import HelpTip from '../components/ui/HelpTip';
import DidYouMean from '../components/ui/DidYouMean';
import CardInfoResults from '../components/cards/CardInfoResults';
import CardsResultsBar, { SORT_VALUES } from '../components/cards/CardsResultsBar';
import usePageMeta from '../hooks/usePageMeta';
import EmptyState from '../components/ui/EmptyState';

const VIEW_KEY = 'carpetazo:cards-view';
const EMPTY = { cards: [], total: 0, pages: 1 };

const readView = () => {
  try { return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch (_error) { return 'grid'; }
};

// Cartas a la venta de todas las carpetas públicas. Búsqueda, juego, orden y página viven en la dirección (se pueden compartir).
export default function CardsPage() {
  usePageMeta({ title: 'Cartas TCG en venta en Chile | Carpetazo', description: 'Busca y compra cartas de Pokémon, Yu-Gi-Oh!, Magic, One Piece, Riftbound, Lorcana, Digimon y Mitos y Leyendas a vendedores de todo Chile. Compara precios y ofertas.', path: '/cartas' });
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const wishlistIndex = useWishlistIndex(Boolean(currentUser));
  const [wanted, setWanted] = useState({}); // cartas ya agregadas a la lista de deseadas en esta visita
  const urlQuery = searchParams.get('q') || '';
  const tcg = searchParams.get('tcg') || '';
  const seller = (searchParams.get('seller') || '').toLowerCase();
  const comuna = searchParams.get('comuna') || '';
  const condition = /^[1-5]$/.test(searchParams.get('condition') || '') ? searchParams.get('condition') : ''; // estado mínimo
  const lang = ['es', 'en', 'ja'].includes(searchParams.get('lang')) ? searchParams.get('lang') : ''; // idioma de la carta
  const sort = SORT_VALUES.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'recent';
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  const [queryInput, setQueryInput] = useState(urlQuery);
  const [result, setResult] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState(readView);
  const [isWide, setIsWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [searchRotation, setSearchRotation] = useState(() => Math.random().toString(36).slice(2, 12));

  // En pantallas anchas siempre es cuadrícula; la lista es solo para el celular y la tablet
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = (event) => setIsWide(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const effectiveView = isWide ? 'grid' : view;
  const chooseView = (next) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch (_error) { /* sin almacenamiento: solo dura esta visita */ }
  };

  const updateParams = (changes, { resetPage = true } = {}) => {
    if (resetPage) setSearchRotation(Math.random().toString(36).slice(2, 12));
    const next = new URLSearchParams(searchParams);
    Object.entries({ ...changes, ...(resetPage ? { page: '' } : {}) }).forEach(([key, value]) => {
      if (value) next.set(key, value); else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  // El texto se envía a la búsqueda medio segundo después de dejar de escribir
  useEffect(() => {
    if (queryInput.trim() === urlQuery) return undefined;
    const timer = setTimeout(() => updateParams({ q: queryInput.trim() }), 450);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => { setQueryInput(urlQuery); }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (urlQuery) params.set('q', urlQuery);
    if (tcg) params.set('tcg', tcg);
    if (seller) params.set('seller', seller);
    if (comuna) params.set('comuna', comuna);
    if (condition) params.set('condition', condition);
    if (lang) params.set('lang', lang);
    if (sort !== 'recent') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    params.set('rotation', searchRotation);
    api.searchCards(params.toString())
      .then((res) => { if (!cancelled) startTransition(() => setResult(res.success ? res : EMPTY)); })
      .catch(() => { if (!cancelled) { setFailed(true); setResult(EMPTY); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [urlQuery, tcg, seller, comuna, condition, lang, sort, page, searchRotation]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const goToPage = (next) => {
    updateParams({ page: next > 1 ? String(next) : '' }, { resetPage: false });
    scrollToTop();
  };
  // Al cambiar de juego primero se sube a la primera carta y después cambia la lista
  const changeTcg = (value) => scrollToTopThen(() => updateParams({ tcg: value }));

  const clearAll = () => { setQueryInput(''); setSearchRotation(Math.random().toString(36).slice(2, 12)); setSearchParams(new URLSearchParams(sort !== 'recent' ? { sort } : {}), { replace: true }); };

  // Lo que hizo la persona en esta pantalla manda; si no hizo nada con esa carta, vale lo que ya tenía en sus listas
  const wantedState = (card) => (wanted[card.id] !== undefined ? wanted[card.id] : (wishlistIndex.get(wishlistKeyOf(wishlistPayloadFromCard(card, card.folder?.tcg))) || false));
  const addToWishlist = async (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    // wanted[id]: id del ítem en la lista, 'pending' mientras se guarda, o vacío. Tocar el corazón otra vez la quita.
    const current = wantedState(card);
    if (current === 'pending') return;
    if (current) {
      setWanted((previous) => ({ ...previous, [card.id]: false })); // el corazón responde al instante
      try {
        await api.deleteWishlistItem(current);
        showToast(`${card.name} quitada de tus deseadas`, 'success');
      } catch (error) {
        setWanted((previous) => ({ ...previous, [card.id]: current }));
        showToast(error.message || 'No se pudo quitar la carta', 'error');
      }
      return;
    }
    setWanted((previous) => ({ ...previous, [card.id]: 'pending' }));
    try {
      const response = await api.addWishlistItem(wishlistPayloadFromCard(card, card.folder?.tcg));
      setWanted((previous) => ({ ...previous, [card.id]: response?.item?.id || 'pending' }));
      showToast(`${card.name} agregada a tus deseadas`, { type: 'success', action: { label: 'Ver lista', run: () => navigate('/dashboard?tab=deseadas') } });
    } catch (error) {
      setWanted((previous) => ({ ...previous, [card.id]: false }));
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    }
  };

  const hasFilters = Boolean(urlQuery || tcg || seller || comuna || condition || lang);
  const gridClass = effectiveView === 'list'
    ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

  return (
    <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16">
      <div className="relative z-10 min-h-[100svh] w-full bg-blue-100 px-4 pb-8 pt-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30 md:px-12 md:pt-14">
        <header className="mb-4 sm:mb-6">
          <div className="flex items-center gap-3"><h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] [text-wrap:balance] md:text-4xl">Cartas en venta</h1><HelpTip topic="cartas" /></div>
          <p className="mt-1 max-w-xl text-sm text-slate-600 md:text-base">Cartas con stock de las carpetas públicas. Toca una para ver quién más la vende y comparar precios.</p>
        </header>

        <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <CardsFilters query={queryInput} tcg={tcg} onQuery={setQueryInput} onTcg={changeTcg} />

          <section className="mt-5 min-w-0 lg:mt-0" aria-label="Resultados">
            <CardsResultsBar
              failed={failed}
              loading={loading}
              onClearAll={clearAll}
              onQuery={(value) => { setQueryInput(value); updateParams({ q: value }); }}
              onSort={(value) => updateParams({ sort: value === 'recent' ? '' : value })}
              onTcg={changeTcg}
              comuna={comuna}
              condition={condition}
              onCondition={(value) => updateParams({ condition: value })}
              lang={lang}
              onLang={(value) => updateParams({ lang: value })}
              onComuna={() => updateParams({ comuna: '' })}
              onComunaChange={(value) => updateParams({ comuna: value })}
              onSeller={() => updateParams({ seller: '' })}
              seller={seller}
              onView={chooseView}
              query={urlQuery}
              sort={sort}
              tcg={tcg}
              total={result.total}
              view={effectiveView}
            />

            <DidYouMean query={urlQuery} onPick={(value) => { setQueryInput(value); updateParams({ q: value }); }} className="mb-3" />

            {failed ? (
              <EmptyState icon="cloud_off" title="No pudimos cargar las cartas" action={{ label: 'Reintentar', icon: 'refresh', onClick: () => setSearchParams(new URLSearchParams(searchParams), { replace: true }) }} role="alert">
                Revisa tu conexión e inténtalo de nuevo.
              </EmptyState>
            ) : !loading && result.cards.length === 0 ? (hasFilters ? null : (
              <EmptyState
                icon="style"
                title="Todavía no hay cartas a la venta"
                action={{ label: 'Publicar mis cartas', to: '/dashboard' }}
              >
                Cuando los vendedores publiquen cartas con stock, aparecerán aquí.
              </EmptyState>
            )) : (
              <ul className={gridClass}>
                {loading
                  ? Array.from({ length: 12 }, (_, i) => <CardTileSkeleton key={i} view={effectiveView} />)
                  : result.cards.map((card, index) => <CardTile key={card.id} card={card} index={index} view={effectiveView} wanted={Boolean(wantedState(card))} onWish={addToWishlist} />)}
              </ul>
            )}

            <CardInfoResults query={urlQuery} game={tcg} sort={sort} lang={lang} hasOffers={result.total > 0} enabled={!loading && !failed && urlQuery.trim().length >= 2 && !seller && !comuna} />

            {!loading && !failed && <CardsPagination page={page} pages={result.pages} onPage={goToPage} />}
          </section>
        </div>
        <FloatingTools onClear={hasFilters ? clearAll : undefined} />
      </div>
    </div>
  );
}
