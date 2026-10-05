import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { API_BASE_URL, apiFetch } from '../services/api';
import Toast from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import WishlistSection from '../components/wishlist/WishlistSection';
import { ensureExternalUrl, formatWhatsAppNumber, getInstagramHref } from '../utils/contact';
import { wishlistPayloadFromCard } from '../utils/wishlistPayload';
import CatalogCartDrawer from '../components/folder/catalog/CatalogCartDrawer';
import CatalogBrowser from '../components/folder/catalog/CatalogBrowser';
import CatalogCover from '../components/folder/catalog/CatalogCover';

const isLocalhostWithProductionApi = () => {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) && API_BASE_URL.includes('api.carpetazo.cl');
};

function PublicCatalog() {
  const { folderId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [cards, setCards] = useState([]);
  const [folderData, setFolderData] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  const [ownsFolder, setOwnsFolder] = useState(false);
  
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
  const [wanted, setWanted] = useState({}); // cartas agregadas a mis deseadas en esta visita
  const addToWishlist = async (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    if (wanted[card.id]) return;
    try {
      await api.addWishlistItem(wishlistPayloadFromCard(card, folderData?.tcg));
      setWanted((previous) => ({ ...previous, [card.id]: true }));
      showToast(`${card.name} agregada a tu lista de deseadas`, 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    }
  };
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
        if (!folder.user?.isOwner) {
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

        let cardsList = (folder.cards || []).map(c => ({
          ...c,
          apiId: c.tcgId || c.id,
          tcgId: c.tcgId !== undefined && c.tcgId !== null ? String(c.tcgId) : c.tcgId,
          ...(c.data || {})
        }));

        if (folder.tcg === 'Mitos y Leyendas') {
          const ids = cardsList.map(card => card.tcgId || card.apiId).filter(Boolean).map(String);
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

  const activeFilterCount = [selectedSupertype, selectedType, searchSet, mylType, mylRace, mylCost, quickRarity].filter(Boolean).length
    + (onlyAvailable ? 1 : 0) + (sortBy !== 'featured' ? 1 : 0);

  const isOwner = Boolean(sellerData?.isOwner) || ownsFolder;
  const messageMode = !sellerData?.phone; // sin WhatsApp público el pedido viaja por mensajes
  useEffect(() => {
    if (!currentUser?.uid || !folderData) { setOwnsFolder(false); return; }
    if (sellerData?.isOwner) return;
    let cancelled = false;
    apiFetch('/folders/me')
      .then((res) => { if (!cancelled) setOwnsFolder(Boolean(res?.folders?.some((f) => f.id === folderData.id))); })
      .catch(() => { if (!cancelled) setOwnsFolder(false); });
    return () => { cancelled = true; };
  }, [currentUser?.uid, folderData?.id, sellerData?.isOwner]);

  // Vendedor sin WhatsApp público: el pedido se envía como mensaje de Carpetazo (el comprador debe tener sesión)
  const handleMessageCheckout = async () => {
    if (!socialEnabled('showMessageButton')) {
      showToast('Este vendedor no recibe pedidos por WhatsApp ni por mensaje.', 'error');
      return;
    }
    if (!currentUser) {
      showToast('Inicia sesión para enviar tu pedido por mensaje. Tu carrito se conserva.', 'info');
      window.dispatchEvent(new Event('carpetazo:open-auth'));
      return;
    }
    if (isOwner) {
      showToast('No puedes enviarte un pedido a ti mismo.', 'error');
      return;
    }
    setIsProcessingCheckout(true);
    try {
      const response = await api.createOrder({ folderId, via: 'message', items: cart.map((item) => ({ id: item.id, quantity: item.quantity })) });
      setCart([]);
      setIsCartOpen(false);
      showToast(`Pedido ${response.code} enviado a ${sellerData?.displayName || 'el vendedor'}`, 'success');
      navigate('/mensajes', { state: { startChatWith: { id: folderData.userId, name: sellerData?.displayName || 'Vendedor', avatar: sellerData?.avatarBase64 || sellerData?.photoURL || null } } });
    } catch (error) {
      console.error('Error al enviar pedido por mensaje:', error);
      showToast(error.message || 'No se pudo enviar el pedido.', 'error');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const handleWhatsAppCheckout = async () => {
    if (cart.length === 0) return;
    if (isOwner) {
      showToast('No puedes enviarte un pedido a ti mismo.', 'error');
      return;
    }

    const phone = sellerData?.phone?.replace(/\D/g, '') || '';
    if (!phone) return handleMessageCheckout();
    
    const formattedPhone = phone.startsWith('56') ? phone : `56${phone}`;
    
    // Safari (iPhone y Mac) bloquea las ventanas abiertas antes de una espera y no deja escribir en ellas:
    // ahí se navega en la misma pestaña. En el resto se abre la ventana de forma síncrona para evitar el bloqueo de pop-ups.
    const ua = navigator.userAgent || '';
    const isIos = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
    let newWindow = null;
    if (!isIos && !isSafari) {
      try {
        newWindow = window.open('', '_blank');
        newWindow?.document.write('Generando tu pedido, por favor espera...');
      } catch (_error) { /* si el navegador no deja escribir, se usa la misma pestaña */ }
    }
    
    setIsProcessingCheckout(true);
    try {
            // 1. Guardar la orden en la base de datos
      const orderResponse = await api.createOrder({
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
      message += `\nTotal: ${formatCLP(orderResponse?.order?.total ?? cartTotal)}`;
      if (orderResponse?.code) message += `\nCódigo de pedido: ${orderResponse.code}`;
      const payment = orderResponse?.payment;
      if (payment) {
        message += `\n\nDatos para transferir:\n${[payment.holderName, payment.rut, payment.bank, payment.accountType, payment.accountNumber].filter(Boolean).join('\n')}`;
      }
      message += payment ? `\n\n¿Tienes disponibilidad?` : `\n\n¿Tienes disponibilidad? ¿Me compartes los datos para transferir?`;
      
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
      
      setCart([]);
      setIsCartOpen(false);
      showToast("Pedido generado correctamente", "success");

      if (newWindow && !newWindow.closed) {
        newWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl; // Safari o pop-up bloqueado: misma pestaña
      }
    } catch (error) {
      console.error("Error al generar pedido:", error);
      try { newWindow?.close(); } catch (_error) { /* ya cerrada */ }
      showToast(error?.message || "Hubo un error al procesar el pedido.", "error");
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
    const getCatalogOrder = (card, fallbackIndex = 0) => {
      const value = Number(card?.catalogOrder);
      return Number.isFinite(value) ? value : fallbackIndex + 100000;
    };
    const list = [...filteredCards];
    list.sort((a, b) => {
      const orderFallback = getCatalogOrder(a) - getCatalogOrder(b) || normalizeText(a.name).localeCompare(normalizeText(b.name));
      if (sortBy === 'featured') return orderFallback;
      if (sortBy === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === 'stock_desc') return Number(b.stock || 0) - Number(a.stock || 0);
      if (sortBy === 'stock_asc') return Number(a.stock || 0) - Number(b.stock || 0);
      if (sortBy === 'rarity_desc') {
        return (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0) || orderFallback;
      }
      if (sortBy === 'set_asc') {
        return normalizeText(a.set).localeCompare(normalizeText(b.set)) || orderFallback;
      }
      return orderFallback;
    });
    return list;
  }, [filteredCards, sortBy]);

  const sellerPublicTheme = sellerData?.publicTheme && typeof sellerData.publicTheme === 'object' ? sellerData.publicTheme : {};
  const socialEnabled = useCallback((field) => sellerPublicTheme[field] !== 'off', [sellerPublicTheme]);
  const visibleContactOptions = useMemo(() => {
    if (!sellerData || !folderData) return [];
    const options = [];
    const isOwnerViewing = isOwner;

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
        href: `https://api.whatsapp.com/send?phone=${formatWhatsAppNumber(sellerData.phone)}&text=${encodeURIComponent(`Hola, vi tu carpeta "${folderData?.name || 'Catálogo'}" en Carpetazo y quiero consultar por tus cartas.`)}`,
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
  }, [sellerData, folderData, currentUser, isOwner, navigate, socialEnabled]);

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

  const catalogCartDrawerProps = { cart, cartTotal, currentUser, formatCLP, handleMessageCheckout,
    handleWhatsAppCheckout, isProcessingCheckout, messageMode, removeFromCart, setIsCartOpen, socialEnabled };

  const catalogBrowserProps = { activeFilterCount, addToCart, addToWishlist, availableRarities, availableSets, cards,
    cart, cartItemsCount, cartTotal, counts, decrementCart, folderData, formatCLP, isMobileFiltersOpen, isOwner,
    isSetDropdownOpen, mylCost, mylFilterOptions, mylRace, mylType, onlyAvailable, quickRarity, searchQuery,
    searchSet, selectedSupertype, selectedType, setIsMobileFiltersOpen, setIsSetDropdownOpen, setMylCost, setMylRace,
    setMylType, setOnlyAvailable, setQuickRarity, setSearchQuery, setSearchSet, setSelectedSupertype, setSelectedType,
    setSortBy, setViewMode, sortBy, sortedCards, viewMode, wanted };

  const catalogCoverProps = { availableCardsCount, cards, contactSeller, folderData, isOwner, sellerData,
    totalStock, visibleContactOptions };

  return (
    <>
      <div className="w-full max-w-[1470px] mx-auto px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      {/* Portada de la carpeta: nombre, vendedor, contacto y cifras */}
      <CatalogCover {...catalogCoverProps} />

      {sellerData?.username && (
        <WishlistSection
          username={sellerData.username}
          seller={{ id: sellerData.id, name: sellerData.displayName, avatar: sellerData.photoURL }}
          isOwner={isOwner}
          variant="catalog"
        />
      )}

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

        <CatalogBrowser {...catalogBrowserProps} />
      </div>

      {/* Cart Drawer */}
      {isCartOpen && (
        <CatalogCartDrawer {...catalogCartDrawerProps} />
      )}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
    </>
  );
}

export default PublicCatalog;

