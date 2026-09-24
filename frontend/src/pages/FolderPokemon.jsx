import { useState, useEffect, useRef } from 'react';

import React from 'react';
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); console.error(error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'white', color: 'red', zIndex: 9999, position: 'fixed', inset: 0, overflow: 'auto' }}>
          <h1>React Crashed!</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}


import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { api } from '../utils/api';

import Filters from '../components/Filters';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import AlbumView from '../components/AlbumView';
const API_BASE = import.meta.env.VITE_API_URL || '';
const CATALOG_CARDS_PER_PAGE = 9;
const DRAG_SCROLL_EDGE_PX = 120;
const DRAG_SCROLL_MAX_SPEED = 28;

const getCatalogOrderValue = (card, fallbackIndex = 0) => {
  const value = Number(card?.catalogOrder);
  return Number.isFinite(value) ? value : fallbackIndex + 100000;
};

const sortCatalogCards = (cardArray = []) => (
  [...cardArray].sort((a, b) => {
    const orderDiff = getCatalogOrderValue(a) - getCatalogOrderValue(b);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  })
);

const chunkCardsByPage = (cardArray = []) => {
  const pages = [];
  for (let i = 0; i < cardArray.length; i += CATALOG_CARDS_PER_PAGE) {
    pages.push(cardArray.slice(i, i + CATALOG_CARDS_PER_PAGE));
  }
  return pages;
};

const getPreviewReorderedCards = (cardArray = [], dragCardId, targetIndex) => {
  if (!dragCardId || targetIndex === null || targetIndex === undefined) return cardArray;
  const fromIndex = cardArray.findIndex(card => card.id === dragCardId);
  if (fromIndex < 0) return cardArray;

  const nextCards = [...cardArray];
  const [movedCard] = nextCards.splice(fromIndex, 1);
  const dropIndex = Math.min(Math.max(Number(targetIndex), 0), nextCards.length);
  nextCards.splice(dropIndex, 0, movedCard);
  return nextCards;
};

const AdminCardEdit = React.memo(({ card, onUpdate, onDelete, dragHandleProps = {}, compact = false }) => {
  const [price, setPrice] = useState(card.price);
  const [stock, setStock] = useState(card.stock);
  const [saving, setSaving] = useState(false);

  // Sync state if card updates externally
  useEffect(() => {
    setPrice(card.price);
    setStock(card.stock);
  }, [card.price, card.stock]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(card.id, price, stock);
    setSaving(false);
  };

  const hasChanges = price != card.price || stock != card.stock;

  return (
    <div className="bg-blue-50 rounded-2xl border border-gray-200 flex flex-col shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
      <div
        {...dragHandleProps}
        className={`${compact ? 'top-1.5 left-1.5 w-7 h-7' : 'top-2 left-2 w-8 h-8'} absolute z-10 rounded-full bg-white/90 text-[#1e40af] shadow-sm border border-blue-100 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-100 transition-opacity`}
        style={{ touchAction: 'none' }}
        title="Mantén y arrastra para ordenar"
      >
        <span translate="no" className="material-symbols-outlined text-[18px]">drag_indicator</span>
      </div>
      <button 
        onClick={() => onDelete(card.id)}
        className={`${compact ? 'top-1.5 right-1.5 w-7 h-7' : 'top-2 right-2 w-8 h-8'} absolute z-10 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm`}
        title="Eliminar carta"
      >
        <span translate="no" className="material-symbols-outlined text-[18px]">delete</span>
      </button>
      <div className={`${compact ? 'p-2.5' : 'p-4'} flex flex-col items-center flex-1`}>
        <div className={`w-full relative pt-[140%] ${compact ? 'mb-2' : 'mb-3'}`}>
          <img src={card.imageUrl} referrerPolicy="no-referrer" referrerPolicy="no-referrer" referrerPolicy="no-referrer" alt={card.name} className="absolute inset-0 w-full h-full object-fill filter drop-shadow-md transition-transform duration-300" />
        </div>
        <p className={`font-bold text-gray-900 text-center line-clamp-1 w-full ${compact ? 'text-xs' : 'text-sm'}`}>{card.name}</p>
        <p className={`text-[10px] text-gray-500 text-center truncate w-full ${compact ? 'mb-2' : 'mb-4'}`}>
          {compact ? card.set : (
            <>
              {card.set} • {card.supertype} • #{(() => {
                let numStr = (card.number || card.apiId?.split('-')[1] || card.id?.split('-')[1] || '').toString();
                let totalStr = (card.total || '---').toString();
                if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
                if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
                return `${numStr}/${totalStr}`;
              })()}
            </>
          )}
        </p>
        
        <div className={`${compact ? 'gap-1.5' : 'gap-2'} flex flex-col w-full mt-auto`}>
           <div className={`w-full bg-gray-50 px-2 ${compact ? 'py-1.5' : 'py-1.5'} rounded-lg border border-gray-200 shadow-sm ${compact ? 'flex flex-col gap-1' : 'flex justify-between items-center'}`}>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Stock</label>
              <div className={`${compact ? 'w-full' : ''} flex items-center shadow-sm rounded-md overflow-hidden border border-gray-300`}>
                <button type="button" onClick={() => setStock(Math.max(0, parseInt(stock) - 1))} className={`${compact ? 'w-8' : 'w-6'} h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors font-black text-sm text-gray-700`}>-</button>
                <input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} className={`${compact ? 'flex-1 min-w-0' : 'w-10'} h-7 text-center bg-white focus:outline-none px-0 text-xs font-bold border-x border-gray-300 text-gray-900`}/>
                <button type="button" onClick={() => setStock(parseInt(stock) + 1)} className={`${compact ? 'w-8' : 'w-6'} h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors font-black text-sm text-gray-700`}>+</button>
              </div>
           </div>
           <div className={`w-full bg-gray-50 px-2 ${compact ? 'py-1.5' : 'py-1.5'} rounded-lg border border-gray-200 shadow-sm ${compact ? 'flex flex-col gap-1' : 'flex justify-between items-center'}`}>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Precio</label>
              <div className={`relative ${compact ? 'w-full' : 'w-24'}`}>
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">$</span>
                <input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} className="w-full h-7 pl-6 pr-2 bg-white focus:outline-none text-xs font-bold rounded-md border border-gray-300 shadow-sm text-right text-gray-900"/>
              </div>
           </div>
        </div>
      </div>
      
      <button 
        onClick={handleSave} 
        disabled={saving || !hasChanges} 
        className={`w-full ${compact ? 'py-2' : 'py-3'} font-bold text-xs tracking-wide transition-colors border-t border-gray-200 flex items-center justify-center gap-1.5 ` + (hasChanges ? 'bg-[#1e40af] text-white hover:bg-blue-800' : 'bg-gray-100 text-gray-500 opacity-60')}
      >
        <span translate="no" className="material-symbols-outlined text-[16px]">{saving ? 'hourglass_empty' : 'save'}</span>
        {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado'}
      </button>
    </div>
  );
}, (prev, next) => prev.card === next.card && prev.compact === next.compact);

