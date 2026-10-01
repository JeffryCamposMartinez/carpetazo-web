import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { API_BASE_URL, apiFetch } from '../utils/api';
import PokemonCard from '../components/PokemonCard';
import AlbumView from '../components/AlbumView';
import Toast from '../components/Toast';
import LiquidTabs from '../components/LiquidTabs';
import { useAuth } from '../contexts/AuthContext';
import PublicCatalogFilters from '../components/folder/filters/PublicCatalogFilters';
import WishlistSection from '../components/WishlistSection';
import { Stars } from '../components/Reviews';
import { ensureExternalUrl, formatWhatsAppNumber, getInstagramHref } from '../utils/contact';
import { wishlistPayloadFromCard } from '../utils/wishlistPayload';
import { ReportMenu } from '../components/ReportButton';

const isLocalhostWithProductionApi = () => {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) && API_BASE_URL.includes('api.carpetazo.cl');
};

// Cifras grandes con separador de miles; desde 100.000 en formato corto para que nunca desborden
const formatCount = (value) => {
  const number = Number(value) || 0;
  return number >= 100000
    ? new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(number)
    : number.toLocaleString('es-CL');
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

  return (
    <>
      <div className="w-full max-w-[1470px] mx-auto px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      {/* Portada de la carpeta: nombre, vendedor, contacto y cifras */}
      {(() => {
        const messageOption = visibleContactOptions.find((contact) => contact.id === 'message');
        const socialOptions = visibleContactOptions.filter((contact) => contact.id !== 'message');
        const defaultAddress = sellerData?.addresses?.find((a) => a.isDefault) || sellerData?.addresses?.[0];
        const locationText = defaultAddress
          ? [defaultAddress.comuna, defaultAddress.region].filter(Boolean).join(', ')
          : [sellerData?.comuna, sellerData?.region].filter(Boolean).join(', ');
        const sellerPath = `/${sellerData?.username || folderData.userId}`;
        const socialClass = {
          whatsapp: 'text-green-600 hover:ring-green-300',
          instagram: 'text-pink-600 hover:ring-pink-300',
          facebook: 'text-blue-600 hover:ring-blue-300',
          youtube: 'text-red-600 hover:ring-red-300',
        };
        const stats = [
          { value: formatCount(cards.length), label: cards.length === 1 ? 'carta' : 'cartas' },
          { value: formatCount(availableCardsCount), label: 'con stock' },
          { value: formatCount(totalStock), label: totalStock === 1 ? 'copia' : 'copias' },
        ];
        return (
          <section className="relative mb-3 overflow-hidden rounded-[1.6rem] bg-[#0f2b57] text-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.8)] ring-1 ring-white/10 md:mb-5 md:rounded-[2rem]">
            {sellerData?.bannerBase64 && (
              <div className="absolute inset-0 z-0 opacity-45" style={{ backgroundImage: `url(${sellerData.bannerBase64})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            )}
            <div className="absolute inset-0 z-[1] bg-gradient-to-br from-[#0f2b57]/95 via-[#12315f]/85 to-[#1e40af]/70" />

            <div className="relative z-10 flex flex-col gap-2.5 p-3 md:gap-6 md:p-8">
              <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between md:gap-8">
                <div className="min-w-0 md:block">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:block">
                  {folderData?.tcg && (
                    <span className="order-2 inline-flex items-center rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-bold text-blue-100 ring-1 ring-white/20 md:order-none md:px-3 md:py-1">{folderData.tcg}</span>
                  )}
                  <h1 className="order-1 break-words text-[1.7rem] font-black leading-[1.05] tracking-[-0.03em] md:order-none md:mt-2 md:text-5xl">{folderData.name}</h1>
                  </div>

                  <div className="mt-2 flex items-center gap-2.5 md:mt-4 md:gap-3">
                    <Link to={sellerPath} className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-[#facc15] bg-white shadow-lg transition-transform hover:scale-105 md:h-14 md:w-14" aria-label="Ver perfil del vendedor">
                      {(sellerData?.avatarBase64 || sellerData?.photoURL) ? (
                        <img src={sellerData?.avatarBase64 || sellerData?.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2b4b] to-[#3b82f6] text-xl font-black text-white">{(sellerData?.displayName || 'V')[0].toUpperCase()}</span>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Link to={sellerPath} className="truncate text-base font-extrabold hover:underline md:text-lg">{sellerData?.displayName || 'Vendedor anónimo'}</Link>
                        {sellerData?.reviewSummary?.showAverage ? (
                          <Link to={`${sellerPath}#resenas`} className="flex items-center gap-1.5 text-xs font-bold text-[#facc15] hover:underline" title="Ver reseñas">
                            <Stars value={sellerData.reviewSummary.average} size={14} />
                            {sellerData.reviewSummary.average.toFixed(1)} · {sellerData.reviewSummary.count} {sellerData.reviewSummary.count === 1 ? 'reseña' : 'reseñas'}
                          </Link>
                        ) : sellerData?.reviewSummary?.count > 0 ? (
                          <Link to={`${sellerPath}#resenas`} className="text-xs font-bold text-[#facc15] hover:underline" title="Ver reseñas">
                            {sellerData.reviewSummary.count} {sellerData.reviewSummary.count === 1 ? 'reseña' : 'reseñas'}
                          </Link>
                        ) : (
                          <Link to={`${sellerPath}#resenas`} className="text-xs font-semibold text-blue-200 hover:underline" title="Ver reseñas">Sin reseñas todavía</Link>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-blue-100">
                        {locationText && (
                          <span className="flex items-center gap-1">
                            <span translate="no" className="material-symbols-outlined text-[15px]">location_on</span>{locationText}
                          </span>
                        )}
                        <Link to={sellerPath} className="font-bold text-[#facc15] hover:underline">Ver más del vendedor</Link>
                      </div>
                    </div>
                  </div>
                  {sellerData?.bio && <p className="mt-3 hidden line-clamp-2 max-w-xl md:block border-l-2 border-[#facc15]/70 pl-3 text-sm italic text-blue-100">"{sellerData.bio}"</p>}
                </div>

                <div className="flex items-center gap-2 md:flex-wrap md:justify-end md:pt-1">
                  {isOwner && (
                    <Link
                      to={`/carpeta/${folderData.id}`}
                      className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#facc15] px-4 py-2.5 text-sm font-extrabold text-[#12315f] shadow-md transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white/70 md:flex-none md:px-5"
                    >
                      <span translate="no" className="material-symbols-outlined text-[20px]">add_circle</span>
                      <span className="md:hidden">Agregar cartas</span><span className="hidden md:inline">Agregar cartas a tu carpeta</span>
                    </Link>
                  )}
                  {messageOption && (
                    <button type="button" onClick={messageOption.onClick || contactSeller} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#facc15] px-4 py-2.5 text-sm font-extrabold text-[#12315f] shadow-md transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white/70 md:flex-none md:px-5">
                      <ContactIcon type="message" className="h-4 w-4" />
                      Contactar vendedor
                    </button>
                  )}
                  {socialOptions.length > 0 && (
                    <div className="flex items-center gap-2 md:justify-end md:gap-2.5">
                    {socialOptions.map((contact) => (
                      <a
                        key={contact.id}
                        href={contact.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={contact.label}
                        title={contact.label}
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white/40 transition hover:-translate-y-0.5 hover:scale-105 ${socialClass[contact.id] || 'text-[#1a2b4b] hover:ring-[#facc15]'}`}
                      >
                        <ContactIcon type={contact.id} className="h-5 w-5" />
                      </a>
                    ))}
                    </div>
                  )}
                  {!isOwner && folderData?.id && (
                    <ReportMenu label="Reportar" buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-blue-100 hover:bg-white/10" options={[{ targetType: 'folder', targetId: folderData.id, label: 'Reportar esta carpeta' }, { targetType: 'user', targetId: sellerData?.id, label: 'Reportar al vendedor' }]} />
                  )}
                  {!isOwner && visibleContactOptions.length === 0 && (
                    <span className="text-xs font-semibold text-blue-200">Sin contacto público</span>
                  )}
                </div>
              </div>

              <p className="text-xs font-bold tabular-nums text-blue-100 md:hidden">{stats.map((item) => `${item.value} ${item.label}`).join(' · ')}</p>

              <dl className="hidden grid-cols-3 divide-x divide-white/15 rounded-2xl bg-white/8 ring-1 ring-white/15 md:grid">
                {stats.map((item) => (
                  <div key={item.label} className="min-w-0 px-2 py-1.5 text-center md:px-6 md:py-4">
                    <dt className="sr-only">{item.label}</dt>
                    <dd className="flex min-w-0 flex-col items-center gap-0.5 text-lg font-black tabular-nums leading-none md:block md:text-3xl">
                      {item.value}
                      <span className="text-[11px] font-bold text-blue-200 md:ml-1.5 md:text-sm">{item.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        );
      })()}

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

        <div className="relative z-10 flex min-h-[calc(100vh-230px)] w-full flex-col overflow-hidden rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem]">
          <main className="relative z-20 flex flex-1 flex-col px-3 pb-3 pt-2 text-gray-900 sm:px-6 md:px-8 md:py-8">
            <div className="mb-1 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-900/5 md:mb-5 md:p-3">
              <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 md:gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span translate="no" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar carta por nombre"
                      aria-label="Buscar carta"
                      className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm font-medium text-slate-900 transition focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]/70 md:h-11 md:pr-4"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <LiquidTabs
                      ariaLabel="Vista del catálogo"
                      axis="auto"
                      layout="inline"
                      value={viewMode}
                      onChange={setViewMode}
                      className="flex-1 rounded-full bg-slate-100 p-1 md:flex-none"
                      buttonClassName="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold md:flex-none"
                      indicatorClassName="rounded-full bg-[#12315f] shadow-sm"
                      activeTextClassName="text-white"
                      inactiveTextClassName="text-slate-500 hover:text-slate-800"
                      options={[
                        { value: 'album', label: <><span translate="no" className="material-symbols-outlined text-[18px]" aria-hidden="true">auto_stories</span><span className="hidden min-[420px]:inline">Álbum</span><span className="sr-only min-[420px]:hidden">Álbum</span></> },
                        { value: 'grid', label: <><span translate="no" className="material-symbols-outlined text-[18px]" aria-hidden="true">grid_view</span><span className="hidden min-[420px]:inline">Cuadrícula</span><span className="sr-only min-[420px]:hidden">Cuadrícula</span></> }
                      ]}
                    />
                    <button
                      type="button"
                      onClick={() => setIsMobileFiltersOpen((value) => !value)}
                      aria-expanded={isMobileFiltersOpen}
                      className={`relative flex h-10 w-10 flex-none items-center justify-center gap-2 rounded-full border px-0 text-sm font-black transition-all min-[420px]:w-auto min-[420px]:px-4 md:h-11 ${
                        isMobileFiltersOpen || activeFilterCount > 0
                          ? 'border-[#12315f] bg-[#12315f] text-white shadow-md'
                          : 'border-slate-200 bg-white text-[#12315f] hover:border-[#12315f]/40'
                      }`}
                    >
                      <span translate="no" className="material-symbols-outlined text-[20px]">tune</span>
                      <span className="hidden min-[420px]:inline">Filtros</span>
                      {activeFilterCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#facc15] px-1 text-[11px] font-black text-[#12315f] ring-2 ring-white min-[420px]:static min-[420px]:ring-0">{activeFilterCount}</span>
                      )}
                    </button>
                  </div>
                </div>

                {isMobileFiltersOpen && (
                  <div className="grid gap-2 border-t border-slate-100 pt-3">
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
                        {!isOwner && (
                          <ReportMenu label="" buttonClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-red-600" options={[{ targetType: 'card', targetId: card.id, label: 'Reportar esta carta' }, { targetType: 'card_image', targetId: card.imageUrl && (card.isCustomImage || card.data?.isCustomImage) ? card.id : null, label: 'Reportar la foto de esta carta' }]} />
                        )}
                        {!isOwner && (
                          <button
                          type="button"
                          onClick={() => addToWishlist(card)}
                          aria-pressed={Boolean(wanted[card.id])}
                          aria-label={wanted[card.id] ? `${card.name} está en tu lista de deseadas` : `Agregar ${card.name} a mis deseadas`}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm transition active:scale-90 ${wanted[card.id] ? 'text-rose-500' : 'text-slate-500'}`}
                        >
                          <span translate="no" className="material-symbols-outlined text-[16px]" style={wanted[card.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
                        </button>
                        )}
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
                      onWish={isOwner ? undefined : addToWishlist}
                      wished={Boolean(wanted[card.id])}
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
              <button aria-label="Cerrar carrito" className="text-gray-500 hover:text-gray-900 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100" onClick={() => setIsCartOpen(false)}>
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
                    <img src={item.imageUrl} referrerPolicy="no-referrer" alt={item.name} className="w-14 h-20 object-cover rounded-md shadow-sm" />
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
              
              {!currentUser && !messageMode && (
                <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                  Estás comprando sin cuenta. Puedes pedir igual, pero <strong>no podrás calificar al vendedor</strong> después.
                  <button type="button" onClick={() => window.dispatchEvent(new Event('carpetazo:open-auth'))} className="ml-1 font-extrabold underline">Iniciar sesión</button>
                </div>
              )}
              {!messageMode && (
                <button
                  className="w-full text-white p-4 rounded-xl font-extrabold flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-[#25D366] hover:bg-[#128C7E] shadow-[0_4px_15px_rgba(37,211,102,0.3)]"
                  disabled={cart.length === 0 || isProcessingCheckout}
                  onClick={handleWhatsAppCheckout}
                >
                  <span translate="no" className="material-symbols-outlined text-2xl">
                    {isProcessingCheckout ? 'hourglass_empty' : 'chat'}
                  </span>
                  {isProcessingCheckout ? 'Procesando...' : 'Generar Pedido por WhatsApp'}
                </button>
              )}
              {(messageMode || socialEnabled('showMessageButton')) && (
                <button
                  className={`w-full p-4 rounded-xl font-extrabold flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${messageMode ? 'text-white bg-[#1e40af] hover:bg-[#1d4ed8] shadow-[0_4px_15px_rgba(30,64,175,0.3)]' : 'mt-2 text-[#1e40af] bg-white ring-2 ring-[#1e40af] hover:bg-blue-50'}`}
                  disabled={cart.length === 0 || isProcessingCheckout || !socialEnabled('showMessageButton')}
                  onClick={handleMessageCheckout}
                >
                  <span translate="no" className="material-symbols-outlined text-2xl">
                    {isProcessingCheckout ? 'hourglass_empty' : 'mail'}
                  </span>
                  {isProcessingCheckout ? 'Procesando...' : currentUser ? 'Enviar pedido por mensaje' : 'Iniciar sesión y enviar pedido por mensaje'}
                </button>
              )}
              <p className="text-[10px] text-center text-gray-500 mt-3">
                {!messageMode
                  ? socialEnabled('showMessageButton')
                    ? 'WhatsApp abre un chat con el detalle de tu pedido. Por mensaje, el pedido llega al vendedor dentro de Carpetazo con un código (necesitas una cuenta). En ambos casos coordinan el pago y el envío directamente.'
                    : 'Al presionar, se abrirá WhatsApp con el detalle de tu pedido para coordinar el pago y envío directamente con el vendedor.'
                  : socialEnabled('showMessageButton')
                    ? 'Este vendedor no usa WhatsApp. Tu pedido le llegará como mensaje de Carpetazo con el detalle y un código, y ahí coordinan el pago y el envío. Necesitas una cuenta.'
                    : 'Este vendedor no recibe pedidos por WhatsApp ni por mensaje por ahora.'}
              </p>
            </div>
          </div>
        </div>
      )}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
    </>
  );
}

export default PublicCatalog;


