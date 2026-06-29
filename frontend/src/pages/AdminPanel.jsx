import { useState, useEffect, useRef } from 'react';
import Filters from '../components/Filters';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

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
    <div className="bg-surface rounded-2xl border border-outline-variant flex flex-col shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
      <button 
        onClick={() => onDelete(card.id)}
        className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-error/90 hover:bg-error text-on-error opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        title="Eliminar carta"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
      <div className="p-4 flex flex-col items-center flex-1">
        <div className="w-full relative pt-[140%] mb-3">
          <img src={card.imageUrl} alt={card.name} className="absolute inset-0 w-full h-full object-contain filter drop-shadow-md transition-transform duration-300" />
        </div>
        <p className="font-label-md font-bold text-on-background text-center line-clamp-1 w-full">{card.name}</p>
        <p className="text-[10px] text-on-surface-variant mb-4 text-center truncate w-full">
          {card.set} • {card.supertype} • #{(() => {
            let numStr = (card.number || card.id?.split('-')[1] || '').toString();
            let totalStr = (card.total || '---').toString();
            if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
            if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
            return `${numStr}/${totalStr}`;
          })()}
        </p>
        
        <div className="flex flex-col gap-2 w-full mt-auto">
           <div className="flex justify-between items-center w-full bg-surface-container-lowest px-2 py-1.5 rounded-lg border border-outline-variant shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Stock</label>
              <div className="flex items-center shadow-sm rounded-md overflow-hidden border border-outline-variant">
                <button onClick={() => setStock(Math.max(0, parseInt(stock) - 1))} className="w-6 h-6 flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors font-bold text-xs">-</button>
                <input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} className="w-10 h-6 text-center bg-surface focus:outline-none px-0 text-xs font-bold border-x border-outline-variant"/>
                <button onClick={() => setStock(parseInt(stock) + 1)} className="w-6 h-6 flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors font-bold text-xs">+</button>
              </div>
           </div>
           <div className="flex justify-between items-center w-full bg-surface-container-lowest px-2 py-1.5 rounded-lg border border-outline-variant shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Precio</label>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-xs">$</span>
                <input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} className="w-full h-6 pl-6 pr-2 bg-surface focus:outline-none text-xs font-bold rounded-md border border-outline-variant shadow-sm text-right"/>
              </div>
           </div>
        </div>
      </div>
      
      <button 
        onClick={handleSave} 
        disabled={saving || !hasChanges} 
        className={"w-full py-2.5 font-bold text-xs tracking-wide transition-colors border-t border-outline-variant flex items-center justify-center gap-1.5 " + (hasChanges ? 'bg-primary text-on-primary hover:bg-primary/90' : 'bg-surface-container-low text-on-surface-variant opacity-60')}
      >
        <span className="material-symbols-outlined text-[16px]">{saving ? 'hourglass_empty' : 'save'}</span>
        {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado'}
      </button>
    </div>
  );
};

