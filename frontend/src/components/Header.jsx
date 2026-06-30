import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export default function Header() {
  const { currentUser, logout, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userAvatar, setUserAvatar] = useState(null);
  const [userUsername, setUserUsername] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
    }
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
              <img src="/images/logos/logo_completo.png" alt="Carpetazo.cl" className="h-10 md:h-14 w-auto object-contain" />
            </Link>

          {currentUser ? (
            <div className="relative profile-dropdown pb-3">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
              >
                <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-9 h-9 rounded-full border-2 border-primary object-cover bg-white shadow-sm" />
                <div className="bg-primary w-9 h-9 rounded-md shadow-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#1a2b4b] text-xl">menu</span>
                </div>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col py-2 animate-[fadeIn_0.2s_ease-out]">
                  <Link to="/dashboard" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">folder</span> Mis carpetas
                  </Link>
                  <Link to="/mensajes" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">chat</span> Mensajes
                  </Link>
                  <Link to="/perfil" onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">person</span> Mi perfil
                  </Link>
                  <Link to={`/${userUsername || currentUser.uid}`} onClick={() => setIsDropdownOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">storefront</span> Ver perfil público
                  </Link>
                  <div className="h-px bg-gray-100 my-1 mx-2"></div>
                  <button onClick={() => { setIsDropdownOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-bold flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">logout</span> Salir
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
          
          <nav className="flex items-end justify-center w-full gap-2 overflow-x-auto px-4 pt-3 bg-[#1e40af] hide-scrollbar whitespace-nowrap shadow-inner border-t border-[#1a2b4b]/20">
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
          <div className="flex items-center justify-between px-md py-sm w-full max-w-container-max mx-auto border-b border-gray-100">
            <Link to="/bienvenida" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/logos/logo_completo.png" alt="Carpetazo.cl" className="h-10 w-auto object-contain" />
            </Link>
            {currentUser ? (
            <div className="relative profile-dropdown">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
              >
                <img src={userAvatar || currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-primary object-cover bg-white shadow-sm" />
                <div className="bg-primary w-8 h-8 rounded-md shadow-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#1a2b4b] text-lg">menu</span>
                </div>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col py-2 animate-[fadeIn_0.2s_ease-out]">
                  <Link to="/dashboard" onClick={() => setIsDropdownOpen(false)} className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 font-semibold flex items-center gap-3 border-b border-gray-50">
                    <span className="material-symbols-outlined text-[20px]">folder</span> Mis carpetas
                  </Link>
                  <Link to="/mensajes" onClick={() => setIsDropdownOpen(false)} className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 font-semibold flex items-center gap-3 border-b border-gray-50">
                    <span className="material-symbols-outlined text-[20px]">chat</span> Mensajes
                  </Link>
                  <Link to="/perfil" onClick={() => setIsDropdownOpen(false)} className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 font-semibold flex items-center gap-3 border-b border-gray-50">
                    <span className="material-symbols-outlined text-[20px]">person</span> Mi perfil
                  </Link>
                  <Link to={`/${userUsername || currentUser.uid}`} onClick={() => setIsDropdownOpen(false)} className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 font-semibold flex items-center gap-3 border-b border-gray-50">
                    <span className="material-symbols-outlined text-[20px]">storefront</span> Ver perfil público
                  </Link>
                  <button onClick={() => { setIsDropdownOpen(false); handleLogout(); }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-bold flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">logout</span> Salir
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleLogin} className="px-3 py-1.5 bg-primary text-on-primary font-bold rounded-md shadow-sm transition-all text-xs flex items-center gap-1.5">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5 bg-white rounded-full p-[1px]" />
                Entrar
              </button>
            </div>
          )}
          </div>
          
          <nav className="flex items-end justify-center w-full gap-2 overflow-x-auto px-4 pt-3 bg-[#1e40af] hide-scrollbar whitespace-nowrap shadow-inner border-t border-[#1a2b4b]/20">
            <Link to="/" className={getLinkClass('/')}>Inicio</Link>
            <Link to="/carpetas" className={getLinkClass('/carpetas')}>Carpetas</Link>
            <Link to="/cartas" className={getLinkClass('/cartas')}>Cartas</Link>
            <Link to="/vendedores" className={getLinkClass('/vendedores')}>Vendedores</Link>
          </nav>
        </div>
      </header>
    </>
  );
}
