import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SvgIcon from '../../ui/SvgIcon';

// Menú lateral del celular: cuenta, secciones y salida; se cierra deslizando hacia la izquierda.
export default function MobileMenu({
  appUser, closeMobileMenu, currentUser, drawerRef, handleLogin, handleLogout, isMobileMenuClosing, location,
  onDrawerTouchEnd, onDrawerTouchMove, onDrawerTouchStart, onInPersonSale, pendingOrders, unreadMessages, userAvatar,
  userUsername
}) {
  const closeRef = useRef(closeMobileMenu);
  closeRef.current = closeMobileMenu;
  // Diálogo accesible: el foco entra al abrir, Tab no sale del panel, Escape cierra y el foco vuelve al botón del menú
  useEffect(() => {
    const previous = document.activeElement;
    const panel = drawerRef.current;
    panel?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { closeRef.current(); return; }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll('button:not([disabled]),a[href]')];
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [drawerRef]);

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div className={`fixed inset-0 bg-black/60 ${isMobileMenuClosing ? 'animate-drawerFadeOut' : 'animate-fadeInOverlay'}`} onClick={closeMobileMenu}></div>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de Carpetazo"
        tabIndex={-1}
        onTouchStart={onDrawerTouchStart}
        onTouchMove={onDrawerTouchMove}
        onTouchEnd={onDrawerTouchEnd}
        className={`relative w-[85%] max-w-sm bg-white h-full outline-none flex flex-col overflow-y-auto overscroll-contain shadow-2xl pb-[env(safe-area-inset-bottom)] ${isMobileMenuClosing ? 'animate-drawerSlideOut' : 'animate-slideInLeft'}`}
      >
        {/* Cabecera: logo y, con sesión, la cuenta */}
        <div className="bg-gradient-to-br from-[#0f2b57] to-[#1e40af] px-4 pb-4 pt-3 text-white">
          <div className="flex items-center justify-between">
            <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-16 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
            <button onClick={closeMobileMenu} aria-label="Cerrar menú" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white active:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60">
              <SvgIcon name="close" translate="no" className="text-[26px]" />
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
              <SvgIcon name="chevron_right" translate="no" className="text-[20px] text-blue-200" />
            </Link>
          )}
        </div>

        {(() => {
          const rowBase = 'relative flex min-h-12 items-center gap-3.5 rounded-xl px-3 text-[15px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/50';
          const allItems = [
            { to: '/dashboard', label: 'Mis carpetas', icon: 'folder', active: location.pathname === '/dashboard' && !/tab=(solicitudes|historial|deseadas)/.test(location.search) },
            { to: '/dashboard?tab=deseadas', label: 'Mi lista de deseos', icon: 'favorite', active: location.pathname === '/dashboard' && location.search.includes('tab=deseadas') },
            { to: '/dashboard?tab=solicitudes', label: 'Solicitudes de compra', icon: 'inbox', active: location.pathname === '/dashboard' && location.search.includes('tab=solicitudes'), badge: pendingOrders.count > 0 ? pendingOrders.count : undefined },
            { to: '/dashboard?tab=historial', label: 'Historial de ventas', icon: 'receipt_long', active: location.pathname === '/dashboard' && location.search.includes('tab=historial') },
            { action: onInPersonSale, label: 'Venta presencial', icon: 'payments' },
            { to: '/mensajes', label: 'Mensajes', icon: 'chat', active: location.pathname === '/mensajes', badge: unreadMessages },
            { to: '/perfil', label: 'Mi cuenta', icon: 'person', active: location.pathname === '/perfil' },
            { to: '/planes', label: 'Mi plan', icon: 'workspace_premium', active: location.pathname === '/planes' },
            { to: '/sugerencias', label: 'Reclamos y sugerencias', icon: 'feedback', active: location.pathname === '/sugerencias' },
            ...(userUsername ? [{ to: `/${userUsername}`, label: 'Mi perfil público', icon: 'badge', active: false }] : []),
            ...(['admin', 'coadmin', 'moderator', 'support'].includes(appUser?.role) ? [{ to: '/moderacion', label: 'Moderación', icon: 'admin_panel_settings', active: location.pathname === '/moderacion' }] : []),
          ];
          const pick = (...labels) => labels.map((label) => allItems.find((item) => item.label === label)).filter(Boolean);
          // Lo de uso diario va solo, en mosaicos; el resto, agrupado por tema
          const quick = pick('Mis carpetas', 'Venta presencial', 'Solicitudes de compra', 'Mensajes');
          const groups = [
            { title: 'Mi actividad', items: pick('Historial de ventas', 'Mi lista de deseos') },
            { title: 'Cuenta', items: pick('Mi cuenta', 'Mi plan', 'Mi perfil público') },
            { title: 'Ayuda', items: pick('Reclamos y sugerencias') },
            { title: 'Equipo', items: pick('Moderación') }
          ].filter((group) => group.items.length);
          const renderItem = (item) => (item.action ? (
            <button
              key={item.label}
              type="button"
              onClick={() => { closeMobileMenu(); item.action(); }}
              className={`${rowBase} w-full text-left text-slate-700 active:bg-slate-100`}
            >
              <SvgIcon name={item.icon} translate="no" className="text-[22px] text-slate-400" />
              <span className="flex-1">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.to + item.label}
              to={item.to}
              onClick={closeMobileMenu}
              aria-current={item.active ? 'page' : undefined}
              className={`${rowBase} ${item.active ? 'bg-blue-50 text-[#12315f]' : 'text-slate-700 active:bg-slate-100'}`}
            >
              {item.active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-[#facc15]" />}
              <SvgIcon name={item.icon} translate="no" className={`text-[22px] ${item.active ? 'text-[#1e40af]' : 'text-slate-400'}`} style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined} />
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white">{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </Link>
          ));
          const tileBase = 'relative flex min-h-[5.5rem] flex-col items-start justify-between gap-2 rounded-2xl p-3.5 text-left text-[14px] font-extrabold leading-tight ring-1 transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/50';
          const renderTile = (item) => {
            const tone = item.active ? 'bg-blue-50 text-[#12315f] ring-[#1e40af]/40' : 'bg-white text-[#12315f] ring-slate-900/10';
            const inner = (
              <>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.active ? 'bg-[#1e40af] text-white' : 'bg-[#ffcb05] text-[#1a2b4b]'}`}><SvgIcon name={item.icon} translate="no" aria-hidden="true" className="text-[22px]" /></span>
                <span>{item.label}</span>
                {item.badge > 0 && <span className="absolute right-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef233c] px-1.5 text-[11px] font-black text-white">{item.badge > 99 ? '99+' : item.badge}</span>}
              </>
            );
            return item.action
              ? <button key={item.label} type="button" onClick={() => { closeMobileMenu(); item.action(); }} className={`${tileBase} ${tone}`}>{inner}</button>
              : <Link key={item.to + item.label} to={item.to} onClick={closeMobileMenu} aria-current={item.active ? 'page' : undefined} className={`${tileBase} ${tone}`}>{inner}</Link>;
          };
          return (
            <div className="flex flex-1 flex-col px-3 pb-4 pt-3">
              {currentUser ? (
                <>
                  <nav aria-label="Acceso rápido" className="grid grid-cols-2 gap-2">
                    {quick.map(renderTile)}
                  </nav>
                  {groups.map((group) => (
                    <nav key={group.title} aria-label={group.title} className="mt-4 flex flex-col gap-0.5">
                      <p className="mb-1 px-3 text-xs font-bold text-slate-400">{group.title}</p>
                      {group.items.map(renderItem)}
                    </nav>
                  ))}
                  <div className="mt-auto pt-6">
                    <button
                      onClick={() => { closeMobileMenu(); handleLogout(); }}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-[15px] font-bold text-red-600 transition-colors active:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    >
                      <SvgIcon name="logout" translate="no" className="text-[20px]" /> Cerrar sesión
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
