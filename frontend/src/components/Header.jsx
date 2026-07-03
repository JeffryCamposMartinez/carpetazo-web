import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import AuthModal from './AuthModal';

export default function Header() {
  const { currentUser, logout, loginWithGoogle } = useAuth();
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
    const isActive = location.pathname.startsWith(path);
    
    if (isActive) {
      // Active tab: light blue background, rounded top only, text dark blue, touches the bottom
      return `font-extrabold text-[#1a2b4b] bg-[#DBEAFE] rounded-t-xl px-6 py-3 transition-all duration-300`;
    }
    // Inactive tab: light blue text, transparent, smaller padding
    return `text-blue-200 hover:text-white hover:bg-white/10 rounded-t-xl px-5 py-2 transition-all duration-300 font-bold text-sm mb-1`;
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
    let unsubscribe = null;
    if (currentUser) {
      setUserAvatar(currentUser.photoURL);
      unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (userSnap) => {
        if (userSnap.exists()) {
          if (userSnap.data().avatarBase64) {
            setUserAvatar(userSnap.data().avatarBase64);
          } else {
            setUserAvatar(currentUser.photoURL);
          }
          if (userSnap.data().username) {
            setUserUsername(userSnap.data().username);
          }
        } else {
          setUserAvatar(currentUser.photoURL);
        }
      }, (error) => {
        console.error("Error listening to user data for header", error);
      });
    } else {
      setUserAvatar(null);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };
  return (
    <>
      {/* TopAppBar - Desktop */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim hidden md:block">
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between px-md py-3 w-full max-w-container-max mx-auto">
            <Link to="/bienvenida" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.png" alt="Carpetazo.cl" className="h-14 md:h-16 w-auto object-contain py-0.5 transform scale-[1.3] md:scale-[1.5] origin-[left_60%] translate-y-1" />
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
            <div className="relative profile-dropdown pb-3">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="focus:outline-none transition-all"
              >
                <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-primary object-cover bg-white shadow-md hover:ring-4 hover:ring-primary/40 transition-all" />
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col py-2 animate-[fadeIn_0.2s_ease-out]">
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
          ) : (
            <div className="flex items-center gap-3 pb-3">
              <button onClick={handleLogin} className="hidden sm:block px-4 py-2 text-on-surface font-bold rounded-lg hover:bg-surface-container transition-colors text-sm">
                Iniciar Sesión
              </button>
              <button onClick={handleLogin} className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 text-sm flex items-center gap-2">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 bg-white rounded-full p-[2px]" />
                Registrarse
              </button>
            </div>
          )}
          </div>
          
          <nav className="flex items-end justify-center w-full gap-2 overflow-x-auto px-4 pt-2 bg-[#1e40af] hide-scrollbar whitespace-nowrap shadow-inner border-t border-[#1a2b4b]/20">
            <Link to="/" className={getLinkClass('/')}>Inicio</Link>
            <Link to="/carpetas" className={getLinkClass('/carpetas')}>Carpetas</Link>
            <Link to="/cartas" className={getLinkClass('/cartas')}>Cartas</Link>
            <Link to="/vendedores" className={getLinkClass('/vendedores')}>Vendedores</Link>
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim md:hidden block">
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between px-4 py-3 w-full border-b border-gray-100 relative h-[60px]">
            {/* Left: Hamburger Menu */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 text-white hover:opacity-80 z-10">
              <span translate="no" className="material-symbols-outlined text-[28px]">menu</span>
            </button>

            {/* Center: Logo */}
            <Link to="/bienvenida" className="absolute left-1/2 -translate-x-1/2 flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.png" alt="Carpetazo.cl" className="h-10 w-auto object-contain py-0.5 transform scale-[1.5] origin-[center_60%] translate-y-0.5" />
            </Link>

            {/* Right: Profile (Unclickable) or Login */}
            <div className="z-10">
              {currentUser ? (
                <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-9 h-9 rounded-full border border-gray-200 object-cover bg-white shadow-sm" />
              ) : (
                <button onClick={handleLogin} className="px-3 py-1.5 bg-primary text-on-primary font-bold rounded-md shadow-sm transition-all text-xs flex items-center gap-1.5">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5 bg-white rounded-full p-[1px]" />
                  Entrar
                </button>
              )}
            </div>
          </div>
          
          {/* Mobile Search Bar with Category */}
          <form onSubmit={handleSearch} className="px-3 py-2 bg-white border-b border-gray-100">
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
              <img src="/images/logos/logo_completo.png" alt="Carpetazo.cl" className="h-20 w-auto object-contain" />
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
                  <span translate="no" className="material-symbols-outlined text-[20px]">logout</span> Cerrar sesión
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
