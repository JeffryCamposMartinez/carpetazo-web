import LiquidTabs from '../components/ui/LiquidTabs';
import { memo, useState, useEffect, useRef, startTransition } from 'react';

import React from 'react';

import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api, apiUrl } from '../services/api';
import { getTcgConfig } from '../config/tcgConfig';
import { useAuth } from '../contexts/AuthContext';

import { useToast } from '../components/ui/ToastProvider';
import ConfirmModal from '../components/ui/ConfirmModal';
import { DETAIL_MODES, getExtDataValue, normalizeTcgProductId, sortCatalogCards } from '../components/folder/folderCards';
import FolderSalesTab from '../components/folder/tabs/FolderSalesTab';
import FolderCatalogTab from '../components/folder/tabs/FolderCatalogTab';
import FolderAddTab from '../components/folder/tabs/FolderAddTab';
import FolderShareNotice from '../components/folder/FolderShareNotice';
import useCardSearch from '../hooks/useCardSearch';
import { DRAG_SCROLL_EDGE_PX, DRAG_SCROLL_MAX_SPEED } from '../components/folder/dragScroll';
import useCatalogOrder from '../hooks/useCatalogOrder';
import useInventoryTools from '../hooks/useInventoryTools';
import { catalogJson } from '../services/tcgcsvFetch';
import { EMPTY_OP_FILTERS, ONE_PIECE_CATEGORY, onePieceGroupLabel } from '../services/tcgcsvOnePiece';
import { EMPTY_MAGIC_FILTERS, MAGIC_CATEGORY, magicGroupLabel } from '../services/tcgcsvMagic';
import { EMPTY_RB_FILTERS, RIFTBOUND_CATEGORY, riftboundGroupLabel } from '../services/tcgcsvRiftbound';
import { EMPTY_LC_FILTERS, LORCANA_CATEGORY, lorcanaGroupLabel } from '../services/tcgcsvLorcana';
import { DIGIMON_CATEGORY, EMPTY_DG_FILTERS, digimonGroupLabel } from '../services/tcgcsvDigimon';
import { EMPTY_YGO_FILTERS, YUGIOH_CATEGORY, yugiohGroupLabel } from '../services/tcgcsvYugioh';
import { tcgcsvCategoryId } from '../services/tcgcsvGames';
import { sortCatalogGroupsNewestFirst } from '../services/catalogOrdering';
import { warmFolderPreview } from '../utils/sharePreview';
import { storedCardId } from '../utils/mylIdentity';
import LoadingState, { ButtonSpinner } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { siteUrl } from '../utils/siteUrl';
import { formatCardSearchQuery } from '../utils/cardCodeSearch';
import { cardLanguageOf, normalizeCardLanguage } from '../utils/cardLanguage';
import HelpTip from '../components/ui/HelpTip';
import SvgIcon from '../components/ui/SvgIcon';


const PAGE_SIZE = 20;

// Una pestaña oculta no se vuelve a dibujar cuando cambia algo de la página (el álbum con todas sus cartas tarda ~200 ms en dibujarse):
// solo se actualiza al volver a mostrarla, con los datos del momento. Ocultarla no cuesta nada.
const Frozen = memo(function Frozen({ children }) { return children; }, (previous, next) => next.frozen);
function KeepAlive({ active, children }) {
  return <div className={active ? '' : 'hidden'}><Frozen frozen={!active}>{children}</Frozen></div>;
}

export default function FolderPage() {

  // La edición se toma de la propia carta (así no cambia al cambiar de idioma/lista de ediciones)
  const getCardSetName = (card) => card?.group?.name || availableSets.find(s => s.groupId == (searchSet || card?.groupId))?.name;

  const getProxyImageUrl = (productId, originalUrl) => {
    if (!originalUrl) return '';
    if (originalUrl.includes('api.carpetazo.cl/images') || originalUrl.includes('r2.dev') || originalUrl.includes('imagenes.carpetazo.cl')) return originalUrl;
    if (originalUrl.startsWith('blob:')) return originalUrl;
    if (originalUrl.startsWith('data:')) return originalUrl;
    if (originalUrl.includes('tcgplayer-cdn.tcgplayer.com')) return originalUrl;
    return apiUrl('/proxy-image?url=' + encodeURIComponent(originalUrl));
  };

  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [folderData, setFolderData] = useState(null);
  const [shareNoticeOpen, setShareNoticeOpen] = useState(false); // aviso para publicar y compartir tras la primera carta
  const [loadingFolder, setLoadingFolder] = useState(true);
  
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'catalog', 'sales'
  // Las pestañas se dibujan una vez y luego solo se ocultan: cambiar de pestaña es instantáneo (antes se volvía a armar todo el álbum o la búsqueda).
  // Con la carpeta ya cargada, las otras se preparan en un momento libre para que ni el primer cambio espere.
  const [mountedTabs, setMountedTabs] = useState({ add: true });
  useEffect(() => { setMountedTabs((previous) => (previous[activeTab] ? previous : { ...previous, [activeTab]: true })); }, [activeTab]);
  useEffect(() => {
    if (loadingFolder) return undefined;
    const warm = () => startTransition(() => setMountedTabs({ add: true, catalog: true, sales: true }));
    if (typeof requestIdleCallback === 'function') { const id = requestIdleCallback(warm, { timeout: 2500 }); return () => cancelIdleCallback(id); }
    const id = setTimeout(warm, 1500);
    return () => clearTimeout(id);
  }, [loadingFolder]);

  // --- ADD TO CATALOG STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchQueryChange = (value) => {
    setSearchQuery(formatCardSearchQuery(value, searchQuery));
  };
  const [gridCols, setGridCols] = useState(typeof window !== 'undefined' && window.innerWidth <= 768 ? 2 : 3);
  const [searchCategory, setSearchCategory] = useState('1');
  const [searchSet, setSearchSet] = useState('');
  const [searchLang, setSearchLang] = useState('en');
  const [availableSets, setAvailableSets] = useState([]);
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [availablePhysicalProducts, setAvailablePhysicalProducts] = useState([]);
  const [searchPhysicalProduct, setSearchPhysicalProduct] = useState('');

  // MYL Custom Filters
  const [mylType, setMylType] = useState('');
  const [mylRace, setMylRace] = useState('');
  const [mylCost, setMylCost] = useState('');
  const [searchBlock, setSearchBlock] = useState('2');
  const [catBlock, setCatBlock] = useState('');

  const filteredSearchSets = searchCategory === '99' && searchBlock !== '' ? availableSets.filter(s => s.blockId == searchBlock) : availableSets;
  const filteredCatSets = (folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') && catBlock !== '' ? availableSets.filter(s => s.blockId == catBlock) : availableSets;
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setGridCols(3);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearchedAPI, setHasSearchedAPI] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSupertype, setSelectedSupertype] = useState('');
  const [opFilters, setOpFilters] = useState(EMPTY_OP_FILTERS); // filtros de One Piece
  const [magicFilters, setMagicFilters] = useState(EMPTY_MAGIC_FILTERS); // filtros de Magic
  const [rbFilters, setRbFilters] = useState(EMPTY_RB_FILTERS); // filtros de Riftbound
  const [lcFilters, setLcFilters] = useState(EMPTY_LC_FILTERS); // filtros de Lorcana
  const [dgFilters, setDgFilters] = useState(EMPTY_DG_FILTERS); // filtros de Digimon
  const [ygFilters, setYgFilters] = useState(EMPTY_YGO_FILTERS); // filtros de Yu-Gi-Oh!

