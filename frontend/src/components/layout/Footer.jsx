import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

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
    const reservedRoutes = ['/', '/bienvenida', '/dashboard', '/perfil', '/carpeta', '/c', '/admin', '/mensajes', '/moderacion', '/carpetas', '/cartas', '/vendedores'];
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
      className="w-full bg-[#0a1120] text-white/70 pb-6 pt-3 mt-auto flex flex-col items-center justify-center gap-0.5 border-t border-white/5 relative z-10"
      style={themedFooterStyle}
    >
      <a href="mailto:carpetazo.soporte@gmail.com" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">mail</span>
        carpetazo.soporte@gmail.com
      </a>
      <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-2 text-xs font-semibold">
        <Link to="/terminos" className="inline-flex min-h-11 items-center rounded-lg px-2 underline-offset-2 transition-colors duration-150 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Términos y Condiciones</Link>
        <Link to="/privacidad" className="inline-flex min-h-11 items-center rounded-lg px-2 underline-offset-2 transition-colors duration-150 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Política de Privacidad</Link>
      </nav>
      <p className="text-xs font-medium tracking-wide text-center" style={{ color: themedFooterStyle ? 'inherit' : undefined, opacity: themedFooterStyle ? 0.8 : undefined }}>
        &copy; {new Date().getFullYear()} Carpetazo.cl. Todos los derechos reservados.
      </p>
    </footer>
  );
}
