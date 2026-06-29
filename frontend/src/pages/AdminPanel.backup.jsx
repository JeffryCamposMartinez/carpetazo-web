import { useState, useEffect, useRef } from 'react';
import Filters from '../components/Filters';

function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('');
  const [searchSupertype, setSearchSupertype] = useState('');
  const [searchSet, setSearchSet] = useState('');
  const [availableSets, setAvailableSets] = useState([]);
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedCard, setSelectedCard] = useState(null);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const abortControllerRef = useRef(null);

  const [pendingOrders, setPendingOrders] = useState([]);
  const [cards, setCards] = useState([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Fetch pending orders
  const fetchOrders = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/orders');
      const result = await response.json();
      if (result.success) {
        setPendingOrders(result.data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const fetchCards = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/cards');
      const result = await response.json();
      if (result.success) {
        setCards(result.data);
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchCards();
    const interval = setInterval(fetchOrders, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Cancela la búsqueda si se cambian los filtros mientras se busca
  useEffect(() => {
    if (isSearching && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSearching(false);
    }
  }, [searchQuery, searchType, searchSupertype, searchSet]);

  const POKEMON_TYPES = [
    { id: "Colorless", label: "Incoloro" },
    { id: "Darkness", label: "Siniestro" },
    { id: "Dragon", label: "Dragón" },
    { id: "Fairy", label: "Hada" },
    { id: "Fighting", label: "Lucha" },
    { id: "Fire", label: "Fuego" },
    { id: "Grass", label: "Planta" },
    { id: "Lightning", label: "Eléctrico" },
    { id: "Metal", label: "Metálico" },
    { id: "Psychic", label: "Psíquico" },
    { id: "Water", label: "Agua" }
  ];

  useEffect(() => {
    // 1. Intentar cargar desde caché (localStorage) para que sea instantáneo
    const cachedSets = localStorage.getItem('pokemon_tcg_sets');
    if (cachedSets) {
      try {
        setAvailableSets(JSON.parse(cachedSets));
      } catch (e) {
        console.error("Error parsing cached sets", e);
      }
    }

    // 2. Hacer la petición de fondo para actualizar si hay expansiones nuevas
    fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setAvailableSets(data.data);
          localStorage.setItem('pokemon_tcg_sets', JSON.stringify(data.data));
        }
      })
      .catch(err => console.error("Error fetching sets:", err));
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() && !searchType && !searchSupertype && !searchSet) return;
    
    // Si ya hay una búsqueda, la cancelamos antes de empezar otra
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsSearching(true);
    try {
      let queryStr = [];
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        if (query.includes('/')) {
          // Formato como "15/165" o "015/165"
          let cardNum = query.split('/')[0].trim();
          if (/^0+\d+$/.test(cardNum)) cardNum = cardNum.replace(/^0+/, ''); // Quitar ceros a la izquierda
          queryStr.push(`number:"${cardNum}"`);
        } else {
          // Si escriben solo un número o texto
          let cleanNum = query;
          if (/^0+\d+$/.test(cleanNum)) cleanNum = cleanNum.replace(/^0+/, '');
          queryStr.push(`(name:"${query}"* OR number:"${cleanNum}")`);
        }
      }
      
      if (searchSupertype) queryStr.push(`supertype:"${searchSupertype}"`);
      
      if (searchType) {
        if (searchSupertype === 'Energy') {
          // Energy cards often don't have the 'types' array in the API, they just have the type in the name
          queryStr.push(`(name:"${searchType}" OR types:"${searchType}")`);
        } else {
          queryStr.push(`types:"${searchType}"`);
        }
      }
      
      if (searchSet) queryStr.push(`set.id:"${searchSet}"`);
      
      const finalQuery = queryStr.join(' ');
      const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(finalQuery)}`, { signal });
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Búsqueda cancelada por el usuario o nuevo filtro.');
      } else {
        console.error("Error searching cards:", error);
        alert('Error al buscar cartas en la API');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const getTcgplayerUrl = (card) => {
    if (!card) return '#';
    
    // Crear el código de la carta (ej. 015/165)
    let code = card.number || '';
    if (card.set && card.set.printedTotal) {
      let numStr = card.number.toString();
      let totalStr = card.set.printedTotal.toString();
      
      // Añadir ceros a la izquierda para que sean de 3 dígitos (si son solo números)
      if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
      if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
      
      code = `${numStr}/${totalStr}`;
    }
    
    // Buscar en TCGPlayer por nombre y código para mayor precisión
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

  const handleSelectCard = (card) => {
    setSelectedCard(card);
    setPrice(''); // No autocompletar, solo mostrar como referencia
    setStock('');
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!selectedCard || !price || !stock) return;

    setIsSaving(true);
    
    const cardData = {
      id: selectedCard.id,
      name: selectedCard.name,
      hp: selectedCard.hp || 'N/A',
      price: parseFloat(price),
      stock: parseInt(stock),
      imageUrl: selectedCard.images?.large || selectedCard.images?.small,
      types: selectedCard.types || [],
      set: selectedCard.set?.name || 'Unknown',
      rarity: selectedCard.rarity || 'Unknown',
      supertype: selectedCard.supertype || 'Unknown'
    };

    try {
      const response = await fetch('http://localhost:8000/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cardData)
      });
      
      const result = await response.json();
      if (result.success) {
        alert('¡Carta guardada en el catálogo exitosamente!');
        setSelectedCard(null);
      } else {
        alert('Error al guardar la carta');
      }
    } catch (error) {
      console.error("Error saving card:", error);
      alert('Error de conexión al guardar la carta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessOrder = async (code) => {
    if (!code) return;
    setIsProcessingOrder(true);
    try {
      const response = await fetch('http://localhost:8000/api/process-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const result = await response.json();
      if (result.success) {
        fetchCards();
        fetchOrders();
      } else {
        alert(result.message || 'Error al procesar la orden.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al procesar el pedido.');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const handleRejectOrder = async (code) => {
    if (!code) return;
    try {
      const response = await fetch('http://localhost:8000/api/reject-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const result = await response.json();
      if (result.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };


  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-lg border border-surface-container w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <span className="material-symbols-outlined text-4xl text-primary mb-2">lock</span>
            <h2 className="font-headline-md text-headline-md text-on-background">Acceso Administrativo</h2>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button type="submit" className="bg-primary hover:bg-primary/90 text-on-primary font-label-md py-3 rounded-lg transition-colors shadow-sm">
              Entrar al Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xl">
      <div className="mb-lg">
        <h1 className="font-headline-lg md:font-display-lg text-headline-lg md:text-display-lg text-on-background mb-xs">Panel de Control</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Gestiona tus ventas y añade nuevas cartas a tu catálogo buscando en la base de datos oficial.</p>
      </div>

      {pendingOrders.length > 0 && (
        <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container shadow-sm mb-6">
          <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">notifications_active</span>
            Solicitudes Pendientes ({pendingOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map(order => {
              const formatCLP = (price) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
              return (
                <div key={order.code} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-surface-container pb-2">
                    <span className="font-label-lg font-bold text-on-surface">Ref: {order.code}</span>
                    <span className="text-sm text-on-surface-variant">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <ul className="text-sm flex-1 space-y-1">
                    {order.items.map((item, i) => {
                      const card = cards.find(c => c.id === item.id);
                      return (
                        <li key={i} className="flex justify-between">
                          <span className="truncate pr-2">{item.q}x {card ? card.name : item.id}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex justify-between items-center pt-2 border-t border-surface-container">
                    <span className="font-title-md text-secondary font-bold">{formatCLP(order.totalAmount || 0)}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRejectOrder(order.code)}
                        className="w-10 h-10 rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-white flex items-center justify-center transition-colors"
                        title="Rechazar y eliminar solicitud"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                      <button 
                        onClick={() => handleProcessOrder(order.code)}
                        disabled={isProcessingOrder}
                        className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container hover:bg-primary hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Venta concretada (descontar stock)"
                      >
                        <span className="material-symbols-outlined text-[20px]">check</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Lado Izquierdo: Buscador de API */}
        <div className="flex-1 bg-surface-container-low p-6 rounded-2xl border border-surface-container shadow-sm">
          <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary">search</span>
            Buscar en Pokémon TCG
          </h2>
          
          <form onSubmit={handleSearch} className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre (ej. Pikachu) o Código (ej. 15/165)"
                className="flex-1 px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <Filters 
                selectedSupertype={searchSupertype}
                onSupertypeChange={setSearchSupertype}
                selectedType={searchType}
                onTypeChange={setSearchType}
                title=""
                subtitle=""
                showCounts={false}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-4">
              {/* Custom Dropdown for Sets to allow height restriction and scroll */}
              <div className="relative flex-1 min-w-[200px]">
                <div 
                  className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface text-on-surface cursor-pointer flex justify-between items-center"
                  onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
                >
                  <span className="truncate">
                    {searchSet === '' ? 'Todas las ediciones' : availableSets.find(s => s.id === searchSet)?.name || 'Seleccionado'}
                  </span>
                  <span className="material-symbols-outlined ml-2 text-on-surface-variant">expand_more</span>
                </div>
                
                {isSetDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsSetDropdownOpen(false)}
                    ></div>
                    <div className="absolute z-20 w-full mt-1 bg-surface-container-highest border border-surface-container rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                      <div 
                        className={`px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-2 ${searchSet === '' ? 'text-primary' : 'text-on-surface'}`}
                        onClick={() => {
                          setSearchSet('');
                          setIsSetDropdownOpen(false);
                        }}
                      >
                        {searchSet === '' && <span className="material-symbols-outlined text-sm">check</span>}
                        <span className={searchSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                      </div>
                      
                      {availableSets.map(set => (
                        <div 
                          key={set.id}
                          className={`px-4 py-2 cursor-pointer hover:bg-surface-container-high transition-colors flex items-center gap-2 ${searchSet === set.id ? 'text-primary' : 'text-on-surface'}`}
                          onClick={() => {
                            setSearchSet(set.id);
                            setIsSetDropdownOpen(false);
                          }}
                        >
                          {searchSet === set.id && <span className="material-symbols-outlined text-sm">check</span>}
                          <span className={searchSet !== set.id ? 'ml-6' : ''}>{set.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex justify-center mt-4">
              <button 
                type="submit" 
                className="bg-primary hover:bg-primary/90 text-on-primary font-label-md px-12 py-3.5 rounded-full transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-2" 
                disabled={isSearching}
              >
                <span className="material-symbols-outlined">{isSearching ? 'hourglass_empty' : 'search'}</span>
                {isSearching ? 'Buscando...' : 'Buscar Cartas'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {isSearching ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mb-4"></div>
                <p className="text-on-surface-variant font-body-md animate-pulse">Consultando la Pokédex mundial...</p>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(card => (
              <div 
                key={card.id} 
                className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 bg-surface-container ${selectedCard?.id === card.id ? 'border-primary shadow-md scale-[1.02]' : 'border-transparent hover:border-outline-variant'}`}
                onClick={() => handleSelectCard(card)}
              >
                <img src={card.images?.small} alt={card.name} className="w-full h-auto object-cover" />
                <div className="p-2 text-center">
                  <p className="font-label-sm text-on-background truncate">{card.name}</p>
                  <p className="text-xs text-on-surface-variant truncate">{card.set?.name}</p>
                  {card.types && <p className="text-[10px] text-primary mt-1 font-bold">{card.types.join(', ')}</p>}
                </div>
              </div>
            ))
            ) : (
                <div className="col-span-full py-12 text-center text-on-surface-variant flex flex-col items-center">
                    <span className="material-symbols-outlined text-5xl mb-3 opacity-30">travel_explore</span>
                    <p>Realiza una búsqueda usando los filtros de arriba para empezar.</p>
                </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Añadir al Catálogo */}
        <div className="lg:w-[400px] bg-surface-container-highest p-6 rounded-2xl shadow-sm h-fit border border-surface-container">
          <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_circle</span>
            Añadir al Catálogo
          </h2>
          
          {selectedCard ? (
            <form onSubmit={handleSaveCard} className="flex flex-col gap-4 mt-6">
              <div className="flex justify-center mb-2">
                <img src={selectedCard.images?.small} alt={selectedCard.name} className="w-32 rounded-lg shadow-md" />
              </div>
              <div className="text-center mb-4">
                  <h3 className="font-headline-md text-on-background">{selectedCard.name}</h3>
                  <p className="text-sm text-on-surface-variant mb-3">{selectedCard.set?.name} • {selectedCard.rarity}</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center w-full mt-4">
                    <a 
                      href={getTcgplayerUrl(selectedCard)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 justify-center items-center gap-2 bg-surface-container-highest text-primary hover:bg-primary hover:text-on-primary px-4 py-2.5 rounded-xl border border-outline-variant shadow-sm transition-all transform hover:scale-105"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      <span className="font-label-sm font-bold tracking-wider">TCGPLAYER</span>
                    </a>
                    
                    <a 
                      href={getTcgmatchUrl(selectedCard)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 justify-center items-center gap-2 bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary px-4 py-2.5 rounded-xl border border-outline-variant shadow-sm transition-all transform hover:scale-105"
                    >
                      <span className="material-symbols-outlined text-sm">search</span>
                      <span className="font-label-sm font-bold tracking-wider">TCGMATCH</span>
                    </a>
                  </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface-variant">Precio (CLP):</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Ej. 1500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-on-surface-variant">Stock Inicial:</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-on-primary font-label-md py-3 rounded-lg transition-colors shadow-sm mt-4" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar Carta en Catálogo'}
              </button>
            </form>
          ) : (
            <div className="mt-8 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">style</span>
              <p>Selecciona una carta de los resultados de búsqueda para añadirla a tu catálogo.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default AdminPanel;