const [filterRarity, setFilterRarity] = useState('');
  const [availableRarities, setAvailableRarities] = useState([]);
  const [rawSearchResults, setRawSearchResults] = useState([]);
  
  const filterCounts = React.useMemo(() => {
    let p = 0, t = 0, e = 0;
    if (rawSearchResults) {
      rawSearchResults.forEach(c => {
        if (c.extData?.category === 'Pokémon') p++;
        else if (c.extData?.category === 'Entrenador') t++;
        else if (c.extData?.category === 'Energía') e++;
      });
    }
    return { pokemon: p, trainers: t, energy: e };
  }, [rawSearchResults]);

const [isSearching, setIsSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState([]);
  const [activeQueueItemId, setActiveQueueItemId] = useState(null);
  const [price, setPrice] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hasMoreGroups, setHasMoreGroups] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [inPersonToolbarVisible, setInPersonToolbarVisible] = useState(false);
  const folderTcgConfig = getTcgConfig(folderData?.tcg);
  const isTcgcsvSearch = Boolean(tcgcsvCategoryId(searchCategory, searchLang)); // Pokémon, One Piece y Magic se buscan directo en TCGCSV
  const isMylFolder = folderTcgConfig.categoryId === '99' || searchCategory === '99';

  const scrollToTopIfNeeded = () => {
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getCardSelectionKey = (card) => normalizeTcgProductId(card?.productId || card?.tcgProductId || card?.id || card?.name);
  const isBatchAdding = activeQueueItemId !== null;
  const selectedQueueCountByCard = selectedQueue.reduce((acc, item) => {
    const key = getCardSelectionKey(item.card);
    acc[key] = (acc[key] || 0) + (item.quantity || 1);
    return acc;
  }, {});
  const totalQueuedCards = selectedQueue.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const resetCardForm = () => {
    setPrice('');
    setStock('1');
    setPseudoName('');
  };

  const toggleMultiSelectMode = () => {
    if (!multiSelectMode) {
      setSelectedCard(null);
      resetCardForm();
    }
    setMultiSelectMode(prev => {
      const next = !prev;
      if (!next) {
        setSelectedQueue([]);
        setActiveQueueItemId(null);
      }
      return next;
    });
  };

  const addCardToQueue = (card) => {
    setSelectedQueue(prev => {
      const key = getCardSelectionKey(card);
      const existingIndex = prev.findIndex(item => getCardSelectionKey(item.card) === key);
      
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: (next[existingIndex].quantity || 1) + 1
        };
        return next;
      }
      
      return [
        ...prev,
        {
          queueId: `${key}-${Date.now()}`,
          card,
          quantity: 1
        }
      ];
    });
    
    setTimeout(() => {
      if (queueScrollRef.current) {
        queueScrollRef.current.scrollTo({ top: queueScrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  };

  const removeQueueItem = (queueId) => {
    setSelectedQueue(prev => prev.filter(item => item.queueId !== queueId));
    if (activeQueueItemId === queueId) {
      setActiveQueueItemId(null);
      setSelectedCard(null);
      resetCardForm();
    }
  };

  const decreaseQueueItemQuantity = (e, queueId) => {
    e.preventDefault();
    const item = selectedQueue.find(i => i.queueId === queueId);
    if (!item) return;
    
    if (item.quantity > 1) {
      setSelectedQueue(prev => prev.map(i => i.queueId === queueId ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      removeQueueItem(queueId);
    }
  };

  const startQueuedAdd = () => {
    const nextItem = selectedQueue[0];
    if (!nextItem) return;
    setActiveQueueItemId(nextItem.queueId);
    setSelectedCard(nextItem.card);
    setStock((nextItem.quantity || 1).toString());
    setPseudoName('');
    setPrice('');
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('add-catalog-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleResultCardClick = (card) => {
    if (multiSelectMode) {
      addCardToQueue(card);
      return;
    }
    setActiveQueueItemId(null);
    setSelectedCard(card);
    resetCardForm();
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('add-catalog-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleRightClickResultCard = (e, card) => {
    e.preventDefault();
    if (!multiSelectMode) return;
    
    const key = getCardSelectionKey(card);
    const existingItem = selectedQueue.find(item => getCardSelectionKey(item.card) === key);
    
    if (existingItem) {
      decreaseQueueItemQuantity(e, existingItem.queueId);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const observerTarget = useRef(null);

  // Vuelve a 20 solo cuando cambia la búsqueda/filtros (no cuando se anexan más ediciones)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, searchSet, searchLang, selectedSupertype, selectedType, filterRarity, filterType]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          if (visibleCount < searchResults.length) setVisibleCount(prev => prev + PAGE_SIZE);
          else if (hasMoreGroups) loadMorePokemonRef.current?.();
        }
      },
      { threshold: 0.1 }
    );
    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }
    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [searchResults, visibleCount, hasMoreGroups]);
  const [stock, setStock] = useState('1');
  const [pseudoName, setPseudoName] = useState('');
  const [language, setLanguage] = useState('English');
  // Al seleccionar una carta, el idioma parte igual al idioma de esa carta (no al del filtro actual)
  useEffect(() => {
    if (selectedCard?.cardLanguage) setLanguage(selectedCard.cardLanguage);
  }, [selectedCard?.id]);
  // Al avanzar o retroceder en pantalla completa cerca del límite, seguir cargando cartas y ediciones sin cortar el recorrido
  useEffect(() => {
    if (!selectedCard || isBatchAdding) return;
    const idx = searchResults.findIndex((item) => item.id === selectedCard.id);
    if (idx < 0) return;
    if (idx >= visibleCount - 5 && (visibleCount < searchResults.length || hasMoreGroups)) {
      setVisibleCount((prev) => Math.max(prev + PAGE_SIZE, idx + PAGE_SIZE));
    }
    if (idx >= searchResults.length - 5 && hasMoreGroups && !isSearching) {
      loadMorePokemonRef.current?.();
    }
  }, [selectedCard?.id, isBatchAdding, searchResults, visibleCount, hasMoreGroups, isSearching]);
  const [isSaving, setIsSaving] = useState(false);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const queueScrollRef = useRef(null);

  // --- UI STATE ---
  const { showToast } = useToast();
  
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', targetId: null });

  // --- CATALOG MANAGEMENT STATE ---
  
  const [catQuery, setCatQuery] = useState('');
  const [catSet, setCatSet] = useState('');
  const [catalogViewMode, setCatalogViewMode] = useState('grid');
  const [catalogGridDensity, setCatalogGridDensity] = useState(3);
  const [catalogDesktopColumns, setCatalogDesktopColumns] = useState(5);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Información de las cartas del inventario: 'basic' (stock y precio) por defecto, 'full' o 'none'
  const [cardDetailsMode, setCardDetailsMode] = useState('basic');
  const showCardDetails = cardDetailsMode !== 'none';
  // La pestaña Agregar solo distingue ver o no ver información
  const setShowCardDetails = (next) => setCardDetailsMode((prev) => {
    const wanted = typeof next === 'function' ? next(prev !== 'none') : next;
    return wanted ? (prev === 'none' ? 'basic' : prev) : 'none';
  });
  const cycleCardDetailsMode = () => setCardDetailsMode((prev) => DETAIL_MODES[prev].next);
  const [cardDetailsPreferenceReady, setCardDetailsPreferenceReady] = useState(false);
  const [isCatSetDropdownOpen, setIsCatSetDropdownOpen] = useState(false);
  const [draggedCatalogCardId, setDraggedCatalogCardId] = useState(null);
  const [dropCatalogIndex, setDropCatalogIndex] = useState(null);
  const [catalogDragFloatingPreview, setCatalogDragFloatingPreview] = useState(null);
  const [savingCatalogOrder, setSavingCatalogOrder] = useState(false);
  const [hasUnsavedCatalogOrder, setHasUnsavedCatalogOrder] = useState(false);
  const catalogDragScrollFrameRef = useRef(null);
  const catalogDragScrollSpeedRef = useRef(0);
  const catalogDragFloatingPreviewRef = useRef(null);
  const touchCatalogCardIdRef = useRef(null);
  const touchCatalogDropIndexRef = useRef(null);
  const isTouchDragRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.uid) {
      setCardDetailsMode('basic');
      setCardDetailsPreferenceReady(false);
      return;
    }

    const storageKey = `carpetazo:folder-card-details-mode:${currentUser.uid}`;
    const savedPreference = window.localStorage.getItem(storageKey);
    setCardDetailsMode(DETAIL_MODES[savedPreference] ? savedPreference : 'basic');
    setCardDetailsPreferenceReady(true);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid || !cardDetailsPreferenceReady) return;
    const storageKey = `carpetazo:folder-card-details-mode:${currentUser.uid}`;
    window.localStorage.setItem(storageKey, cardDetailsMode);
  }, [cardDetailsMode, currentUser?.uid, cardDetailsPreferenceReady]);

  useEffect(() => {
    // Evita que la previsualización se quede pegada si se cambia de vista (grid <-> album) mientras se arrastra
    setDraggedCatalogCardId(null);
    setDropCatalogIndex(null);
    setCatalogDragFloatingPreview(null);
    touchCatalogCardIdRef.current = null;
    touchCatalogDropIndexRef.current = null;
  }, [catalogViewMode]);

  const moveCatalogDragFloatingPreview = (clientX, clientY) => {
    if (!catalogDragFloatingPreviewRef.current || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    catalogDragFloatingPreviewRef.current.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
  };

  // --- SALES & HISTORY STATE ---
  // Pedidos de esta carpeta: misma fuente y acciones que Solicitudes/Historial del panel
  const [folderOrders, setFolderOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [salesView, setSalesView] = useState('presencial');
  // Enlace directo desde el menú de la cuenta: /carpeta/:id?tab=sales&view=presencial abre la venta presencial de esta carpeta
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'sales') {
      setActiveTab('sales');
      if (params.get('view') === 'presencial') setSalesView('presencial');
      return;
    }
    if (params.get('tab') === 'catalog') {
      setActiveTab('catalog');
      setCatQuery(params.get('q') || '');
    }
  }, [location.search, id]);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (!draggedCatalogCardId) return undefined;

    const updateScrollSpeed = (clientY) => {
      if (!Number.isFinite(clientY) || clientY <= 0) {
        catalogDragScrollSpeedRef.current = 0;
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      if (clientY < DRAG_SCROLL_EDGE_PX) {
        const intensity = (DRAG_SCROLL_EDGE_PX - clientY) / DRAG_SCROLL_EDGE_PX;
        catalogDragScrollSpeedRef.current = -Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
      } else if (clientY > viewportHeight - DRAG_SCROLL_EDGE_PX) {
        const intensity = (clientY - (viewportHeight - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX;
        catalogDragScrollSpeedRef.current = Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
      } else {
        catalogDragScrollSpeedRef.current = 0;
      }
    };

    const handleWindowDragOver = (event) => {
      updateScrollSpeed(event.clientY);
      moveCatalogDragFloatingPreview(event.clientX, event.clientY);
    };

    const tick = () => {
      const speed = catalogDragScrollSpeedRef.current;
      if (speed !== 0) {
        window.scrollBy({ top: speed, left: 0, behavior: 'instant' });
      }
      catalogDragScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    catalogDragScrollFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      catalogDragScrollSpeedRef.current = 0;
      if (catalogDragScrollFrameRef.current) {
        window.cancelAnimationFrame(catalogDragScrollFrameRef.current);
        catalogDragScrollFrameRef.current = null;
      }
    };
  }, [draggedCatalogCardId]);

  useEffect(() => {
    if (activeTab !== 'sales') return;
    fetchOrders();
  }, [activeTab]);

  // Fetch logic
  

  

  const fetchCards = async () => {
    try {
      const res = await api.getFolder(id);
      if(res.success && res.folder) {
        const mappedCards = sortCatalogCards((res.folder.cards || []).map(c => ({ ...c, ...(c.data || {}), data: c.data || {} })));
        setCards(mappedCards);
        setHasUnsavedCatalogOrder(false);
      }
    } catch (err) { console.error('Error fetching cards:', err); }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const init = async () => {
      let redirected = false;
      try {
        const res = await api.getFolder(id);
        if (res.success && res.folder) {
          // Esta pantalla es para editar: quien no es el dueño (o no tiene sesión) va a la vista pública de la carpeta
          if (!res.folder.isOwner) { redirected = true; navigate(`/c/${id}`, { replace: true }); return; }
          setFolderData(res.folder);
          setSearchCategory(getTcgConfig(res.folder.tcg).categoryId);
          const mappedCards = sortCatalogCards((res.folder.cards || []).map(c => ({ ...c, ...(c.data || {}), data: c.data || {} })));
          setCards(mappedCards);
          setHasUnsavedCatalogOrder(false);
        }
      } catch (e) { console.error(e); } finally { if (!redirected) setLoadingFolder(false); }
    };
    init();
  }, [id]);

  useEffect(() => {
    let stale = false;
    if (!searchCategory) {
      setAvailableSets([]);
      setSearchSet('');
      return undefined;
    }
    // Bloques y productos físicos son solo de Mitos y Leyendas
    if (!tcgcsvCategoryId(searchCategory, searchLang)) api.getTcgBlocks(searchCategory).then(res => {
      if(!stale && res.success) {
        const sorted = res.data.sort((a, b) => {
          if (a.id === 2) return -1;
          if (b.id === 2) return 1;
          return 0;
        });
        setAvailableBlocks(sorted);
      }
    }).catch(console.error);
    if (!tcgcsvCategoryId(searchCategory, searchLang)) api.getTcgPhysicalProducts().then(res => { if(!stale && res.success) setAvailablePhysicalProducts(res.data); }).catch(console.error);
    if (tcgcsvCategoryId(searchCategory, searchLang)) {
      setAvailableSets([]);
      // Cancelar cualquier carga en curso del idioma anterior y limpiar sus resultados
      pokeGenRef.current++;
      pokeQueueRef.current = [];
      pokeLoadingRef.current = false;
      abortControllerRef.current?.abort();
      setHasMoreGroups(false);
      setRawSearchResults([]);
      setSearchResults([]);
      setIsSearching(false);
      const catId = tcgcsvCategoryId(searchCategory, searchLang);
      // Ediciones sin cartas (solo sellado), generado con scripts/find_empty_tcgcsv_groups.cjs
      catalogJson(`/sets?categoryId=${catId}`)
        .then((local) => {
          if (!Array.isArray(local?.data)) throw new Error('Catálogo local no disponible');
          return { json: { results: local.data }, emptyGroups: {} };
        })
        .then(({ json, emptyGroups }) => {
          if (stale) return;
          const groups = sortCatalogGroupsNewestFirst((json.results || [])
            .filter(g => new Date(g.publishedOn) <= new Date())
            .filter(g => emptyGroups[catId]?.[g.groupId] !== g.modifiedOn));
          setAvailableSets(groups.map(g => ({ groupId: g.groupId, id: g.groupId, name: catId === ONE_PIECE_CATEGORY ? onePieceGroupLabel(g) : catId === MAGIC_CATEGORY ? magicGroupLabel(g) : catId === RIFTBOUND_CATEGORY ? riftboundGroupLabel(g) : catId === YUGIOH_CATEGORY ? yugiohGroupLabel(g) : catId === LORCANA_CATEGORY ? lorcanaGroupLabel(g) : catId === DIGIMON_CATEGORY ? digimonGroupLabel(g) : g.name, isSupplemental: g.isSupplemental, abbreviation: g.abbreviation, publishedOn: g.publishedOn })));
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') {
            console.error('No se pudieron cargar las ediciones locales:', error);
            if (!stale) setAvailableSets([]);
          }
        });
      return () => { stale = true; };
    }
      api.getTcgGroups(searchCategory)
      .then(res => {
        if (!stale && res.success) {
          let sortedSets = res.data.sort((a,b) => new Date(b.publishedOn || 0) - new Date(a.publishedOn || 0));
          
          
          
          setAvailableSets(sortedSets);
          if (sortedSets.length > 0 && !searchSet) {
             // Default to the most recent set or leave empty
          }
        }
      })
      .catch(console.error);
    return () => { stale = true; };
  }, [searchCategory, searchLang]);

  // --- MANEJO DE CATÁLOGO LOGIC ---
  const handleUpdateCard = async (cardIdToUpdate, newPrice, newStock, newLanguage) => {
    try {
      const payload = { price: parseFloat(newPrice), stock: parseInt(newStock) };
      if (newLanguage) payload.data = { language: newLanguage };
      await api.updateCard(id, cardIdToUpdate, payload);
      // Optimistic update locally
      setCards(prev => prev.map(c => c.id === cardIdToUpdate ? {
        ...c,
        price: payload.price,
        stock: payload.stock,
        ...(newLanguage ? { language: newLanguage, data: { ...(c.data || {}), language: newLanguage } } : {}),
      } : c));
      showToast('Carta actualizada correctamente', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'No se pudo actualizar la carta.', 'error');
    }
  };

  // Destacar una carta en el perfil público (el máximo lo fija el plan; el servidor responde con el motivo si no se puede)
  const handleToggleFeatured = async (cardId, featured) => {
    try {
      await api.setCardFeatured(id, cardId, featured);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, featuredAt: featured ? new Date().toISOString() : null } : c));
      showToast(featured ? 'Carta destacada en tu perfil' : 'Carta quitada de tus destacadas', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo destacar la carta.', 'error');
    }
  };

  const handleDeleteRequest = (id) => {
    setConfirmDialog({ show: true, message: '¿Estás seguro de eliminar esta carta del catálogo?', targetId: id });
  };

  const executeDeleteCard = async () => {
    const cardIdToDelete = confirmDialog.targetId;
    setConfirmDialog({ show: false, message: '', targetId: null });
    try {
      await api.deleteCard(id, cardIdToDelete);
      if (true) {
        setCards(cards.filter(c => c.id !== cardIdToDelete));
        showToast('Carta eliminada exitosamente', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Error de conexión al eliminar la carta.', 'error');
    }
  };

  const orderedCatalogCards = sortCatalogCards(cards);

  const filteredCatalog = orderedCatalogCards.filter(card => {
    const normalizedQuery = catQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const normalizedName = (card.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const matchesQuery = catQuery === '' || normalizedName.includes(normalizedQuery);
    const matchesSupertype = true;
    const matchesType = true;
    const matchesSet = catSet === '' 
      ? true 
      : catSet === 'otros' 
        ? !availableSets.some(s => s.name === card.set)
        : availableSets.some(s => s.groupId == catSet && s.name === card.set);
    
    // Client-side MYL filtering
    let matchesMyl = true;
    if (folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') {
      if (mylType && card.extData?.type !== mylType) matchesMyl = false;
      if (mylCost && parseInt(card.extData?.cost) !== parseInt(mylCost)) matchesMyl = false;
        if (searchPhysicalProduct && !(card.physicalProductIds || [card.physicalProductId]).some(id => String(id) === String(searchPhysicalProduct))) matchesMyl = false;
      if (mylRace) {
        if (!card.extData?.race) matchesMyl = false;
        else if (Array.isArray(card.extData.race) && !card.extData.race.includes(mylRace)) matchesMyl = false;
        else if (typeof card.extData.race === 'string' && card.extData.race !== mylRace) matchesMyl = false;
      }
    }
    
    return matchesQuery && matchesSupertype && matchesType && matchesSet && matchesMyl;
  });

  // IMPORTANT: We do NOT pass draggedCatalogCardId or dropCatalogIndex to getPreviewReorderedCards
  // during Grid Mode. If we shift the array live, cards move across <section> boundaries, unmount,
  // and completely destroy the browser's touch/drag event context, causing permanent freezes.
  // The drop target is visually indicated by the 'isDropTarget' CSS highlight instead.
  const previewCatalog = filteredCatalog;

  const inventory = useInventoryTools({ folderId: id, cards, setCards, filteredCatalog, showToast });

  const { getCatalogDragHandleProps, getCatalogDropProps, handleCatalogReorder, saveCatalogOrder } = useCatalogOrder({
    cards, catalogDragScrollSpeedRef, draggedCatalogCardId, fetchCards, filteredCatalog,
    hasUnsavedCatalogOrder, id, isTouchDragRef, moveCatalogDragFloatingPreview, savingCatalogOrder, setCards,
    setCatalogDragFloatingPreview, setDraggedCatalogCardId, setDropCatalogIndex, setHasUnsavedCatalogOrder,
    setSavingCatalogOrder, showToast, touchCatalogCardIdRef, touchCatalogDropIndexRef
  });

  const hasCatalogFilters = Boolean(catQuery || catSet || searchPhysicalProduct || mylType || mylRace || mylCost);

  const clearCatalogFilters = () => {
    setCatQuery('');
    setCatSet('');
    setSearchPhysicalProduct('');
    setMylType('');
    setMylRace('');
    setMylCost('');
    setIsCatSetDropdownOpen(false);
    scrollToTopIfNeeded();
  };

  // Escritorio: cartas por fila elegidas directamente (2, 3, 5 o 9). Teléfono: tres niveles de 1 a 3
  const DESKTOP_COLUMN_OPTIONS = [2, 3, 5, 9];
  const isDesktopGrid = viewportWidth > 768;
  const cycleCatalogGridDensity = () => {
    if (isDesktopGrid) {
      setCatalogDesktopColumns(prev => DESKTOP_COLUMN_OPTIONS[(DESKTOP_COLUMN_OPTIONS.indexOf(prev) + 1) % DESKTOP_COLUMN_OPTIONS.length]);
      return;
    }
    setCatalogGridDensity(prev => (prev >= 3 ? 1 : prev + 1));
  };

  const DESKTOP_GRID_CLASS = { 2: 'grid-cols-[repeat(2,minmax(0,19rem))] justify-center', 3: 'grid-cols-[repeat(3,minmax(0,17rem))] justify-center', 5: 'grid-cols-5', 9: 'grid-cols-9' };
  const catalogGridClass = isDesktopGrid ? DESKTOP_GRID_CLASS[catalogDesktopColumns] : {
    1: 'grid-cols-1 sm:grid-cols-2',
    2: 'grid-cols-2 sm:grid-cols-3',
    3: 'grid-cols-3 sm:grid-cols-4',
  }[catalogGridDensity];
  const catalogGridColumns = isDesktopGrid ? catalogDesktopColumns : [[1, 2], [2, 3], [3, 4]][catalogGridDensity - 1][viewportWidth >= 640 ? 1 : 0];
  const catalogGridDense = isDesktopGrid ? catalogDesktopColumns >= 5 : catalogGridDensity >= 3;

  const fetchOrders = async () => {
    try {
      let all = [];
      let cursor = undefined;
      let more = true;
      while (more) {
        // eslint-disable-next-line no-await-in-loop
        const result = await api.getMyOrders(cursor);
        if (!result.success) break;
        all = all.concat(result.orders || []);
        more = result.hasMore;
        cursor = result.nextCursor;
      }
      setFolderOrders(all.filter(order => order.folderId === id));
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Al confirmar una venta el stock cambió en el servidor: se recargan las cartas
  const handleOrderUpdated = (updated) => {
    window.dispatchEvent(new Event('carpetazo:orders-updated')); // la campana se actualiza al instante
    setFolderOrders(prev => prev.map(o => (o.id === updated.id ? { ...o, status: updated.status, updatedAt: updated.updatedAt } : o)));
    if (updated.status === 'completed') fetchCards();
  };

  const openBuyerPreview = () => {
    window.open(`/c/${id}`, '_blank', 'noopener,noreferrer');
  };

  const copyBuyerLink = async () => {
    if (folderData && !folderData.isPublic) { showToast('Esta carpeta es privada: quien abra el enlace no verá tus cartas ni la vista previa. Hazla pública para compartirla.', 'error'); return; }
    const url = siteUrl(`/c/${id}`);
    warmFolderPreview(id);
    try {
      await navigator.clipboard.writeText(url);
      api.trackMetric('share_folder');
      showToast('Enlace público copiado', 'success');
    } catch (error) {
      console.error(error);
      showToast('No se pudo copiar el enlace.', 'error');
    }
  };

  // --- AGREGAR AL CATÁLOGO LOGIC ---
  useEffect(() => {
    if (isSearching && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSearching(false);
    }
    setHasSearchedAPI(false);
  }, [searchQuery, searchCategory, searchSet]);

  
  useEffect(() => {
    let filtered = rawSearchResults;

    // El texto ya se aplicó al buscar (useCardSearch, o el servidor en Mitos y Leyendas) con tolerancia a apóstrofos, «/» y letras mal escritas;
    // volver a filtrar aquí por el texto exacto escondía esas coincidencias.

    filtered = applyCardFilters(filtered);

    // Custom Sorting for Mitos y Leyendas
    if (searchCategory === '99') {
      const typeOrder = {
        'ORO': 1,
        'ALIADO': 2,
        'TALISMAN': 3,
        'TALISMÁN': 3,
        'TOTEM': 4,
        'TÓTEM': 4,
        'ARMA': 5
      };
      
      const editionOrder = {
        'Espada Sagrada': 1,
        'Helenica': 2,
        'Tierras Altas': 3,
        'Dominios de RA': 4
      };

      
    }

    setSearchResults(filtered);
  }, [rawSearchResults, filterType, filterRarity, searchQuery, mylType, mylRace, mylCost, searchPhysicalProduct, selectedSupertype, selectedType, opFilters, magicFilters, rbFilters, lcFilters, dgFilters, ygFilters]);

  // Si con los filtros actuales no alcanzan resultados para llenar la primera página, seguir cargando ediciones
  useEffect(() => {
    if (isTcgcsvSearch && hasMoreGroups && !isSearching && searchResults.length < PAGE_SIZE) {
      loadMorePokemonRef.current?.();
    }
  }, [searchResults, hasMoreGroups, isSearching, selectedSupertype, selectedType, filterRarity, opFilters, magicFilters, rbFilters, lcFilters, dgFilters, ygFilters]);

  // Al cargar las ediciones de Pokémon con "Todas las ediciones", buscar solo para no dejar la lista en blanco
  useEffect(() => {
    if (isTcgcsvSearch && availableSets.length > 0 && !searchSet && activeTab === 'add' && !loadingFolder) {
      handleSearchAPI({ preventDefault: () => {} });
    }
  }, [availableSets]);

  const [initialSearchTriggered, setInitialSearchTriggered] = useState(false);
  useEffect(() => {
    if (!loadingFolder && searchCategory && !initialSearchTriggered && activeTab === 'add') {
      setInitialSearchTriggered(true);
      handleSearchAPI({ preventDefault: () => {} });
    }
  }, [loadingFolder, searchCategory, initialSearchTriggered, activeTab]);

  const { applyCardFilters, handleSearchAPI, loadMorePokemonRef, pokeGenRef, pokeLoadingRef, pokeQueueRef } = useCardSearch({
    abortControllerRef, activeTab, availableSets, filterRarity, loadingFolder, mylCost, mylRace, mylType, magicFilters, opFilters, rbFilters, lcFilters, dgFilters, ygFilters,
    searchBlock, searchCategory, searchLang, searchPhysicalProduct, searchQuery, searchSet, selectedSupertype,
    selectedType, setAvailableRarities, setFilterRarity, setFilterType, setHasMoreGroups, setHasSearchedAPI,
    setIsSearching, setRawSearchResults, showToast
  });

    const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Sube una imagen válida', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', 'card');
      const uploadResult = await api.uploadImage(formData);
      const imageUrl = uploadResult.url;

      setSelectedCard(prev => {
        if (!prev) return prev;
        const safeId = String(prev.id || prev.productId || prev.tcgProductId || '');
        return {
          ...prev,
          isCustomImage: true,
          id: safeId.includes('-custom-') ? safeId : `${safeId}-custom-${Date.now()}`,
          imageUrl,
          images: {
            ...prev.images,
            large: imageUrl,
            small: imageUrl
          }
        };
      });
    } catch (error) {
      console.error('Error uploading card image:', error);
      showToast('No pudimos subir la imagen a R2', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    const cardStock = parseInt(stock);
    if (!selectedCard || !price || !cardStock) return;
    setIsSaving(true);
    
    try {
      const targetTcgId = storedCardId(folderData?.tcg, normalizeTcgProductId(selectedCard.productId || selectedCard.id || selectedCard.tcgProductId));
      const targetLanguage = isMylFolder ? 'Spanish' : normalizeCardLanguage(language);
      const existingCard = cards.find(c => normalizeTcgProductId(c.tcgId) === targetTcgId && cardLanguageOf(c) === targetLanguage);
      
      if (existingCard) {
        const newStock = existingCard.stock + cardStock;
        const newPrice = parseFloat(price);
        await api.updateCard(id, existingCard.id, { price: newPrice, stock: newStock });
        showToast('¡Carta actualizada (se sumó el stock)!', 'success');
      } else {
        const cardData = {
          tcgId: targetTcgId,
          name: selectedCard.name,
          price: parseFloat(price),
          stock: cardStock,
          imageUrl: selectedCard.imageUrl || '',
          data: {
            pseudoName: isBatchAdding ? '' : pseudoName.trim(),
            set: getCardSetName(selectedCard) || 'Unknown',
            rarity: getExtDataValue(selectedCard.extData, 'Rarity') || getExtDataValue(selectedCard.extData, 'Card Number / Rarity') || getExtDataValue(selectedCard.extData, 'Frequency') || 'Unknown',
            supertype: selectedCard.extData?.magic?.types?.[0] || selectedCard.extData?.rb?.types?.[0] || selectedCard.extData?.ygo?.kind || selectedCard.extData?.lc?.types?.[0] || selectedCard.extData?.dg?.types?.[0] || getExtDataValue(selectedCard.extData, 'Card Type / HP / Stage')?.split(' / ')[0] || getExtDataValue(selectedCard.extData, 'Type') || getExtDataValue(selectedCard.extData, 'CardType') || 'Unknown',
            type: selectedCard.extData?.magic?.colors?.join('') || selectedCard.extData?.rb?.domains?.join('/') || selectedCard.extData?.ygo?.attribute || selectedCard.extData?.lc?.inks?.join('/') || selectedCard.extData?.dg?.colors?.join('/') || getExtDataValue(selectedCard.extData, 'Type') || getExtDataValue(selectedCard.extData, 'Color'),
            race: selectedCard.extData?.magic?.subtypes?.join(' ') || selectedCard.extData?.rb?.tags?.join(' ') || selectedCard.extData?.ygo?.race || selectedCard.extData?.lc?.classes?.join(' ') || selectedCard.extData?.dg?.traits?.join(' ') || getExtDataValue(selectedCard.extData, 'Race'),
            cost: selectedCard.extData?.magic?.mv ?? selectedCard.extData?.rb?.energy ?? selectedCard.extData?.ygo?.level ?? selectedCard.extData?.lc?.cost ?? selectedCard.extData?.dg?.cost ?? getExtDataValue(selectedCard.extData, 'Cost'),
            effect: getExtDataValue(selectedCard.extData, 'Effect'),
            number: getExtDataValue(selectedCard.extData, 'Number') || '',
            total: '',
            language: targetLanguage,
            catalogOrder: cards.length
          }
        };
        await api.addCard(id, cardData);
        showToast('¡Carta guardada en el catálogo exitosamente!', 'success');
        // Primera carta de la carpeta: se invita a publicarla y compartirla (una sola vez por carpeta)
        if (cards.length === 0) {
          let seen = false;
          try {
            seen = Boolean(localStorage.getItem(`carpetazo:share-notice:${id}`));
            localStorage.setItem(`carpetazo:share-notice:${id}`, '1');
          } catch (_error) { /* sin almacenamiento: se avisa igual */ }
          if (!seen) setShareNoticeOpen(true);
        }
      }
      
      if (isBatchAdding) {
        setSelectedQueue(prev => {
          const remaining = prev.filter(item => item.queueId !== activeQueueItemId);
          const nextItem = remaining[0];
          if (nextItem) {
            setActiveQueueItemId(nextItem.queueId);
            setSelectedCard(nextItem.card);
            setStock((nextItem.quantity || 1).toString());
          } else {
            setActiveQueueItemId(null);
            setSelectedCard(null);
            setStock('1');
            setMultiSelectMode(false);
          }
          return remaining;
        });
        setPrice('');
        setPseudoName('');
      } else {
        setSelectedCard(null);
      }
      fetchCards();
      
      if (!isBatchAdding || selectedQueue.length <= 1) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || 'No se pudo guardar la carta', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCardTcgId = selectedCard
    ? storedCardId(folderData?.tcg, normalizeTcgProductId(selectedCard.productId || selectedCard.id || selectedCard.tcgProductId))
    : null;
  const selectedCardLanguage = isMylFolder ? 'Spanish' : normalizeCardLanguage(language);
  const selectedExistingCard = selectedCardTcgId
    ? cards.find(c => normalizeTcgProductId(c.tcgId) === selectedCardTcgId && cardLanguageOf(c) === selectedCardLanguage)
    : null;

  if (loadingFolder) {
    return (
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border-x border-gray-300 flex flex-col items-center justify-center relative z-10 min-h-[calc(100svh-80px)] bg-[#DBEAFE]">
          <LoadingState variant="page" label="Abriendo la carpeta…" />
        </div>
      </div>
    );
  }
  if (!folderData) return (
    <div className="relative z-10 flex min-h-[calc(100svh-80px)] w-full flex-col items-center justify-center bg-[#DBEAFE] p-6">
      <EmptyState icon="folder_off" title="No pudimos abrir esta carpeta" action={{ label: 'Volver a mis carpetas', onClick: () => navigate('/dashboard') }} className="max-w-md">
        Puede que ya no exista o que haya un problema de conexión. Revisa tu conexión e inténtalo de nuevo.
      </EmptyState>
    </div>
  );

  const folderSalesTabProps = { cards, copyBuyerLink, folderId: id, folderOrders, handleOrderUpdated, isActive: activeTab === 'sales', ordersLoading, salesView,
    setCards, setSalesView, setInPersonToolbarVisible, showScrollTop, showToast };

  const folderCatalogTabProps = { availableSets, cards, catQuery, catSet, catalogDragFloatingPreview,
    catalogDragFloatingPreviewRef, cardDetailsMode, catalogGridClass, catalogGridColumns, catalogGridDense, catalogViewMode,
    clearCatalogFilters, currentFolderId: id, inventory, copyBuyerLink, cycleCardDetailsMode, cycleCatalogGridDensity, draggedCatalogCardId, dropCatalogIndex,
    filteredCatSets, filteredCatalog, folderData, getCatalogDragHandleProps, getCatalogDropProps,
    handleCatalogReorder, handleDeleteRequest, handleToggleFeatured, handleUpdateCard, hasCatalogFilters, hasUnsavedCatalogOrder,
    isCatSetDropdownOpen, isMylFolder, openBuyerPreview, previewCatalog, saveCatalogOrder, savingCatalogOrder,
    scrollToTopIfNeeded, setActiveTab, setCatQuery, setCatSet, setCatalogViewMode, setIsCatSetDropdownOpen,
    showScrollTop };

  const folderAddTabProps = { activeQueueItemId, availableBlocks, availablePhysicalProducts, availableRarities,
    availableSets, decreaseQueueItemQuantity, fileInputRef, filterCounts, filterRarity, filterType,
    filteredSearchSets, folderData, getCardSelectionKey, getCardSetName, getProxyImageUrl, gridCols,
    handleImageUpload, handleResultCardClick, handleRightClickResultCard, handleSaveCard, handleSearchAPI,
    hasMoreGroups, hasSearchedAPI, isBatchAdding, isMylFolder, isSaving, isSearching, isSetDropdownOpen, language,
    multiSelectMode, mylCost, mylRace, mylType, magicFilters, observerTarget, opFilters, price, rbFilters, lcFilters, dgFilters, ygFilters, pseudoName, queueScrollRef, removeQueueItem,
    resetCardForm, scrollToTopIfNeeded, searchBlock, searchCategory, searchLang, searchPhysicalProduct, searchQuery,
    searchResults, searchSet, selectedCard, selectedExistingCard, selectedQueue, selectedQueueCountByCard,
    selectedSupertype, selectedType, setActiveQueueItemId, setFilterRarity, setFilterType, setGridCols,
    setIsSetDropdownOpen, setLanguage, setMylCost, setMylRace, setMagicFilters, setMylType, setOpFilters, setPrice, setRbFilters, setLcFilters, setDgFilters, setYgFilters, setPseudoName, setSearchBlock,
    setSearchLang, setSearchPhysicalProduct, setSearchQuery: handleSearchQueryChange, setSearchSet, setSelectedCard, setSelectedQueue,
    setSelectedSupertype, setSelectedType, setShowCardDetails, setStock, showCardDetails, showScrollTop,
    startQueuedAdd, stock, toggleMultiSelectMode, totalQueuedCards, visibleCount, cardsCount: cards.length };

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border-x border-gray-300 flex flex-col relative z-10 min-h-[calc(100svh-80px)] bg-[#DBEAFE]">
          <div className="relative z-20 flex flex-1 flex-col px-3 py-4 text-gray-900 sm:px-8 sm:py-5">
      <div className="mb-3 flex items-center gap-2 border-b border-gray-300 pb-3 sm:gap-4">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100 hover:text-[#1e40af] sm:h-10 sm:w-10"
          title="Volver a mis carpetas"
        >
          <SvgIcon name="arrow_back" translate="no" className="text-xl" />
        </button>
        <h1 className="m-0 truncate text-2xl font-black leading-tight text-[#1a2b4b] sm:text-4xl">Carpeta: {folderData.name}</h1>
        <HelpTip topic={activeTab === 'add' ? 'folderAdd' : activeTab === 'catalog' ? 'folderCatalog' : { presencial: 'folderPresencial', solicitudes: 'folderSolicitudes', historial: 'folderHistorial' }[salesView]} />
      </div>

      {/* Tabs */}
      <div className="mb-3 border-b border-gray-300 sm:mb-4">
        <LiquidTabs
          ariaLabel="Secciones de la carpeta"
          className="gap-1"
          buttonClassName="flex items-center justify-center gap-1 rounded-t-xl bg-gray-50/50 px-2 py-3 font-bold hover:bg-gray-100 sm:gap-2 sm:px-6"
          indicatorClassName="rounded-t-xl border-b-4 border-[#1e40af] bg-white shadow-sm"
          activeTextClassName="!bg-transparent text-[#1e40af] hover:!bg-transparent"
          inactiveTextClassName="text-gray-500"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'add', icon: 'add_circle', label: 'Agregar Cartas' },
            { value: 'catalog', icon: 'auto_stories', label: 'Carpeta' },
            { value: 'sales', icon: 'receipt_long', label: 'Ventas' },
          ].map(t => ({
            value: t.value,
            label: (
              <>
                <SvgIcon name={t.icon} translate="no" className="text-[18px] sm:text-[24px]" />
                <span className="text-xs sm:text-sm">{t.label}</span>
              </>
            ),
          }))}
        />
      </div>

      {/* Tab Content */}
      <div>
        {mountedTabs.catalog && <KeepAlive active={activeTab === 'catalog'}><FolderCatalogTab {...folderCatalogTabProps} /></KeepAlive>}
        {mountedTabs.add && <KeepAlive active={activeTab === 'add'}><FolderAddTab {...folderAddTabProps} /></KeepAlive>}
        {mountedTabs.sales && <KeepAlive active={activeTab === 'sales'}><FolderSalesTab {...folderSalesTabProps} /></KeepAlive>}
        
      </div>

      
      <ConfirmModal 
        isOpen={confirmDialog.show} 
        title="Confirmar Acción" 
        message={confirmDialog.message} 
        onConfirm={executeDeleteCard} 
        onCancel={() => setConfirmDialog({ show: false, message: '', targetId: null })}
      />
          </div>
        </div>
      </div>
    
      {/* Scroll to top button */}
      {showScrollTop && !inPersonToolbarVisible && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] bg-[#1e40af] text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-800 transition-all z-50 flex items-center justify-center transform hover:scale-110 active:scale-95 border-2 border-white/20 lg:hidden"
          aria-label="Volver arriba"
        >
          <SvgIcon name="arrow_upward" translate="no" className="text-2xl" />
        </button>
      )}
      {shareNoticeOpen && !isBatchAdding && (
        <FolderShareNotice
          folder={{ id, name: folderData.name, isPublic: folderData.isPublic }}
          onPublished={() => setFolderData((prev) => ({ ...prev, isPublic: true }))}
          onClose={() => setShareNoticeOpen(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}


