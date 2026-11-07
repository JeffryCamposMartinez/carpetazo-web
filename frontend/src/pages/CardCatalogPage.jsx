import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { GAMES } from '../components/cards/CardsFilters';
import FolderAddSearchFilters from '../components/folder/filters/FolderAddSearchFilters';
import LiquidTabs from '../components/ui/LiquidTabs';
import LoadableImage, { LoadingMark } from '../components/ui/LoadableImage';
import EmptyState from '../components/ui/EmptyState';
import usePageMeta from '../hooks/usePageMeta';

const MYL = 'Mitos y Leyendas'; // tiene su propio catálogo (categoría 99), fuera de TCGplayer: sus cartas no tienen ficha
const PAGE_SIZE = 60;
const noop = () => {};

// Las ediciones de Mitos y Leyendas, de la más nueva a la más vieja
const loadMylGroups = () => api.getTcgGroups('99').then((res) => (res.success ? [...res.data].sort((a, b) => new Date(b.publishedOn || 0) - new Date(a.publishedOn || 0)) : Promise.reject(new Error('Catálogo no disponible'))));
const mylCardsOf = (res) => (res.success ? res.data.map((product) => ({ productId: String(product.productId), name: product.name, number: (product.extData || []).find((item) => item.name === 'Number')?.value || '', imageUrl: product.imageUrl })) : Promise.reject(new Error('Catálogo no disponible')));

