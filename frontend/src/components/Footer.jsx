import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Footer() {
  const location = useLocation();
  const [publicFooterTheme, setPublicFooterTheme] = useState(null);

  useEffect(() => {
    const handlePublicProfileTheme = (event) => {
      setPublicFooterTheme(event.detail?.theme || null);
    };
    window.addEventListener('carpetazo:public-profile-theme', handlePublicProfileTheme);
    return () => window.removeEventListener('carpetazo:public-profile-theme', handlePublicProfileTheme);
  }, []);

  useEffect(() => {
    const reservedRoutes = ['/', '/bienvenida', '/dashboard', '/perfil', '/carpeta', '/c', '/admin', '/mensajes', '/carpetas', '/cartas', '/vendedores'];
    const pathname = location.pathname;
    const isDynamicPublicProfile = pathname.split('/').filter(Boolean).length === 1 && !reservedRoutes.includes(pathname);
    if (!isDynamicPublicProfile) {
      setPublicFooterTheme(null);
    }
  }, [location.pathname]);

  if (location.pathname === '/mensajes') return null;

  const themedFooterStyle = publicFooterTheme && publicFooterTheme.id !== 'classic-blue'
    ? {
      backgroundImage: `linear-gradient(135deg, ${publicFooterTheme.primary || '#1e40af'}, ${publicFooterTheme.secondary || '#1d4ed8'})`,
      color: publicFooterTheme.card || '#ffffff',
      borderTopColor: `${publicFooterTheme.accent || '#facc15'}44`
    }
    : undefined;

  return (
    <footer 
      className="w-full bg-[#0a1120] text-white/70 py-6 mt-auto flex flex-col items-center justify-center gap-2 border-t border-white/5 relative z-10"
      style={themedFooterStyle}
    >
      <div className="flex items-center gap-2 hover:text-white transition-colors duration-300">
        <span translate="no" className="material-symbols-outlined text-[18px]">mail</span>
        <a href="mailto:carpetazoco@gmail.com" className="text-sm font-medium">carpetazoco@gmail.com</a>
      </div>
      <p className="text-xs font-medium tracking-wide text-center" style={{ color: themedFooterStyle ? 'inherit' : undefined, opacity: themedFooterStyle ? 0.8 : undefined }}>
        &copy; {new Date().getFullYear()} Carpetazo.cl. Todos los derechos reservados.
      </p>
    </footer>
  );
}
