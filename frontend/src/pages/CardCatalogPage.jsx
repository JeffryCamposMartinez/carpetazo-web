import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { fetchPokemonGroupCards, fetchPokemonGroups, filterPokemonCards } from '../services/tcgcsvPokemon';
import { fetchGameGroupCards, fetchGameGroups, filterGameCards, tcgcsvGameInfo } from '../services/tcgcsvGames';
import { EMPTY_OP_FILTERS } from '../services/tcgcsvOnePiece';
import { EMPTY_MAGIC_FILTERS } from '../services/tcgcsvMagic';
import { EMPTY_RB_FILTERS } from '../services/tcgcsvRiftbound';
import { EMPTY_LC_FILTERS } from '../services/tcgcsvLorcana';
import { EMPTY_DG_FILTERS } from '../services/tcgcsvDigimon';
import { EMPTY_YGO_FILTERS } from '../services/tcgcsvYugioh';
import { EDITION_FAMILY_PREFIX } from '../utils/editionFamilies';
import { catalogLink } from '../utils/catalogLink';
import CatalogEditionBar from '../components/cards/catalog/CatalogEditionBar';
import CatalogToolbar, { SORTS, VIEWS } from '../components/cards/catalog/CatalogToolbar';
import { ARROW_BUTTON } from '../components/ui/arrowButton';
import SlideSwap from '../components/cards/catalog/SlideSwap';
import CatalogGrid from '../components/cards/catalog/CatalogGrid';
import useFinishSplit from '../hooks/useFinishSplit';
import CardLightbox from '../components/ui/CardLightbox';
import AddToFolderModal from '../components/cards/AddToFolderModal';
import SvgIcon from '../components/ui/SvgIcon';
import { useToast } from '../components/ui/ToastProvider';
import { GAMES } from '../components/cards/CardsFilters';
import FolderAddSearchFilters from '../components/folder/filters/FolderAddSearchFilters';
import LiquidTabs from '../components/ui/LiquidTabs';
import { LoadingMark } from '../components/ui/LoadableImage';
import EmptyState from '../components/ui/EmptyState';
import usePageMeta from '../hooks/usePageMeta';

