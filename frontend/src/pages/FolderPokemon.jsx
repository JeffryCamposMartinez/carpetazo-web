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
const API_BASE = import.meta.env.VITE_API_URL || '';

const AdminCardEdit = ({ card, onUpdate, onDelete }) => {
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
    <div className="bg-white rounded-2xl border border-gray-200 flex flex-col shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
      <button 
        onClick={() => onDelete(card.id)}
        className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        title="Eliminar carta"
      >
        <span translate="no" className="material-symbols-outlined text-[18px]">delete</span>
      </button>
      <div className="p-4 flex flex-col items-center flex-1">
        <div className="w-full relative pt-[140%] mb-3">
          <img src={card.imageUrl} referrerPolicy="no-referrer" referrerPolicy="no-referrer" referrerPolicy="no-referrer" alt={card.name} className="absolute inset-0 w-full h-full object-fill filter drop-shadow-md transition-transform duration-300" />
        </div>
        <p className="font-bold text-gray-900 text-center line-clamp-1 w-full text-sm">{card.name}</p>
        <p className="text-[10px] text-gray-500 mb-4 text-center truncate w-full">
          {card.set} • {card.supertype} • #{(() => {
            let numStr = (card.number || card.apiId?.split('-')[1] || card.id?.split('-')[1] || '').toString();
            let totalStr = (card.total || '---').toString();
            if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
            if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
            return `${numStr}/${totalStr}`;
          })()}
        </p>
        
        <div className="flex flex-col gap-2 w-full mt-auto">
           <div className="flex justify-between items-center w-full bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Stock</label>
              <div className="flex items-center shadow-sm rounded-md overflow-hidden border border-gray-300">
                <button onClick={() => setStock(Math.max(0, parseInt(stock) - 1))} className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors font-bold text-xs text-gray-700">-</button>
                <input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} className="w-10 h-6 text-center bg-white focus:outline-none px-0 text-xs font-bold border-x border-gray-300 text-gray-900"/>
                <button onClick={() => setStock(parseInt(stock) + 1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors font-bold text-xs text-gray-700">+</button>
              </div>
           </div>
           <div className="flex justify-between items-center w-full bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 shadow-sm">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Precio</label>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">$</span>
                <input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} className="w-full h-6 pl-6 pr-2 bg-white focus:outline-none text-xs font-bold rounded-md border border-gray-300 shadow-sm text-right text-gray-900"/>
              </div>
           </div>
        </div>
      </div>
      
      <button 
        onClick={handleSave} 
        disabled={saving || !hasChanges} 
        className={"w-full py-3 font-bold text-xs tracking-wide transition-colors border-t border-gray-200 flex items-center justify-center gap-1.5 " + (hasChanges ? 'bg-[#1e40af] text-white hover:bg-blue-800' : 'bg-gray-100 text-gray-500 opacity-60')}
      >
        <span translate="no" className="material-symbols-outlined text-[16px]">{saving ? 'hourglass_empty' : 'save'}</span>
        {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado'}
      </button>
    </div>
  );
};