// Visor del catálogo: todas las cartas de todas las ediciones, solo para mirarlas (juego → edición → cartas), con los filtros propios de cada juego
export default function CardCatalogPage() {
  usePageMeta({ title: 'Catálogo de cartas TCG | Carpetazo', description: 'Mira todas las cartas de todas las ediciones de Pokémon, Mitos y Leyendas, Magic, Yu-Gi-Oh!, One Piece, Riftbound, Lorcana y Digimon.', path: '/cartas/catalogo' });
  const [params, setParams] = useSearchParams();
  const game = GAMES.some((item) => item.name === params.get('tcg')) ? params.get('tcg') : 'Pokémon';
  const setParam = params.get('set') || '';
  const isMyl = game === MYL;
  const isPokemon = game === 'Pokémon';
  const gameInfo = tcgcsvGameInfo(game); // todos los de TCGplayer menos Pokémon y Mitos y Leyendas

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLang, setSearchLang] = useState('en');
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
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };
  const changeGame = (name) => {
    if (name === game) return;
    resetFilters();
    update({ tcg: name === 'Pokémon' ? '' : name, set: '' });
  };
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
    const timer = setTimeout(() => setMylQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const availableSets = groups || [];
  const filteredSets = useMemo(() => (isMyl && searchBlock ? availableSets.filter((item) => String(item.blockId) === String(searchBlock)) : availableSets), [groups, isMyl, searchBlock]);
  const group = useMemo(() => {
    if (setParam.startsWith(EDITION_FAMILY_PREFIX)) return { groupId: setParam, name: 'Coleccionista Victoriosa (todas)' }; // la opción «(todas)» de Mitos y Leyendas
    return filteredSets.find((item) => String(item.groupId) === setParam) || filteredSets[0] || null;
  }, [filteredSets, setParam]);

  const mylFilters = useMemo(() => ({ type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock, physicalProductId: searchPhysicalProduct }), [mylType, mylRace, mylCost, searchBlock, searchPhysicalProduct]);
  const term = isMyl ? mylQuery.trim() : '';

  useEffect(() => {
    if (!group) return undefined;
    const controller = new AbortController();
    setCards(null); setFailed(false); setShown(PAGE_SIZE);
    const request = isMyl
      ? (term.length >= 2 ? api.searchTcgProducts(term, '99', group.groupId, mylFilters) : api.getTcgProducts('99', group.groupId, mylFilters)).then(mylCardsOf)
      : isPokemon ? fetchPokemonGroupCards(searchLang, group, controller.signal) : fetchGameGroupCards(game, group, controller.signal);
    request
      .then((list) => { if (!controller.signal.aborted) setCards(list); })
      .catch((error) => { if (error?.name !== 'AbortError' && !controller.signal.aborted) { setCards([]); setFailed(true); } });
    return () => controller.abort();
  }, [game, group, searchLang, mylFilters, term]);

  const gameFilters = game === 'One Piece' ? opFilters : game === 'Magic' ? magicFilters : game === 'Yu-Gi-Oh!' ? ygFilters : game === 'Lorcana' ? lcFilters : game === 'Digimon' ? dgFilters : rbFilters;
  // Texto y filtros del juego sobre las cartas de la edición (Mitos y Leyendas ya llega filtrada del servidor)
  const visible = useMemo(() => {
    const list = cards || [];
    if (isMyl) return list;
    return gameInfo ? filterGameCards(game, list, searchQuery.trim().toLowerCase(), gameFilters) : filterPokemonCards(list, { query: searchQuery, supertype: selectedSupertype, type: selectedType });
  }, [cards, game, searchQuery, selectedSupertype, selectedType, gameFilters]);

  useEffect(() => { setShown(PAGE_SIZE); }, [searchQuery, selectedSupertype, selectedType, gameFilters]);

  const loading = groups === null || (group && cards === null);

  return (
    <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16">
      <div className="relative z-10 min-h-[100svh] w-full bg-blue-100 px-4 pb-8 pt-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30 md:px-12 md:pt-14">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] [text-wrap:balance] md:text-4xl">Catálogo de cartas</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 md:text-base">Todas las cartas de cada edición, para mirarlas. Toca una para ver su ficha y quién la vende.</p>
        </header>

        <div className="-mx-4 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
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
        </div>

        <div className="mt-3 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200 lg:max-w-4xl">
          <FolderAddSearchFilters
            availableBlocks={blocks}
            tcg={game}
            searchCategory={isMyl ? '99' : gameInfo ? gameInfo.marker : '1'}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchSet={group ? String(group.groupId) : ''}
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
        </div>

        {group && cards && <p className="mt-4 text-sm font-bold text-[#12315f]" aria-live="polite">{visible.length} {visible.length === 1 ? 'carta' : 'cartas'} en {group.name}</p>}

        <section className="mt-4" aria-label="Cartas de la edición" aria-busy={loading}>
          {loading ? (
            <div className="relative flex h-64 items-center justify-center"><LoadingMark className="absolute inset-0" /></div>
          ) : failed ? (
            <EmptyState icon="cloud_off" title="No pudimos cargar el catálogo" action={{ label: 'Reintentar', icon: 'refresh', onClick: () => window.location.reload() }} role="alert">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon="style" title="Ninguna carta coincide" action={{ label: 'Quitar filtros', onClick: resetFilters }}>
              Prueba con otro nombre, otros filtros u otra edición.
            </EmptyState>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {visible.slice(0, shown).map((card) => {
                  const to = isMyl ? null : catalogLink(card); // las cartas de Mitos y Leyendas no tienen ficha: solo se miran
                  const body = (
                    <>
                      <span className="relative block aspect-[63/88] w-full overflow-hidden bg-slate-100">
                        <LoadableImage src={card.imageUrl} alt={card.name} loading="lazy" decoding="async" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain" />
                      </span>
                      <span className="flex flex-col gap-0.5 p-3">
                        <span className="line-clamp-2 text-sm font-extrabold leading-tight text-[#12315f]">{card.name}</span>
                        {card.number && <span className="text-xs font-bold tabular-nums text-slate-500">N.º {card.number}</span>}
                      </span>
                    </>
                  );
                  const tileClass = `block overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.4)]${to ? ' transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_2px_4px_rgba(26,43,75,0.08),0_18px_32px_-16px_rgba(26,43,75,0.5)] motion-reduce:transition-none' : ''}`;
                  return <li key={card.productId} className="min-w-0">{to ? <Link to={to} className={tileClass}>{body}</Link> : <div className={tileClass}>{body}</div>}</li>;
                })}
              </ul>
              {shown < visible.length && (
                <div className="mt-6 flex justify-center">
                  <button type="button" onClick={() => setShown((count) => count + PAGE_SIZE)} className="inline-flex h-12 items-center justify-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#eab308]">Ver más cartas ({visible.length - shown})</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