function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'add', 'sales'

  // --- ADD TO CATALOG STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('');
  const [searchSupertype, setSearchSupertype] = useState('');
  const [searchSet, setSearchSet] = useState('');
  const [availableSets, setAvailableSets] = useState([]);
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearchedAPI, setHasSearchedAPI] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [price, setPrice] = useState('');
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
  const [catSupertype, setCatSupertype] = useState('');
  const [catType, setCatType] = useState('');
  const [catQuery, setCatQuery] = useState('');
  const [catSet, setCatSet] = useState('');
  const [isCatSetDropdownOpen, setIsCatSetDropdownOpen] = useState(false);

  // --- SALES & HISTORY STATE ---
  const [pendingOrders, setPendingOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [cards, setCards] = useState([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Fetch logic
  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      const result = await response.json();
      if (result.success) setPendingOrders(result.data);
    } catch (err) { console.error('Error fetching orders:', err); }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history');
      const result = await response.json();
      if (result.success) setHistory(result.data);
    } catch (err) { console.error('Error fetching history:', err); }
  };

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/cards');
      const result = await response.json();
      if (result.success) setCards(result.data);
    } catch (err) { console.error('Error fetching cards:', err); }
  };

  useEffect(() => {
    fetchOrders();
    fetchHistory();
    fetchCards();
    const interval = setInterval(() => {
      fetchOrders();
      fetchHistory();
    }, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Sets caching
  useEffect(() => {
    const cachedSets = localStorage.getItem('pokemon_tcg_sets');
    if (cachedSets) {
      try { setAvailableSets(JSON.parse(cachedSets)); } catch (e) {}
    }
    fetch('/api/tcg/sets')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setAvailableSets(data.data);
          localStorage.setItem('pokemon_tcg_sets', JSON.stringify(data.data));
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') setIsAuthenticated(true);
    else showToast('Contraseña incorrecta', 'error');
  };

  // --- MANEJO DE CATÁLOGO LOGIC ---
  const handleUpdateCard = async (id, newPrice, newStock) => {
    try {
      const response = await fetch('/api/cards/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, price: newPrice, stock: newStock })
      });
      const result = await response.json();
      if (result.success) {
        // Optimistic update locally
        setCards(cards.map(c => c.id === id ? { ...c, price: parseFloat(newPrice), stock: parseInt(newStock) } : c));
        showToast('Carta actualizada correctamente', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Error de conexión al actualizar la carta.', 'error');
    }
  };

  const handleDeleteRequest = (id) => {
    setConfirmDialog({ show: true, message: '¿Estás seguro de eliminar esta carta del catálogo?', targetId: id });
  };

  const executeDeleteCard = async () => {
    const id = confirmDialog.targetId;
    setConfirmDialog({ show: false, message: '', targetId: null });
    try {
      const response = await fetch('/api/cards/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (result.success) {
        setCards(cards.filter(c => c.id !== id));
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
    const matchesSupertype = catSupertype === '' || card.supertype === catSupertype;
    const matchesType = catType === '' || (card.types && card.types.includes(catType)) || (card.supertype === 'Energy' && card.name && card.name.includes(catType));
    const matchesSet = catSet === '' || card.set === availableSets.find(s => s.id === catSet)?.name;
    return matchesQuery && matchesSupertype && matchesType && matchesSet;
  });

  const renderCatalogTab = () => (
    <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container shadow-sm">
      <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-primary">inventory_2</span>
        Inventario Actual
      </h2>
      
      {/* Buscador Local */}
      <div className="flex flex-col gap-4 mb-8 bg-surface p-4 rounded-xl border border-outline-variant">
        <input 
          type="text" 
          value={catQuery}
          onChange={(e) => setCatQuery(e.target.value)}
          placeholder="Buscar por nombre en tu catálogo..."
          className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
        />
        
        <Filters 
          selectedSupertype={catSupertype}
          onSupertypeChange={setCatSupertype}
          selectedType={catType}
          onTypeChange={setCatType}
          title=""
          subtitle=""
          showCounts={false}
        />
        
        <div className="relative min-w-[200px] mt-4">
          <div 
            className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface cursor-pointer flex justify-between items-center"
            onClick={() => setIsCatSetDropdownOpen(!isCatSetDropdownOpen)}
          >
            <span className="truncate">
              {catSet === '' ? 'Todas las ediciones' : availableSets.find(s => s.id === catSet)?.name || 'Seleccionado'}
            </span>
            <span className="material-symbols-outlined ml-2 text-on-surface-variant">expand_more</span>
          </div>
          
          {isCatSetDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsCatSetDropdownOpen(false)}></div>
              <div className="absolute z-20 w-full mt-1 bg-surface-container-highest border border-surface-container rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                <div 
                  className={`px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-2 ${catSet === '' ? 'text-primary' : 'text-on-surface'}`}
                  onClick={() => { setCatSet(''); setIsCatSetDropdownOpen(false); }}
                >
                  {catSet === '' && <span className="material-symbols-outlined text-sm">check</span>}
                  <span className={catSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                </div>
                {availableSets.map(set => (
                  <div 
                    key={set.id}
                    className={`px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-2 ${catSet === set.id ? 'text-primary' : 'text-on-surface'}`}
                    onClick={() => { setCatSet(set.id); setIsCatSetDropdownOpen(false); }}
                  >
                    {catSet === set.id && <span className="material-symbols-outlined text-sm">check</span>}
                    <span className={catSet !== set.id ? 'ml-6' : ''}>{set.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredCatalog.map(card => (
          <AdminCardEdit key={card.id} card={card} onUpdate={handleUpdateCard} onDelete={handleDeleteRequest} />
        ))}
        {filteredCatalog.length === 0 && (
          <div className="col-span-full py-12 text-center text-on-surface-variant flex flex-col items-center">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-30">search_off</span>
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
  }, [searchQuery, searchType, searchSupertype, searchSet]);

  const handleSearchAPI = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() && !searchType && !searchSupertype && !searchSet) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsSearching(true);
    try {
      let queryStr = [];
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        if (query.includes('/')) {
          let cardNum = query.split('/')[0].trim();
          let cardTotal = query.split('/')[1]?.trim();
          if (/^0+\d+$/.test(cardNum)) cardNum = cardNum.replace(/^0+/, '');
          
          // Búsqueda en 2 pasos: primero encontrar el nombre de la carta exacta
          let exactQuery = `number:"${cardNum}"`;
          if (cardTotal) exactQuery += ` set.printedTotal:"${cardTotal}"`;
          
          try {
            const exactResponse = await fetch(`/api/tcg/cards?q=${encodeURIComponent(exactQuery)}`, { signal });
            const exactData = await exactResponse.json();
            if (exactData.data && exactData.data.length > 0) {
              // Escapar el nombre para coincidencia exacta
              const cardName = exactData.data[0].name.replace(/"/g, '\\"');
              queryStr.push(`name:"!${cardName}"`);
            } else {
              queryStr.push(`number:"${cardNum}"`);
            }
          } catch (err) {
            if (err.name !== 'AbortError') queryStr.push(`number:"${cardNum}"`);
            else throw err;
          }
        } else {
          let cleanNum = query;
          if (/^0+\d+$/.test(cleanNum)) cleanNum = cleanNum.replace(/^0+/, '');
          // En Lucene (Pokémon TCG API), los comodines (*) NO deben ir dentro de comillas.
          const wildcardQuery = query.replace(/\s+/g, '*');
          queryStr.push(`(name:*${wildcardQuery}* OR number:"${cleanNum}")`);
        }
      }
      if (searchSupertype) queryStr.push(`supertype:"${searchSupertype}"`);
      if (searchType) {
        if (searchSupertype === 'Energy') queryStr.push(`(name:"${searchType}" OR types:"${searchType}")`);
        else queryStr.push(`types:"${searchType}"`);
      }
      if (searchSet) queryStr.push(`set.id:"${searchSet}"`);
      
      const finalQuery = queryStr.join(' ');
      const response = await fetch(`/api/tcg/cards?q=${encodeURIComponent(finalQuery)}`, { signal });
        const data = await response.json();
        setSearchResults(data.data || []);
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

        setSelectedCard(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            isCustomImage: true,
            id: prev.id.includes('-custom-') ? prev.id : `${prev.id}-custom-${Date.now()}`,
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
      id: selectedCard.id,
      name: selectedCard.name,
      pseudoName: pseudoName.trim(),
      hp: selectedCard.hp || 'N/A',
      price: parseFloat(price),
      stock: parseInt(stock),
      imageUrl: selectedCard.images?.large || selectedCard.images?.small,
      types: selectedCard.types || [],
      set: selectedCard.set?.name || 'Unknown',
      rarity: selectedCard.rarity || 'Unknown',
      supertype: selectedCard.supertype || 'Unknown',
      number: selectedCard.number || '',
      total: selectedCard.set?.printedTotal || '',
      language: language
    };
    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });
      const result = await response.json();
      if (result.success) {
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
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Lado Izquierdo: Buscador de API */}
      <div className="flex-1 bg-surface-container-low p-6 rounded-2xl border border-surface-container shadow-sm">
        <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary">search</span>
          Buscar en Pokémon TCG
        </h2>
        
        <form onSubmit={handleSearchAPI} className="flex flex-col gap-4 mb-6">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre (ej. Pikachu) o Código (ej. 15/165)"
            className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
          />
          <Filters selectedSupertype={searchSupertype} onSupertypeChange={setSearchSupertype} selectedType={searchType} onTypeChange={setSearchType} title="" subtitle="" showCounts={false} />
          <div className="relative min-w-[200px] mt-4">
            <div className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface cursor-pointer flex justify-between items-center" onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}>
              <span className="truncate">{searchSet === '' ? 'Todas las ediciones' : availableSets.find(s => s.id === searchSet)?.name || 'Seleccionado'}</span>
              <span className="material-symbols-outlined ml-2 text-on-surface-variant">expand_more</span>
            </div>
            {isSetDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSetDropdownOpen(false)}></div>
                <div className="absolute z-20 w-full mt-1 bg-surface-container-highest border border-surface-container rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                  <div className={`px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-2 ${searchSet === '' ? 'text-primary' : 'text-on-surface'}`} onClick={() => { setSearchSet(''); setIsSetDropdownOpen(false); }}>
                    {searchSet === '' && <span className="material-symbols-outlined text-sm">check</span>}
                    <span className={searchSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                  </div>
                  {availableSets.map(set => (
                    <div key={set.id} className={`px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-2 ${searchSet === set.id ? 'text-primary' : 'text-on-surface'}`} onClick={() => { setSearchSet(set.id); setIsSetDropdownOpen(false); }}>
                      {searchSet === set.id && <span className="material-symbols-outlined text-sm">check</span>}
                      <span className={searchSet !== set.id ? 'ml-6' : ''}>{set.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex justify-center mt-4">
            <button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-label-md px-12 py-3.5 rounded-full transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2" disabled={isSearching}>
              <span className="material-symbols-outlined">{isSearching ? 'hourglass_empty' : 'search'}</span>
              {isSearching ? 'Buscando...' : 'Buscar Cartas'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pr-2">
          {isSearching ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mb-4"></div>
              <p className="text-on-surface-variant font-body-md animate-pulse">Consultando la Pokédex mundial...</p>
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map(card => (
            <div key={card.id} className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 bg-surface-container ${selectedCard?.id === card.id ? 'border-primary shadow-md' : 'border-transparent hover:border-outline-variant'}`} onClick={() => { 
              setSelectedCard(card); setPrice(''); setStock(''); setPseudoName(''); 
              if (window.innerWidth < 1024) {
                setTimeout(() => {
                  document.getElementById('add-catalog-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }
            }}>
              <div className="relative w-full aspect-[63/88] flex items-center justify-center bg-surface-container-highest">
                <img src={card.images?.small} alt={card.name} className="w-full h-full object-contain" />
              </div>
              <div className="p-2 text-center">
                <p className="font-label-sm text-on-background truncate">{card.name}</p>
                <p className="text-xs text-on-surface-variant truncate">{card.set?.name}</p>
              </div>
            </div>
          ))
          ) : hasSearchedAPI ? (
              <div className="col-span-full py-12 text-center text-on-surface-variant flex flex-col items-center">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-30">search_off</span>
                  <p>No se encontraron cartas que coincidan con tu búsqueda.</p>
              </div>
          ) : (
              <div className="col-span-full py-12 text-center text-on-surface-variant flex flex-col items-center">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-30">travel_explore</span>
                  <p>Realiza una búsqueda para empezar.</p>
              </div>
          )}
        </div>
      </div>

      {/* Lado Derecho: Añadir al Catálogo */}
      <div id="add-catalog-panel" className="w-full max-w-[400px] lg:w-[400px] bg-surface-container-highest p-6 rounded-2xl shadow-sm border border-surface-container sticky top-24 flex-shrink-0 z-10 hover:z-[60] h-fit min-h-[650px] lg:min-h-0 mx-auto lg:mx-0 self-center lg:self-start scroll-mt-24">
        <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">add_circle</span>
          Añadir al Catálogo
        </h2>
        {selectedCard ? (
          <form onSubmit={handleSaveCard} className="flex flex-col gap-2 mt-2">
            <div className="flex justify-center relative z-50 mb-2 mt-2">
              <div className="relative inline-block">
                <img 
                  src={selectedCard.images?.large || selectedCard.images?.small} 
                  alt={selectedCard.name} 
                  className="h-44 sm:h-52 w-auto object-contain rounded-lg shadow-md hover:scale-[2.2] transition-transform duration-300 cursor-zoom-in relative z-50 hover:z-[70] origin-center" 
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-3 -right-3 z-[60] bg-primary text-on-primary rounded-full w-10 h-10 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-primary/90 hover:scale-110 transition-all border-2 border-surface"
                  title="Tomar Foto / Subir Imagen"
                >
                  <span className="material-symbols-outlined text-[20px]">photo_camera</span>
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
            <div className="text-center relative z-0">
                <h3 className="font-headline-sm text-on-background leading-tight truncate">{selectedCard.name}</h3>
                <p className="text-[11px] text-on-surface-variant truncate mb-2">{selectedCard.set?.name} • {selectedCard.rarity}</p>
                <div className="flex justify-center gap-2">
                  <a 
                    href={getTcgplayerUrl(selectedCard)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex justify-center items-center gap-1 bg-surface-container-highest text-primary hover:bg-primary hover:text-on-primary px-3 py-1 rounded-md border border-outline-variant shadow-sm transition-colors text-[10px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    <span className="font-bold tracking-wider">TCGPLAYER</span>
                  </a>
                  <a 
                    href={getTcgmatchUrl(selectedCard)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex justify-center items-center gap-1 bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary px-3 py-1 rounded-md border border-outline-variant shadow-sm transition-colors text-[10px]"
                  >
                    <span className="material-symbols-outlined text-[14px]">search</span>
                    <span className="font-bold tracking-wider">TCGMATCH</span>
                  </a>
                </div>
            </div>
            
            <div className="flex gap-2 mt-1">
              <div className="flex flex-col gap-0.5 flex-1">
                <label className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">Precio (CLP):</label>
                <input type="number" min="0" step="1" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-2 py-1 rounded border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary text-sm" placeholder="Ej. 1500" />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <label className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">Stock:</label>
                <input type="number" min="0" step="1" required value={stock} onChange={(e) => setStock(e.target.value)} className="w-full px-2 py-1 rounded border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary text-sm" />
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">Apodo / Variante (Opcional):</label>
              <input 
                type="text"
                placeholder="Ej. Reverse Holo, Promo..."
                value={pseudoName}
                onChange={(e) => setPseudoName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">Idioma:</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-2 py-1 rounded border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary text-sm">
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-on-primary font-label-md py-2 rounded transition-colors shadow-sm mt-1" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar Carta'}
            </button>
          </form>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">style</span>
            <p>Selecciona una carta de los resultados.</p>
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
      const response = await fetch('/api/process-order', {
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
      const response = await fetch('/api/reject-order', {
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
          <span className="material-symbols-outlined text-secondary">notifications_active</span>
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
                    <button onClick={() => handleRejectOrder(order.code)} className="w-10 h-10 rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-white flex items-center justify-center transition-colors" title="Rechazar solicitud"><span className="material-symbols-outlined text-[20px]">close</span></button>
                    <button onClick={() => handleProcessOrder(order.code)} disabled={isProcessingOrder} className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-white flex items-center justify-center transition-colors disabled:opacity-50" title="Venta concretada"><span className="material-symbols-outlined text-[20px]">check</span></button>
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
          <span className="material-symbols-outlined text-primary">history</span>
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
                        <span className="material-symbols-outlined text-[14px]">
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

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-lg border border-surface-container w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <span className="material-symbols-outlined text-4xl text-primary mb-2">lock</span>
            <h2 className="font-headline-md text-headline-md text-on-background">Acceso Administrativo</h2>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary" />
            <button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-label-md py-3 rounded-lg transition-colors shadow-sm">Entrar al Panel</button>
          </form>
        </div>
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      </div>
    );
  }

  return (
    <main className="max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xl">
      <div className="mb-lg">
        <h1 className="font-headline-lg md:font-display-lg text-headline-lg md:text-display-lg text-on-background mb-xs">Panel de Control</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-surface-container mb-8 pb-0 custom-scrollbar">
        <button onClick={() => setActiveTab('catalog')} className={`px-6 py-4 rounded-t-xl font-label-md transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'catalog' ? 'bg-surface-container-lowest text-primary border-b-4 border-primary shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'hover:bg-surface-container text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">inventory_2</span>
          Manejo de Catálogo
        </button>
        <button onClick={() => setActiveTab('add')} className={`px-6 py-4 rounded-t-xl font-label-md transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'add' ? 'bg-surface-container-lowest text-primary border-b-4 border-primary shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'hover:bg-surface-container text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">add_circle</span>
          Agregar al Catálogo
        </button>
        <button onClick={() => setActiveTab('sales')} className={`px-6 py-4 rounded-t-xl font-label-md transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'sales' ? 'bg-surface-container-lowest text-primary border-b-4 border-primary shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'hover:bg-surface-container text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">receipt_long</span>
          Ventas y Solicitudes
          {pendingOrders.length > 0 && <span className="bg-error text-white text-xs px-2 py-0.5 rounded-full">{pendingOrders.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'catalog' && renderCatalogTab()}
        {activeTab === 'add' && renderAddTab()}
        {activeTab === 'sales' && renderSalesTab()}
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
  );
}

export default AdminPanel;
