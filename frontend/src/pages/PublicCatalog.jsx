import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { API_BASE_URL, apiFetch } from '../utils/api';
import PokemonCard from '../components/PokemonCard';
import AlbumView from '../components/AlbumView';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import PublicCatalogFilters from '../components/folder/filters/PublicCatalogFilters';

const isLocalhostWithProductionApi = () => {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) && API_BASE_URL.includes('api.carpetazo.cl');
};

const formatWhatsAppNumber = (phone = '') => {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';
  return cleanPhone.startsWith('56') ? cleanPhone : `56${cleanPhone}`;
};

const ensureExternalUrl = (url = '') => {
  const cleanUrl = String(url).trim();
  if (!cleanUrl) return '';
  return /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl.replace(/^@/, '')}`;
};

const getInstagramHref = (value = '') => {
  const cleanValue = String(value).trim();
  if (!cleanValue) return '';
  if (/^https?:\/\//i.test(cleanValue)) return cleanValue;
  return `https://instagram.com/${cleanValue.replace('@', '')}`;
};

const ContactIcon = ({ type, className = 'h-4 w-4' }) => {
  if (type === 'whatsapp') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <path fill="#25D366" d="M16 3.2A12.6 12.6 0 0 0 5.1 22.1L3.7 28.8l6.8-1.8A12.6 12.6 0 1 0 16 3.2Z" />
        <path fill="#fff" d="M22.9 18.7c-.4-.2-2.2-1.1-2.5-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.7.1-1 .5-.3.4-1.3 1.3-1.3 3.1 0 1.8 1.3 3.6 1.5 3.8.2.2 2.6 4 6.3 5.6.9.4 1.6.6 2.1.8.9.3 1.7.3 2.3.2.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.2-.1-.5-.2-.9-.4Z" />
      </svg>
    );
  }

  if (type === 'instagram') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <rect width="28" height="28" x="2" y="2" rx="8" fill="#E1306C" />
        <path fill="#FCAF45" d="M3.8 10.5A8.5 8.5 0 0 1 10.5 3.8h11A8.5 8.5 0 0 1 28.2 10.5v1.2C23.6 8.3 16.4 8.1 3.8 17v-6.5Z" opacity="0.8" />
        <path fill="#833AB4" d="M3.8 17c7.4-4.6 17.8-5.2 24.4-1.4v5.9a8.5 8.5 0 0 1-8.5 8.5h-7.2A8.5 8.5 0 0 1 4 21.5L3.8 17Z" opacity="0.85" />
        <circle cx="16" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="1.8" fill="#fff" />
      </svg>
    );
  }

  if (type === 'facebook') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#1877F2" />
        <path fill="#fff" d="M18.5 30V18.5h3.8l.6-4.5h-4.4v-2.9c0-1.3.4-2.2 2.3-2.2h2.3v-4c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 5.9V14h-3.8v4.5H14V30h4.5Z" />
      </svg>
    );
  }

  if (type === 'youtube') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <rect width="28" height="20" x="2" y="6" rx="6" fill="#FF0000" />
        <path fill="#fff" d="m14 12 7 4-7 4v-8Z" />
      </svg>
    );
  }

  return <span translate="no" className="material-symbols-outlined text-[18px]">chat</span>;
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
  const [sortBy, setSortBy] = useState('featured');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [quickRarity, setQuickRarity] = useState('');
  const [mylType, setMylType] = useState('');
  const [mylRace, setMylRace] = useState('');
  const [mylCost, setMylCost] = useState('');
  const [mylFilterOptions, setMylFilterOptions] = useState({ types: [], races: [], costs: [], rarities: [] });
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  
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
    setQuickRarity('');
    setOnlyAvailable(false);
    setSortBy('featured');
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
      await api.createOrder({
        sellerId: folderData.userId,
        buyerName: 'Cliente por WhatsApp',
        folderId: folderId,
        folderName: folderData.name || 'Catálogo',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          q: item.quantity,
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
  const availableRarities = useMemo(() => [...new Set(cards.map(c => c.rarity).filter(Boolean))].sort(), [cards]);
  const totalStock = useMemo(() => cards.reduce((sum, card) => sum + Number(card.stock || 0), 0), [cards]);
  const availableCardsCount = useMemo(() => cards.filter(card => Number(card.stock || 0) > 0).length, [cards]);

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
    .filter(card => quickRarity === '' || card.rarity === quickRarity)
    .filter(card => !onlyAvailable || Number(card.stock || 0) > 0)
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
    }), [cards, appliedFilters, folderData?.tcg, quickRarity, onlyAvailable]);

  const sortedCards = useMemo(() => {
    const rarityWeight = {
      'Common': 1,
      'Uncommon': 2,
      'Rare': 3,
      'Rare Holo': 4,
      'Rare Holo EX': 5,
      'Rare Holo GX': 6,
      'Rare Holo V': 7,
      'Rare Holo VMAX': 8,
      'Rare Ultra': 9,
      'Rare Secret': 10,
      'Promo': 11,
    };
    const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const list = [...filteredCards];
    list.sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0);
      if (sortBy === 'stock_asc') return Number(a.stock || 0) - Number(b.stock || 0);
      if (sortBy === 'rarity_desc') {
        return (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0) || normalizeText(a.name).localeCompare(normalizeText(b.name));
      }
      if (sortBy === 'set_asc') {
        return normalizeText(a.set).localeCompare(normalizeText(b.set)) || normalizeText(a.name).localeCompare(normalizeText(b.name));
      }
      return 0;
    });
    return list;
  }, [filteredCards, sortBy]);

  const sellerPublicTheme = sellerData?.publicTheme && typeof sellerData.publicTheme === 'object' ? sellerData.publicTheme : {};
  const socialEnabled = useCallback((field) => sellerPublicTheme[field] !== 'off', [sellerPublicTheme]);
  const visibleContactOptions = useMemo(() => {
    if (!sellerData || !folderData) return [];
    const options = [];
    const isOwnerViewing = currentUser?.uid && currentUser.uid === folderData.userId;

    if (!isOwnerViewing && socialEnabled('showMessageButton')) {
      options.push({
        id: 'message',
        label: 'Mensaje privado',
        type: 'button',
        className: 'bg-[#ffcb05] text-[#1a2b4b] ring-yellow-200 hover:bg-yellow-300',
        onClick: () => {
          if (!currentUser) {
            navigate('/bienvenida');
            return;
          }
          navigate('/mensajes', {
            state: {
              startChatWith: {
                id: folderData.userId,
                name: sellerData.displayName || 'Vendedor',
                avatar: sellerData.avatarBase64 || sellerData.photoURL || null
              }
            }
          });
        }
      });
    }

    if (sellerData.phone && socialEnabled('showWhatsApp')) {
      options.push({
        id: 'whatsapp',
        label: 'WhatsApp',
        href: `https://wa.me/${formatWhatsAppNumber(sellerData.phone)}?text=${encodeURIComponent(`Hola, vi tu carpeta "${folderData?.name || 'Catálogo'}" en Carpetazo y quiero consultar por tus cartas.`)}`,
        className: 'bg-green-50 text-green-700 ring-green-100 hover:bg-green-100'
      });
    }

    if (sellerData.instagramUrl && socialEnabled('showInstagram')) {
      options.push({
        id: 'instagram',
        label: 'Instagram',
        href: getInstagramHref(sellerData.instagramUrl),
        className: 'bg-pink-50 text-pink-600 ring-pink-100 hover:bg-pink-100'
      });
    }

    if (sellerData.facebookUrl && socialEnabled('showFacebook')) {
      options.push({
        id: 'facebook',
        label: 'Facebook',
        href: ensureExternalUrl(sellerData.facebookUrl),
        className: 'bg-blue-50 text-blue-700 ring-blue-100 hover:bg-blue-100'
      });
    }

    if (sellerData.youtubeUrl && socialEnabled('showYoutube')) {
      options.push({
        id: 'youtube',
        label: 'YouTube',
        href: ensureExternalUrl(sellerData.youtubeUrl),
        className: 'bg-red-50 text-red-600 ring-red-100 hover:bg-red-100'
      });
    }

    return options;
  }, [sellerData, folderData, currentUser, navigate, socialEnabled]);

  const contactSeller = useCallback(() => {
    const firstContact = visibleContactOptions[0];
    if (!firstContact) {
      showToast('Este vendedor aún no tiene contacto público configurado.', 'info');
      return;
    }

    if (firstContact.onClick) {
      firstContact.onClick();
      return;
    }

    if (firstContact.href) window.open(firstContact.href, '_blank', 'noopener,noreferrer');
  }, [visibleContactOptions]);

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
      <div className="w-full max-w-[1470px] mx-auto px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      {/* Seller info banner */}
      <div className="relative mb-3 overflow-hidden rounded-[1.6rem] border border-white/70 bg-white shadow-[0_22px_55px_-32px_rgba(15,23,42,0.65)] md:mb-5 md:rounded-[2rem]">
        
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

        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-white/95 via-white/90 to-blue-50/95" />
        {sellerData?.bannerBase64 && <div className="absolute inset-0 z-[2] bg-gradient-to-r from-white/95 via-white/80 to-white/55" />}

        <div className="relative z-10 grid gap-3 p-3 md:grid-cols-[minmax(520px,1fr)_minmax(360px,0.75fr)] md:items-center md:gap-5 md:p-7 lg:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
          {/* Compact card with avatar inside */}
          <div
            className={"flex w-full items-center gap-3 rounded-[1.35rem] border p-3 transition-all md:min-h-[170px] md:gap-7 md:rounded-[1.75rem] md:p-6 " +
              (sellerData?.bannerBase64 
                ? "bg-white/80 backdrop-blur-md shadow-xl border-white/70" 
                : "bg-slate-50 border-slate-200")}
            style={sellerData?.bannerComplementaryColor ? { borderColor: sellerData.bannerComplementaryColor } : {}}
          >
            {/* Avatar inside card */}
            <Link to={`/${sellerData?.username || folderData.userId}`} className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-white shadow-lg transition-transform hover:scale-105 md:h-32 md:w-32 md:border-4 md:shadow-xl lg:h-36 lg:w-36">
              {(sellerData?.avatarBase64 || sellerData?.photoURL) ? (
                <img src={sellerData?.avatarBase64 || sellerData?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2b4b] to-[#3b82f6] text-3xl font-black text-white">
                  {(sellerData?.displayName || 'V')[0].toUpperCase()}
                </div>
              )}
            </Link>

            {/* Text info next to avatar */}
            <div className="flex flex-col text-left flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-lg font-black leading-tight text-[#1a2b4b] md:text-2xl">
                  {sellerData?.displayName || 'Vendedor Anónimo'}
                </span>
                {(sellerData?.isVerified || true) && (
                  <span translate="no" className="material-symbols-outlined text-[#3b82f6] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }} title="Vendedor Verificado">verified</span>
                )}
              </div>
              {sellerData?.fullName && <p className="truncate text-xs font-semibold text-gray-500 md:text-sm">{sellerData.fullName}</p>}
              
              <div className="mt-0.5 flex flex-wrap items-center gap-1 md:gap-1.5">
                {(sellerData?.totalTrades > 0) ? (
                  <>
                    <div className="flex items-center gap-0.5 bg-white/60 px-1.5 py-0.5 rounded-md border border-yellow-300">
                      <span translate="no" className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[#1a2b4b] font-extrabold text-[11px]">{sellerData?.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] font-semibold">{sellerData?.totalTrades} reseñas</span>
                  </>
                ) : (
                  <span className="rounded-full border border-gray-200 bg-white/70 px-2.5 py-0.5 text-[11px] font-bold text-gray-500 md:px-3 md:py-1 md:text-xs">Nuevo Vendedor</span>
                )}
              </div>
              {sellerData?.bio && (
                <p className="mt-1 line-clamp-1 border-l-2 border-primary/40 pl-2 text-xs italic text-gray-600 md:mt-2 md:line-clamp-2 md:pl-3 md:text-sm">"{sellerData.bio}"</p>
              )}
            </div>
          </div>
        </div>

        {/* Folder Title and Buttons Row */}
        <div className="relative z-10 flex w-full flex-col items-start gap-2 md:items-end md:gap-3">
          {visibleContactOptions.filter(contact => contact.id !== 'message').length > 0 && (
            <div className="absolute right-1 top-[-1.35rem] z-20 flex items-center gap-1.5 md:hidden">
              {visibleContactOptions.filter(contact => contact.id !== 'message').map((contact) => {
                const socialBubbleClass = {
                  whatsapp: 'border-slate-950 bg-white text-green-600 ring-white hover:ring-green-300',
                  instagram: 'border-slate-950 bg-white text-pink-600 ring-[#ffcb05] hover:ring-pink-300',
                  facebook: 'border-slate-950 bg-white text-blue-600 ring-blue-200 hover:ring-blue-300',
                  youtube: 'border-slate-950 bg-white text-red-600 ring-red-200 hover:ring-red-300',
                }[contact.id] || 'border-slate-950 bg-white text-[#1a2b4b] ring-white hover:ring-[#ffcb05]';
                return (
                  <a
                    key={contact.id}
                    href={contact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={contact.label}
                    title={contact.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 p-0 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.9)] ring-2 transition-all hover:-translate-y-0.5 hover:scale-105 hover:shadow-md ${socialBubbleClass}`}
                  >
                    <ContactIcon type={contact.id} className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          )}

          <h1 className="max-w-full text-2xl font-black leading-none tracking-[-0.04em] text-[#1a2b4b] md:text-4xl md:leading-tight">
            {folderData.name}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black text-slate-600 md:justify-end md:gap-2 md:text-xs">
            <span className="rounded-full border border-blue-100 bg-white/95 px-2.5 py-1 text-[#1a2b4b] shadow-sm md:px-3 md:py-1.5">{cards.length} cartas</span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-emerald-700 shadow-sm md:px-3 md:py-1.5">{availableCardsCount} con stock</span>
            <span className="rounded-full border border-yellow-100 bg-yellow-50 px-2.5 py-1 text-[#1a2b4b] shadow-sm md:px-3 md:py-1.5">{totalStock} copias</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 md:justify-end md:gap-2">
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

            {visibleContactOptions.filter(contact => contact.id === 'message').length > 0 ? visibleContactOptions.filter(contact => contact.id === 'message').map((contact) => {
              const baseClass = `flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-black shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md md:h-10 md:w-10 md:justify-center md:gap-0 md:border-2 md:border-slate-950 md:bg-white md:p-0 md:text-[#1a2b4b] md:ring-2 md:ring-white md:hover:ring-blue-200 ${contact.className || 'bg-white text-[#1a2b4b] ring-slate-200'}`;
              const content = (
                <>
                  <ContactIcon type={contact.id} className="h-4 w-4" />
                  <span className="md:sr-only">Contactar vendedor</span>
                </>
              );

              return (
                <button key={contact.id} type="button" onClick={contact.onClick || contactSeller} className={baseClass}>
                  {content}
                </button>
              );
            }) : visibleContactOptions.length === 0 ? (
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
                Sin contacto público
              </span>
            ) : null}

            {visibleContactOptions.filter(contact => contact.id !== 'message').map((contact) => {
              const socialBubbleClass = {
                whatsapp: 'border-slate-950 bg-white text-green-600 ring-white hover:ring-green-300',
                instagram: 'border-slate-950 bg-white text-pink-600 ring-[#ffcb05] hover:ring-pink-300',
                facebook: 'border-slate-950 bg-white text-blue-600 ring-blue-200 hover:ring-blue-300',
                youtube: 'border-slate-950 bg-white text-red-600 ring-red-200 hover:ring-red-300',
              }[contact.id] || 'border-slate-950 bg-white text-[#1a2b4b] ring-white hover:ring-[#ffcb05]';
              return (
                <a
                  key={`desktop-${contact.id}`}
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={contact.label}
                  title={contact.label}
                  className={`hidden h-10 w-10 items-center justify-center rounded-full border-2 p-0 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.9)] ring-2 transition-all hover:-translate-y-0.5 hover:scale-105 hover:shadow-md md:flex ${socialBubbleClass}`}
                >
                  <ContactIcon type={contact.id} className="h-5 w-5" />
                </a>
              );
            })}
          </div>

          <Link to={`/${sellerData?.username || folderData.userId}`} className="group mt-0 flex items-center gap-1.5 rounded-full border border-[#ffcb05]/70 bg-gradient-to-r from-[#ffcb05] via-yellow-300 to-white px-3.5 py-2 text-[11px] font-black text-[#08204a] shadow-[0_10px_24px_-16px_rgba(30,64,175,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-lg md:mt-2 md:px-4 md:text-xs">
            <span translate="no" className="material-symbols-outlined text-[16px]">storefront</span>
            <span>Ver más del vendedor</span>
            <span translate="no" className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
          </Link>
        </div>
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

      <aside className="fixed right-5 top-[220px] z-20 hidden w-[218px] min-[1800px]:block">
        <div className="relative overflow-hidden rounded-[1.7rem] border border-white/20 bg-[#071a3a]/70 p-3 text-white shadow-[0_30px_85px_-35px_rgba(0,0,0,0.95)] ring-1 ring-white/10 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#ffcb05] to-transparent" />
          <div className="pointer-events-none absolute -left-14 -top-16 h-32 w-32 rounded-full bg-[#ffcb05]/18 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-16 h-40 w-40 rounded-full bg-[#38bdf8]/18 blur-3xl" />

          <div className="relative mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12 text-[#ffcb05] shadow-inner ring-1 ring-white/15">
                <span translate="no" className="material-symbols-outlined text-[21px]">tune</span>
              </span>
              <div>
                <p className="text-sm font-black leading-tight">Filtros</p>
                <p className="text-[10px] font-bold text-white/60">{sortedCards.length} en vista</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12 text-white shadow-inner ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-[#ffcb05] hover:text-[#061734]"
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
            >
              <span translate="no" className="material-symbols-outlined text-[20px]">filter_alt_off</span>
            </button>
          </div>

          <div className="relative flex flex-col gap-2">
            <PublicCatalogFilters
              variant="sidebar"
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

            <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/55">
              Ordenar
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-11 rounded-2xl border border-white/20 bg-white/90 px-3 text-[12px] font-black normal-case tracking-normal text-[#102142] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.9)] outline-none transition hover:bg-white focus:border-[#ffcb05] focus:ring-2 focus:ring-[#ffcb05]/35"
              >
                <option value="featured">Orden carpeta</option>
                <option value="price_asc">Precio ↑</option>
                <option value="price_desc">Precio ↓</option>
                <option value="stock_desc">Más stock</option>
                <option value="stock_asc">Menos stock</option>
                <option value="rarity_desc">Rareza</option>
                <option value="set_asc">Edición A-Z</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/55">
              Rareza
              <select
                value={quickRarity}
                onChange={(event) => setQuickRarity(event.target.value)}
                className="h-11 rounded-2xl border border-white/20 bg-white/90 px-3 text-[12px] font-black normal-case tracking-normal text-[#102142] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.9)] outline-none transition hover:bg-white focus:border-[#ffcb05] focus:ring-2 focus:ring-[#ffcb05]/35"
              >
                <option value="">Todas</option>
                {availableRarities.map(rarity => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setOnlyAvailable(value => !value)}
              className={`mt-1 flex h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black shadow-[0_14px_28px_-22px_rgba(0,0,0,0.9)] transition-all hover:-translate-y-0.5 ${
                onlyAvailable
                  ? 'border-emerald-300/70 bg-emerald-400/95 text-[#052e1c]'
                  : 'border-white/20 bg-white/12 text-white hover:border-white/40 hover:bg-white/20'
              }`}
            >
              <span translate="no" className="material-symbols-outlined text-[18px]">{onlyAvailable ? 'visibility' : 'visibility_off'}</span>
              Disponibles
            </button>
          </div>
        </div>
      </aside>

        <div className="relative z-10 flex min-h-[calc(100vh-230px)] w-full flex-col overflow-hidden rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem]">
          <main className="relative z-20 flex flex-1 flex-col px-3 py-3 text-gray-900 sm:px-6 md:px-8 md:py-8">
            <div className="mb-3 rounded-[1.35rem] border border-white/80 bg-white/95 p-2.5 shadow-sm md:mb-5 md:rounded-[1.5rem] md:p-4">
              <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 md:gap-3">
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="relative">
                    <span translate="no" className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">search</span>
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar carta..."
                      className="h-10 w-full rounded-xl border border-gray-300 bg-gray-50 pl-11 pr-3 text-sm font-medium text-gray-900 transition-all focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af] md:h-11"
                    />
                  </div>
                  <div className="flex items-center rounded-xl bg-blue-50 p-1 shadow-inner">
                    <button 
                      type="button"
                      onClick={() => setViewMode('album')} 
                      className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-all md:h-9 md:flex-none ${viewMode === 'album' ? 'bg-white text-[#1e40af] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <span translate="no" className="material-symbols-outlined text-[18px]">auto_stories</span> Álbum
                    </button>
                    <button 
                      type="button"
                      onClick={() => setViewMode('grid')} 
                      className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-all md:h-9 md:flex-none ${viewMode === 'grid' ? 'bg-white text-[#1e40af] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <span translate="no" className="material-symbols-outlined text-[18px]">grid_view</span> Cuadrícula
                    </button>
                  </div>
                </div>
                
                <div className="xl:hidden">
                  <button
                    type="button"
                    onClick={() => setIsMobileFiltersOpen(value => !value)}
                    className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition-all md:h-11 ${
                      isMobileFiltersOpen
                        ? 'border-[#1e40af] bg-[#1e40af] text-white shadow-md'
                        : 'border-blue-100 bg-blue-50 text-[#1e40af] hover:bg-blue-100'
                    }`}
                    aria-expanded={isMobileFiltersOpen}
                  >
                    <span translate="no" className="material-symbols-outlined text-[20px]">
                      {isMobileFiltersOpen ? 'filter_alt_off' : 'filter_alt'}
                    </span>
                    {isMobileFiltersOpen ? 'Ocultar filtros' : 'Ver filtros'}
                  </button>
                </div>

                {isMobileFiltersOpen && (
                  <div className="grid gap-2 border-t border-slate-100 pt-3 xl:hidden">
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

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1 text-[11px] font-black text-slate-500">
                        Ordenar
                        <select
                          value={sortBy}
                          onChange={(event) => setSortBy(event.target.value)}
                          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-[#1a2b4b] outline-none transition focus:border-[#1e40af] focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="featured">Orden carpeta</option>
                          <option value="price_asc">Precio ↑</option>
                          <option value="price_desc">Precio ↓</option>
                          <option value="stock_desc">Más stock</option>
                          <option value="stock_asc">Menos stock</option>
                          <option value="rarity_desc">Rareza</option>
                          <option value="set_asc">Edición A-Z</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] font-black text-slate-500">
                        Rareza
                        <select
                          value={quickRarity}
                          onChange={(event) => setQuickRarity(event.target.value)}
                          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-[#1a2b4b] outline-none transition focus:border-[#1e40af] focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Todas</option>
                          {availableRarities.map(rarity => (
                            <option key={rarity} value={rarity}>{rarity}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => setOnlyAvailable(value => !value)}
                        className={`mt-auto flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition-all ${
                          onlyAvailable
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:text-[#1e40af]'
                        }`}
                      >
                        <span translate="no" className="material-symbols-outlined text-[18px]">{onlyAvailable ? 'visibility' : 'visibility_off'}</span>
                        Disponibles
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs font-bold text-slate-500">
                      <span><strong className="text-[#1a2b4b]">{sortedCards.length}</strong> carta{sortedCards.length === 1 ? '' : 's'} en esta vista</span>
                      <span>{cartItemsCount > 0 ? `${cartItemsCount} en el carrito · ${formatCLP(cartTotal)}` : 'Filtra, ordena y agrega al pedido sin salir de la carpeta'}</span>
                    </div>
                  </div>
                )}
              </form>
            </div>

          <div className="min-w-0">
              {sortedCards.length === 0 || viewMode === 'album' ? (
                <AlbumView tcg={folderData?.tcg} cards={sortedCards} 
                  binderColor={folderData?.color || '#2f7336'}
                  emptyMessage="Carpeta vacía con estos filtros. No encontramos cartas que coincidan con tu búsqueda actual."
                  renderCardOverlays={(card) => Number(card.stock || 0) <= 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[4%] bg-transparent">
                      <span className="relative rounded-full bg-slate-950/85 px-3 py-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white/70 md:text-xs">Sin stock</span>
                    </div>
                  ) : null}
                  renderCardActions={(card) => {
                    const cartItem = cart.find(i => i.id === card.id);
                    const availableStock = Number(card.stock || 0) - (cartItem ? cartItem.quantity : 0);
                    return (
                      <div className="flex items-center gap-1 w-full mt-2" onClick={(e) => e.stopPropagation()}>
                        {cartItem ? (
                          <div className="flex items-center justify-between w-full bg-slate-100 rounded-md p-1 border border-slate-200">
                            <button 
                              onClick={() => decrementCart(card.id)}
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
                {sortedCards.map(card => {
                  const cartItem = cart.find(i => i.id === card.id);
                  const availableStock = Number(card.stock || 0) - (cartItem ? cartItem.quantity : 0);
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
          </div>
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


