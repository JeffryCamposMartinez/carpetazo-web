import { Link } from 'react-router-dom';

// Menú lateral del celular: cuenta, secciones y salida; se cierra deslizando hacia la izquierda.
export default function MobileMenu({
  appUser, closeMobileMenu, currentUser, drawerRef, handleLogin, handleLogout, isMobileMenuClosing, location,
  onDrawerTouchEnd, onDrawerTouchMove, onDrawerTouchStart, pendingOrders, unreadMessages, userAvatar,
  userUsername
}) {
  return (
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
            ...(['admin', 'moderator', 'support'].includes(appUser?.role) ? [{ to: '/moderacion', label: 'Moderación', icon: 'admin_panel_settings', active: location.pathname === '/moderacion' }] : []),
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
                    Entrar
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
