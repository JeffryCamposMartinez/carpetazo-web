import LiquidTabs from './LiquidTabs';
import { preloadMainNow } from '../utils/routePreload';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, startTransition } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

import AuthModal from './AuthModal';

const decodeMessagePreview = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) {
      if (parsed.imageUrl || parsed.imageBase64) return '📷 Imagen';
      return parsed.text || 'Mensaje nuevo';
    }
  } catch {
    // Mensajes antiguos en texto plano.
  }
  return content || 'Mensaje nuevo';
};

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
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isMobileMenuOpen]);

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
    const reservedRoutes = ['/', '/bienvenida', '/dashboard', '/perfil', '/carpeta', '/c', '/admin', '/mensajes', '/carpetas', '/cartas', '/vendedores'];
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
      api.getMyPendingOrders(seenOrders)
        .then((ordersResult) => {
          if (!cancelled && ordersResult?.success) {
            setPendingOrders(previous => (
              previous.count === ordersResult.count && previous.unseen === ordersResult.unseen && previous.orders[0]?.id === ordersResult.orders[0]?.id
                ? previous
                : { count: ordersResult.count, unseen: ordersResult.unseen ?? ordersResult.count, orders: ordersResult.orders }
            ));
          }
        })
        .catch(() => {});

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
        }
      } catch (error) {
        if (!cancelled) {
          setUnreadMessages(0);
          setNotificationChats([]);
        }
      }
    };

    loadUnreadMessages();
    const intervalId = window.setInterval(loadUnreadMessages, 8000);
    window.addEventListener('focus', loadUnreadMessages);
    window.addEventListener('carpetazo:messages-updated', loadUnreadMessages);
    window.addEventListener('carpetazo:orders-updated', loadUnreadMessages);
    document.addEventListener('visibilitychange', loadUnreadMessages);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadUnreadMessages);
      window.removeEventListener('carpetazo:messages-updated', loadUnreadMessages);
      window.removeEventListener('carpetazo:orders-updated', loadUnreadMessages);
      document.removeEventListener('visibilitychange', loadUnreadMessages);
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
    if (!wishSeenKey) { setWishMatches({ items: 0, offers: 0, fresh: 0, ids: [] }); return undefined; }
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
    load();
    const intervalId = window.setInterval(load, 5 * 60 * 1000);
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.clearInterval(intervalId); window.removeEventListener('focus', load); };
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

  const totalNotifications = unseenMessages + pendingOrders.unseen + wishMatches.fresh;
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

  const NotificationBell = ({ compact = false }) => (
    <div className="notification-dropdown relative">
      <button
        type="button"
        onClick={openNotifications}
        aria-label={totalNotifications > 0 ? `${totalNotifications} notificaciones sin atender` : 'Ver notificaciones'}
        aria-expanded={isNotificationOpen}
        className={`group relative flex items-center justify-center rounded-full text-white transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/60 ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
      >
        <span className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} flex items-center justify-center rounded-full border-2 border-[#facc15] bg-white text-[#12315f] shadow-md transition-all group-hover:ring-4 group-hover:ring-[#facc15]/30`}>
        <svg viewBox="0 0 50 30" className={`${compact ? 'h-6 w-8' : 'h-7 w-9'} overflow-visible`} aria-hidden="true">
          <g className="origin-[50%_2px] transition-transform duration-500 group-hover:animate-[bellRing_2.3s_ease-in-out]">
            <path className="transition-transform duration-500 group-hover:animate-[bellBall_2.3s_ease-in-out]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" d="M28.7,25 c0,1.9-1.7,3.5-3.7,3.5s-3.7-1.6-3.7-3.5s1.7-3.5,3.7-3.5S28.7,23,28.7,25z" />
            <path fill="#FFFFFF" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" d="M35.9,21.8c-1.2-0.7-4.1-3-3.4-8.7c0.1-1,0.1-2.1,0-3.1h0c-0.3-4.1-3.9-7.2-8.1-6.9c-3.7,0.3-6.6,3.2-6.9,6.9h0 c-0.1,1-0.1,2.1,0,3.1c0.6,5.7-2.2,8-3.4,8.7c-0.4,0.2-0.6,0.6-0.6,1v1.8c0,0.2,0.2,0.4,0.4,0.4h22.2c0.2,0,0.4-0.2,0.4-0.4v-1.8 C36.5,22.4,36.3,22,35.9,21.8L35.9,21.8z" />
          </g>
        </svg>
        </span>
        {totalNotifications > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white shadow-lg ring-2 ring-white">
            {totalNotifications > 99 ? '99+' : totalNotifications}
          </span>
        )}
      </button>

      {isNotificationOpen && (
        <div className={`absolute top-full z-50 mt-3 w-[310px] overflow-hidden rounded-3xl border border-[#facc15]/40 bg-white text-slate-900 shadow-2xl ring-1 ring-slate-900/5 ${compact ? 'right-0' : 'right-0'}`}>
          <div className="bg-gradient-to-r from-[#0f2b57] to-[#1e40af] px-4 py-3 text-white">
            <p className="text-sm font-black">Notificaciones</p>
            <p className="text-xs text-blue-100">Solicitudes de compra y mensajes</p>
          </div>

          {pendingOrders.count > 0 && (
            <div className="border-b border-slate-100 py-2">
              <p className="px-4 pb-1 pt-1 text-xs font-black text-slate-500">
                {pendingOrders.count === 1 ? '1 solicitud de compra por atender' : `${pendingOrders.count} solicitudes de compra por atender`}
              </p>
              {pendingOrders.orders.map(order => (
                <button
                  key={order.id}
                  type="button"
                  onClick={openPendingOrders}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50 ${openSnapshot && new Date(order.createdAt) > new Date(openSnapshot.ordersSince || 0) ? 'bg-blue-50/70' : ''}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#facc15]/25 text-[#12315f] ring-2 ring-[#facc15]/50">
                    <span translate="no" className="material-symbols-outlined text-[22px]">shopping_bag</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-black">
                      Pedido {order.code} · {order.folderName}
                      {openSnapshot && new Date(order.createdAt) > new Date(openSnapshot.ordersSince || 0) && <span className="rounded-full bg-[#ef233c] px-1.5 py-px text-[10px] font-black text-white">Nuevo</span>}
                    </span>
                    <span className="block truncate text-xs font-semibold text-slate-500">
                      {order.cards} {order.cards === 1 ? 'carta' : 'cartas'} · {formatOrderTotal(order.total)} · {orderAge(order.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
              {pendingOrders.count > pendingOrders.orders.length && (
                <p className="px-4 pt-1 text-xs font-semibold text-slate-500">y {pendingOrders.count - pendingOrders.orders.length} más</p>
              )}
            </div>
          )}

          {wishMatches.items > 0 && (
            <div className="border-b border-slate-100 py-2">
              <button type="button" onClick={openWishlist} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-slate-50">
                <span translate="no" className="material-symbols-outlined text-[22px] text-rose-500">favorite</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-800">{wishMatches.items === 1 ? '1 carta de tu lista está disponible' : `${wishMatches.items} cartas de tu lista están disponibles`}</span>
                  <span className="block text-xs font-semibold text-slate-500">Ver quién las vende</span>
                </span>
              </button>
            </div>
          )}

          {notificationChats.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-2">
              {notificationChats.map(chat => {
                const partner = getChatPartner(chat);
                const unreadCount = Number(chat.unreadCount || 0);
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => openNotificationChat(chat)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50 ${openSnapshot?.chatIds.has(chatKey(chat)) ? 'bg-blue-50/70' : ''}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-black text-blue-700 ring-2 ring-[#facc15]/40">
                      {partner.photoURL ? <img src={partner.photoURL} alt="" className="h-full w-full object-cover" /> : (partner.name || partner.username || 'U').charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">{partner.name || partner.username || 'Usuario'}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{decodeMessagePreview(chat.lastMessage || chat.content || '')}</span>
                    </span>
                    {unreadCount > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : pendingOrders.count === 0 && wishMatches.items === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-black text-slate-800">Sin notificaciones nuevas</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Las solicitudes de compra y los mensajes aparecerán aquí.</p>
            </div>
          ) : null}

          <div className="flex border-t border-slate-100">
            {pendingOrders.count > 0 && (
              <button type="button" onClick={openPendingOrders} className="flex-1 px-4 py-3 text-sm font-black text-[#1e40af] transition hover:bg-slate-50">
                Ver solicitudes
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsNotificationOpen(false);
                navigate('/mensajes');
              }}
              className="flex-1 px-4 py-3 text-sm font-black text-[#1e40af] transition hover:bg-slate-50"
            >
              Ver mensajes
            </button>
          </div>
        </div>
      )}
    </div>
  );

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
  return (
    <>
      {/* TopAppBar - Desktop */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim hidden md:block" style={themedTopBarStyle}>
        <div className="flex flex-col w-full">
          <div className="flex lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] items-center justify-between gap-4 lg:gap-8 px-md py-3 w-full max-w-container-max mx-auto">
            <Link to="/bienvenida" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-14 w-auto object-contain transform scale-[1.3] md:scale-[1.4] origin-[left_center] drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
            </Link>

          {/* Centered Search Bar with Category Selector */}
          <form onSubmit={handleSearch} className="w-full flex-1 lg:flex-none">
            <div className="flex items-center bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.25)] overflow-visible focus-within:ring-[3px] focus-within:ring-[#facc15]/70 transition-shadow relative pl-1 pr-1">
              {/* Category selector */}
              <div className="relative search-category-dropdown">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(p => !p)}
                  className="flex items-center gap-1.5 pl-4 pr-3 py-2.5 my-0.5 text-sm font-bold text-[#12315f] border-r border-gray-200 hover:bg-gray-50 rounded-l-full transition-colors whitespace-nowrap"
                >
                  {searchCategory}
                  <span translate="no" className="material-symbols-outlined text-[14px] text-gray-500">keyboard_arrow_down</span>
                </button>
                {categoryDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[130px]">
                    {searchCategories.map(cat => (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => { setSearchCategory(cat.label); setCategoryDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                          searchCategory === cat.label
                            ? 'bg-[#1e40af] text-white'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-[#1e40af]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Busca ${searchCategory.toLowerCase()}...`}
                className="flex-1 min-w-0 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 !bg-transparent !border-0 !shadow-none !ring-0 !rounded-none focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-sm transition hover:brightness-105 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#12315f]/40"
              >
                <span translate="no" className="material-symbols-outlined text-[20px] font-bold">search</span>
              </button>
            </div>
          </form>

          {currentUser ? (
            <div className="flex items-center gap-3 justify-self-end">
            <NotificationBell />
            <div className="relative profile-dropdown">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-label="Abrir menú de cuenta"
                aria-expanded={isDropdownOpen}
                className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-3 text-white shadow-sm transition-all hover:bg-white/15 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-primary object-cover bg-white shadow-md transition-all group-hover:ring-4 group-hover:ring-primary/40" />
                <span className="hidden lg:flex flex-col items-start leading-none">
                  <span className="text-[13px] font-extrabold">Mi cuenta</span>
                  <span className="mt-1 text-[10px] font-semibold text-blue-100">Ver menú</span>
                </span>
                <span translate="no" className={`material-symbols-outlined hidden lg:block text-[18px] text-blue-100 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col py-2 animate-[fadeIn_0.2s_ease-out]">
                  <div className="px-4 pb-2 pt-1 border-b border-gray-100 mb-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Tu cuenta</p>
                    <p className="mt-1 truncate text-sm font-extrabold text-[#1a2b4b]">{userUsername || currentUser.displayName || 'Usuario'}</p>
                  </div>
                  <Link to="/dashboard" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span translate="no" className="material-symbols-outlined text-[20px]">folder</span> Mis carpetas
                  </Link>
                  <Link to="/mensajes" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span translate="no" className="material-symbols-outlined text-[20px]">chat</span> Mensajes
                  </Link>
                  <Link to="/perfil" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span translate="no" className="material-symbols-outlined text-[20px]">person</span> Mi perfil
                  </Link>
                  <Link to={`/${userUsername || currentUser.uid}`} onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span translate="no" className="material-symbols-outlined text-[20px]">storefront</span> Ver perfil público
                  </Link>
                  <div className="h-px bg-gray-100 my-1 mx-2"></div>
                  <button onClick={() => { setIsDropdownOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-bold flex items-center gap-3">
                    <span translate="no" className="material-symbols-outlined text-[20px]">logout</span> Salir
                  </button>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-self-end">
              <button onClick={handleLogin} className="hidden sm:block whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold text-white/90 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/60">
                Iniciar sesión
              </button>
              <button onClick={handleLogin} className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#facc15] px-4 py-2 text-sm font-extrabold text-[#12315f] shadow-md transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white/70">
                <img src="/images/logos/google.svg" alt="" className="w-4 h-4 bg-white rounded-full p-[2px]" />
                Registrarse<span className="hidden xl:inline"> con Google</span>
              </button>
            </div>
          )}
          </div>
          
          <nav onPointerEnter={preloadMainNow} onPointerDown={preloadMainNow} onTouchStart={preloadMainNow} className="flex items-center justify-center w-full gap-2 md:gap-4 overflow-x-auto px-4 py-2 bg-[#1e40af] hide-scrollbar whitespace-nowrap border-t border-[#facc15]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(9,20,45,0.25)]" style={themedNavStyle}>
            <LiquidTabs
              ariaLabel="Navegación principal"
              layout="inline"
              className="gap-2 md:gap-4"
              buttonClassName="rounded-full px-5 py-1.5 text-[15px] font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#facc15]/80 after:pointer-events-none after:absolute after:inset-x-5 after:bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[#facc15] after:transition-transform after:duration-300 hover:after:scale-x-100 aria-pressed:after:hidden"
              indicatorClassName="rounded-full shadow-sm"
              indicatorStyle={{ backgroundColor: themedNavActive ? (publicHeaderTheme.surface || publicHeaderTheme.card) : '#ffffff' }}
              activeTextClassName="font-bold"
              inactiveTextClassName="text-white/85 hover:text-white"
              activeTextStyle={{ color: themedNavActive ? publicHeaderTheme.text : '#1e40af' }}
              inactiveTextStyle={themedNavActive ? { color: `${publicHeaderTheme.card || '#ffffff'}dd` } : undefined}
              value={activeNavRoute}
              onChange={goToSection}
              options={NAV_ROUTES}
            />
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim md:hidden block" style={themedTopBarStyle}>
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 w-full relative h-[60px]">
            {/* Left: Profile and Hamburger Menu */}
            <div className="flex items-center gap-2 z-10">
              {currentUser ? (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Abrir menú de cuenta"
                  className="relative flex items-center gap-1 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-2 text-white shadow-sm active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <img src={userAvatar || currentUser.photoURL} alt="Perfil" className="w-9 h-9 rounded-full border-2 border-[#facc15] object-cover bg-white shadow-sm" />
                  <span translate="no" className="material-symbols-outlined text-[24px] text-white">menu</span>
                </button>
              ) : (
                <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Abrir menú" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60">
                  <span translate="no" className="material-symbols-outlined text-[26px]">menu</span>
                </button>
              )}
            </div>

            {/* Center: Logo */}
            <Link to="/bienvenida" className="absolute left-1/2 -translate-x-1/2 flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-10 w-auto object-contain transform scale-[1.35] origin-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
            </Link>

            {/* Right: Login (if not logged in) */}
            <div className="z-10 flex min-w-[44px] justify-end">
              {currentUser ? (
                <NotificationBell compact />
              ) : (
                <button onClick={handleLogin} className="flex items-center gap-1.5 rounded-full bg-[#facc15] px-3 py-2 text-xs font-extrabold text-[#12315f] shadow-md transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/70">
                  <img src="/images/logos/google.svg" alt="" className="w-3.5 h-3.5 bg-white rounded-full p-[1px]" />
                  Entrar
                </button>
              )}
            </div>
          </div>
          
          {/* Mobile Search Bar with Category */}
          <form onSubmit={handleSearch} className="px-3 pt-1 pb-2.5">
            <div className="flex items-center bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.25)] overflow-visible relative pl-0.5 pr-1 focus-within:ring-[3px] focus-within:ring-[#facc15]/70">
              {/* Category selector mobile */}
              <div className="relative search-category-dropdown">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(p => !p)}
                  className="flex items-center gap-1 pl-3.5 pr-2.5 py-2.5 text-xs font-bold text-[#12315f] border-r border-gray-200 whitespace-nowrap"
                >
                  {searchCategory}
                  <span translate="no" className="material-symbols-outlined text-[12px]">keyboard_arrow_down</span>
                </button>
                {categoryDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[120px]">
                    {searchCategories.map(cat => (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => { setSearchCategory(cat.label); setCategoryDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                          searchCategory === cat.label
                            ? 'bg-[#1e40af] text-white'
                            : 'text-gray-700 hover:bg-blue-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Busca ${searchCategory.toLowerCase()}...`}
                className="flex-1 min-w-0 px-3 py-2.5 text-base text-gray-800 placeholder-gray-400 !bg-transparent !border-0 !shadow-none !ring-0 !rounded-none focus:outline-none"
              />
              <button type="submit" aria-label="Buscar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-sm active:scale-95">
                <span translate="no" className="material-symbols-outlined text-[19px] font-bold">search</span>
              </button>
            </div>
          </form>

          {/* Navegación principal compacta: 4 columnas iguales, sin scroll horizontal */}
          <nav onPointerDown={preloadMainNow} onTouchStart={preloadMainNow} className="border-t border-[#facc15]/40 bg-[#1e40af] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" style={themedNavStyle}>
            <LiquidTabs
              ariaLabel="Navegación principal"
              layout="grid"
              buttonClassName="rounded-full px-1 py-1.5 text-[13px] max-[359px]:text-[11.5px] font-medium leading-none focus-visible:ring-2 focus-visible:ring-[#facc15]/80"
              indicatorClassName="rounded-full shadow-sm"
              indicatorStyle={{ backgroundColor: themedNavActive ? (publicHeaderTheme.surface || publicHeaderTheme.card) : '#ffffff' }}
              activeTextClassName="font-bold"
              inactiveTextClassName="text-white/85"
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
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className={`fixed inset-0 bg-black/60 ${isMobileMenuClosing ? 'animate-drawerFadeOut' : 'animate-fadeInOverlay'}`} onClick={closeMobileMenu}></div>
          <div
            ref={drawerRef}
            onTouchStart={onDrawerTouchStart}
            onTouchMove={onDrawerTouchMove}
            onTouchEnd={onDrawerTouchEnd}
            className={`relative w-[85%] max-w-sm bg-white h-full flex flex-col overflow-y-auto overscroll-contain shadow-2xl pb-[env(safe-area-inset-bottom)] ${isMobileMenuClosing ? 'animate-drawerSlideOut' : 'animate-slideInLeft'}`}
          >
            {/* Cabecera: logo y, con sesión, la cuenta */}
            <div className="bg-gradient-to-br from-[#0f2b57] to-[#1e40af] px-4 pb-4 pt-3 text-white">
              <div className="flex items-center justify-between">
                <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-16 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
                <button onClick={closeMobileMenu} aria-label="Cerrar menú" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60">
                  <span translate="no" className="material-symbols-outlined text-[26px]">close</span>
                </button>
              </div>
              {currentUser && (
                <Link to="/perfil" onClick={closeMobileMenu} className="mt-3 flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 transition active:bg-white/15">
                  {userAvatar || currentUser.photoURL ? (
                    <img src={userAvatar || currentUser.photoURL} alt="" className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-[#facc15] bg-white object-cover shadow-md" />
                  ) : (
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#facc15] bg-[#12315f] text-xl font-black text-white">
                      {(userUsername || currentUser.email || 'U')[0].toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold">{userUsername || 'Usuario'}</span>
                    <span className="block truncate text-xs font-medium text-blue-100">{currentUser.email}</span>
                  </span>
                  <span translate="no" className="material-symbols-outlined text-[20px] text-blue-200">chevron_right</span>
                </Link>
              )}
            </div>

            {(() => {
              const rowBase = 'relative flex min-h-12 items-center gap-3.5 rounded-xl px-3 text-[15px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/50';
              const accountItems = [
                { to: '/dashboard', label: 'Mis carpetas', icon: 'folder', active: location.pathname === '/dashboard' && !location.search.includes('solicitudes') },
                ...(pendingOrders.count > 0 ? [{ to: '/dashboard?tab=solicitudes', label: 'Solicitudes de compra', icon: 'inbox', badge: pendingOrders.count }] : []),
                { to: '/mensajes', label: 'Mensajes', icon: 'chat', active: location.pathname === '/mensajes', badge: unreadMessages },
                { to: '/perfil', label: 'Mi perfil', icon: 'person', active: location.pathname === '/perfil' },
                { to: `/${userUsername || currentUser?.uid || ''}`, label: 'Mi perfil público', icon: 'badge', active: false },
              ];
              const renderItem = (item) => (
                <Link
                  key={item.to + item.label}
                  to={item.to}
                  onClick={closeMobileMenu}
                  aria-current={item.active ? 'page' : undefined}
                  className={`${rowBase} ${item.active ? 'bg-blue-50 text-[#12315f]' : 'text-slate-700 active:bg-slate-100'}`}
                >
                  {item.active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-[#facc15]" />}
                  <span translate="no" className={`material-symbols-outlined text-[22px] ${item.active ? 'text-[#1e40af]' : 'text-slate-400'}`} style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white">{item.badge > 99 ? '99+' : item.badge}</span>
                  )}
                </Link>
              );
              return (
                <div className="flex flex-1 flex-col px-3 pb-4 pt-3">
                  {currentUser ? (
                    <>
                      <p className="mb-1 px-3 text-xs font-bold text-slate-400">Tu cuenta</p>
                      <nav aria-label="Tu cuenta" className="flex flex-col gap-0.5">
                        {accountItems.map(renderItem)}
                      </nav>
                      <div className="mt-auto pt-6">
                        <button
                          onClick={() => { closeMobileMenu(); handleLogout(); }}
                          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-[15px] font-bold text-red-600 transition-colors active:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          <span translate="no" className="material-symbols-outlined text-[20px]">logout</span> Cerrar sesión
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pt-2">
                      <p className="mb-2 px-1 text-sm font-semibold text-slate-500">Entra para vender, guardar carpetas y hablar con vendedores.</p>
                      <button
                        onClick={() => { closeMobileMenu(); handleLogin(); }}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#facc15] px-4 text-[15px] font-extrabold text-[#12315f] shadow-md transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#12315f]/40"
                      >
                        <img src="/images/logos/google.svg" alt="" className="h-5 w-5 rounded-full bg-white p-[2px]" />
                        Entrar con Google
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

