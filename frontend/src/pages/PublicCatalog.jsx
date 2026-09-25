import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiFetch } from '../utils/api';
import PokemonCard from '../components/PokemonCard';
import AlbumView from '../components/AlbumView';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PublicCatalogFilters from '../components/folder/filters/PublicCatalogFilters';

const isLocalhostWithProductionApi = () => {
  if (typeof window === 'undefined') return false;
  const apiUrl = import.meta.env.VITE_API_URL || 'https://api.carpetazo.cl/api';
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) && apiUrl.includes('api.carpetazo.cl');
};

function PublicCatalog() {
  const { folderId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [cards, setCards] = useState([]);
  const [folderData, setFolderData] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const showToast = (message, type = 'info') => setToast({ message, type });
  
  const [selectedSupertype, setSelectedSupertype] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSet, setSearchSet] = useState('');
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState('album');
  const [mylType, setMylType] = useState('');
  const [mylRace, setMylRace] = useState('');
  const [mylCost, setMylCost] = useState('');
  const [mylFilterOptions, setMylFilterOptions] = useState({ types: [], races: [], costs: [], rarities: [] });
  
  const [appliedFilters, setAppliedFilters] = useState({
    query: '', set: '', supertype: '', type: '', mylType: '', mylRace: '', mylCost: ''
  });

  useEffect(() => {
    const queryParam = searchParams.get('q') || '';
    const setParam = searchParams.get('set') || '';
    const supertypeParam = searchParams.get('supertype') || '';
    const typeParam = searchParams.get('type') || '';
    const raceParam = searchParams.get('race') || '';
    const costParam = searchParams.get('cost') || '';

    setSearchQuery(queryParam);
    setSearchSet(setParam);
    setSelectedSupertype(supertypeParam);
    setSelectedType(typeParam);
    setMylType(typeParam);
    setMylRace(raceParam);
    setMylCost(costParam);
    setAppliedFilters({
      query: queryParam,
      set: setParam,
      supertype: supertypeParam,
      type: typeParam,
      mylType: typeParam,
      mylRace: raceParam,
      mylCost: costParam,
    });
  }, [folderId]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchCatalogData = async () => {
      try {
                const response = await apiFetch('/folders/' + folderId);
        if (!response.success || !response.folder) {
          setErrorMsg("La carpeta no existe o fue eliminada.");
          setLoading(false);
          return;
        }
        const folder = response.folder;
        setFolderData(folder);

                // Track folder visits
        if (!currentUser || currentUser.uid !== folder.userId) {
          const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
          apiFetch('/folders/' + folderId + '/visit', { method: 'POST', body: JSON.stringify({ currentWeek }) }).catch(err => console.error("Error updating visits", err));
        }

                        if (folder.user) {
          let mergedUser = { 
            ...folder.user, 
            displayName: folder.user.name || folder.user.username,
            avatarBase64: folder.user.photoURL
          };
          if (folder.user.firebaseUid && window.location.protocol !== 'http:') {
            try {
              
              const userSnap = await getDoc(doc(db, 'users', folder.user.firebaseUid));
              if (userSnap.exists()) {
                mergedUser = { ...mergedUser, ...userSnap.data() };
              }
            } catch (e) {
              console.warn("No se pudieron cargar datos extendidos del vendedor desde Firestore; usando datos públicos del backend.", e?.message || e);
            }
          }
          setSellerData(mergedUser);
        }

        let cardsList = (folder.cards || []).map(c => ({ ...c, apiId: c.tcgId || c.id, ...(c.data || {}) }));

        if (folder.tcg === 'Mitos y Leyendas') {
          const ids = cardsList.map(card => card.tcgId || card.apiId).filter(Boolean);
          const needsMetadata = cardsList.some(card => !card.type || !card.race || card.cost === undefined || card.cost === null || !card.effect);
          try {
            if (needsMetadata && ids.length > 0 && !isLocalhostWithProductionApi()) {
              const metadataResponse = await api.getTcgProductsMetadata(ids);
              const metadataById = metadataResponse?.data || {};
              cardsList = cardsList.map(card => {
                const metadata = metadataById[String(card.tcgId || card.apiId)] || {};
                return {
                  ...card,
                  set: card.set && card.set !== 'Unknown' ? card.set : metadata.set || card.set,
                  type: card.type || metadata.type || card.supertype,
                  race: card.race || metadata.race || card.subtype,
                  cost: card.cost ?? metadata.cost,
                  effect: card.effect || metadata.effect,
                  rarity: card.rarity && card.rarity !== 'Unknown' ? card.rarity : metadata.rarity || card.rarity,
                  number: card.number || metadata.number,
                };
              });
            }
          } catch (metadataError) {
            console.warn('No se pudieron enriquecer las cartas MYL con metadatos TCG.', metadataError?.message || metadataError);
          }
        }

        setCards(cardsList);
        
      } catch (error) {
        console.error("Error fetching catalog:", error);
        setErrorMsg("Hubo un error al cargar el catálogo.");
      } finally {
        setLoading(false);
      }
    };
    
    if (folderId) fetchCatalogData();
  }, [folderId]);

  useEffect(() => {
    if (folderData?.tcg !== 'Mitos y Leyendas') return;
    const localOptions = {
      types: [...new Set(cards.map(card => card.type || card.supertype).filter(Boolean))].sort(),
      races: [...new Set(cards.flatMap(card => String(card.race || '').split(',').map(value => value.trim())).filter(Boolean))].sort(),
      costs: [...new Set(cards.map(card => card.cost).filter(value => value !== undefined && value !== null && value !== '').map(String))]
        .sort((a, b) => Number(a) - Number(b)),
      rarities: [...new Set(cards.map(card => card.rarity).filter(Boolean))].sort(),
    };

    if (localOptions.types.length || localOptions.races.length || localOptions.costs.length) {
      setMylFilterOptions(localOptions);
      return;
    }

    if (isLocalhostWithProductionApi()) {
      setMylFilterOptions({ types: [], races: [], costs: [], rarities: [] });
      return;
    }

    api.getTcgFilterOptions('99')
      .then((result) => {
        if (result.success) {
          setMylFilterOptions(result.data || { types: [], races: [], costs: [], rarities: [] });
        }
      })
      .catch((error) => {
        console.warn('No se pudieron cargar opciones MYL desde la base de datos.', error?.message || error);
      });
  }, [folderData?.tcg, cards]);

  const addToCart = useCallback((card) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === card.id);
      if (existing) {
        if (existing.quantity < existing.stock) {
            return prev.map(item => 
              item.id === card.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        }
        return prev;
      }
      return [...prev, { ...card, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((cardId) => setCart(prev => prev.filter(item => item.id !== cardId)), []);

  const decrementCart = useCallback((cardId) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === cardId);
      if (existing) {
        if (existing.quantity > 1) {
          return prev.map(item => item.id === cardId ? { ...item, quantity: item.quantity - 1 } : item);
        } else {
          return prev.filter(item => item.id !== cardId);
        }
      }
      return prev;
    });
  }, []);

  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (Number(item.price || 0) * item.quantity), 0), [cart]);
  const cartItemsCount = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart]);

  const formatCLP = (price) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSearchSet('');
    setSelectedSupertype('');
    setSelectedType('');
    setMylType('');
    setMylRace('');
    setMylCost('');
  }, []);

  const scrollCatalogTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);


  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const handleWhatsAppCheckout = async () => {
    if (cart.length === 0) return;
    
    const phone = sellerData?.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      alert("El vendedor no tiene un número de contacto configurado.");
      return;
    }
    
    const formattedPhone = phone.startsWith('56') ? phone : `56${phone}`;
    
    // Abrir ventana síncronamente para evitar bloqueo de pop-ups
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('Generando tu pedido, por favor espera...');
    }
    
    setIsProcessingCheckout(true);
    try {
            // 1. Guardar la orden en la base de datos
      await api.post('/orders/create', {
        sellerId: folderData.userId,
        buyerName: 'Cliente por WhatsApp',
        folderId: folderId,
        folderName: folderData.name || 'Catálogo',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: cartTotal
      });

      // 2. Generar el mensaje y redirigir
      let message = `¡Hola! Vengo de Carpetazo. Me interesa comprar estas cartas de la carpeta "${folderData?.name || 'Catálogo'}":\n\n`;
      cart.forEach(item => {
        message += `• ${item.quantity}x ${item.name} (${item.set}) - ${formatCLP(Number(item.price || 0) * item.quantity)}\n`;
      });
      message += `\nTotal: ${formatCLP(cartTotal)}\n\n¿Tienes disponibilidad?`;
      
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      
      if (newWindow) {
        newWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl; // fallback si el navegador bloquea incluso el window.open síncrono
      }

      setCart([]);
      setIsCartOpen(false);
      showToast("Pedido generado correctamente", "success");
    } catch (error) {
      console.error("Error al generar pedido:", error);
      if (newWindow) newWindow.close();
      showToast("Hubo un error al procesar el pedido.", "error");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const counts = useMemo(() => ({
    pokemon: cards.filter(c => c.supertype === 'Pokémon').length,
    trainers: cards.filter(c => c.supertype === 'Trainer').length,
    energy: cards.filter(c => c.supertype === 'Energy').length
  }), [cards]);

  const availableSets = useMemo(() => [...new Set(cards.map(c => c.set).filter(Boolean))].sort(), [cards]);

  useEffect(() => {
    const nextFilters = {
      query: searchQuery,
      set: searchSet,
      supertype: selectedSupertype,
      type: selectedType,
      mylType,
      mylRace,
      mylCost,
    };
    setAppliedFilters(nextFilters);

    const nextParams = new URLSearchParams();
    if (nextFilters.query) nextParams.set('q', nextFilters.query);
    if (nextFilters.set) nextParams.set('set', nextFilters.set);
    if (folderData?.tcg === 'Mitos y Leyendas') {
      if (nextFilters.mylType) nextParams.set('type', nextFilters.mylType);
      if (nextFilters.mylRace) nextParams.set('race', nextFilters.mylRace);
      if (nextFilters.mylCost) nextParams.set('cost', nextFilters.mylCost);
    } else {
      if (nextFilters.supertype) nextParams.set('supertype', nextFilters.supertype);
      if (nextFilters.type) nextParams.set('type', nextFilters.type);
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchQuery, searchSet, selectedSupertype, selectedType, mylType, mylRace, mylCost, folderData?.tcg, setSearchParams]);

  const filteredCards = useMemo(() => cards
    .filter(card => folderData?.tcg === 'Mitos y Leyendas' || appliedFilters.supertype === '' || card.supertype === appliedFilters.supertype)
    .filter(card => folderData?.tcg === 'Mitos y Leyendas' || appliedFilters.type === '' || (card.types && card.types.includes(appliedFilters.type)) || (card.supertype === 'Energy' && card.name && card.name.includes(appliedFilters.type)))
    .filter(card => folderData?.tcg !== 'Mitos y Leyendas' || appliedFilters.mylType === '' || [card.type, card.cardType, card.supertype].filter(Boolean).includes(appliedFilters.mylType))
    .filter(card => {
      if (folderData?.tcg !== 'Mitos y Leyendas' || appliedFilters.mylRace === '') return true;
      const races = [card.race, card.subtype, ...(card.types || [])]
        .filter(Boolean)
        .flatMap(value => String(value).split(',').map(item => item.trim()));
      return races.includes(appliedFilters.mylRace);
    })
    .filter(card => folderData?.tcg !== 'Mitos y Leyendas' || appliedFilters.mylCost === '' || String(card.cost ?? card.manaCost ?? '') === String(appliedFilters.mylCost))
    .filter(card => appliedFilters.set === '' || card.set === appliedFilters.set)
    .filter(card => {
      if (!appliedFilters.query) return true;
      const query = appliedFilters.query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const haystack = [
        card.name,
        card.id,
        card.number,
        card.set,
        card.type,
        card.cardType,
        card.race,
        card.subtype,
      ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return haystack.includes(query);
    }), [cards, appliedFilters, folderData?.tcg]);

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300 flex flex-col items-center justify-center relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center bg-[#DBEAFE] p-6 relative z-10">
        <span translate="no" className="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <h2 className="text-2xl font-bold mb-6 text-[#1a2b4b] text-center max-w-md leading-snug">{errorMsg}</h2>
        <Link to="/" className="bg-[#1e40af] hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
      {/* Seller info banner */}
      <div className="relative border-b border-gray-200 md:border-x shadow-sm py-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6 overflow-hidden bg-white">
        
        {/* Background Image with 100% Opacity */}
        {sellerData?.bannerBase64 && (
          <div 
            className="absolute inset-0 z-0" 
            style={{ 
              backgroundImage: `url(${sellerData.bannerBase64})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center'
            }}
          ></div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-5 w-full md:w-auto">
          {/* Compact card with avatar inside */}
          <div
            className={"flex items-center gap-4 p-4 w-full md:w-[480px] rounded-2xl border transition-all " +
              (sellerData?.bannerBase64 
                ? "bg-white/70 backdrop-blur-md shadow-xl border-white/40" 
                : "bg-gray-50 border-gray-200")}
            style={sellerData?.bannerComplementaryColor ? { borderColor: sellerData.bannerComplementaryColor } : {}}
          >
            {/* Avatar inside card */}
            <Link to={`/${sellerData?.username || folderData.userId}`} className="w-16 h-16 rounded-full border-2 border-white shadow-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0 hover:scale-105 transition-transform">
              {(sellerData?.avatarBase64 || sellerData?.photoURL) ? (
                <img src={sellerData?.avatarBase64 || sellerData?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1a2b4b] to-[#3b82f6] flex items-center justify-center text-white text-2xl font-black">
                  {(sellerData?.displayName || 'V')[0].toUpperCase()}
                </div>
              )}
            </Link>

            {/* Text info next to avatar */}
            <div className="flex flex-col text-left flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-base font-black text-[#1a2b4b] leading-tight">
                  {sellerData?.displayName || 'Vendedor Anónimo'}
                </span>
                {(sellerData?.isVerified || true) && (
                  <span translate="no" className="material-symbols-outlined text-[#3b82f6] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }} title="Vendedor Verificado">verified</span>
                )}
              </div>
              {sellerData?.fullName && <p className="text-gray-500 text-[11px] font-semibold truncate">{sellerData.fullName}</p>}
              
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {(sellerData?.totalTrades > 0) ? (
                  <>
                    <div className="flex items-center gap-0.5 bg-white/60 px-1.5 py-0.5 rounded-md border border-yellow-300">
                      <span translate="no" className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[#1a2b4b] font-extrabold text-[11px]">{sellerData?.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] font-semibold">{sellerData?.totalTrades} reseñas</span>
                  </>
                ) : (
                  <span className="text-gray-500 text-[10px] font-semibold bg-white/50 px-2 py-0.5 rounded-full border border-gray-200">Nuevo Vendedor</span>
                )}
              </div>
              {sellerData?.bio && (
                <p className="text-gray-600 italic text-[10px] mt-1.5 line-clamp-2 border-l-2 border-primary/40 pl-2">"{sellerData.bio}"</p>
              )}
            </div>
          </div>
        </div>

        {/* Folder Title and Buttons Row */}
        <div className="relative z-10 flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
          <h1 className={`text-3xl font-black text-[#1a2b4b] mb-1 ${sellerData?.bannerBase64 ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : ''}`}>
            {folderData.name}
          </h1>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Location (City/Region only) */}
            {(() => {
              const defaultAddress = sellerData?.addresses?.find(a => a.isDefault) || sellerData?.addresses?.[0];
              if (defaultAddress) {
                const locationText = [defaultAddress.comuna, defaultAddress.region].filter(Boolean).join(', ');
                const displayText = defaultAddress.name ? `${defaultAddress.name} - ${locationText}` : locationText;
                return (
                  <span className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 shadow-sm text-xs font-semibold">
                    <span translate="no" className="material-symbols-outlined text-[16px]">location_on</span>
                    {displayText}
                  </span>
                );
              }
              if (sellerData?.region || sellerData?.comuna) {
                return (
                  <span className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 shadow-sm text-xs font-semibold">
                    <span translate="no" className="material-symbols-outlined text-[16px]">location_on</span>
                    {[sellerData.comuna, sellerData.region].filter(Boolean).join(', ')}
                  </span>
                );
              }
              return null;
            })()}

            {/* Mensaje Privado (Direct Chat) */}
            {sellerData && currentUser && currentUser.uid !== folderData.userId && (
              <button 
                onClick={() => navigate('/mensajes', { state: { startChatWith: { id: folderData.userId, name: sellerData.displayName || 'Vendedor', avatar: sellerData.avatarBase64 || sellerData.photoURL || null } } })}
                className="flex items-center gap-1 bg-[#1e40af] hover:bg-blue-800 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md hover:scale-105 transition-all cursor-pointer"
              >
                <span translate="no" className="material-symbols-outlined text-[16px]">chat</span>
                Mensaje Privado
              </button>
            )}

            {/* WhatsApp */}
            {sellerData?.phone && (
              <a href={`https://wa.me/${sellerData.phone.replace(/[^0-9]/g, '').startsWith('56') ? sellerData.phone.replace(/[^0-9]/g, '') : '56' + sellerData.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-full border border-green-200 shadow-sm transition-colors cursor-pointer text-xs font-bold">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.12.553 4.184 1.594 6.02L.05 24l6.115-1.604A11.956 11.956 0 0012.031 24c6.646 0 12.031-5.385 12.031-12.031C24.062 5.385 18.677 0 12.031 0zm0 22.012a9.98 9.98 0 01-5.1-1.393l-.365-.217-3.791.993.993-3.791-.217-.365A9.972 9.972 0 012.019 12.03c0-5.526 4.492-10.018 10.012-10.018s10.012 4.492 10.012 10.018c0 5.526-4.492 10.012-10.012 10.012zm5.496-7.514c-.301-.151-1.782-.88-2.058-.98-.276-.101-.477-.151-.678.151-.201.301-.778.98-.954 1.181-.176.201-.352.226-.653.075-1.428-.713-2.584-1.928-3.23-3.35-.101-.201-.01-.301.14-.452.126-.126.301-.352.452-.528.151-.176.201-.301.301-.502.101-.201.05-.377-.025-.528-.075-.151-.678-1.631-.928-2.234-.251-.603-.502-.528-.678-.528-.176 0-.377-.01-.578-.01-.201 0-.528.075-.803.377-.276.301-1.054 1.03-1.054 2.51 0 1.48 1.079 2.912 1.23 3.113.151.201 2.133 3.263 5.17 4.568 1.958.841 2.684.904 3.588.753.904-.151 2.861-1.168 3.263-2.302.402-1.134.402-2.108.276-2.309-.125-.201-.452-.301-.753-.452z"/></svg>
                WhatsApp
              </a>
            )}

            {/* Instagram */}
            {sellerData?.instagramUrl && (
              <a href={`https://instagram.com/${sellerData.instagramUrl.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-pink-50 hover:bg-pink-100 text-pink-600 px-3 py-1.5 rounded-full border border-pink-200 shadow-sm transition-colors cursor-pointer text-xs font-bold">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                Instagram
              </a>
            )}
          </div>

          <Link to={`/${sellerData?.username || folderData.userId}`} className="flex items-center gap-1.5 text-xs font-bold text-[#1e40af] hover:text-blue-800 transition-colors group mt-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
            <span>Ver catálogo completo del vendedor</span>
            <span translate="no" className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>
      </div>

      <button 
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-[80px] right-4 z-30 flex min-h-14 items-center gap-2 rounded-full bg-primary px-4 py-3 text-on-primary shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <span translate="no" className="material-symbols-outlined" data-icon="shopping_cart">shopping_cart</span>
        {cartItemsCount > 0 ? (
          <>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-primary">{cartItemsCount}</span>
            <span className="hidden text-xs font-black leading-tight min-[390px]:block">{formatCLP(cartTotal)}</span>
          </>
        ) : (
          <span className="sr-only">Abrir carrito</span>
        )}
      </button>

      <div className="fixed bottom-[150px] right-5 z-30 flex flex-col items-center gap-2.5 md:bottom-[104px] md:right-10">
        <button
          type="button"
          onClick={clearFilters}
          title="Limpiar filtros"
          aria-label="Limpiar filtros"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg ring-1 ring-slate-100 transition-all hover:-translate-y-0.5 hover:text-[#1e40af] hover:shadow-xl md:h-12 md:w-12"
        >
          <span translate="no" className="material-symbols-outlined text-[22px] md:text-[24px]">filter_alt_off</span>
        </button>

        <button
          type="button"
          onClick={scrollCatalogTop}
          title="Subir al inicio"
          aria-label="Subir al inicio"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-lg ring-2 ring-white/30 transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-xl md:h-12 md:w-12"
        >
          <span translate="no" className="material-symbols-outlined text-[25px] md:text-[27px]">arrow_upward</span>
        </button>
      </div>
        <div className="w-full overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-b border-gray-300 flex flex-col relative z-10 min-h-[calc(100vh-200px)] bg-[#DBEAFE]">
          <main className="flex-1 text-gray-900 px-4 sm:px-8 py-8 flex flex-col relative z-20">
            <div className="bg-white p-3 md:p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
          <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_auto] gap-2 md:flex md:flex-row">
              <div className="flex-1 relative">
                <span translate="no" className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">search</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar nombre de carta o número..."
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] transition-all text-xs font-medium md:rounded-xl md:pl-11 md:pr-4 md:py-2.5 md:text-sm"
                />
              </div>
              <button type="button" onClick={() => setSearchQuery(searchQuery.trim())} className="bg-[#1e40af] hover:bg-blue-800 text-white font-bold px-3 py-2 rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-1.5 flex-shrink-0 md:w-auto md:rounded-xl md:px-8 md:py-2.5 text-xs md:text-sm">
                <span translate="no" className="material-symbols-outlined text-[17px] md:text-[18px]">search</span>
                <span className="hidden min-[360px]:inline">Aplicar</span>
              </button>
            </div>
            
            <PublicCatalogFilters
              tcg={folderData?.tcg}
              cards={cards}
              counts={counts}
              selectedSupertype={selectedSupertype}
              onSupertypeChange={setSelectedSupertype}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              searchSet={searchSet}
              setSearchSet={setSearchSet}
              availableSets={availableSets}
              isSetDropdownOpen={isSetDropdownOpen}
              setIsSetDropdownOpen={setIsSetDropdownOpen}
              mylType={mylType}
              setMylType={setMylType}
              mylRace={mylRace}
              setMylRace={setMylRace}
              mylCost={mylCost}
              setMylCost={setMylCost}
              mylFilterOptions={mylFilterOptions}
            />
          </form>
        </div>

          {filteredCards.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 text-sm shadow-sm">
              <p className="font-bold text-[#1a2b4b]">
                {filteredCards.length} carta{filteredCards.length === 1 ? '' : 's'} disponible{filteredCards.length === 1 ? '' : 's'}
              </p>
              <p className="text-xs font-semibold text-gray-500">
                {cartItemsCount > 0 ? `${cartItemsCount} en el carrito · ${formatCLP(cartTotal)}` : 'Selecciona cartas para armar tu pedido'}
              </p>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex justify-end mb-4 border-b border-gray-100 pb-4">
            <div className="bg-gray-100 p-1 rounded-xl flex items-center shadow-inner">
              <button 
                onClick={() => setViewMode('album')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'album' ? 'bg-white text-[#1e40af] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <span translate="no" className="material-symbols-outlined text-lg">auto_stories</span> Álbum
              </button>
              <button 
                onClick={() => setViewMode('grid')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-white text-[#1e40af] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <span translate="no" className="material-symbols-outlined text-lg">grid_view</span> Cuadrícula
              </button>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="py-12 text-center text-gray-500 flex flex-col items-center">
                <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-30">inventory_2</span>
                <p>Este catálogo aún no tiene cartas o no coinciden con tu búsqueda.</p>
            </div>
          ) : viewMode === 'album' ? (
            <AlbumView tcg={folderData?.tcg} cards={filteredCards} 
              binderColor={folderData?.color || '#2f7336'}
              renderCardActions={(card) => {
                const cartItem = cart.find(i => i.id === card.id);
                const availableStock = card.stock - (cartItem ? cartItem.quantity : 0);
                return (
                  <div className="flex items-center gap-1 w-full mt-2" onClick={(e) => e.stopPropagation()}>
                    {cartItem ? (
                      <div className="flex items-center justify-between w-full bg-slate-100 rounded-md p-1 border border-slate-200">
                        <button 
                          onClick={() => decrementCart(card)}
                          className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span translate="no" className="material-symbols-outlined text-[16px]">remove</span>
                        </button>
                        <span className="font-bold text-slate-800 text-xs px-2">{cartItem.quantity}</span>
                        <button 
                          onClick={() => addToCart(card)}
                          disabled={availableStock <= 0}
                          className="w-6 h-6 flex items-center justify-center bg-[#2563eb] rounded shadow-sm text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                        >
                          <span translate="no" className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => addToCart(card)}
                        disabled={availableStock <= 0}
                        className="w-full flex items-center justify-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-1.5 rounded-md font-bold transition-all disabled:opacity-50 shadow-sm text-[10px]"
                      >
                        <span translate="no" className="material-symbols-outlined text-[14px]">shopping_cart</span>
                        {availableStock <= 0 ? 'Agotado' : 'Agregar'}
                      </button>
                    )}
                  </div>
                );
              }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredCards.map(card => {
              const cartItem = cart.find(i => i.id === card.id);
              const availableStock = card.stock - (cartItem ? cartItem.quantity : 0);
              return (
                <PokemonCard 
                  key={card.id} 
                  card={card} 
                  availableStock={availableStock}
                  cartQuantity={cartItem ? cartItem.quantity : 0}
                  onAddToCart={addToCart}
                  onRemoveFromCart={() => decrementCart(card.id)}
                />
              );
            })}
          </div>
        )}
      </main>
        </div>
      </div>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-end" onClick={() => setIsCartOpen(false)}>
          <div className="bg-white border-l border-gray-200 w-full max-w-md h-full p-6 flex flex-col shadow-2xl animate-[slideIn_0.3s_ease_forwards]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
              <h2 className="font-headline-md text-2xl font-bold flex items-center gap-2 text-gray-900">
                <span translate="no" className="material-symbols-outlined">shopping_cart</span> Tu Pedido
              </h2>
              <button className="text-gray-500 hover:text-gray-900 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100" onClick={() => setIsCartOpen(false)}>
                <span translate="no" className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 custom-scrollbar pr-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-70">
                  <span translate="no" className="material-symbols-outlined text-6xl mb-2">shopping_bag</span>
                  <p>Tu carrito está vacío.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                    <img src={item.imageUrl} referrerPolicy="no-referrer" referrerPolicy="no-referrer" alt={item.name} className="w-14 h-20 object-cover rounded-md shadow-sm" />
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="font-bold text-sm text-gray-900 leading-tight mb-1 line-clamp-2">{item.name}</p>
                      <p className="text-gray-500 text-xs mb-1">{item.set}</p>
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs font-bold text-gray-700">{item.quantity}x</span>
                        <span className="text-[#1e40af] font-bold text-sm">{formatCLP(item.price)} c/u</span>
                      </div>
                    </div>
                    <button className="absolute top-2 right-2 text-error/50 hover:text-error w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/10 transition-colors" onClick={() => removeFromCart(item.id)}>
                        <span translate="no" className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-xl font-bold text-gray-900 mb-4">
                <span>Total a pagar:</span>
                <span className="text-[#1e40af] text-2xl">{formatCLP(cartTotal)}</span>
              </div>
              
              <button 
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-xl font-extrabold flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(37,211,102,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                disabled={cart.length === 0 || isProcessingCheckout}
                onClick={handleWhatsAppCheckout}
              >
                <span translate="no" className="material-symbols-outlined text-2xl">
                  {isProcessingCheckout ? 'hourglass_empty' : 'chat'}
                </span>
                {isProcessingCheckout ? 'Procesando...' : 'Generar Pedido por WhatsApp'}
              </button>
              <p className="text-[10px] text-center text-gray-500 mt-3">Al presionar, se abrirá WhatsApp con el detalle de tu pedido para coordinar el pago y envío directamente con el vendedor.</p>
            </div>
          </div>
        </div>
      )}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
    </>
  );
}

export default PublicCatalog;