const MYL = 'Mitos y Leyendas'; // tiene su propio catálogo (categoría 99), fuera de TCGplayer: sus cartas no tienen ficha
const PAGE_SIZE = 60;
const noop = () => {};
const ALL_EDITIONS = { all: true, groupId: 'all', name: 'Todas las ediciones' }; // primera posición del deslizador de ediciones, la predeterminada
const VIEW_KEY = 'catalog:view';
const AUTO_MATCHES = 12; // al buscar en «todas las ediciones» se avanza de edición hasta juntar estas coincidencias
const AUTO_EDITIONS = 60; // y como máximo esta cantidad de ediciones seguidas
const LEAGUE_SET = /^prize pack|league & championship/i; // cartas de liga de Pokémon: Prize Pack y League & Championship
const leadingNumber = (text) => { const match = String(text || '').match(/\d+/); return match ? parseInt(match[0], 10) : 0; };
const SORTERS = {
  num: (a, b) => leadingNumber(a.number) - leadingNumber(b.number) || String(a.number).localeCompare(String(b.number), 'es', { numeric: true }),
  'num-desc': (a, b) => SORTERS.num(b, a),
  az: (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || SORTERS.num(a, b),
  za: (a, b) => SORTERS.az(b, a),
};
const storedView = () => { try { const value = localStorage.getItem(VIEW_KEY); return VIEWS.some((item) => item.value === value) ? value : 'grid'; } catch { return 'grid'; } };

// Las ediciones de Mitos y Leyendas, de la más nueva a la más vieja
const loadMylGroups = () => api.getTcgGroups('99').then((res) => (res.success ? [...res.data].sort((a, b) => new Date(b.publishedOn || 0) - new Date(a.publishedOn || 0)) : Promise.reject(new Error('Catálogo no disponible'))));
const mylCardsOf = (res) => (res.success ? res.data.map((product) => ({ productId: String(product.productId), name: product.name, number: (product.extData || []).find((item) => item.name === 'Number')?.value || '', imageUrl: product.imageUrl })) : Promise.reject(new Error('Catálogo no disponible')));

// Visor del catálogo: todas las cartas de todas las ediciones, solo para mirarlas (juego → edición → cartas), con los filtros propios de cada juego
export default function CardCatalogPage() {
  usePageMeta({ title: 'Catálogo de cartas TCG | Carpetazo', description: 'Mira todas las cartas de todas las ediciones de Pokémon, Mitos y Leyendas, Magic, Yu-Gi-Oh!, One Piece, Riftbound, Lorcana y Digimon.', path: '/cartas/catalogo' });
  const [params, setParams] = useSearchParams();
  const game = GAMES.some((item) => item.name === params.get('tcg')) ? params.get('tcg') : 'Pokémon';
  const setParam = params.get('set') || '';
  const gameIndex = GAMES.findIndex((item) => item.name === game);
  const isMyl = game === MYL;
  const isPokemon = game === 'Pokémon';
  const gameInfo = tcgcsvGameInfo(game); // todos los de TCGplayer menos Pokémon y Mitos y Leyendas

  const sort = SORTERS[params.get('orden')] ? params.get('orden') : 'num';
  const view = VIEWS.some((item) => item.value === params.get('vista')) ? params.get('vista') : storedView();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [dir, setDir] = useState(1); // hacia dónde se avanzó por última vez (para animar el cambio de juego o edición)
  const [openId, setOpenId] = useState(null); // carta abierta en la vista rápida
  const [addTarget, setAddTarget] = useState(null);
  const [showTop, setShowTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState(params.get('q') || '');
  const [searchLang, setSearchLangState] = useState(['es', 'ja'].includes(params.get('idioma')) ? params.get('idioma') : 'en');
  const setSearchLang = (value) => { setSearchLangState(value); update({ idioma: value === 'en' ? '' : value }); }; // el idioma va en el enlace: una edición solo en español se puede compartir
  const [selectedSupertype, setSelectedSupertype] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [opFilters, setOpFilters] = useState(EMPTY_OP_FILTERS);
  const [magicFilters, setMagicFilters] = useState(EMPTY_MAGIC_FILTERS);
  const [rbFilters, setRbFilters] = useState(EMPTY_RB_FILTERS);
  const [lcFilters, setLcFilters] = useState(EMPTY_LC_FILTERS);
  const [dgFilters, setDgFilters] = useState(EMPTY_DG_FILTERS);
  const [ygFilters, setYgFilters] = useState(EMPTY_YGO_FILTERS);
  const [blocks, setBlocks] = useState([]);
  const [physicalProducts, setPhysicalProducts] = useState([]);
  const [searchBlock, setSearchBlock] = useState('');
  const [searchPhysicalProduct, setSearchPhysicalProduct] = useState('');
  const [mylType, setMylType] = useState('');
  const [mylRace, setMylRace] = useState('');
  const [mylCost, setMylCost] = useState('');
  const [mylQuery, setMylQuery] = useState(''); // el texto de Mitos y Leyendas se busca en el servidor, un momento después de escribir

  const groupsKey = `${game}|${isPokemon ? searchLang : ''}`;
  const [loaded, setLoaded] = useState({ key: '', list: null }); // las ediciones llevan su juego e idioma: al cambiar no se usan las del anterior
  const groups = loaded.key === groupsKey ? loaded.list : null; // null = cargando
  const [cards, setCards] = useState(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);

  const update = (changes) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      return next;
    }, { replace: true });
  };
  const changeGame = (name) => {
    if (name === game) return;
    resetFilters();
    update({ tcg: name === 'Pokémon' ? '' : name, set: '', q: '' });
  };
  const changeView = (value) => { try { localStorage.setItem(VIEW_KEY, value); } catch { /* sin almacenamiento: solo se usa en esta visita */ } update({ vista: value === 'grid' ? '' : value }); };
  const resetFilters = () => {
    setSearchQuery(''); setMylQuery(''); setSearchLang('en'); setSelectedSupertype(''); setSelectedType('');
    setOpFilters(EMPTY_OP_FILTERS); setMagicFilters(EMPTY_MAGIC_FILTERS); setRbFilters(EMPTY_RB_FILTERS); setLcFilters(EMPTY_LC_FILTERS); setDgFilters(EMPTY_DG_FILTERS); setYgFilters(EMPTY_YGO_FILTERS);
    setSearchBlock(''); setSearchPhysicalProduct(''); setMylType(''); setMylRace(''); setMylCost('');
  };

  useEffect(() => {
    const controller = new AbortController();
    setCards(null); setFailed(false);
    const request = isMyl ? loadMylGroups() : isPokemon ? fetchPokemonGroups(searchLang, controller.signal) : fetchGameGroups(game, controller.signal);
    request
      .then((list) => { if (!controller.signal.aborted) setLoaded({ key: groupsKey, list }); })
      .catch((error) => { if (error?.name !== 'AbortError' && !controller.signal.aborted) { setLoaded({ key: groupsKey, list: [] }); setFailed(true); } });
    return () => controller.abort();
  }, [groupsKey]);

  useEffect(() => {
    if (!isMyl) return;
    api.getTcgBlocks('99').then((res) => { if (res.success) setBlocks(res.data); }).catch(noop);
    api.getTcgPhysicalProducts().then((res) => { if (res.success) setPhysicalProducts(res.data); }).catch(noop);
  }, [isMyl]);

  // En el celular el juego elegido (p. ej. Digimon) puede quedar fuera de la vista: se desliza hasta él
  useEffect(() => { document.querySelector('[aria-label=Juego] [aria-pressed=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [game]);

  useEffect(() => {
    const timer = setTimeout(() => { setMylQuery(searchQuery); update({ q: searchQuery.trim() }); }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const availableSets = groups || [];
  const leagueSets = useMemo(() => (isPokemon ? availableSets.filter((item) => LEAGUE_SET.test(item.name)) : []), [groups, isPokemon]);
  const leagueOnly = isPokemon && leagueSets.length > 0 && params.get('liga') === '1';
  const filteredSets = useMemo(() => (leagueOnly ? leagueSets : isMyl && searchBlock ? availableSets.filter((item) => String(item.blockId) === String(searchBlock)) : availableSets), [groups, isMyl, searchBlock, leagueOnly]);
  const group = useMemo(() => {
    if (setParam.startsWith(EDITION_FAMILY_PREFIX)) return { groupId: setParam, name: 'Coleccionista Victoriosa (todas)' }; // la opción «(todas)» de Mitos y Leyendas
    return filteredSets.find((item) => String(item.groupId) === setParam) || filteredSets[0] || null;
  }, [filteredSets, setParam]);

  const mylFilters = useMemo(() => ({ type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock, physicalProductId: searchPhysicalProduct }), [mylType, mylRace, mylCost, searchBlock, searchPhysicalProduct]);
  const term = isMyl ? mylQuery.trim() : '';

  const requestCards = (target, signal) => (isMyl
    ? (term.length >= 2 ? api.searchTcgProducts(term, '99', target.groupId, mylFilters) : api.getTcgProducts('99', target.groupId, mylFilters)).then(mylCardsOf)
    : isPokemon ? fetchPokemonGroupCards(searchLang, target, signal) : fetchGameGroupCards(game, target, signal));

  useEffect(() => {
    if (!group) return undefined;
    const controller = new AbortController();
    setCards(null); setFailed(false); setShown(PAGE_SIZE);
    requestCards(group, controller.signal)
      .then((list) => { if (!controller.signal.aborted) setCards(list); })
      .catch((error) => { if (error?.name !== 'AbortError' && !controller.signal.aborted) { setCards([]); setFailed(true); } });
    return () => controller.abort();
  }, [game, group, searchLang, mylFilters, term]);

  const gameFilters = game === 'One Piece' ? opFilters : game === 'Magic' ? magicFilters : game === 'Yu-Gi-Oh!' ? ygFilters : game === 'Lorcana' ? lcFilters : game === 'Digimon' ? dgFilters : rbFilters;
  // Texto y filtros del juego sobre las cartas de la edición (Mitos y Leyendas ya llega filtrada del servidor)
  const refine = (list) => {
    if (isMyl) return list;
    return gameInfo ? filterGameCards(game, list, searchQuery.trim().toLowerCase(), gameFilters) : filterPokemonCards(list, { query: searchQuery, supertype: selectedSupertype, type: selectedType });
  };
  const visible = useMemo(() => refine(cards || []), [cards, game, searchQuery, selectedSupertype, selectedType, gameFilters]);

  const sorted = useMemo(() => [...visible].sort(SORTERS[sort]), [visible, sort]);
  useEffect(() => { setShown(PAGE_SIZE); }, [searchQuery, selectedSupertype, selectedType, gameFilters, sort]);

  // Al llegar al final de la lista se muestran más cartas solas (el botón sigue ahí por si el navegador no lo permite)
  const sentinel = useRef(null);
  const more = useCallback(() => setShown((count) => count + PAGE_SIZE), []);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) more(); }, { rootMargin: '600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, sorted.length, more]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 900);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Edición más nueva / más antigua (la lista viene de la más nueva a la más vieja)
  const position = group ? filteredSets.findIndex((item) => String(item.groupId) === String(group.groupId)) : -1;
  const goTo = (target, way = 1) => { if (target) { setDir(way); update({ set: target.all ? '' : String(target.groupId) }); } };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${group.name} · Catálogo de cartas`, url });
      else { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'success'); }
    } catch (error) { if (error?.name !== 'AbortError') showToast('No pudimos copiar el enlace', 'error'); }
  };

  // Pokémon: una carta con varios acabados con precio (Reverse Holofoil…) se muestra también como una carta por acabado, con su franja diagonal
  // Edición solo en español (sin ficha en TCGplayer): se busca su edición inglesa (mismo día de salida y los mismos números) para traer su ficha y acabados
  const [twin, setTwin] = useState(null); // { spanish, english, byNumber }
  useEffect(() => {
    setTwin(null);
    if (!isPokemon || searchLang !== 'es' || !group || Number(group.groupId) < 9000000 || !cards?.length) return undefined;
    let active = true;
    (async () => {
      const day = String(group.publishedOn || '').slice(0, 10);
      const candidates = day ? (await fetchPokemonGroups('en')).filter((item) => String(item.publishedOn || '').slice(0, 10) === day).slice(0, 4) : [];
      const numbers = new Set(cards.map((card) => leadingNumber(card.number)));
      let best = null;
      for (const candidate of candidates) {
        const list = await fetchPokemonGroupCards('en', candidate);
        const byNumber = new Map();
        list.forEach((card) => { const key = leadingNumber(card.number); if (!byNumber.has(key)) byNumber.set(key, card.productId); });
        const overlap = [...numbers].filter((key) => byNumber.has(key)).length;
        if (overlap >= numbers.size / 2 && (!best || overlap > best.overlap)) best = { overlap, english: candidate.groupId, byNumber };
      }
      if (active && best) setTwin({ spanish: group.groupId, english: best.english, byNumber: best.byNumber });
    })().catch(noop);
    return () => { active = false; };
  }, [group, cards, isPokemon, searchLang]);

  // «Todas las ediciones seguidas»: al terminar la edición se ofrece cargar la siguiente, y así hasta la última
  const allMode = !setParam; // sin edición elegida: todas las ediciones, una tras otra
  const [extraCount, setExtraCount] = useState(0);
  const [extraCards, setExtraCards] = useState({}); // `${clave}|${groupId}` → cartas de esa edición (null mientras carga)
  const chainKey = `${game}|${searchLang}|${leagueOnly}|${group?.groupId}|${term}|${JSON.stringify(mylFilters)}`;
  useEffect(() => { setExtraCount(0); }, [chainKey]);
  const following = allMode && position >= 0 ? filteredSets.slice(position + 1, position + 1 + extraCount) : [];
  const nextSet = allMode && position >= 0 ? filteredSets[position + 1 + extraCount] || null : null;
  const extraKey = (target) => `${game}|${searchLang}|${term}|${JSON.stringify(mylFilters)}|${target.groupId}`;
  useEffect(() => {
    following.forEach((target) => {
      const key = extraKey(target);
      if (extraCards[key] !== undefined) return;
      setExtraCards((previous) => ({ ...previous, [key]: null }));
      requestCards(target).then((list) => setExtraCards((previous) => ({ ...previous, [key]: list }))).catch(() => setExtraCards((previous) => ({ ...previous, [key]: [] })));
    });
  }, [following.length, chainKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const extraLists = following.map((target) => ({ group: target, list: extraCards[extraKey(target)] }));
  const extraPage = extraLists.flatMap(({ group: target, list }) => (list ? refine(list).sort(SORTERS[sort]).map((card) => ({ ...card, id: card.productId, tcgProductId: card.productId, groupId: isMyl ? undefined : target.groupId, section: String(target.groupId) })) : []));

  const filtering = searchQuery.trim().length >= 2 || Boolean(selectedSupertype || selectedType);
  const extrasReady = extraLists.every((item) => item.list);
  const matchCount = sorted.length + extraPage.length;
  useEffect(() => {
    if (allMode && filtering && cards && extrasReady && nextSet && matchCount < AUTO_MATCHES && extraCount < AUTO_EDITIONS) setExtraCount((count) => count + 1);
  }, [allMode, filtering, cards, extrasReady, nextSet?.groupId, matchCount, extraCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCards = useMemo(() => [...sorted.slice(0, shown).map((card) => {
    const english = twin && String(twin.spanish) === String(group?.groupId) ? twin.byNumber.get(leadingNumber(card.number)) : null;
    return { ...card, id: card.productId, tcgProductId: english || card.productId, baseProductId: english || undefined, groupId: isMyl ? undefined : english ? twin.english : group?.groupId, section: String(group?.groupId) };
  }), ...extraPage], [sorted, shown, group, isMyl, twin, extraCards, following.length, sort, searchQuery, selectedSupertype, selectedType, gameFilters]);
  const { cards: shownCards } = useFinishSplit(pageCards, isPokemon ? 'pokemon' : null);
  const addToFolder = (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    setAddTarget({ ...card, game, tcgProductId: card.productId });
  };

  const loading = groups === null || (group && cards === null);

  return (
    <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16">
      <div className="relative z-10 min-h-[100svh] w-full bg-blue-100 px-4 pb-8 pt-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30 md:px-12 md:pt-14">
        <header className="mb-4 text-center sm:mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] [text-wrap:balance] md:text-4xl">Catálogo de cartas</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600 md:text-base">Todas las cartas de cada edición. Toca una para verla en grande, y desde ahí ve su ficha y quién la vende.</p>
        </header>

        <div className="flex items-center gap-2 rounded-full bg-white p-1 ring-1 ring-slate-900/10 md:hidden">
          {[-1, 1].map((step) => (
            <button key={step} type="button" onClick={() => { setDir(step); changeGame(GAMES[(gameIndex + step + GAMES.length) % GAMES.length].name); }} aria-label={step < 0 ? 'Juego anterior' : 'Juego siguiente'} className={`${ARROW_BUTTON} h-11 w-11 shrink-0`} style={{ order: step < 0 ? 0 : 2 }}>
              <SvgIcon name={step < 0 ? 'chevron_left' : 'chevron_right'} translate="no" aria-hidden="true" className="text-[24px]" />
            </button>
          ))}
          <SlideSwap id={game} dir={dir} className="order-1 min-w-0 flex-1"><p className="truncate text-center text-base font-extrabold text-[#12315f]" aria-live="polite">{game} <span className="text-xs font-bold text-slate-500">{gameIndex + 1}/{GAMES.length}</span></p></SlideSwap>
        </div>
        <div className="-mx-4 hidden overflow-x-auto px-4 py-2 [scrollbar-width:none] md:mx-0 md:block md:px-0 [&::-webkit-scrollbar]:hidden"><div className="mx-auto w-max">
          <LiquidTabs
            ariaLabel="Juego"
            layout="inline"
            className="w-max gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(26,43,75,0.08)] ring-1 ring-slate-900/10"
            buttonClassName="h-10 shrink-0 rounded-full px-4 text-sm font-extrabold focus-visible:ring-2 focus-visible:ring-[#1e40af]"
            indicatorClassName="rounded-full bg-[#12315f] shadow-[0_8px_16px_-8px_rgba(18,49,95,0.7)]"
            activeTextClassName="text-white"
            inactiveTextClassName="text-[#12315f] [@media(hover:hover)]:hover:bg-blue-50"
            value={game}
            onChange={changeGame}
            options={GAMES.map((item) => ({ value: item.name, label: item.name }))}
          />
        </div></div>

        <div className="mx-auto mt-3 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200 lg:max-w-4xl">
          <FolderAddSearchFilters
            availableBlocks={blocks}
            tcg={game}
            searchCategory={isMyl ? '99' : gameInfo ? gameInfo.marker : '1'}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchSet={group && !allMode ? String(group.groupId) : ''}
            availableSets={availableSets}
            filteredSearchSets={filteredSets}
            isSetDropdownOpen={false}
            setIsSetDropdownOpen={noop}
            setSearchSet={(value) => update({ set: value ? String(value) : '' })}
            searchLang={searchLang}
            setSearchLang={setSearchLang}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            selectedSupertype={selectedSupertype}
            setSelectedSupertype={setSelectedSupertype}
            searchBlock={searchBlock}
            setSearchBlock={setSearchBlock}
            searchPhysicalProduct={searchPhysicalProduct}
            setSearchPhysicalProduct={setSearchPhysicalProduct}
            availablePhysicalProducts={physicalProducts}
            mylType={mylType}
            setMylType={setMylType}
            mylRace={mylRace}
            setMylRace={setMylRace}
            mylCost={mylCost}
            setMylCost={setMylCost}
            opFilters={opFilters}
            setOpFilters={setOpFilters}
            magicFilters={magicFilters}
            setMagicFilters={setMagicFilters}
            rbFilters={rbFilters}
            setRbFilters={setRbFilters}
            lcFilters={lcFilters}
            setLcFilters={setLcFilters}
            dgFilters={dgFilters}
            setDgFilters={setDgFilters}
            ygFilters={ygFilters}
            setYgFilters={setYgFilters}
            loadedCards={cards || []}
            scrollToTopIfNeeded={noop}
          />
          <div className="flex flex-wrap justify-center gap-2 px-2 pb-1 pt-2">
            {[
              leagueSets.length > 0 && { label: 'Solo cartas de liga (Prize Pack)', on: leagueOnly, toggle: () => update({ liga: leagueOnly ? '' : '1', set: '' }) },
            ].filter(Boolean).map((chip) => (
              <button key={chip.label} type="button" onClick={chip.toggle} aria-pressed={chip.on} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold ring-1 transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${chip.on ? 'bg-[#12315f] text-[#facc15] ring-[#facc15]' : 'bg-white text-[#12315f] ring-slate-900/10 [@media(hover:hover)]:hover:bg-blue-50'}`}>
                <SvgIcon name={chip.on ? 'check' : 'add'} translate="no" aria-hidden="true" className="text-[18px]" />{chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full lg:max-w-4xl">
        {group && (
          <CatalogEditionBar
            group={allMode ? ALL_EDITIONS : group}
            all={allMode}
            count={visible.length}
            total={(cards || []).length}
            loading={loading}
            dir={dir}
            newer={allMode ? null : position > 0 ? filteredSets[position - 1] : ALL_EDITIONS}
            older={allMode ? filteredSets[0] || null : position >= 0 && position < filteredSets.length - 1 ? filteredSets[position + 1] : null}
            onGo={goTo}
            onShare={share}
          />
        )}
        {group && cards && (sorted.length > 0 || extraPage.length > 0) && <CatalogToolbar sort={sort} onSort={(value) => update({ orden: value === 'num' ? '' : value })} view={view} onView={changeView} />}
        </div>

        <section className="mt-4" aria-label="Cartas de la edición" aria-busy={loading}>
          {loading ? (
            <div className="relative flex h-64 items-center justify-center"><LoadingMark className="absolute inset-0" /><span className="sr-only" role="status">Cargando cartas…</span></div>
          ) : failed ? (
            <EmptyState icon="cloud_off" title="No pudimos cargar el catálogo" action={{ label: 'Reintentar', icon: 'refresh', onClick: () => window.location.reload() }} role="alert">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          ) : !group ? (
            <EmptyState icon="style" title="Este juego aún no tiene ediciones">Vuelve pronto: estamos sumando más cartas al catálogo.</EmptyState>
          ) : matchCount === 0 && !(allMode && nextSet) && extrasReady ? (
            <EmptyState icon="style" title={(cards || []).length === 0 ? 'Esta edición no tiene cartas todavía' : 'Ninguna carta coincide'} action={(cards || []).length === 0 ? { label: 'Ver la edición más nueva', onClick: () => goTo(filteredSets[0]) } : { label: 'Quitar filtros', onClick: resetFilters }} secondary={(cards || []).length === 0 ? undefined : { label: 'Probar con otra edición', onClick: () => goTo(filteredSets[position + 1] || filteredSets[0]) }}>
              {(cards || []).length === 0 ? 'Aún no cargamos las cartas de esta edición.' : 'Prueba con otro nombre, otros filtros u otra edición.'}
            </EmptyState>
          ) : (
            <>
              <CatalogGrid cards={shownCards.filter((card) => card.section === String(group.groupId))} view={view} hasFicha={!isMyl} onOpen={(card) => setOpenId(card.id)} />
              {shown < sorted.length && (
                <div ref={sentinel} className="mt-6 flex justify-center">
                  <button type="button" onClick={more} className="inline-flex h-12 items-center justify-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#eab308]">Ver más cartas ({sorted.length - shown})</button>
                </div>
              )}
              {allMode && shown >= sorted.length && (
                <>
                  {extraLists.map(({ group: target, list }) => {
                    const cardsOf = shownCards.filter((card) => card.section === String(target.groupId));
                    if (filtering && list && cardsOf.length === 0) return null; // con búsqueda no se muestran las ediciones sin coincidencias
                    return (
                      <div key={target.groupId} className="mt-8">
                        <h2 className="mb-3 rounded-2xl bg-[#12315f] px-4 py-3 text-center text-base font-extrabold text-white shadow-[0_14px_28px_-18px_rgba(18,49,95,0.9)] md:text-lg">{target.name}{list && <span className="block text-xs font-bold text-blue-100/85">{cardsOf.length === 0 ? 'Sin cartas con estos filtros' : `${list.length} cartas`}</span>}</h2>
                        {!list ? <div className="relative flex h-40 items-center justify-center"><LoadingMark className="absolute inset-0" /></div> : <CatalogGrid cards={cardsOf} view={view} hasFicha={!isMyl} onOpen={(card) => setOpenId(card.id)} />}
                      </div>
                    );
                  })}
                  <div className="mt-8 flex flex-col items-center gap-1">
                    {filtering && nextSet && matchCount < AUTO_MATCHES && extraCount < AUTO_EDITIONS ? (
                      <div className="relative flex h-24 w-full items-center justify-center"><LoadingMark className="absolute inset-0" /><span className="sr-only" role="status">Buscando en más ediciones…</span></div>
                    ) : nextSet ? (
                      <button type="button" onClick={() => setExtraCount((count) => count + 1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#eab308]">
                        <SvgIcon name="add" translate="no" aria-hidden="true" className="text-[18px]" />Cargar siguiente edición
                      </button>
                    ) : <p className="text-xs font-bold text-slate-500">Llegaste a la última edición</p>}
                    {nextSet && <p className="max-w-full truncate text-xs font-bold text-slate-500">{nextSet.name}</p>}
                  </div>
                </>
              )}
              {shown >= sorted.length && sorted.length > PAGE_SIZE && !allMode && <p className="mt-6 text-center text-xs font-bold text-slate-500">Viste las {sorted.length} cartas de {group.name}</p>}
            </>
          )}
        </section>
      </div>
      {showTop && (
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label="Volver arriba" className={`${ARROW_BUTTON} fixed bottom-5 right-4 z-40 h-12 w-12 md:right-8`}>
          <SvgIcon name="arrow_upward" translate="no" aria-hidden="true" className="text-[24px]" />
        </button>
      )}
      {openId && shownCards.length > 0 && (
        <CardLightbox
          cards={shownCards}
          cardId={openId}
          onChange={setOpenId}
          onClose={() => setOpenId(null)}
          tcg={game}
          describe={(card) => ({ subtitle: [game, group?.name].filter(Boolean).join(' · '), chips: [card.number && `N.º ${card.number}`, card.finish, card.extData?.Rarity || card.rarity].filter(Boolean), note: 'Carta del catálogo: es informativa, no una oferta de venta.' })}
          renderActions={(card) => (
            <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2">
              {!isMyl && catalogLink(card) && <button type="button" onClick={() => navigate(catalogLink(card))} className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#facc15] px-3.5 py-1.5 text-xs font-extrabold text-[#12315f] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-11 sm:px-5 sm:py-2 sm:text-sm"><SvgIcon name="info" translate="no" aria-hidden="true" className="shrink-0 text-[18px] sm:text-[20px]" />Ver ficha y quién la vende</button>}
              {!isMyl && <button type="button" onClick={() => addToFolder(card)} className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] sm:min-h-11 sm:px-5 sm:py-2 sm:text-sm"><SvgIcon name="add_circle" translate="no" aria-hidden="true" className="shrink-0 text-[18px] sm:text-[20px]" />Agregar a mi carpeta</button>}
            </div>
          )}
        />
      )}
      {addTarget && <AddToFolderModal card={addTarget} onClose={() => setAddTarget(null)} />}
    </div>
  );
}
