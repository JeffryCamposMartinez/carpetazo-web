import LiquidTabs from '../ui/LiquidTabs';
import { preloadMainNow } from '../../app/routePreload';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, startTransition, lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import MobileMenu from './header/MobileMenu';
import NotificationBellPanel from './header/NotificationBellPanel';
import { useToast } from '../ui/ToastProvider';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

// Ventanas que solo se abren a pedido: su código se descarga al abrirlas, no en la primera carga de cada página
const AuthModal = lazy(() => import('../auth/AuthModal'));
const ReviewModal = lazy(() => import('../reviews/Reviews').then((module) => ({ default: module.ReviewModal })));

export default function Header() {
  const { currentUser, appUser, logout, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userAvatar, setUserAvatar] = useState(null);
  const [userUsername, setUserUsername] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuClosing, setIsMobileMenuClosing] = useState(false);
  const drawerRef = useRef(null);
  const drawerTouch = useRef({ startX: 0, startY: 0, dx: 0, dragging: false });

  // Cierra el menú lateral con animación de salida
  const closeMobileMenu = () => {
    if (isMobileMenuClosing) return;
    setIsMobileMenuClosing(true);
    setTimeout(() => { setIsMobileMenuOpen(false); setIsMobileMenuClosing(false); }, 220);
  };

  // Con el menú abierto, la página de atrás no se desplaza
  useBodyScrollLock(isMobileMenuOpen);

  // Arrastrar el panel hacia la izquierda lo cierra, como en una app nativa
  const onDrawerTouchStart = (e) => {
    const t = e.touches[0];
    drawerTouch.current = { startX: t.clientX, startY: t.clientY, dx: 0, dragging: false };
  };
  const onDrawerTouchMove = (e) => {
    const st = drawerTouch.current;
    const t = e.touches[0];
    const dx = t.clientX - st.startX;
    const dy = t.clientY - st.startY;
    if (!st.dragging) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) st.dragging = true; else return;
    }
    st.dx = Math.min(0, dx);
    if (drawerRef.current) {
      drawerRef.current.style.animation = 'none';
      drawerRef.current.style.transition = 'none';
      drawerRef.current.style.transform = `translateX(${st.dx}px)`;
    }
  };
  const onDrawerTouchEnd = () => {
    const st = drawerTouch.current;
    if (!st.dragging || !drawerRef.current) return;
    st.dragging = false;
    if (st.dx < -80) {
      drawerRef.current.style.transition = 'transform 180ms ease-out';
      drawerRef.current.style.transform = 'translateX(-105%)';
      closeMobileMenu();
    } else {
      drawerRef.current.style.transition = 'transform 180ms ease-out';
      drawerRef.current.style.transform = 'translateX(0)';
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('Carpetas');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [publicHeaderTheme, setPublicHeaderTheme] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationChats, setNotificationChats] = useState([]);
  const [pendingOrders, setPendingOrders] = useState({ count: 0, unseen: 0, orders: [] });
  // Lo "visto" en la campana se guarda solo en este navegador: no cambia los mensajes ni los pedidos
  const [seen, setSeen] = useState({ orders: null, chats: {} });
  const [openSnapshot, setOpenSnapshot] = useState(null);
  const seenRef = useRef(seen);
  const [wishMatches, setWishMatches] = useState({ items: 0, offers: 0, fresh: 0, ids: [] }); // cartas de la lista de deseos que otros venden
  const [reviewPrompts, setReviewPrompts] = useState({ items: [], fresh: 0 }); // compras completadas que aún no se califican
  const [reviewTarget, setReviewTarget] = useState(null);
  const { showToast } = useToast();
  seenRef.current = seen;
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const searchCategories = [
    { label: 'Carpetas', route: '/carpetas' },
    { label: 'Cartas', route: '/cartas' },
    { label: 'Vendedores', route: '/vendedores' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    const cat = searchCategories.find(c => c.label === searchCategory);
    const route = cat ? cat.route : '/carpetas';
    if (searchQuery.trim()) {
      navigate(`${route}?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(route);
    }
  };

  const NAV_ROUTES = [
    { value: '/', label: 'Inicio' },
    { value: '/carpetas', label: 'Carpetas' },
    { value: '/cartas', label: 'Cartas' },
    { value: '/vendedores', label: 'Vendedores' },
  ];
  // La banda de secciones tiene su propio estado: se mueve en cuanto se toca y no espera a la pantalla ni a sus datos
  const [pendingNav, setPendingNav] = useState(null);
  useEffect(() => { setPendingNav(null); }, [location.pathname]);
  const goToSection = (route) => {
    setPendingNav(route);
    // Primero se pinta el movimiento de la banda; después la pantalla nueva, como transición interrumpible
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => startTransition(() => navigate(route))));
  };
  const routeFromLocation = (NAV_ROUTES.find(r => (r.value === '/' ? location.pathname === '/' : location.pathname.startsWith(r.value))) || {}).value || '';
  const activeNavRoute = pendingNav ?? routeFromLocation;
  const themedNavActive = Boolean(publicHeaderTheme && publicHeaderTheme.id !== 'classic-blue');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-dropdown')) {
        setIsDropdownOpen(false);
      }
      if (!event.target.closest('.search-category-dropdown')) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape cierra cualquier menú desplegable del encabezado
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsDropdownOpen(false);
      setIsNotificationOpen(false);
      setCategoryDropdownOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const handlePublicProfileTheme = (event) => {
      setPublicHeaderTheme(event.detail?.theme || null);
    };
    window.addEventListener('carpetazo:public-profile-theme', handlePublicProfileTheme);
    return () => window.removeEventListener('carpetazo:public-profile-theme', handlePublicProfileTheme);
  }, []);

  // Otras pantallas (p. ej. el carrito) piden abrir el acceso sin perder su estado
  useEffect(() => {
    const openAuth = () => setIsAuthModalOpen(true);
    window.addEventListener('carpetazo:open-auth', openAuth);
    return () => window.removeEventListener('carpetazo:open-auth', openAuth);
  }, []);

  useEffect(() => {
    const reservedRoutes = ['/', '/bienvenida', '/dashboard', '/perfil', '/carpeta', '/c', '/admin', '/mensajes', '/moderacion', '/carpetas', '/cartas', '/vendedores', '/terminos', '/privacidad'];
    const pathname = location.pathname;
    const isDynamicPublicProfile = pathname.split('/').filter(Boolean).length === 1 && !reservedRoutes.includes(pathname);
    if (!isDynamicPublicProfile) {
      setPublicHeaderTheme(null);
    }
  }, [location.pathname]);

  const themedTopBarStyle = publicHeaderTheme && publicHeaderTheme.id !== 'classic-blue'
      ? {
        backgroundImage: `linear-gradient(135deg, ${publicHeaderTheme.primary || '#1e40af'}, ${publicHeaderTheme.secondary || '#1d4ed8'})`,
        color: publicHeaderTheme.card || '#ffffff'
      }
      : undefined;

  const themedNavStyle = publicHeaderTheme && publicHeaderTheme.id !== 'classic-blue'
      ? {
        backgroundImage: `linear-gradient(90deg, ${publicHeaderTheme.primary || '#1e40af'}, ${publicHeaderTheme.secondary || '#1d4ed8'})`,
        borderColor: `${publicHeaderTheme.accent || '#facc15'}55`
      }
      : undefined;

    useEffect(() => {
    if (currentUser) {
      setUserAvatar(appUser?.photoURL || currentUser.photoURL || null);
      setUserUsername(appUser?.username || appUser?.name || currentUser.displayName || currentUser.email?.split('@')[0] || null);
    } else {
      setUserAvatar(null);
      setUserUsername(null);
    }
  }, [currentUser, appUser]);

  useEffect(() => {
    let cancelled = false;

    const loadUnreadMessages = async () => {
      if (!currentUser) {
        setUnreadMessages(0);
        setNotificationChats([]);
        setPendingOrders({ count: 0, unseen: 0, orders: [] });
        return;
      }
      // Con la pestaña oculta no se consulta; al volver se actualiza de inmediato
      if (document.visibilityState === 'hidden') return;

      // Solicitudes de compra pendientes (si falla, los mensajes siguen funcionando)
      // Lo visto se lee directo del navegador: en la primera carga el estado aún no se restauró y todo aparecería como nuevo
      let seenOrders = seenRef.current.orders;
      try { seenOrders = JSON.parse(localStorage.getItem(`carpetazo:bell-seen:${currentUser.uid}`) || 'null')?.orders || seenOrders; } catch (_error) { /* sin almacenamiento */ }
      const ordersPromise = api.getMyPendingOrders(seenOrders)
        .then((ordersResult) => {
          if (!cancelled && ordersResult?.success) {
            setPendingOrders(previous => (
              previous.count === ordersResult.count && previous.unseen === ordersResult.unseen && previous.orders[0]?.id === ordersResult.orders[0]?.id
                ? previous
                : { count: ordersResult.count, unseen: ordersResult.unseen ?? ordersResult.count, orders: ordersResult.orders }
            ));
            return `${ordersResult.count}:${ordersResult.unseen}`;
          }
          return '';
        })
        .catch(() => '');

      let chatSignature = 'sin-datos';
      try {
        const result = await api.getChats();
        const nextChats = (result.chats || []).filter(chat => {
          const partner = chat.otherUser || chat.partner || {};
          return partner.firebaseUid !== currentUser.uid;
        });
        const total = Number(result.totalUnread ?? nextChats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0));
        if (!cancelled) {
          const filteredTotal = nextChats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0);
          setUnreadMessages(Number.isFinite(filteredTotal) ? filteredTotal : (Number.isFinite(total) ? total : 0));
          setNotificationChats(nextChats.filter(chat => Number(chat.unreadCount || 0) > 0));
          chatSignature = `${filteredTotal}:${nextChats[0]?.id || ''}:${nextChats[0]?.createdAt || ''}`;
        }
      } catch (error) {
        if (!cancelled) {
          setUnreadMessages(0);
          setNotificationChats([]);
        }
      }

      // Si nada cambió respecto de la consulta anterior, la próxima se espacia
      const signature = `${await ordersPromise}|${chatSignature}`;
      if (signature === lastSignature) idleChecks += 1;
      else { idleChecks = 0; lastSignature = signature; }
    };

    // Intervalo adaptativo: 8 s con actividad, 15 s tras 4 consultas iguales y 30 s tras 10; cualquier evento lo reinicia
    let timer = null;
    let idleChecks = 0;
    let lastSignature = '';
    const nextDelay = () => (idleChecks < 4 ? 8000 : idleChecks < 10 ? 15000 : 30000);
    const tick = async () => {
      await loadUnreadMessages();
      if (!cancelled) timer = window.setTimeout(tick, nextDelay());
    };
    const wake = () => { idleChecks = 0; window.clearTimeout(timer); tick(); };

    tick();
    window.addEventListener('focus', wake);
    window.addEventListener('carpetazo:messages-updated', wake);
    window.addEventListener('carpetazo:orders-updated', wake);
    document.addEventListener('visibilitychange', wake);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('focus', wake);
      window.removeEventListener('carpetazo:messages-updated', wake);
      window.removeEventListener('carpetazo:orders-updated', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [currentUser?.uid, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.notification-dropdown')) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getChatPartner = (chat) => chat?.otherUser || chat?.partner || {};

  // El resaltado de "Nuevo" solo dura mientras el panel está abierto
  useEffect(() => {
    if (!isNotificationOpen) setOpenSnapshot(null);
  }, [isNotificationOpen]);

  // Cartas deseadas que otros venden: se consulta al entrar y cada 5 minutos (la consulta es más pesada que la de pedidos)
  const wishSeenKey = currentUser ? `carpetazo:wish-seen:${currentUser.uid}` : null;
  useEffect(() => {
    if (!wishSeenKey) { setWishMatches({ items: 0, offers: 0, fresh: 0, ids: [] }); setReviewPrompts({ items: [], fresh: 0 }); return undefined; }
    let cancelled = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      api.getWishlistMatches().then((res) => {
        if (cancelled || !res?.success) return;
        const entries = Object.values(res.matches || {});
        const ids = entries.flatMap((entry) => entry.offers.map((offer) => offer.cardId));
        let known = null;
        try { known = JSON.parse(localStorage.getItem(wishSeenKey) || 'null'); } catch (_error) { /* sin almacenamiento */ }
        // La primera vez todo cuenta como nuevo solo si ya había una lista de vistos; si no, se avisa una vez
        const knownSet = new Set(Array.isArray(known) ? known : []);
        setWishMatches({ items: entries.length, offers: ids.length, fresh: ids.filter((id) => !knownSet.has(id)).length, ids });
      }).catch(() => {});
    };
    const loadReviews = () => {
      if (document.visibilityState === 'hidden') return;
      api.getPendingReviews().then((res) => {
        if (cancelled || !res?.success) return;
        const items = res.pending || [];
        let known = null;
        try { known = JSON.parse(localStorage.getItem(`carpetazo:review-seen:${wishSeenKey.split(':').pop()}`) || 'null'); } catch (_error) { /* sin almacenamiento */ }
        const knownSet = new Set(Array.isArray(known) ? known : []);
        setReviewPrompts({ items, fresh: items.filter((item) => !knownSet.has(item.orderId)).length });
      }).catch(() => {});
    };
    load();
    loadReviews();
    window.addEventListener('focus', loadReviews);
    const intervalId = window.setInterval(() => { load(); loadReviews(); }, 5 * 60 * 1000);
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.clearInterval(intervalId); window.removeEventListener('focus', load); window.removeEventListener('focus', loadReviews); };
  }, [wishSeenKey]);

  const seenKey = currentUser ? `carpetazo:bell-seen:${currentUser.uid}` : null;
  const chatKey = (chat) => getChatPartner(chat).id || chat.otherId;

  // Carga lo visto de este usuario en este navegador
  useEffect(() => {
    if (!seenKey) { setSeen({ orders: null, chats: {} }); return; }
    try {
      const saved = JSON.parse(localStorage.getItem(seenKey) || 'null');
      setSeen(saved && typeof saved === 'object' ? { orders: saved.orders || null, chats: saved.chats || {} } : { orders: null, chats: {} });
    } catch (_error) {
      setSeen({ orders: null, chats: {} });
    }
  }, [seenKey]);

  const persistSeen = (next) => {
    setSeen(next);
    if (!seenKey) return;
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch (_error) { /* sin almacenamiento: solo dura esta sesión */ }
  };

  // Mensajes nuevos = no leídos que aún no se habían visto en la campana
  const unseenMessages = notificationChats.reduce(
    (sum, chat) => sum + Math.max(0, Number(chat.unreadCount || 0) - Number(seen.chats[chatKey(chat)] || 0)),
    0
  );

  // Si un chat se leyó en Mensajes (bajó su conteo), lo visto se ajusta para que un mensaje futuro vuelva a avisar
  useEffect(() => {
    const keys = Object.keys(seen.chats);
    if (keys.length === 0) return;
    const unread = new Map(notificationChats.map(chat => [chatKey(chat), Number(chat.unreadCount || 0)]));
    let changed = false;
    const next = {};
    for (const key of keys) {
      const now = unread.get(key) || 0;
      const kept = Math.min(Number(seen.chats[key]), now);
      if (kept !== Number(seen.chats[key])) changed = true;
      if (kept > 0) next[key] = kept;
    }
    if (changed) persistSeen({ ...seen, chats: next });
  }, [notificationChats]);

  const totalNotifications = unseenMessages + pendingOrders.unseen + wishMatches.fresh + reviewPrompts.fresh;
  const handleReviewDone = (done) => {
    setReviewPrompts((previous) => ({ items: previous.items.filter((item) => item.orderId !== done.orderId), fresh: Math.max(0, previous.fresh - 1) }));
    setReviewTarget(null);
    showToast('¡Gracias! Tu reseña ya es pública.', 'success');
  };
  const formatOrderTotal = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const orderAge = (iso) => {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  };
  const openWishlist = () => {
    setIsNotificationOpen(false);
    navigate('/dashboard?tab=deseadas');
  };
  const openPendingOrders = () => {
    setIsNotificationOpen(false);
    navigate('/dashboard?tab=solicitudes');
  };

  const openNotifications = async () => {
    setIsNotificationOpen(previous => !previous);
    if (!isNotificationOpen) {
      // Al abrir, todo queda visto solo en la campana; las solicitudes siguen pendientes y los mensajes sin leer
      setOpenSnapshot({
        ordersSince: seen.orders,
        chatIds: new Set(notificationChats.filter(chat => Number(chat.unreadCount || 0) > Number(seen.chats[chatKey(chat)] || 0)).map(chatKey))
      });
      persistSeen({
        orders: pendingOrders.orders[0]?.createdAt || seen.orders,
        chats: Object.fromEntries(notificationChats.map(chat => [chatKey(chat), Number(chat.unreadCount || 0)]))
      });
      setPendingOrders(previous => (previous.unseen === 0 ? previous : { ...previous, unseen: 0 }));
      if (wishSeenKey && wishMatches.ids.length > 0) {
        try { localStorage.setItem(wishSeenKey, JSON.stringify(wishMatches.ids.slice(0, 500))); } catch (_error) { /* sin almacenamiento */ }
        setWishMatches(previous => (previous.fresh === 0 ? previous : { ...previous, fresh: 0 }));
      }
      if (wishSeenKey && reviewPrompts.items.length > 0) {
        try { localStorage.setItem(`carpetazo:review-seen:${wishSeenKey.split(':').pop()}`, JSON.stringify(reviewPrompts.items.map((item) => item.orderId).slice(0, 100))); } catch (_error) { /* sin almacenamiento */ }
        setReviewPrompts(previous => (previous.fresh === 0 ? previous : { ...previous, fresh: 0 }));
      }
    }
  };

  const openNotificationChat = (chat) => {
    const partner = getChatPartner(chat);
    setIsNotificationOpen(false);
    setNotificationChats(previous => previous.filter(item => item.id !== chat.id));
    navigate('/mensajes', {
      state: {
        startChatWith: {
          id: partner.id || chat.otherId,
          firebaseUid: partner.firebaseUid,
          name: partner.name || partner.username || 'Usuario',
          username: partner.username,
          avatar: partner.photoURL || ''
        }
      }
    });
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar Sesión:', error);
    }
  };

  // Buscador compartido por escritorio y móvil. Es una función (no un componente) para que el campo no se remonte al escribir
  const renderSearch = (variant) => {
    const isMobile = variant === 'mobile';
    const menuId = `search-category-menu-${variant}`;
    const category = searchCategory.toLowerCase();
    return (
      <form role="search" onSubmit={handleSearch} className="w-full">
        <div className={`relative flex items-center rounded-full bg-white pl-1 pr-1 shadow-[0_1px_2px_rgba(8,18,42,0.4),0_8px_18px_-8px_rgba(8,18,42,0.55)] transition-shadow duration-150 focus-within:ring-2 focus-within:ring-[#facc15] ${isMobile ? 'h-12' : 'h-11'}`}>
          <div
            className="relative search-category-dropdown self-stretch"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && categoryDropdownOpen) {
                setCategoryDropdownOpen(false);
                e.currentTarget.querySelector('button')?.focus();
              }
            }}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={categoryDropdownOpen}
              aria-controls={categoryDropdownOpen ? menuId : undefined}
              aria-label={`Buscar en ${searchCategory}. Cambiar categoría`}
              onClick={() => setCategoryDropdownOpen(p => !p)}
              className="flex h-full items-center gap-0.5 whitespace-nowrap rounded-l-full pl-3.5 pr-1.5 text-sm font-bold text-[#12315f] transition-colors duration-150 hover:bg-slate-100 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e40af]"
            >
              {searchCategory}
              <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[18px] text-slate-500 transition-transform duration-150 ${categoryDropdownOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
            </button>
            {categoryDropdownOpen && (
              <div id={menuId} role="menu" aria-label="Buscar en" className="menu-pop absolute left-0 top-full z-50 mt-2 min-w-[10.5rem] overflow-hidden rounded-xl bg-white p-1 shadow-[0_12px_32px_-8px_rgba(8,18,42,0.45)] ring-1 ring-slate-900/10">
                {searchCategories.map(cat => {
                  const selected = searchCategory === cat.label;
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => { setSearchCategory(cat.label); setCategoryDropdownOpen(false); }}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e40af] ${selected ? 'bg-[#1e40af] text-white' : 'text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af]'}`}
                    >
                      {cat.label}
                      {selected && <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">check</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-slate-200" />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label={`Buscar ${category}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Busca ${category}...`}
            className={`h-full min-w-0 flex-1 px-3 font-medium text-[#12315f] caret-[#1e40af] selection:bg-[#facc15]/60 text-ellipsis placeholder:font-normal placeholder:text-slate-500 !bg-transparent !border-0 !shadow-none !ring-0 !rounded-none focus:outline-none ${isMobile ? 'text-base' : 'text-[15px]'}`}
          />
          <button
            type="submit"
            aria-label="Buscar"
            className={`relative flex shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12315f] after:absolute after:-inset-1 after:content-[''] ${isMobile ? 'h-10 w-10' : 'h-9 w-9'}`}
          >
            <span translate="no" aria-hidden="true" className={`material-symbols-outlined font-bold ${isMobile ? 'text-[22px]' : 'text-[20px]'}`}>search</span>
          </button>
        </div>
      </form>
    );
  };

  const mobileMenuProps = { appUser, closeMobileMenu, currentUser, drawerRef, handleLogin, handleLogout,
    isMobileMenuClosing, location, onDrawerTouchEnd, onDrawerTouchMove, onDrawerTouchStart, pendingOrders,
    unreadMessages, userAvatar, userUsername };

  const notificationBellPanelProps = { chatKey, formatOrderTotal, getChatPartner, isNotificationOpen, navigate,
    notificationChats, openNotificationChat, openNotifications, openPendingOrders, openSnapshot, openWishlist,
    orderAge, pendingOrders, reviewPrompts, setIsNotificationOpen, setReviewTarget, totalNotifications, wishMatches };

  return (
    <>
      {/* TopAppBar - Desktop */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim hidden md:block" style={themedTopBarStyle}>
        <div className="flex flex-col w-full">
          <div className="flex lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] items-center justify-between gap-4 lg:gap-8 px-md py-2 w-full max-w-container-max mx-auto">
            <Link to="/bienvenida" aria-label="Carpetazo.cl, ir a la bienvenida" className="flex shrink-0 items-center justify-self-start rounded-xl transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
              <img src="/images/logos/logo_completo.webp" alt="" className="h-14 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
            </Link>

            {/* Buscador: protagonista del encabezado, centrado entre logo y cuenta */}
            <div className="w-full min-w-0 flex-1 lg:flex-none">{renderSearch('desktop')}</div>

            {currentUser ? (
              <div className="relative z-30 flex items-center gap-2 justify-self-end">
                <NotificationBellPanel {...notificationBellPanelProps} />
                <div className="relative profile-dropdown">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    aria-label="Abrir menú de cuenta"
                    aria-haspopup="menu"
                    aria-expanded={isDropdownOpen}
                    className="group flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-1 text-white transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] xl:pr-3"
                  >
                    <img src={userAvatar || currentUser.photoURL} alt="" className="h-9 w-9 rounded-full border-2 border-[#facc15] object-cover bg-white" />
                    <span className="hidden text-[13px] font-extrabold xl:block">Mi cuenta</span>
                    <span translate="no" aria-hidden="true" className={`material-symbols-outlined hidden text-[18px] text-blue-100 transition-transform duration-150 xl:block ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>

                  {isDropdownOpen && (
                    <div role="menu" className="menu-pop [--menu-origin:top_right] absolute right-0 top-full z-50 mt-2 flex w-56 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white py-2 shadow-xl">
                      <div className="px-4 pb-2 pt-1 border-b border-gray-100 mb-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Tu cuenta</p>
                        <p className="mt-1 truncate text-sm font-extrabold text-[#1a2b4b]">{userUsername || currentUser.displayName || 'Usuario'}</p>
                      </div>
                      <Link role="menuitem" to="/dashboard" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af] font-semibold flex items-center gap-3">
                        <span translate="no" className="material-symbols-outlined text-[20px]">folder</span> Mis carpetas
                      </Link>
                      <Link role="menuitem" to="/dashboard?tab=deseadas" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af] font-semibold flex items-center gap-3">
                        <span translate="no" className="material-symbols-outlined text-[20px]">favorite</span> Mi lista de deseos
                      </Link>
                      <Link role="menuitem" to="/mensajes" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af] font-semibold flex items-center gap-3">
                        <span translate="no" className="material-symbols-outlined text-[20px]">chat</span> Mensajes
                      </Link>
                      <Link role="menuitem" to="/perfil" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af] font-semibold flex items-center gap-3">
                        <span translate="no" className="material-symbols-outlined text-[20px]">person</span> Mi perfil
                      </Link>
                      <Link role="menuitem" to={`/${userUsername || currentUser.uid}`} onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af] font-semibold flex items-center gap-3">
                        <span translate="no" className="material-symbols-outlined text-[20px]">storefront</span> Ver perfil público
                      </Link>
                      {['admin', 'moderator', 'support'].includes(appUser?.role) && (
                        <Link role="menuitem" to="/moderacion" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-[#12315f] hover:bg-blue-50 hover:text-[#1e40af] font-semibold flex items-center gap-3">
                          <span translate="no" className="material-symbols-outlined text-[20px]">admin_panel_settings</span> Moderación
                        </Link>
                      )}
                      <div className="h-px bg-gray-100 my-1 mx-2"></div>
                      <button role="menuitem" onClick={() => { setIsDropdownOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-bold flex items-center gap-3">
                        <span translate="no" className="material-symbols-outlined text-[20px]">logout</span> Salir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-self-end">
                <button onClick={handleLogin} className="flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-[#facc15] px-4 text-sm font-extrabold text-[#12315f] shadow-[0_1px_2px_rgba(8,18,42,0.35)] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <img src="/images/logos/google.svg" alt="" className="w-4 h-4 bg-white rounded-full p-[2px]" />
                  Entrar
                </button>
              </div>
            )}
          </div>

          <nav aria-label="Principal" onPointerEnter={preloadMainNow} onPointerDown={preloadMainNow} onTouchStart={preloadMainNow} className="flex items-center justify-center w-full gap-2 md:gap-4 overflow-x-auto px-4 py-1.5 bg-[#1e40af] hide-scrollbar whitespace-nowrap border-t border-[#facc15]/40" style={themedNavStyle}>
            <LiquidTabs
              ariaLabel="Navegación principal"
              navigation
              layout="inline"
              className="gap-2 md:gap-4"
              buttonClassName="h-9 rounded-full px-5 text-[15px] font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#facc15] after:pointer-events-none after:absolute after:inset-x-5 after:bottom-1 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[#facc15] after:transition-transform after:duration-200 hover:after:scale-x-100 aria-[current=page]:after:hidden"
              indicatorClassName="rounded-full shadow-sm"
              indicatorStyle={{ backgroundColor: themedNavActive ? (publicHeaderTheme.surface || publicHeaderTheme.card) : '#ffffff' }}
              activeTextClassName="font-bold"
              inactiveTextClassName="text-white/90 hover:text-white"
              activeTextStyle={{ color: themedNavActive ? publicHeaderTheme.text : '#1e40af' }}
              inactiveTextStyle={themedNavActive ? { color: `${publicHeaderTheme.card || '#ffffff'}dd` } : undefined}
              value={activeNavRoute}
              onChange={goToSection}
              options={NAV_ROUTES}
            />
          </nav>
        </div>
      </header>

      {/* Mobile Header: sigue al usuario, pero la franja del logo (52 px) se va con el scroll y solo quedan buscador y secciones.
          Es solo CSS (top negativo): sin estado ni eventos de scroll que se descuadren con la barra del navegador del celular */}
      <header className="sticky top-[-52px] z-40 w-full bg-surface dark:bg-surface-dim md:hidden block" style={themedTopBarStyle}>
        <div className="flex flex-col w-full">
          <div className="relative flex h-[52px] w-full items-center justify-between gap-2 px-3">
            {/* Izquierda: cuenta y menú */}
            <div className="z-10 flex items-center">
              {currentUser ? (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Abrir menú de cuenta"
                  aria-haspopup="dialog"
                  className="relative flex h-11 items-center gap-1 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-2 text-white transition-[background-color,transform] duration-150 active:scale-[0.97] active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
                >
                  <img src={userAvatar || currentUser.photoURL} alt="" className="h-9 w-9 rounded-full border-2 border-[#facc15] object-cover bg-white" />
                  <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px] text-white">menu</span>
                </button>
              ) : (
                <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Abrir menú" aria-haspopup="dialog" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-[background-color,transform] duration-150 active:scale-[0.97] active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                  <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[26px]">menu</span>
                </button>
              )}
            </div>

            {/* Centro: logo, reconocible sin quitar espacio al buscador */}
            <Link to="/bienvenida" aria-label="Carpetazo.cl, ir a la bienvenida" className="absolute left-1/2 flex -translate-x-1/2 items-center rounded-xl transition-opacity duration-150 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
              <img src="/images/logos/logo_completo.webp" alt="" className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
            </Link>

            {/* Derecha: notificaciones o acceso */}
            <div className="z-30 flex min-w-[44px] justify-end">
              {currentUser ? (
                <NotificationBellPanel {...notificationBellPanelProps} />
              ) : (
                <button onClick={handleLogin} className="flex h-11 items-center gap-1.5 rounded-full bg-[#facc15] px-4 text-[13px] font-extrabold text-[#12315f] shadow-[0_1px_2px_rgba(8,18,42,0.35)] transition-[filter,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <img src="/images/logos/google.svg" alt="" className="w-4 h-4 bg-white rounded-full p-[1px]" />
                  Entrar
                </button>
              )}
            </div>
          </div>

          <div className="px-3 pb-2.5 pt-0.5">{renderSearch('mobile')}</div>

          {/* Secciones: 4 columnas iguales, sin scroll horizontal */}
          <nav aria-label="Principal" onPointerDown={preloadMainNow} onTouchStart={preloadMainNow} className="border-t border-[#facc15]/40 bg-[#1e40af] px-2 py-1" style={themedNavStyle}>
            <LiquidTabs
              ariaLabel="Navegación principal"
              navigation
              layout="grid"
              buttonClassName="h-10 rounded-full px-1 text-[13.5px] max-[359px]:text-[12px] font-medium leading-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
              indicatorClassName="rounded-full shadow-sm"
              indicatorStyle={{ backgroundColor: themedNavActive ? (publicHeaderTheme.surface || publicHeaderTheme.card) : '#ffffff' }}
              activeTextClassName="font-bold"
              inactiveTextClassName="text-white/90"
              activeTextStyle={{ color: themedNavActive ? publicHeaderTheme.text : '#1e40af' }}
              inactiveTextStyle={themedNavActive ? { color: `${publicHeaderTheme.card || '#ffffff'}dd` } : undefined}
              value={activeNavRoute}
              onChange={goToSection}
              options={NAV_ROUTES}
            />
          </nav>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <MobileMenu {...mobileMenuProps} />
      )}
      {/* Authentication Modal */}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} />
        </Suspense>
      )}
      {reviewTarget && (
        <Suspense fallback={null}>
          <ReviewModal pending={reviewTarget} onClose={() => setReviewTarget(null)} onDone={handleReviewDone} />
        </Suspense>
      )}
    </>
  );
}