function FolderPokemonInner() {

  const getProxyImageUrl = (productId, originalUrl) => {
    if (!originalUrl) return '';
    if (originalUrl.includes('api.carpetazo.cl/images') || originalUrl.includes('r2.dev') || originalUrl.includes('imagenes.carpetazo.cl')) return originalUrl;
    if (originalUrl.startsWith('blob:')) return originalUrl;
    if (originalUrl.startsWith('data:')) return originalUrl;
    return `https://api.carpetazo.cl/api/proxy-image?productId=${productId}`;
  };

  const { id } = useParams();
  const navigate = useNavigate();
  const [folderData, setFolderData] = useState(null);
  const [loadingFolder, setLoadingFolder] = useState(true);
  
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'catalog', 'sales'

  // --- ADD TO CATALOG STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState(typeof window !== 'undefined' && window.innerWidth <= 768 ? 2 : 3);
  const [searchCategory, setSearchCategory] = useState('3');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [searchSet, setSearchSet] = useState('');
  const [availableSets, setAvailableSets] = useState([]);
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
      if (window.innerWidth > 768 && gridCols === 1) {
        setGridCols(3);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridCols]);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearchedAPI, setHasSearchedAPI] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('');
  const [availableRarities, setAvailableRarities] = useState([]);
  const [rawSearchResults, setRawSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState([]);
  const [activeQueueItemId, setActiveQueueItemId] = useState(null);
  const [price, setPrice] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const isMylFolder = folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99';

  const scrollToTopIfNeeded = () => {
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getCardSelectionKey = (card) => String(card?.productId || card?.tcgProductId || card?.id || card?.name || '');
  const isBatchAdding = activeQueueItemId !== null;
  const selectedQueueCountByCard = selectedQueue.reduce((acc, item) => {
    const key = getCardSelectionKey(item.card);
    acc[key] = (acc[key] || 0) + (item.quantity || 1);
    return acc;
  }, {});
  const totalQueuedCards = selectedQueue.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const resetCardForm = () => {
    setPrice('');
    setStock('');
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

  useEffect(() => {
    setVisibleCount(30);
  }, [searchResults]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 30);
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
  }, [searchResults, visibleCount]);
  const [stock, setStock] = useState('');
  const [pseudoName, setPseudoName] = useState('');
  const [language, setLanguage] = useState('English');
  const [isSaving, setIsSaving] = useState(false);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const queueScrollRef = useRef(null);

  // --- UI STATE ---
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const showToast = (message, type = 'info') => setToast({ message, type });
  
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', targetId: null });

  // --- CATALOG MANAGEMENT STATE ---
  
  const [catQuery, setCatQuery] = useState('');
  const [catSet, setCatSet] = useState('');
  const [catalogViewMode, setCatalogViewMode] = useState('grid');
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
  const [pendingOrders, setPendingOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [cards, setCards] = useState([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

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
        window.scrollBy({ top: speed, left: 0, behavior: 'auto' });
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
      try {
        const res = await api.getFolder(id);
        if (res.success && res.folder) {
          setFolderData(res.folder);
          // Set searchCategory based on the folder's TCG
          const tcgMap = {
            'Pokemon': '3',
            'YuGiOh': '2',
            'Magic': '1',
            'Mitos y Leyendas': '99',
            'OnePiece': '62'
          };
          if (res.folder.tcg && tcgMap[res.folder.tcg]) {
            setSearchCategory(tcgMap[res.folder.tcg]);
          }
          const mappedCards = sortCatalogCards((res.folder.cards || []).map(c => ({ ...c, ...(c.data || {}), data: c.data || {} })));
          setCards(mappedCards);
          setHasUnsavedCatalogOrder(false);
        }
      } catch (e) { console.error(e); } finally { setLoadingFolder(false); }
    };
    init();
  }, [id]);

  // Categories and Sets caching
  useEffect(() => {
    api.getTcgCategories()
      .then(res => {
        if (res.success) setAvailableCategories(res.data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!searchCategory) {
      setAvailableSets([]);
      setSearchSet('');
      return;
    }
    api.getTcgPhysicalProducts().then(res => { if(res.success) setAvailablePhysicalProducts(res.data); }).catch(console.error);
      api.getTcgGroups(searchCategory)
      .then(res => {
        if (res.success) {
          let sortedSets = res.data.sort((a,b) => new Date(b.publishedOn || 0) - new Date(a.publishedOn || 0));
          
          if (searchCategory === '99') {
            const allowedSets = ['Hijos de Daana', 'Espada Sagrada', 'Helénica', 'Dominios de RA', 'Drácula e Inferno'];
              sortedSets = allowedSets.map(name => sortedSets.find(s => s.name === name)).filter(Boolean);
          }
          
          setAvailableSets(sortedSets);
          if (sortedSets.length > 0 && !searchSet) {
             // Default to the most recent set or leave empty
          }
        }
      })
      .catch(console.error);
  }, [searchCategory]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') setIsAuthenticated(true);
    else showToast('Contraseña incorrecta', 'error');
  };

  // --- MANEJO DE CATÁLOGO LOGIC ---
  const handleUpdateCard = async (cardIdToUpdate, newPrice, newStock) => {
    try {
      await api.updateCard(id, cardIdToUpdate, { price: parseFloat(newPrice), stock: parseInt(newStock) });
      // Optimistic update locally
      setCards(cards.map(c => c.id === cardIdToUpdate ? { ...c, price: parseFloat(newPrice), stock: parseInt(newStock) } : c));
      showToast('Carta actualizada correctamente', 'success');
    } catch (error) {
      console.error(error);
      showToast('Error de conexión al actualizar la carta.', 'error');
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
    const matchesQuery = catQuery === '' || card.name.toLowerCase().includes(catQuery.toLowerCase());
    const matchesSupertype = true;
    const matchesType = true;
    const matchesSet = catSet === '' 
      ? true 
      : catSet === 'otros' 
        ? !availableSets.some(s => s.name === card.set)
        : card.set === availableSets.find(s => s.id === catSet)?.name;
    
    // Client-side MYL filtering
    let matchesMyl = true;
    if (folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') {
      if (mylType && card.extData?.type !== mylType) matchesMyl = false;
      if (mylCost && parseInt(card.extData?.cost) !== parseInt(mylCost)) matchesMyl = false;
        if (searchPhysicalProduct && String(card.physicalProductId) !== String(searchPhysicalProduct)) matchesMyl = false;
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
  const catalogPages = chunkCardsByPage(previewCatalog);

  const saveCatalogOrder = async () => {
    const nextCards = sortCatalogCards(cards);
    if (!hasUnsavedCatalogOrder || savingCatalogOrder) return;

    setSavingCatalogOrder(true);
    try {
      await Promise.all(nextCards.map((card, index) => (
        api.updateCard(id, card.id, {
          data: {
            ...(card.data || {}),
            catalogOrder: index
          }
        })
      )));
      setHasUnsavedCatalogOrder(false);
      showToast('Orden actualizado correctamente', 'success');
    } catch (error) {
      console.error(error);
      showToast('No se pudo guardar el nuevo orden.', 'error');
      fetchCards();
    } finally {
      setSavingCatalogOrder(false);
    }
  };

  const handleCatalogReorder = (dragCardId, targetVisibleIndex) => {
    if (!dragCardId || targetVisibleIndex === null || targetVisibleIndex === undefined) return;

    const visibleCards = filteredCatalog;
    const targetCard = visibleCards[targetVisibleIndex] || null;
    if (targetCard?.id === dragCardId) return;

    const currentOrdered = sortCatalogCards(cards);
    const fromIndex = currentOrdered.findIndex(card => card.id === dragCardId);
    const toIndex = targetCard
      ? currentOrdered.findIndex(card => card.id === targetCard.id)
      : currentOrdered.length;
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const nextOrdered = [...currentOrdered];
    const [movedCard] = nextOrdered.splice(fromIndex, 1);
    const dropIndex = Math.min(toIndex, nextOrdered.length);
    nextOrdered.splice(dropIndex, 0, movedCard);

    const reorderedCards = nextOrdered.map((card, index) => ({
      ...card,
      catalogOrder: index,
      data: {
        ...(card.data || {}),
        catalogOrder: index
      }
    }));

    setCards(reorderedCards);
    setHasUnsavedCatalogOrder(true);
    setDraggedCatalogCardId(null);
    setDropCatalogIndex(null);
  };

  const getCatalogDragHandleProps = (card, visibleIndex) => ({
    draggable: !savingCatalogOrder,
    onDragStart: (event) => {
      if (isTouchDragRef.current) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
      const emptyImg = new Image(); emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      event.dataTransfer.setDragImage(emptyImg, 0, 0);
      setDraggedCatalogCardId(card.id);
      setCatalogDragFloatingPreview({ card });
      requestAnimationFrame(() => moveCatalogDragFloatingPreview(event.clientX, event.clientY));
      setDropCatalogIndex(visibleIndex);
    },
    onDragEnd: () => {
      setDraggedCatalogCardId(null);
      setCatalogDragFloatingPreview(null);
      setDropCatalogIndex(null);
    },
    onTouchStart: (event) => {
      if (savingCatalogOrder) return;
      isTouchDragRef.current = true;
      event.stopPropagation();
      touchCatalogCardIdRef.current = card.id;
      setDraggedCatalogCardId(card.id);
      const startTouch = event.touches?.[0];
      setCatalogDragFloatingPreview({ card });
      if (startTouch) requestAnimationFrame(() => moveCatalogDragFloatingPreview(startTouch.clientX, startTouch.clientY));
      setDropCatalogIndex(visibleIndex);
      touchCatalogDropIndexRef.current = visibleIndex;

      const handleTouchMove = (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        if (e.cancelable) e.preventDefault(); // Prevent native scroll to stop touchcancel
        moveCatalogDragFloatingPreview(touch.clientX, touch.clientY);

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        if (touch.clientY < DRAG_SCROLL_EDGE_PX) {
          const intensity = (DRAG_SCROLL_EDGE_PX - touch.clientY) / DRAG_SCROLL_EDGE_PX;
          catalogDragScrollSpeedRef.current = -Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
        } else if (touch.clientY > viewportHeight - DRAG_SCROLL_EDGE_PX) {
          const intensity = (touch.clientY - (viewportHeight - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX;
          catalogDragScrollSpeedRef.current = Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
        } else {
          catalogDragScrollSpeedRef.current = 0;
        }

        const dropEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest?.('[data-catalog-drop-index]');
        if (dropEl?.dataset?.catalogDropIndex !== undefined) {
          const nextIndex = Number(dropEl.dataset.catalogDropIndex);
          if (Number.isFinite(nextIndex)) {
            if (touchCatalogDropIndexRef.current !== nextIndex) {
              touchCatalogDropIndexRef.current = nextIndex;
              setDropCatalogIndex(nextIndex);
            }
          }
        }
      };

      const handleTouchEnd = () => {
        const targetIndex = touchCatalogDropIndexRef.current;
        const dragId = touchCatalogCardIdRef.current;
        if (dragId && Number.isFinite(targetIndex)) {
          handleCatalogReorder(dragId, targetIndex);
        }
        cleanup();
      };

      const cleanup = () => {
        isTouchDragRef.current = false;
        catalogDragScrollSpeedRef.current = 0;
        touchCatalogCardIdRef.current = null;
        touchCatalogDropIndexRef.current = null;
        setDraggedCatalogCardId(null);
        setCatalogDragFloatingPreview(null);
        setDropCatalogIndex(null);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', cleanup);
      };

      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', cleanup);
    }
  });

  const getCatalogDropProps = (visibleIndex) => ({
    onDragEnter: (event) => {
      event.preventDefault();
      setDropCatalogIndex(visibleIndex);
    },
    onDragOver: (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropCatalogIndex(visibleIndex);
    },
    onDrop: (event) => {
      event.preventDefault();
      const dragId = event.dataTransfer.getData('text/plain') || draggedCatalogCardId;
      setCatalogDragFloatingPreview(null);
      handleCatalogReorder(dragId, visibleIndex);
    }
  });

  const renderCatalogTab = () => (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 mb-6">
        <span translate="no" className="material-symbols-outlined text-[#1e40af]">inventory_2</span>
        Inventario Actual
      </h2>
      
      {/* Buscador Local */}
      <div className="flex flex-col gap-4 mb-8 bg-gray-50/50 p-4 rounded-xl border border-gray-200">
        <input 
          type="text" 
          value={catQuery}
          onChange={(e) => { setCatQuery(e.target.value); scrollToTopIfNeeded(); }}
          placeholder="Buscar por nombre en tu catálogo..."
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]"
        />
        
        <div className="w-full">
            <div className="relative w-full h-full">
              <div 
                className="w-full h-full px-3 py-1.5 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 cursor-pointer flex justify-between items-center transition-all hover:border-[#1e40af]"
                onClick={() => setIsCatSetDropdownOpen(!isCatSetDropdownOpen)}
              >
                <span className="truncate font-bold text-sm lg:text-xs">
                  {catSet === '' ? 'Todas las ediciones' :  availableSets.find(s => s.id === catSet)?.name || 'Seleccionado'}
                </span>
                <span translate="no" className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
              </div>
              
              {isCatSetDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setIsCatSetDropdownOpen(false)}></div>
                  <div className="absolute z-[110] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    <div 
                      className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${catSet === '' ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`}
                      onClick={() => { setCatSet(''); setIsCatSetDropdownOpen(false); scrollToTopIfNeeded(); }}
                    >
                      {catSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                      <span className={catSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                    </div>
                    
                    {filteredCatSets.map(set => (
                      <div 
                        key={set.id}
                        className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${catSet === set.id ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`}
                        onClick={() => { setCatSet(set.id); setIsCatSetDropdownOpen(false); scrollToTopIfNeeded(); }}
                      >
                        {catSet === set.id && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                        <span className={catSet !== set.id ? 'ml-6' : ''}>{set.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
        </div>
      </div>

      <div className="fixed bottom-[5.75rem] right-6 z-[1200] flex justify-end md:static md:mb-6 md:border-b md:border-gray-100 md:pb-4">
        <div className="w-14 bg-white/95 p-1 rounded-full flex flex-col items-center shadow-2xl ring-4 ring-white/70 backdrop-blur md:w-auto md:flex-row md:items-center md:rounded-xl md:bg-gray-100 md:shadow-inner md:ring-0 md:backdrop-blur-0">
          <button
            type="button"
            onClick={() => setCatalogViewMode('album')}
            className={`h-12 w-12 rounded-full text-xs font-bold transition-all flex items-center justify-center md:h-auto md:w-auto md:gap-2 md:rounded-lg md:px-4 md:py-2 md:text-sm ${
              catalogViewMode === 'album'
                ? 'bg-[#1e40af] text-white shadow-md md:bg-white md:text-[#1e40af] md:shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span translate="no" className="material-symbols-outlined text-[21px] md:text-[18px]">auto_stories</span>
            <span className="sr-only md:not-sr-only">Álbum</span>
          </button>
          <button
            type="button"
            onClick={() => setCatalogViewMode('grid')}
            className={`h-12 w-12 rounded-full text-xs font-bold transition-all flex items-center justify-center md:h-auto md:w-auto md:gap-2 md:rounded-lg md:px-4 md:py-2 md:text-sm ${
              catalogViewMode === 'grid'
                ? 'bg-[#1e40af] text-white shadow-md md:bg-white md:text-[#1e40af] md:shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span translate="no" className="material-symbols-outlined text-[21px] md:text-[18px]">grid_view</span>
            <span className="sr-only md:not-sr-only">Cuadrícula</span>
          </button>
        </div>
      </div>

      {hasUnsavedCatalogOrder && (
        <div className="fixed bottom-6 right-[5.75rem] z-[1200] md:bottom-8 md:right-8">
          <button
            type="button"
            onClick={saveCatalogOrder}
            disabled={savingCatalogOrder}
            className="inline-flex h-14 whitespace-nowrap items-center gap-2 rounded-full bg-[#1e40af] px-4 text-xs font-black text-white shadow-2xl ring-4 ring-white/70 transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:text-sm"
          >
            <span translate="no" className="material-symbols-outlined text-[20px]">
              {savingCatalogOrder ? 'hourglass_empty' : 'save'}
            </span>
            <span className="hidden min-[360px]:inline">
              {savingCatalogOrder ? 'Guardando posiciones...' : 'Guardar posiciones'}
            </span>
            <span className="min-[360px]:hidden">
              {savingCatalogOrder ? 'Guardando...' : 'Guardar'}
            </span>
          </button>
        </div>
      )}

      {filteredCatalog.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant flex flex-col items-center">
            <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-30">search_off</span>
            <p>No se encontraron cartas que coincidan con los filtros.</p>
        </div>
      ) : catalogViewMode === 'album' ? (
        <div className="rounded-2xl bg-[#dbeafe] py-6 overflow-hidden">
          <AlbumView
            tcg={folderData?.tcg}
            cards={previewCatalog}
            binderColor={folderData?.color || '#2f7336'}
            emptyMessage="No se encontraron cartas que coincidan con los filtros."
            reorderEnabled={!savingCatalogOrder}
            onReorderCard={handleCatalogReorder}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {savingCatalogOrder && (
            <div className="sticky top-24 z-20 mx-auto w-fit rounded-full bg-[#1e40af] px-4 py-2 text-sm font-bold text-white shadow-lg">
              Guardando nuevo orden...
            </div>
          )}

          {catalogPages.map((pageCards, pageIndex) => (
            <section
              key={`catalog-page-${pageIndex}`}
              className="rounded-3xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-blue-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-[#1a2b4b]">Página {pageIndex + 1}</h3>
                  <p className="text-xs font-medium text-gray-500">
                    Estas {pageCards.length} carta{pageCards.length === 1 ? '' : 's'} se verán juntas en esta página del álbum.
                  </p>
                </div>
                <span className="rounded-full bg-[#1e40af] px-3 py-1 text-xs font-bold text-white">
                  {pageCards.length}/{CATALOG_CARDS_PER_PAGE}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 xl:gap-4">
                {pageCards.map((card, cardIndex) => {
                  const visibleIndex = pageIndex * CATALOG_CARDS_PER_PAGE + cardIndex;
                  const isDragging = draggedCatalogCardId === card.id;
                  const isDropTarget = dropCatalogIndex === visibleIndex && draggedCatalogCardId && draggedCatalogCardId !== card.id;

                  return (
                    <div
                      key={card.id || `catalog-${visibleIndex}`}
                      data-catalog-drop-index={visibleIndex}
                      {...getCatalogDropProps(visibleIndex)}
                      className={`rounded-2xl transition-all ${
                        isDragging ? 'ring-4 ring-emerald-400/80 bg-emerald-50/80 scale-[1.02]' : ''
                      } ${
                        isDropTarget ? 'ring-4 ring-[#1e40af]/30 bg-blue-100/70 scale-[1.02]' : ''
                      }`}
                    >
                      <AdminCardEdit
                        card={card}
                        onUpdate={handleUpdateCard}
                        onDelete={handleDeleteRequest}
                        dragHandleProps={getCatalogDragHandleProps(card, visibleIndex)}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {catalogDragFloatingPreview && (
        <div
          ref={catalogDragFloatingPreviewRef}
          className="fixed top-0 left-0 z-[5000] pointer-events-none -translate-x-1/2 -translate-y-1/2 will-change-transform"
        >
          <div className="relative w-24 md:w-32 rotate-3 scale-105 rounded-xl bg-black/80 p-1 shadow-xl ring-2 ring-white/30">
            <img
              src={catalogDragFloatingPreview.card.imageUrl}
              alt={catalogDragFloatingPreview.card.name}
              className="block w-full rounded-[5%] object-contain opacity-90"
            />
            <div className="absolute -top-2 -right-2 rounded-full bg-black px-2.5 py-1 text-xs font-black text-white shadow ring-2 ring-white/30">
              x{catalogDragFloatingPreview.card.stock || 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );

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

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.cleanName && c.cleanName.toLowerCase().includes(q)) ||
        (c.extData && Array.isArray(c.extData) && c.extData.some(x => (x.name === 'Number' || x.name === 'Card Number / Rarity') && x.value && x.value.toLowerCase().includes(q)))
      );
    }

    if (filterType !== 'all') {
      const sealedKeywords = ['booster', 'box', 'pack', 'deck', 'case', 'blister', 'display', 'collection', 'tin', 'elite trainer', 'bundle', 'kit', 'theme', 'starter'];
      filtered = filtered.filter(c => {
        const lowerName = (c.name || '').toLowerCase();
        const isSealed = sealedKeywords.some(kw => lowerName.includes(kw));
        return filterType === 'sealed' ? isSealed : !isSealed;
      });
    }

    if (filterRarity) {
      filtered = filtered.filter(c => {
        if (!c.extData || !Array.isArray(c.extData)) return false;
        const rObj = c.extData.find(x => x.name === 'Rarity' || x.name === 'Card Number / Rarity');
        return rObj && rObj.value === filterRarity;
      });
    }

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
  }, [rawSearchResults, filterType, filterRarity, searchQuery, mylType, mylRace, mylCost, searchPhysicalProduct]);


  const [initialSearchTriggered, setInitialSearchTriggered] = useState(false);
  useEffect(() => {
    if (!loadingFolder && searchCategory && !initialSearchTriggered && activeTab === 'add') {
      setInitialSearchTriggered(true);
      handleSearchAPI({ preventDefault: () => {} });
    }
  }, [loadingFolder, searchCategory, initialSearchTriggered, activeTab]);

  const handleSearchAPI = async (e) => {
    e.preventDefault();
    if (!searchCategory) {
      showToast('Selecciona un TCG.', 'error');
      return;
    }
    if (!searchSet && !searchQuery.trim() && searchCategory !== '99') {
      showToast('Selecciona una edición o ingresa un nombre para buscar.', 'error');
      return;
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    try {
      let cards = [];
      const mylFilters = searchCategory === '99' ? { type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock, physicalProductId: searchPhysicalProduct } : {};
      
      if (searchSet && searchQuery.trim() === '') {
        const response = await api.getTcgProducts(searchCategory, searchSet, mylFilters);
        cards = response.data || [];
      } else {
        const response = await api.searchTcgProducts(searchQuery.trim(), searchCategory, searchSet, mylFilters);
        cards = response.data || [];
      }
      
      const rarities = new Set();
      cards.forEach(c => {
        if (c.extData && Array.isArray(c.extData)) {
          const rarityObj = c.extData.find(x => x.name === 'Rarity' || x.name === 'Card Number / Rarity');
          if (rarityObj && rarityObj.value) rarities.add(rarityObj.value);
        }
      });
      setAvailableRarities(Array.from(rarities).sort());
      setFilterRarity('');
      setFilterType('all');
      setRawSearchResults(cards);
      setHasSearchedAPI(true);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
        showToast('Error al buscar cartas en la API', 'error');
      }
    } finally {
      setIsSearching(false);
    }
  };

  
    const firstRenderFilters = useRef(true);
    useEffect(() => {
      if (firstRenderFilters.current) {
        firstRenderFilters.current = false;
        return;
      }
      if (activeTab === 'add' && !loadingFolder && searchCategory) {
        const timeoutId = setTimeout(() => {
          handleSearchAPI({ preventDefault: () => {} });
        }, 500);
        return () => clearTimeout(timeoutId);
      }
    }, [searchBlock, searchSet, searchPhysicalProduct, mylType, mylRace, mylCost, searchQuery]);

    const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Ultra-compresión a WebP con calidad del 50%
        const compressedBase64 = canvas.toDataURL('image/webp', 0.5);

        setSelectedCard(prev => {
          if (!prev) return prev;
          const safeId = String(prev.id || prev.productId || prev.tcgProductId || '');
          return {
            ...prev,
            isCustomImage: true,
            id: safeId.includes('-custom-') ? safeId : `${safeId}-custom-${Date.now()}`,
            imageUrl: compressedBase64,
            images: {
              ...prev.images,
              large: compressedBase64,
              small: compressedBase64
            }
          };
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    const cardStock = parseInt(stock);
    if (!selectedCard || !price || !cardStock) return;
    setIsSaving(true);
    
    try {
      const targetTcgId = selectedCard.productId?.toString() || selectedCard.id?.toString() || selectedCard.tcgProductId?.toString();
      const existingCard = cards.find(c => c.tcgId === targetTcgId);
      
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
            set: availableSets.find(s => s.groupId == (searchSet || selectedCard.groupId))?.name || 'Unknown',
            rarity: selectedCard.extData?.Rarity || selectedCard.extData?.['Card Number / Rarity'] || 'Unknown',
            supertype: selectedCard.extData ? selectedCard.extData['Card Type / HP / Stage']?.split(' / ')[0] || 'Unknown' : 'Unknown',
            number: selectedCard.extData?.Number || '',
            total: '',
            language: isMylFolder ? 'Spanish' : language,
            catalogOrder: cards.length
          }
        };
        await api.addCard(id, cardData);
        showToast('¡Carta guardada en el catálogo exitosamente!', 'success');
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
            setStock('');
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
      showToast('Error de conexión al guardar la carta', 'error');
    } finally {
      setIsSaving(false);
    }
  };



  const renderAddTab = () => (
    <div className="flex flex-col-reverse lg:flex-row gap-6">
      {/* Lado Izquierdo: Buscador de API */}
      <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="bg-white pb-4 mb-4 border-b border-gray-200">
            <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 mb-4">
          <span translate="no" className="material-symbols-outlined text-[#1e40af]">search</span>
            Buscar en {folderData?.tcg || "Carpeta"}
        </h2>
        
        <form onSubmit={handleSearchAPI} className="flex flex-col gap-2 mb-3">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchCategory === "99" ? "Nombre de la carta (ej. Oseye)" : "Nombre (ej. Pikachu) o Código"}
            className="w-full px-3 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] transition-colors"
          />
          <div className="grid grid-cols-3 gap-2 mb-2">
              
            {searchCategory === '99' && (
                <select value={searchBlock} onChange={(e) => { setSearchBlock(e.target.value); setSearchSet(''); setSearchPhysicalProduct(''); scrollToTopIfNeeded(); }} className="w-full px-2 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors truncate">
                  <option value="2">Primer Bloque</option>
                    <option value="3">Primera Era</option>
                    <option value="1">Furia Extendido</option>
                </select>
              )}
              {searchCategory === '99' && (
                <select value={searchPhysicalProduct} onChange={(e) => { setSearchPhysicalProduct(e.target.value); scrollToTopIfNeeded(); }} disabled={!searchBlock} className="w-full px-2 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed truncate">
                  <option value="">Producto</option>
                  {availablePhysicalProducts.filter(p => !searchBlock || p.blockId === parseInt(searchBlock)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}

            <div className="relative w-full">
              <div className="w-full px-2 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-300 bg-white text-gray-900 cursor-pointer flex justify-between items-center transition-colors hover:border-[#1e40af]" onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}>
                <span className="truncate font-bold text-sm lg:text-xs">{searchSet === '' ? 'Edición' : availableSets.find(s => s.groupId == searchSet)?.name || 'Seleccionado'}</span>
                <span translate="no" className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
              </div>
              {isSetDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSetDropdownOpen(false)}></div>
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                    
                    <div 
                      className={`px-3 py-1.5 text-sm lg:text-xs cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${searchSet === '' ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`}
                      onClick={() => { setSearchSet(''); setIsSetDropdownOpen(false); scrollToTopIfNeeded(); }}
                    >
                      {searchSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                      <span className={searchSet !== '' ? 'ml-6' : ''}>Edición</span>
                    </div>
                    {filteredSearchSets.map(set => (
                      <div key={set.groupId} className={`px-3 py-1.5 text-sm lg:text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${searchSet == set.groupId ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`} onClick={() => { setSearchSet(set.groupId); setIsSetDropdownOpen(false); scrollToTopIfNeeded(); }}>
                        {searchSet == set.groupId && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                        <span className={searchSet != set.groupId ? 'ml-6' : ''}>{set.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
            {/* MYL Custom Filters UI */}
            {searchCategory === '99' && (
              <div className="flex flex-col mt-2">
                
                <div className="grid grid-cols-3 gap-2">
                  <select value={mylType} onChange={(e) => { setMylType(e.target.value); scrollToTopIfNeeded(); }} className="w-full px-3 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 font-medium shadow-sm transition-all">
                    <option value="">Tipo</option>
                    <option value="ALIADO">Aliado</option>
                    <option value="ARMA">Arma</option>
                    <option value="ORO">Oro</option>
                    <option value="TALISMAN">Talismán</option>
                    <option value="TOTEM">Tótem</option>
                  </select>
                  <select value={mylRace} onChange={(e) => { setMylRace(e.target.value); scrollToTopIfNeeded(); }} className="w-full px-3 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-[#1e40af] font-medium shadow-sm transition-all">
                    <option value="">Raza</option>
                    {searchBlock === '2' ? (
                      <>
                        <option value="CABALLERO">Caballero</option>
                        <option value="DEFENSOR">Defensor</option>
                        <option value="DESAFIANTE">Desafiante</option>
                        <option value="DRAGON">Dragón</option>
                        <option value="ETERNO">Eterno</option>
                        <option value="FAERIE">Faerie</option>
                        <option value="FARAON">Faraón</option>
                        <option value="HEROE">Héroe</option>
                        <option value="OLIMPICO">Olímpico</option>
                        <option value="SACERDOTE">Sacerdote</option>
                        <option value="SOMBRA">Sombra</option>
                        <option value="TITAN">Titán</option>
                      </>
                    ) : (
                      <>
                        <option value="CABALLERO">Caballero</option>
                        <option value="DRAGON">Dragón</option>
                        <option value="FAERIE">Faerie</option>
                        <option value="GUERRERO">Guerrero</option>
                        <option value="SOMBRA">Sombra</option>
                        <option value="BESTIA">Bestia</option>
                        <option value="DIOS">Dios</option>
                        <option value="HEROE">Héroe</option>
                        <option value="SACERDOTE">Sacerdote</option>
                        <option value="SIN_RAZA">Sin Raza</option>
                        <option value="DESAFIANTE">Desafiante</option>
                        <option value="ANCESTRAL">Ancestral</option>
                      </>
                    )}
                  </select>
                  
                  <select 
                value={mylCost} 
                onChange={(e) => { setMylCost(e.target.value); scrollToTopIfNeeded(); }} 
                className="w-full px-3 py-1.5 text-sm lg:text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-[#1e40af] font-medium shadow-sm transition-all"
              >
                <option value="">Costo</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
                </div>
              </div>
            )}
            
          {(searchCategory !== '99' || availableRarities.length > 0) && (
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {searchCategory !== '99' && (
                <div className="flex items-center w-full sm:w-auto bg-white p-1 rounded-lg border border-gray-200">
                  <button type="button" onClick={() => { setFilterType('all'); scrollToTopIfNeeded(); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors ${filterType === 'all' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>Todos</button>
                  <button type="button" onClick={() => { setFilterType('cards'); scrollToTopIfNeeded(); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors ${filterType === 'cards' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>Cartas</button>
                  <button type="button" onClick={() => { setFilterType('sealed'); scrollToTopIfNeeded(); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors ${filterType === 'sealed' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>Sellado</button>
                </div>
              )}
              
              {availableRarities.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[200px]">
                  <span className="text-sm font-bold text-gray-700">Rareza:</span>
                  <select 
                    value={filterRarity} 
                    onChange={(e) => { setFilterRarity(e.target.value); scrollToTopIfNeeded(); }}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-sm"
                  >
                    <option value="">Todas</option>
                    {availableRarities.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

          <div className="fixed bottom-[88px] right-6 flex flex-col gap-3 z-[60] lg:hidden">
            <button 
              type="button" 
              onClick={toggleMultiSelectMode}
              className={`${multiSelectMode ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-[#1e40af] border-gray-200 hover:bg-gray-100'} w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95 border`}
              title={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
            >
              <span translate="no" className="material-symbols-outlined text-[22px]">library_add</span>
              {selectedQueue.length > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full text-xs flex items-center justify-center border-2 border-white ${multiSelectMode ? 'bg-white text-[#1e40af]' : 'bg-[#1e40af] text-white'}`}>
                  {selectedQueue.length}
                </span>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => { const isMobile = window.innerWidth <= 768; const maxCols = isMobile ? 3 : 5; const minCols = isMobile ? 1 : 2; setGridCols(prev => prev >= maxCols ? minCols : prev + 1); }} 
              className="bg-white hover:bg-gray-100 text-[#1e40af] border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
              title="Cambiar vista"
            >
              <span translate="no" className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="ml-1">{gridCols}</span>
            </button>
            <button type="submit" className="hidden" />
            <button 
              type="button" 
              onClick={() => { setSearchQuery(''); setSearchPhysicalProduct(''); setSearchSet(''); setMylType(''); setMylRace(''); setMylCost(''); scrollToTopIfNeeded(); }} 
              className="bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
              title="Limpiar filtros"
            >
              <span translate="no" className="material-symbols-outlined text-[22px]">filter_alt_off</span>
            </button>
          </div>
        </form>
      </div>
      {(multiSelectMode || selectedQueue.length > 0) && (
        <div className="lg:hidden mb-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-bold text-[#1a2b4b]">Selección múltiple</p>
              <p className="text-xs text-gray-500">{totalQueuedCards} carta{totalQueuedCards === 1 ? '' : 's'} en la lista</p>
            </div>
            <div className="flex gap-2">
              {selectedQueue.length > 0 && (
                <button type="button" onClick={() => { setSelectedQueue([]); setActiveQueueItemId(null); setSelectedCard(null); resetCardForm(); }} className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                  Limpiar
                </button>
              )}
              <button type="button" disabled={selectedQueue.length === 0} onClick={startQueuedAdd} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1e40af] text-white disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm hover:bg-blue-800 transition-colors">
                Agregar selección
              </button>
            </div>
          </div>
          {selectedQueue.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {selectedQueue.map((item, index) => (
                <button key={item.queueId} type="button" onClick={(e) => decreaseQueueItemQuantity(e, item.queueId)} onContextMenu={(e) => e.preventDefault()} className={`relative flex-shrink-0 w-16 rounded-lg border-2 bg-white p-1 shadow-sm transition-all ${activeQueueItemId === item.queueId ? 'border-[#1e40af]' : 'border-blue-200 hover:border-red-300'}`} title="Quitar de la selección">
                  <img src={item.card.imageUrl} alt={item.card.name} className="w-full aspect-[63/88] object-contain rounded" />
                  <span className="absolute -top-2 -left-2 bg-[#1e40af] text-white text-[10px] font-bold rounded-full min-w-5 px-1 h-5 flex items-center justify-center border border-white">x{item.quantity || 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={`grid gap-4 pr-2 ${gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : gridCols === 3 ? 'grid-cols-3' : gridCols === 4 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
          {isSearching ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1e40af] mb-4"></div>
              <p className="text-gray-500 font-bold animate-pulse">Consultando la Pokédex mundial...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
            {searchResults.slice(0, visibleCount).map((card, index) => {
              const queuedCount = selectedQueueCountByCard[getCardSelectionKey(card)] || 0;
              const isCardSelected = selectedCard?.id === card.id || queuedCount > 0;
              return (
            <div key={card.id || `search-${index}`} className={`relative cursor-pointer flex flex-col justify-between rounded-xl overflow-hidden border-2 transition-all duration-200 bg-blue-50 shadow-sm ${gridCols === 1 ? 'max-w-[255px] mx-auto w-full' : gridCols === 2 ? 'max-w-[350px] mx-auto w-full' : 'w-full'} ${isCardSelected ? 'border-[#1e40af] shadow-md scale-[1.02] ring-2 ring-[#1e40af]/20' : 'border-gray-200 hover:border-[#1e40af]/50'}`} onClick={() => handleResultCardClick(card)} onContextMenu={(e) => handleRightClickResultCard(e, card)} title={multiSelectMode ? "Clic izquierdo: Añadir 1 copia | Clic derecho: Quitar 1 copia" : ""}>
              {queuedCount > 0 && (
                <div className="absolute top-2 right-2 z-20 bg-[#1e40af] text-white text-xs font-bold rounded-full min-w-7 h-7 px-2 flex items-center justify-center border-2 border-white shadow-md">
                  x{queuedCount}
                </div>
              )}
              <div className="relative w-full aspect-[63/88] flex items-center justify-center bg-gray-50 p-2">
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src="/favicon.png" className="w-10 h-10 opacity-40 animate-pulse object-contain filter grayscale" alt="Cargando..." />
                </div>
                <img src={card.imageUrl} referrerPolicy="no-referrer" alt={card.name} loading="lazy" className="w-full h-full object-contain filter drop-shadow-sm relative z-10 transition-opacity duration-300 opacity-0" onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); e.currentTarget.previousSibling.style.display = 'none'; }} />
              </div>
              <div className={`text-center border-t border-gray-100 w-full ${gridCols <= 2 ? 'p-2' : gridCols === 3 ? 'p-3' : gridCols === 4 ? 'p-2' : 'p-1'}`}>
                <p className={`font-bold text-gray-900 truncate ${gridCols === 1 ? 'text-base' : gridCols === 2 ? 'text-xl' : gridCols === 3 ? 'text-base' : gridCols === 4 ? 'text-sm' : 'text-xs'}`}>{card.name}</p>
                <p className={`text-gray-500 truncate mt-1 ${gridCols === 1 ? 'text-xs' : gridCols === 2 ? 'text-lg' : gridCols === 3 ? 'text-sm' : gridCols === 4 ? 'text-xs' : 'text-[10px]'}`}>{availableSets.find(s => s.groupId == (searchSet || card.groupId))?.name}</p>
              </div>
            </div>
          );})}
          {visibleCount < searchResults.length && (
            <div ref={observerTarget} className="col-span-full h-10 w-full flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af]"></div>
            </div>
          )}
          </>
          ) : hasSearchedAPI ? (
              <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                  <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-50">search_off</span>
                  <p className="font-bold">No se encontraron cartas que coincidan con tu búsqueda.</p>
              </div>
          ) : (
              <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                  <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-50">travel_explore</span>
                  <p className="font-bold">Realiza una búsqueda para empezar.</p>
              </div>
          )}
        </div>
      </div>

      {/* Lado Derecho: Añadir a Carpeta */}

        {/* Columna de Botones FAB (Solo PC) */}
        <div className="hidden lg:flex flex-col gap-3 sticky top-[360px] h-fit z-[60] self-start -mx-2">
            <button 
                type="button" 
                onClick={toggleMultiSelectMode}
                className={`${multiSelectMode ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-[#1e40af] border-gray-200 hover:bg-gray-100'} relative w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95 border`}
                title={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
            >
                <span translate="no" className="material-symbols-outlined text-[22px]">library_add</span>
                {selectedQueue.length > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full text-xs flex items-center justify-center border-2 border-white ${multiSelectMode ? 'bg-white text-[#1e40af]' : 'bg-[#1e40af] text-white'}`}>
                        {selectedQueue.length}
                    </span>
                )}
            </button>
            <button 
                type="button" 
                onClick={() => { const isMobile = window.innerWidth <= 768; const maxCols = isMobile ? 3 : 5; const minCols = isMobile ? 1 : 2; setGridCols(prev => prev >= maxCols ? minCols : prev + 1); }} 
                className="bg-white hover:bg-gray-100 text-[#1e40af] border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
                title="Cambiar vista"
            >
                <span translate="no" className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="ml-1">{gridCols}</span>
            </button>
            <button 
                type="button" 
                onClick={() => { setSearchQuery(''); setSearchPhysicalProduct(''); setSearchSet(''); setMylType(''); setMylRace(''); setMylCost(''); scrollToTopIfNeeded(); }} 
                className="bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
                title="Limpiar filtros"
            >
                <span translate="no" className="material-symbols-outlined text-[22px]">filter_alt_off</span>
            </button>
            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`bg-[#1e40af] text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center transform hover:scale-110 active:scale-95 border-2 border-white/20 ${showScrollTop ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}
                aria-label="Volver arriba"
                title="Volver arriba"
            >
                <span translate="no" className="material-symbols-outlined text-2xl">arrow_upward</span>
            </button>
        </div>

      <div id="add-catalog-panel" className={`w-full max-w-[400px] lg:w-[400px] bg-white p-6 lg:p-6 rounded-2xl shadow-sm border border-gray-200 lg:sticky lg:top-[140px] flex-shrink-0 z-10 hover:z-[60] mx-auto lg:mx-0 self-center lg:self-start scroll-mt-[130px] lg:scroll-mt-[150px] ${selectedCard ? 'block' : 'hidden lg:block'} lg:h-[calc(100vh-160px)] overflow-visible`}>
        <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 border-b border-gray-200 pb-4">
          <span translate="no" className="material-symbols-outlined text-[#1e40af]">add_circle</span>
          {isBatchAdding ? 'Agregar Selección' : 'Añadir a Carpeta'}
        </h2>
        {selectedCard ? (
          <form onSubmit={handleSaveCard} className="flex min-h-[610px] lg:min-h-0 lg:h-[calc(100%-58px)] flex-col justify-between gap-4 mt-2">
            <div className="flex justify-center relative z-50 mt-4 lg:flex-1 lg:min-h-0 w-full">
              <div className="relative inline-block lg:h-full flex justify-center items-center">
                <img 
                  src={getProxyImageUrl(selectedCard.tcgProductId || selectedCard.id, selectedCard.imageUrl)} 
                  alt={selectedCard.name} 
                  className="h-72 sm:h-80 lg:h-full lg:max-h-full lg:w-full aspect-[63/88] object-contain rounded-lg shadow-md hover:scale-[1.55] transition-transform duration-300 cursor-zoom-in relative z-50 hover:z-[70] origin-center" 
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-3 -right-3 z-[60] bg-[#1e40af] text-white rounded-full w-10 h-10 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-blue-800 hover:scale-110 transition-all border-2 border-white"
                  title="Subir foto real de la carta"
                >
                  <span translate="no" className="material-symbols-outlined text-[20px]">photo_camera</span>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment" 
                onChange={handleImageUpload} 
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-center px-2">
                <p className="font-bold text-gray-900 leading-tight">{selectedCard.name}</p>
                <p className="text-sm text-gray-500 mt-1">{availableSets.find(s => s.groupId == (searchSet || selectedCard.groupId))?.name} • {selectedCard.rarity}</p>
                {isBatchAdding && (
                  <p className="text-xs font-bold text-[#1e40af] mt-2">
                    Carta {selectedQueue.findIndex(item => item.queueId === activeQueueItemId) + 1} de {selectedQueue.length}
                  </p>
                )}
              </div>
              
              {!isBatchAdding && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alias / Apodo (Opcional)</label>
                  <input type="text" value={pseudoName} onChange={(e) => setPseudoName(e.target.value)} placeholder="Ej: Charizard de Ash..." maxLength={30} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-sm text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]" />
                </div>
              )}

              <div className="flex gap-4">
                <div className={isBatchAdding ? 'w-full' : 'flex-1'}>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Precio (CLP)*</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input type="number" required min="1" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]" placeholder="1000" />
                  </div>
                </div>
                {!isBatchAdding && (
                  <div className="w-1/3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Stock*</label>
                    <input type="number" required min="1" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-center" placeholder="1" />
                  </div>
                )}
              </div>

              {!isMylFolder && !isBatchAdding && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Idioma</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-sm">
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Japanese">Japanese</option>
                  </select>
                </div>
              )}

              <button type="submit" disabled={isSaving} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-[15px]">
                {isSaving ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <span translate="no" className="material-symbols-outlined">add_circle</span>}
                {isSaving ? 'Guardando...' : isBatchAdding ? 'Guardar y continuar' : 'Guardar Carta'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {(multiSelectMode || selectedQueue.length > 0) ? (
              <div className="hidden lg:flex min-h-[610px] lg:min-h-0 lg:h-[calc(100%-58px)] flex-col justify-between gap-4 mt-2">
                  <div className="flex items-center justify-between gap-3 px-2 mt-4">
                    <div>
                      <p className="text-sm font-bold text-[#1a2b4b]">Selección múltiple</p>
                      <p className="text-xs text-gray-500">{totalQueuedCards} carta{totalQueuedCards === 1 ? '' : 's'} en la lista</p>
                    </div>
                    {selectedQueue.length > 0 && (
                      <button type="button" onClick={() => { setSelectedQueue([]); setActiveQueueItemId(null); setSelectedCard(null); resetCardForm(); }} className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                        Limpiar
                      </button>
                    )}
                  </div>

                  <div ref={queueScrollRef} className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden custom-scrollbar mt-2 px-2 pb-4">
                    {selectedQueue.length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {selectedQueue.map((item, index) => (
                          <div key={item.queueId} onContextMenu={(e) => decreaseQueueItemQuantity(e, item.queueId)} title="Clic derecho para quitar 1 copia" className="relative w-full aspect-[63/88] rounded-xl shadow-sm border-2 border-blue-200 bg-white p-1.5 hover:border-red-300 transition-colors flex items-center justify-center cursor-context-menu">
                            <img 
                              src={getProxyImageUrl(item.card.tcgProductId || item.card.id, item.card.imageUrl)} 
                              alt={item.card.name} 
                              className="w-full h-full object-contain rounded-md" 
                            />
                            <button 
                              type="button" 
                              onClick={() => removeQueueItem(item.queueId)} 
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md border-2 border-white hover:scale-110 transition-transform z-[60]"
                              title="Quitar de la selección"
                            >
                              <span translate="no" className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                            <span className="absolute -bottom-2 -left-2 bg-[#1e40af] text-white text-[11px] font-bold rounded-full min-w-7 px-1 h-7 flex items-center justify-center shadow-md border-2 border-white z-[60]">
                              x{item.quantity || 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 opacity-80 border-2 border-dashed border-gray-200 rounded-xl">
                        <span translate="no" className="material-symbols-outlined text-6xl mb-4 text-gray-300">library_add</span>
                        <div className="text-center px-4">
                          <p className="text-sm font-bold">Usa clic izquierdo para sumar copias.</p>
                          <p className="text-sm font-bold mt-1 opacity-80">Usa clic derecho para restarlas.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="button" disabled={selectedQueue.length === 0} onClick={startQueuedAdd} className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#1e40af] text-white disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm hover:bg-blue-800 transition-colors flex items-center justify-center gap-2">
                    <span translate="no" className="material-symbols-outlined text-[20px]">playlist_add_check</span>
                    Agregar selección
                  </button>
                </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 opacity-80 border-2 border-dashed border-gray-200 rounded-xl mt-6 p-6">
                <span translate="no" className="material-symbols-outlined text-6xl mb-4 text-gray-300">style</span>
                <p className="text-sm font-bold text-center">Selecciona una carta de los resultados.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // --- SALES & HISTORY LOGIC ---
  const handleProcessOrder = async (code) => {
    if (!code) return;
    setIsProcessingOrder(true);
    try {
      const response = await fetch(`${API_BASE}/api/process-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const result = await response.json();
      if (result.success) { fetchCards(); fetchOrders(); fetchHistory(); }
    } catch (err) { console.error(err); } finally { setIsProcessingOrder(false); }
  };

  const handleRejectOrder = async (code) => {
    if (!code) return;
    try {
      const response = await fetch(`${API_BASE}/api/reject-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const result = await response.json();
      if (result.success) { fetchOrders(); fetchHistory(); }
    } catch (err) { console.error(err); }
  };

  const formatCLP = (price) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

  const renderSalesTab = () => (
    <div className="flex flex-col gap-8">
      {/* Solicitudes Pendientes */}
      <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container shadow-sm">
        <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2 mb-4">
          <span translate="no" className="material-symbols-outlined text-secondary">notifications_active</span>
          Solicitudes Pendientes ({pendingOrders.length})
        </h2>
        {pendingOrders.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant bg-surface rounded-xl border border-dashed border-outline-variant">No hay pedidos pendientes actualmente.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map(order => (
              <div key={order.code} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-start border-b border-surface-container pb-2">
                  <span className="font-label-lg font-bold text-on-surface">Ref: {order.code}</span>
                  <span className="text-sm text-on-surface-variant">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <ul className="text-sm flex-1 space-y-1">
                  {order.items.map((item, i) => {
                    const card = cards.find(c => c.id === item.id);
                    return <li key={i} className="flex justify-between"><span className="truncate pr-2">{item.q}x {card ? card.name : item.id}</span></li>
                  })}
                </ul>
                <div className="flex justify-between items-center pt-2 border-t border-surface-container">
                  <span className="font-title-md text-secondary font-bold">{formatCLP(order.totalAmount || 0)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleRejectOrder(order.code)} className="w-10 h-10 rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-white flex items-center justify-center transition-colors" title="Rechazar solicitud"><span translate="no" className="material-symbols-outlined text-[20px]">close</span></button>
                    <button onClick={() => handleProcessOrder(order.code)} disabled={isProcessingOrder} className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-white flex items-center justify-center transition-colors disabled:opacity-50" title="Venta concretada"><span translate="no" className="material-symbols-outlined text-[20px]">check</span></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de Ventas */}
      <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container shadow-sm">
        <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2 mb-4">
          <span translate="no" className="material-symbols-outlined text-primary">history</span>
          Historial de Ventas
        </h2>
        {history.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant bg-surface rounded-xl border border-dashed border-outline-variant">El historial está vacío.</div>
        ) : (
          <div className="overflow-x-auto bg-surface rounded-xl border border-outline-variant">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-lowest text-on-surface-variant text-sm font-label-md">
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Ref</th>
                  <th className="p-4">Artículos</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, index) => (
                  <tr key={index} className="border-b border-surface-container hover:bg-surface-container-lowest transition-colors">
                    <td className="p-4 text-sm text-on-surface">{new Date(h.processedAt).toLocaleString()}</td>
                    <td className="p-4 font-bold text-on-surface">{h.code}</td>
                    <td className="p-4 text-sm text-on-surface">
                      {h.items.map(item => {
                         const card = cards.find(c => c.id === item.id);
                         return `${item.q}x ${card ? card.name : item.id}`;
                      }).join(', ')}
                    </td>
                    <td className="p-4 font-bold text-on-surface">{formatCLP(h.totalAmount || 0)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${h.status === 'completed' ? 'bg-[#25D366]/20 text-[#128C7E]' : 'bg-error-container text-on-error-container'}`}>
                        <span translate="no" className="material-symbols-outlined text-[14px]">
                           {h.status === 'completed' ? 'check_circle' : 'cancel'}
                        </span>
                        {h.status === 'completed' ? 'Concretada' : 'Cancelada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  if (loadingFolder) {
    return (
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border-x border-gray-300 flex flex-col items-center justify-center relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  if (!folderData) return (
    <div className="min-h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center bg-[#DBEAFE] p-6 relative z-10">
      <span translate="no" className="material-symbols-outlined text-6xl text-error mb-4">error</span>
      <h2 className="text-2xl font-bold mb-6 text-[#1a2b4b] text-center max-w-md leading-snug">Carpeta no encontrada o error al cargar los datos.</h2>
      <button onClick={() => navigate('/dashboard')} className="bg-[#1e40af] hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors">Volver al Dashboard</button>
    </div>
  );

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border-x border-gray-300 flex flex-col relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
          <main className="flex-1 text-gray-900 px-4 sm:px-8 py-8 flex flex-col relative z-20">
      <div className="mb-6 flex items-center gap-2 sm:gap-4 pb-4 border-b border-gray-300">
        <button 
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600 bg-white border border-gray-300 shadow-sm hover:text-[#1e40af]"
          title="Volver a mis carpetas"
        >
          <span translate="no" className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
        </button>
        <h1 className="font-headline-lg md:font-display-lg text-headline-lg md:text-display-lg text-[#1a2b4b] m-0 leading-tight truncate">Carpeta: {folderData.name}</h1>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 border-b border-gray-300 mb-8 pb-0">
        <button 
          onClick={() => setActiveTab('add')} 
          className={`px-2 sm:px-6 py-4 rounded-t-xl font-bold transition-colors flex items-center justify-center gap-1 sm:gap-2 ${activeTab === 'add' ? 'bg-white text-[#1e40af] border-b-4 border-[#1e40af] shadow-sm' : 'bg-gray-50/50 hover:bg-gray-100 text-gray-500'}`}
        >
          <span translate="no" className="material-symbols-outlined text-[18px] sm:text-[24px]">add_circle</span>
          <span className="text-xs sm:text-sm">Agregar Cartas</span>
        </button>
        <button 
          onClick={() => setActiveTab('catalog')} 
          className={`px-2 sm:px-6 py-4 rounded-t-xl font-bold transition-colors flex items-center justify-center gap-1 sm:gap-2 ${activeTab === 'catalog' ? 'bg-white text-[#1e40af] border-b-4 border-[#1e40af] shadow-sm' : 'bg-gray-50/50 hover:bg-gray-100 text-gray-500'}`}
        >
          <span translate="no" className="material-symbols-outlined text-[18px] sm:text-[24px]">inventory_2</span>
          <span className="text-xs sm:text-sm">Carpeta</span>
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'catalog' && renderCatalogTab()}
        {activeTab === 'add' && renderAddTab()}
        
      </div>

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      
      <ConfirmModal 
        isOpen={confirmDialog.show} 
        title="Confirmar Acción" 
        message={confirmDialog.message} 
        onConfirm={executeDeleteCard} 
        onCancel={() => setConfirmDialog({ show: false, message: '', targetId: null })}
      />
          </main>
        </div>
      </div>
    
      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 bg-[#1e40af] text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-800 transition-all z-50 flex items-center justify-center transform hover:scale-110 active:scale-95 border-2 border-white/20 lg:hidden"
          aria-label="Volver arriba"
        >
          <span translate="no" className="material-symbols-outlined text-2xl">arrow_upward</span>
        </button>
      )}
    </>
  );
}


const FolderPokemon = (props) => (
  <ErrorBoundary>
    <FolderPokemonInner {...props} />
  </ErrorBoundary>
);
export default FolderPokemon;