function FolderPokemonInner() {

  const getProxyImageUrl = (productId, originalUrl) => {
    if (!originalUrl) return '';
    if (originalUrl.includes('api.carpetazo.cl/images')) return originalUrl;
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
  const [searchBlock, setSearchBlock] = useState('');
  const [catBlock, setCatBlock] = useState('');

  const filteredSearchSets = searchCategory === '99' && searchBlock !== '' ? availableSets.filter(s => s.blockId == searchBlock) : availableSets;
  const filteredCatSets = (folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') && catBlock !== '' ? availableSets.filter(s => s.blockId == catBlock) : availableSets;
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearchedAPI, setHasSearchedAPI] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('');
  const [availableRarities, setAvailableRarities] = useState([]);
  const [rawSearchResults, setRawSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [price, setPrice] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  // --- UI STATE ---
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const showToast = (message, type = 'info') => setToast({ message, type });
  
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', targetId: null });

  // --- CATALOG MANAGEMENT STATE ---
  
  const [catQuery, setCatQuery] = useState('');
  const [catSet, setCatSet] = useState('');
  const [isCatSetDropdownOpen, setIsCatSetDropdownOpen] = useState(false);

  // --- SALES & HISTORY STATE ---
  const [pendingOrders, setPendingOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [cards, setCards] = useState([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Fetch logic
  

  

  const fetchCards = async () => {
    try {
      const res = await api.getFolder(id);
      if(res.success && res.folder) {
        const mappedCards = (res.folder.cards || []).map(c => ({ ...c, ...(c.data || {}) }));
        setCards(mappedCards);
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
          const mappedCards = (res.folder.cards || []).map(c => ({ ...c, ...(c.data || {}) }));
          setCards(mappedCards);
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

  const filteredCatalog = cards.filter(card => {
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
      if (mylRace) {
        if (!card.extData?.race) matchesMyl = false;
        else if (Array.isArray(card.extData.race) && !card.extData.race.includes(mylRace)) matchesMyl = false;
        else if (typeof card.extData.race === 'string' && card.extData.race !== mylRace) matchesMyl = false;
      }
    }
    
    return matchesQuery && matchesSupertype && matchesType && matchesSet && matchesMyl;
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
          onChange={(e) => setCatQuery(e.target.value)}
          placeholder="Buscar por nombre en tu catálogo..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]"
        />
        
        {(folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') && (
          <select value={catBlock} onChange={(e) => { setCatBlock(e.target.value); setCatSet(''); }} className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]">
            <option value="">Selecciona un bloque (Todos)</option>
            <option value="1">Furia Extendido</option>
            <option value="2">Primer Bloque</option>
            <option value="3">Primera Era</option>
          </select>
        )}
        
        <div className="w-full">
            <div className="relative w-full h-full">
              <div 
                className="w-full h-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 cursor-pointer flex justify-between items-center transition-all hover:border-[#1e40af]"
                onClick={() => setIsCatSetDropdownOpen(!isCatSetDropdownOpen)}
              >
                <span className="truncate font-bold text-sm">
                  {catSet === '' ? 'Todas las ediciones' :  availableSets.find(s => s.id === catSet)?.name || 'Seleccionado'}
                </span>
                <span translate="no" className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
              </div>
              
              {isCatSetDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setIsCatSetDropdownOpen(false)}></div>
                  <div className="absolute z-[110] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    <div 
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${catSet === '' ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`}
                      onClick={() => { setCatSet(''); setIsCatSetDropdownOpen(false); }}
                    >
                      {catSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                      <span className={catSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                    </div>
                    
                    {filteredCatSets.map(set => (
                      <div 
                        key={set.id}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${catSet === set.id ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`}
                        onClick={() => { setCatSet(set.id); setIsCatSetDropdownOpen(false); }}
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
      
      {/* MYL Custom Filters UI for Catalog Tab */}
      {(folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') && (
        <div className="flex flex-col gap-3 mb-8 p-4 bg-[#DBEAFE]/30 rounded-xl border border-blue-200">
          <h4 className="text-xs font-bold text-[#1e40af] uppercase tracking-wider mb-1 flex items-center gap-1">
            <span translate="no" className="material-symbols-outlined text-[16px]">tune</span>
            Filtros Mitos y Leyendas
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <select value={mylType} onChange={(e) => setMylType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-sm transition-all">
              <option value="">Tipo (Todos)</option>
              <option value="ALIADO">Aliado</option>
              <option value="ARMA">Arma</option>
              <option value="ORO">Oro</option>
              <option value="TALISMAN">Talismán</option>
              <option value="TOTEM">Tótem</option>
            </select>
            <select value={mylRace} onChange={(e) => setMylRace(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-sm transition-all">
              <option value="">Raza (Todas)</option>
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
            </select>
            
            <input 
              type="number" 
              placeholder="Costo (ej. 2)" 
              value={mylCost} 
              onChange={(e) => setMylCost(e.target.value)} 
              className="col-span-2 sm:col-span-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-sm transition-all placeholder:text-gray-400"
            />
          </div>
        </div>
      )}      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredCatalog.map(card => (
          <AdminCardEdit key={card.id} card={card} onUpdate={handleUpdateCard} onDelete={handleDeleteRequest} />
        ))}
        {filteredCatalog.length === 0 && (
          <div className="col-span-full py-12 text-center text-on-surface-variant flex flex-col items-center">
            <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-30">search_off</span>
            <p>No se encontraron cartas que coincidan con los filtros.</p>
          </div>
        )}
      </div>
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
  }, [rawSearchResults, filterType, filterRarity, searchQuery]);

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
    if (!selectedCard || !price || !stock) return;
    setIsSaving(true);
    const cardData = {
      tcgId: selectedCard.productId.toString(),
      name: selectedCard.name,
      price: parseFloat(price),
      stock: parseInt(stock),
      imageUrl: selectedCard.imageUrl || '',
      data: {
        pseudoName: pseudoName.trim(),
        set: availableSets.find(s => s.groupId == (searchSet || selectedCard.groupId))?.name || 'Unknown',
        rarity: selectedCard.extData?.Rarity || selectedCard.extData?.['Card Number / Rarity'] || 'Unknown',
        supertype: selectedCard.extData ? selectedCard.extData['Card Type / HP / Stage']?.split(' / ')[0] || 'Unknown' : 'Unknown',
        number: selectedCard.extData?.Number || '',
        total: '',
        language: language
      }
    };
    try {
      await api.addCard(id, cardData);
      if (true) {
        showToast('¡Carta guardada en el catálogo exitosamente!', 'success');
        setSelectedCard(null);
        fetchCards();
        // Volver arriba suavemente en móviles para buscar la siguiente carta
        if (window.innerWidth < 1024) {
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 100);
        }
      } else showToast('Error al guardar la carta', 'error');
    } catch (error) {
      console.error(error);
      showToast('Error de conexión al guardar la carta', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getTcgplayerUrl = (card) => {
    if (!card) return '#';
    let code = card.number || '';
    if (card.set && card.set.printedTotal) {
      let numStr = card.number.toString();
      let totalStr = card.set.printedTotal.toString();
      if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
      if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
      code = `${numStr}/${totalStr}`;
    }
    const searchQuery = `${card.name} ${code}`.trim();
    if (card.tcgId) return `https://www.tcgplayer.com/product/${card.tcgId}`;
    return `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(searchQuery)}`;
  };

  const getTcgmatchUrl = (card) => {
    if (!card) return '#';
    let code = card.number || '';
    if (card.set && card.set.printedTotal) {
      let numStr = card.number.toString();
      let totalStr = card.set.printedTotal.toString();
      if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
      if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
      code = `${numStr}/${totalStr}`;
    }
    const searchQuery = `${card.name} ${code}`.trim();
    const encodedQuery = encodeURIComponent(searchQuery).replace(/%20/g, '+');
    return `https://tcgmatch.cl/cartas/busqueda/q=${encodedQuery}`;
  };

  const renderAddTab = () => (
    <div className="flex flex-col-reverse lg:flex-row gap-6">
      {/* Lado Izquierdo: Buscador de API */}
      <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 mb-4">
          <span translate="no" className="material-symbols-outlined text-[#1e40af]">search</span>
          Buscar en Pokémon TCG
        </h2>
        
        <form onSubmit={handleSearchAPI} className="flex flex-col gap-4 mb-6">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre (ej. Pikachu) o Código (ej. 15/165)"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] transition-colors"
          />
          <div className="flex flex-col sm:flex-row gap-4 mb-2">
            <select 
                value={searchCategory} 
                disabled={true}
                className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-500 focus:outline-none cursor-not-allowed font-medium"
              >
                <option value="" disabled>Seleccionar TCG</option>
                {availableCategories.map(cat => (
                  <option key={cat.categoryId} value={cat.categoryId}>{cat.name}</option>
                ))}
              </select>
              
            {searchCategory === '99' && (
              <select value={searchBlock} onChange={(e) => { setSearchBlock(e.target.value); setSearchSet(''); }} className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors">
                <option value="">Bloque (Todos)</option>
                <option value="1">Furia Extendido</option>
                <option value="2">Primer Bloque</option>
                <option value="3">Primera Era</option>
              </select>
            )}

            <div className={`relative w-full ${searchCategory === '99' ? 'sm:w-1/3' : 'sm:w-2/3'}`}>
              <div className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 cursor-pointer flex justify-between items-center transition-colors hover:border-[#1e40af]" onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}>
                <span className="truncate font-bold text-sm">{searchSet === '' ? 'Todas las ediciones' : availableSets.find(s => s.groupId == searchSet)?.name || 'Seleccionado'}</span>
                <span translate="no" className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
              </div>
              {isSetDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSetDropdownOpen(false)}></div>
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                    
                    <div 
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${searchSet === '' ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`}
                      onClick={() => { setSearchSet(''); setIsSetDropdownOpen(false); }}
                    >
                      {searchSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                      <span className={searchSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                    </div>
                    {filteredSearchSets.map(set => (
                      <div key={set.groupId} className={`px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${searchSet == set.groupId ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`} onClick={() => { setSearchSet(set.groupId); setIsSetDropdownOpen(false); }}>
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
              <div className="flex flex-col gap-3 mt-4 p-4 bg-[#DBEAFE]/30 rounded-xl border border-blue-200">
                <h4 className="text-xs font-bold text-[#1e40af] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span translate="no" className="material-symbols-outlined text-[16px]">tune</span>
                  Filtros Mitos y Leyendas
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <select value={mylType} onChange={(e) => setMylType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-sm transition-all">
                    <option value="">Tipo (Todos)</option>
                    <option value="ALIADO">Aliado</option>
                    <option value="ARMA">Arma</option>
                    <option value="ORO">Oro</option>
                    <option value="TALISMAN">Talismán</option>
                    <option value="TOTEM">Tótem</option>
                  </select>
                  <select value={mylRace} onChange={(e) => setMylRace(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-sm transition-all">
                    <option value="">Raza (Todas)</option>
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
                  </select>
                  
                  <input 
                    type="number" 
                    placeholder="Costo (ej. 2)" 
                    value={mylCost} 
                    onChange={(e) => setMylCost(e.target.value)} 
                    className="col-span-2 sm:col-span-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-sm transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>
            )}
            
          {(searchCategory !== '99' || availableRarities.length > 0) && (
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {searchCategory !== '99' && (
                <div className="flex items-center w-full sm:w-auto bg-white p-1 rounded-lg border border-gray-200">
                  <button type="button" onClick={() => setFilterType('all')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors ${filterType === 'all' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>Todos</button>
                  <button type="button" onClick={() => setFilterType('cards')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors ${filterType === 'cards' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>Cartas</button>
                  <button type="button" onClick={() => setFilterType('sealed')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors ${filterType === 'sealed' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>Sellado</button>
                </div>
              )}
              
              {availableRarities.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[200px]">
                  <span className="text-sm font-bold text-gray-700">Rareza:</span>
                  <select 
                    value={filterRarity} 
                    onChange={(e) => setFilterRarity(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-sm"
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

          <div className="flex justify-center mt-4">
            <button type="submit" className="bg-[#1e40af] hover:bg-blue-800 text-white font-bold px-12 py-3 rounded-full transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2" disabled={isSearching}>
              <span translate="no" className="material-symbols-outlined">{isSearching ? 'hourglass_empty' : 'search'}</span>
              {isSearching ? 'Buscando...' : 'Buscar Cartas'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pr-2">
          {isSearching ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1e40af] mb-4"></div>
              <p className="text-gray-500 font-bold animate-pulse">Consultando la Pokédex mundial...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
            {searchResults.slice(0, visibleCount).map(card => (
            <div key={card.id} className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 bg-white shadow-sm ${selectedCard?.id === card.id ? 'border-[#1e40af] shadow-md scale-[1.02]' : 'border-gray-200 hover:border-[#1e40af]/50'}`} onClick={() => { 
              setSelectedCard(card); setPrice(''); setStock(''); setPseudoName(''); 
              if (window.innerWidth < 1024) {
                setTimeout(() => {
                  document.getElementById('add-catalog-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }
            }}>
              <div className="relative w-full aspect-[63/88] flex items-center justify-center bg-gray-50 p-2">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                </div>
                <img src={card.imageUrl} referrerPolicy="no-referrer" alt={card.name} loading="lazy" className="w-full h-full object-contain filter drop-shadow-sm relative z-10 transition-opacity duration-300 opacity-0" onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); e.currentTarget.previousSibling.style.display = 'none'; }} />
              </div>
              <div className="p-3 text-center border-t border-gray-100">
                <p className="font-bold text-sm text-gray-900 truncate">{card.name}</p>
                <p className="text-xs text-gray-500 truncate mt-1">{availableSets.find(s => s.groupId == (searchSet || card.groupId))?.name}</p>
              </div>
            </div>
          ))}
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

      {/* Lado Derecho: Añadir al Catálogo */}
      <div id="add-catalog-panel" className={`w-full max-w-[400px] lg:w-[400px] bg-white p-6 lg:p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-24 flex-shrink-0 z-10 hover:z-[60] h-fit min-h-[650px] lg:min-h-0 mx-auto lg:mx-0 self-center lg:self-start scroll-mt-24 ${!selectedCard ? 'hidden lg:block' : 'block'}`}>
        <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 border-b border-gray-200 pb-4">
          <span translate="no" className="material-symbols-outlined text-[#1e40af]">add_circle</span>
          Añadir al Catálogo
        </h2>
        {selectedCard ? (
          <form onSubmit={handleSaveCard} className="flex flex-col gap-2 mt-2">
            <div className="flex justify-center relative z-50 mb-2 mt-2">
              <div className="relative inline-block">
                <img 
                  src={getProxyImageUrl(selectedCard.tcgProductId || selectedCard.id, selectedCard.imageUrl)} 
                  alt={selectedCard.name} 
                  className="h-44 sm:h-52 aspect-[63/88] object-fill rounded-lg shadow-md hover:scale-[2.2] transition-transform duration-300 cursor-zoom-in relative z-50 hover:z-[70] origin-center" 
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
            <div className="text-center mt-2 px-2">
              <p className="font-bold text-gray-900 leading-tight">{selectedCard.name}</p>
              <p className="text-sm text-gray-500 mt-1">{availableSets.find(s => s.groupId == (searchSet || selectedCard.groupId))?.name} • {selectedCard.rarity}</p>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alias / Apodo (Opcional)</label>
              <input type="text" value={pseudoName} onChange={(e) => setPseudoName(e.target.value)} placeholder="Ej: Charizard de Ash..." maxLength={30} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Precio (CLP)*</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input type="number" required min="1" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]" placeholder="1000" />
                </div>
              </div>
              <div className="w-1/3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Stock*</label>
                <input type="number" required min="1" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-center" placeholder="1" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Idioma</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-sm">
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-4 text-[15px]">
              {isSaving ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <span translate="no" className="material-symbols-outlined">add_circle</span>}
              {isSaving ? 'Guardando...' : 'Guardar Carta'}
            </button>
            <div className="mt-2 flex justify-between gap-2">
              <a href={getTcgplayerUrl(selectedCard)} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 text-[11px] font-bold text-[#1e40af] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center gap-1">
                TCGPlayer
              </a>
              <a href={getTcgmatchUrl(selectedCard)} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 text-[11px] font-bold text-[#1e40af] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center gap-1">
                TCGMatch
              </a>
            </div>
          </form>
        ) : (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 opacity-80 border-2 border-dashed border-gray-200 rounded-xl mt-6 p-6">
            <span translate="no" className="material-symbols-outlined text-6xl mb-4 text-gray-300">style</span>
            <p className="text-sm font-bold text-center">Selecciona una carta de los resultados.</p>
          </div>
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
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border-x border-gray-300 flex flex-col items-center justify-center relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
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
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border-x border-gray-300 flex flex-col relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
          <main className="flex-1 text-gray-900 px-4 sm:px-8 py-8 flex flex-col relative z-20">
      <div className="mb-6 flex items-center gap-2 sm:gap-4 pb-4 border-b border-gray-300">
        <button 
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600 bg-white border border-gray-300 shadow-sm hover:text-[#1e40af]"
          title="Volver a mis carpetas"
        >
          <span translate="no" className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
        </button>
        <h1 className="font-headline-lg md:font-display-lg text-headline-lg md:text-display-lg text-[#1a2b4b] m-0 leading-tight truncate">Catálogo: {folderData.name}</h1>
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
          <span className="text-xs sm:text-sm">Catálogo</span>
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
          className="fixed bottom-6 right-6 bg-[#1e40af] text-white p-3 rounded-full shadow-lg hover:bg-blue-800 transition-all z-50 flex items-center justify-center transform hover:scale-110 active:scale-95 border-2 border-white/20"
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


