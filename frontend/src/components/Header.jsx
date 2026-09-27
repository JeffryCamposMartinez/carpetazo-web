import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('Carpetas');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [publicHeaderTheme, setPublicHeaderTheme] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationChats, setNotificationChats] = useState([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const markingNotificationsRef = useRef(false);

  const searchCategories = [
    { label: 'Carpetas', route: '/carpetas' },
    { label: 'Cartas', route: '/cartas' },
    { label: 'Vendedores', route: '/vendedores' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    const cat = searchCategories.find(c => c.label === searchCategory);
    const route = cat ? cat.route : '/explorar';
    if (searchQuery.trim()) {
      navigate(`${route}?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(route);
    }
  };

  const getLinkClass = (path) => {
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    
    if (isActive) {
      return `font-bold rounded-full px-5 py-1.5 transition-all duration-300 ${publicHeaderTheme && publicHeaderTheme.id !== 'classic-blue' ? '' : 'text-[#1e40af] bg-white shadow-sm'}`;
    }
    return `text-blue-100 hover:text-white hover:bg-white/10 rounded-full px-5 py-1.5 transition-all duration-300 font-medium text-[15px]`;
  };

  const getLinkStyle = (path) => {
    if (!publicHeaderTheme || publicHeaderTheme.id === 'classic-blue') return undefined;
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    if (isActive) {
      return {
        backgroundColor: publicHeaderTheme.surface || publicHeaderTheme.card,
        color: publicHeaderTheme.text
      };
    }
    return {
      color: `${publicHeaderTheme.card || '#ffffff'}dd`
    };
  };

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
        return;
      }

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

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadUnreadMessages);
      window.removeEventListener('carpetazo:messages-updated', loadUnreadMessages);
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

  const markNotificationChatsRead = async (snapshot = notificationChats) => {
    if (markingNotificationsRef.current || snapshot.length === 0) return;
    markingNotificationsRef.current = true;
    setUnreadMessages(0);

    try {
      await Promise.all(snapshot.map(async (chat) => {
        const partner = getChatPartner(chat);
        const otherId = partner.id || chat.otherId;
        if (!otherId) return;
        const result = await api.getMessages(otherId);
        const list = result.messages || result.data || [];
        await Promise.all(
          list
            .filter(message => message.senderId === otherId && !message.isRead)
            .map(message => api.markMessageRead(message.id).catch(() => null))
        );
      }));
    } catch (error) {
      console.error('Error marking notification messages as read:', error);
    } finally {
      markingNotificationsRef.current = false;
    }
  };

  const openNotifications = async () => {
    const snapshot = notificationChats;
    setIsNotificationOpen(previous => !previous);
    if (!isNotificationOpen && unreadMessages > 0) {
      markNotificationChatsRead(snapshot);
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
        aria-label={unreadMessages > 0 ? `${unreadMessages} mensajes sin leer` : 'Ver mensajes'}
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
        {unreadMessages > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white shadow-lg ring-2 ring-white">
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </button>

      {isNotificationOpen && (
        <div className={`absolute top-full z-50 mt-3 w-[310px] overflow-hidden rounded-3xl border border-[#facc15]/40 bg-white text-slate-900 shadow-2xl ring-1 ring-slate-900/5 ${compact ? 'right-0' : 'right-0'}`}>
          <div className="bg-gradient-to-r from-[#0f2b57] to-[#1e40af] px-4 py-3 text-white">
            <p className="text-sm font-black">Notificaciones</p>
            <p className="text-xs text-blue-100">Mensajes recientes de Carpetazo</p>
          </div>

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
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50"
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
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-black text-slate-800">Sin mensajes nuevos</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Cuando llegue uno, aparecerá aquí.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setIsNotificationOpen(false);
              navigate('/mensajes');
            }}
            className="w-full border-t border-slate-100 px-4 py-3 text-sm font-black text-[#1e40af] transition hover:bg-slate-50"
          >
            Ver todos los mensajes
          </button>
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
          <div className="flex items-center justify-between px-md py-3 md:py-4 w-full max-w-container-max mx-auto">
            <Link to="/bienvenida" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-14 md:h-14 w-auto object-contain transform scale-[1.3] md:scale-[1.4] origin-[left_center]" />
            </Link>

          {/* Centered Search Bar with Category Selector */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-8">
            <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-visible focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all relative">
              {/* Category selector */}
              <div className="relative search-category-dropdown">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold text-[#1a2b4b] border-r border-gray-200 hover:bg-gray-50 rounded-l-xl transition-colors whitespace-nowrap"
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
                className="flex-1 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center px-4 py-2.5 hover:bg-blue-50 transition-colors rounded-r-xl border-l border-gray-200"
              >
                <span translate="no" className="material-symbols-outlined text-[#1e40af] text-[20px]">search</span>
              </button>
            </div>
          </form>

          {currentUser ? (
            <div className="flex items-center gap-3 pb-3">
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
            <div className="flex items-center gap-3 pb-3">
              <button onClick={handleLogin} className="hidden sm:block px-4 py-2 text-on-surface font-bold rounded-lg hover:bg-surface-container transition-colors text-sm">
                Iniciar Sesión
              </button>
              <button onClick={handleLogin} className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 text-sm flex items-center gap-2">
                <img src="/images/logos/google.svg" alt="Google" className="w-4 h-4 bg-white rounded-full p-[2px]" />
                Registrarse
              </button>
            </div>
          )}
          </div>
          
          <nav className="flex items-center justify-center w-full gap-2 md:gap-4 overflow-x-auto px-4 py-2.5 bg-[#1e40af] hide-scrollbar whitespace-nowrap shadow-inner border-t border-black/10" style={themedNavStyle}>
            <Link to="/" className={getLinkClass('/')} style={getLinkStyle('/')}>Inicio</Link>
            <Link to="/carpetas" className={getLinkClass('/carpetas')} style={getLinkStyle('/carpetas')}>Carpetas</Link>
            <Link to="/cartas" className={getLinkClass('/cartas')} style={getLinkStyle('/cartas')}>Cartas</Link>
            <Link to="/vendedores" className={getLinkClass('/vendedores')} style={getLinkStyle('/vendedores')}>Vendedores</Link>
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim md:hidden block" style={themedTopBarStyle}>
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between px-4 py-3 w-full border-b border-gray-100 relative h-[60px]">
            {/* Left: Profile and Hamburger Menu */}
            <div className="flex items-center gap-2 z-10">
              {currentUser ? (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Abrir menú de cuenta"
                  className="relative flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-2 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-9 h-9 rounded-full border border-gray-200 object-cover bg-white shadow-sm" />
                  <span translate="no" className="material-symbols-outlined text-[24px] text-white">menu</span>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide text-[#1e40af] shadow-sm">Menú</span>
                </button>
              ) : (
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 text-white hover:opacity-80">
                  <span translate="no" className="material-symbols-outlined text-[28px]">menu</span>
                </button>
              )}
            </div>

            {/* Center: Logo */}
            <Link to="/bienvenida" className="absolute left-1/2 -translate-x-1/2 flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-10 w-auto object-contain py-0.5 transform scale-[1.5] origin-[center_60%] translate-y-0.5" />
            </Link>

            {/* Right: Login (if not logged in) */}
            <div className="z-10 w-[60px] flex justify-end">
              {currentUser ? (
                <NotificationBell compact />
              ) : (
                <button onClick={handleLogin} className="px-3 py-1.5 bg-primary text-on-primary font-bold rounded-md shadow-sm transition-all text-xs flex items-center gap-1.5">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5 bg-white rounded-full p-[1px]" />
                  Entrar
                </button>
              )}
            </div>
          </div>
          
          {/* Mobile Search Bar with Category */}
          <form onSubmit={handleSearch} className="px-3 py-2 bg-white border-b border-gray-100" style={publicHeaderTheme && publicHeaderTheme.id !== 'classic-blue' ? { backgroundColor: publicHeaderTheme.card, borderColor: `${publicHeaderTheme.primary}33` } : undefined}>
            <div className="flex items-center bg-gray-100 rounded-xl overflow-visible relative">
              {/* Category selector mobile */}
              <div className="relative search-category-dropdown">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(p => !p)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-[#1a2b4b] border-r border-gray-300 whitespace-nowrap"
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
                className="flex-1 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
              />
              <button type="submit" className="px-3 py-2">
                <span translate="no" className="material-symbols-outlined text-[#1e40af] text-[18px]">search</span>
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 animate-fadeInOverlay" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-[85%] max-w-sm bg-white h-full flex flex-col overflow-y-auto shadow-2xl animate-slideInLeft">
            {/* Header sidebar */}
            <div className="flex items-center justify-between p-4 bg-[#1a2b4b]">
              <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-20 w-auto object-contain" />
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-white hover:text-gray-200 focus:outline-none">
                <span translate="no" className="material-symbols-outlined text-[28px]">close</span>
              </button>
            </div>

            {/* Main Links */}
            <div className="flex flex-col py-2 border-b border-gray-100">
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="px-6 py-3.5 text-[15px] font-bold text-gray-800">Inicio</Link>
              <Link to="/carpetas" onClick={() => setIsMobileMenuOpen(false)} className="px-6 py-3.5 text-[15px] font-bold text-gray-800">Carpetas</Link>
              <Link to="/cartas" onClick={() => setIsMobileMenuOpen(false)} className="px-6 py-3.5 text-[15px] font-bold text-gray-800">Cartas</Link>
              <Link to="/vendedores" onClick={() => setIsMobileMenuOpen(false)} className="px-6 py-3.5 text-[15px] font-bold text-gray-800">Vendedores</Link>
            </div>

            {/* User Section */}
            {currentUser && (
              <div className="pt-5 px-6">
                <div className="flex items-center gap-3 mb-6">
                  {userAvatar || currentUser.photoURL ? (
                    <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-12 h-12 rounded-full border border-gray-200 object-cover bg-white shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#1e40af] text-white flex items-center justify-center font-bold text-xl shadow-sm">
                      {userUsername ? userUsername[0].toUpperCase() : currentUser.email[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[15px] font-bold text-gray-900 truncate">{userUsername || 'Usuario'}</span>
                    <span className="text-xs text-gray-500 truncate">{currentUser.email}</span>
                  </div>
                </div>
                
                <div className="text-[11px] font-bold text-gray-400 mb-3 uppercase tracking-wider">Perfil</div>
                <div className="flex flex-col space-y-1">
                  <Link to="/perfil" onClick={() => setIsMobileMenuOpen(false)} className="py-3 text-[15px] text-gray-600 flex items-center gap-4 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors">
                    <span translate="no" className="material-symbols-outlined text-gray-400 text-[22px]">person</span> Mi perfil
                  </Link>
                  <Link to={`/${userUsername || currentUser.uid}`} onClick={() => setIsMobileMenuOpen(false)} className="py-3 text-[15px] text-gray-600 flex items-center gap-4 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors">
                    <span translate="no" className="material-symbols-outlined text-gray-400 text-[22px]">storefront</span> Mi perfil público
                  </Link>
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="py-3 text-[15px] text-gray-600 flex items-center gap-4 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors">
                    <span translate="no" className="material-symbols-outlined text-gray-400 text-[22px]">folder</span> Mis carpetas
                  </Link>
                  <Link to="/mensajes" onClick={() => setIsMobileMenuOpen(false)} className="py-3 text-[15px] text-gray-600 flex items-center gap-4 hover:bg-gray-50 rounded-lg -mx-2 px-2 transition-colors">
                    <span translate="no" className="material-symbols-outlined text-gray-400 text-[22px]">chat</span> Mensajes
                  </Link>
                </div>
                
                <button onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="mt-8 mb-6 w-full py-3 text-[15px] text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                  <span translate="no" className="material-symbols-outlined text-[20px]">logout</span> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

