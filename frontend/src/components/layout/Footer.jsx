import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import SocialBrandIcon from '../ui/SocialBrandIcon';

const DEFAULT_SETTINGS = {
  tagline: 'Compra, vende y comparte tu colección de cartas TCG en todo Chile.',
  address: '',
  email: 'contacto@carpetazo.cl',
  phone: '',
  facebookUrl: 'https://facebook.com/carpetazo.cl',
  instagramUrl: 'https://instagram.com/carpetazo.cl',
  whatsappUrl: '',
  discordUrl: '',
  twitterUrl: '',
  tiktokUrl: '',
  theme: 'dark', // 'dark' | 'light'
  copyrightText: '',
  infoLinks: [
    { label: 'Nosotros', url: '/bienvenida' },
    { label: 'Términos y condiciones', url: '/terminos' },
    { label: 'Políticas de privacidad', url: '/privacidad' }
  ]
};

function FacebookIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function WhatsAppIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149 1.98 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function DiscordIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function Footer() {
  const location = useLocation();
  const [publicFooterTheme, setPublicFooterTheme] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    api.getFooterSettings()
      .then((res) => {
        if (!cancelled && res?.settings) {
          setSettings((prev) => ({ ...prev, ...res.settings }));
        }
      })
      .catch(() => {});

    const handleUpdated = (event) => {
      if (event?.detail) {
        setSettings((prev) => ({ ...prev, ...event.detail }));
      }
    };
    window.addEventListener('carpetazo:footer-settings-updated', handleUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('carpetazo:footer-settings-updated', handleUpdated);
    };
  }, []);

  useEffect(() => {
    const handlePublicProfileTheme = (event) => {
      setPublicFooterTheme(event.detail?.theme || null);
    };
    window.addEventListener('carpetazo:public-profile-theme', handlePublicProfileTheme);
    return () => window.removeEventListener('carpetazo:public-profile-theme', handlePublicProfileTheme);
  }, []);

  useEffect(() => {
    const reservedRoutes = ['/', '/bienvenida', '/dashboard', '/perfil', '/carpeta', '/c', '/admin', '/mensajes', '/moderacion', '/sugerencias', '/planes', '/carpetas', '/cartas', '/vendedores'];
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

  const isLight = settings.theme === 'light' && !themedFooterStyle;

  // Social list
  const socialItems = [
    { name: 'Facebook', url: settings.facebookUrl },
    { name: 'Instagram', url: settings.instagramUrl },
    { name: 'WhatsApp', url: settings.whatsappUrl },
    { name: 'Discord', url: settings.discordUrl },
    { name: 'Twitter / X', url: settings.twitterUrl, icon: null },
    { name: 'TikTok', url: settings.tiktokUrl, icon: null },
  ].filter((item) => Boolean(item.url && item.url.trim()));

  const infoLinks = settings.infoLinks && settings.infoLinks.length > 0
    ? settings.infoLinks
    : DEFAULT_SETTINGS.infoLinks;

  const copyrightText = settings.copyrightText?.trim() || `© ${new Date().getFullYear()} Carpetazo.cl. Todos los derechos reservados.`;

  return (
    <footer
      className={`w-full relative z-10 transition-colors duration-200 mt-auto border-t ${
        themedFooterStyle
          ? ''
          : isLight
          ? 'bg-white text-slate-600 border-slate-200'
          : 'bg-[#0a1120] text-slate-300 border-white/10'
      }`}
      style={themedFooterStyle}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Columna 1: Logo, Lema y Redes */}
          <div className="flex flex-col items-start gap-2.5">
            <Link
              to="/bienvenida"
              className="inline-block transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] rounded-xl"
            >
              <img
                src="/images/logos/logo_completo.webp"
                alt="Carpetazo.cl"
                className="h-8 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
              />
            </Link>

            {settings.tagline && (
              <p
                className={`text-xs leading-relaxed max-w-xs ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
                style={{ color: themedFooterStyle ? 'inherit' : undefined, opacity: themedFooterStyle ? 0.9 : undefined }}
              >
                {settings.tagline}
              </p>
            )}

            {socialItems.length > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
                {socialItems.map((social) => {
                  return (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.name}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${
                        isLight
                          ? 'text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-blue-700'
                          : 'text-slate-300 bg-white/10 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      <SocialBrandIcon network={social.name} className="h-3.5 w-3.5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Columna 2: Contacto / Ubícanos */}
          <div className="flex flex-col items-start gap-2">
            <h3
              className={`text-[11px] font-black uppercase tracking-wider ${
                isLight ? 'text-[#0f172a]' : 'text-white'
              }`}
              style={{ color: themedFooterStyle ? 'inherit' : undefined }}
            >
              {settings.address ? 'Ubícanos' : 'Contacto'}
            </h3>

            <div className="flex flex-col gap-1.5 text-xs">
              {settings.address && (
                <div className="flex items-start gap-2">
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    location_on
                  </span>
                  <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                    {settings.address}
                  </span>
                </div>
              )}

              {settings.email && (
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    mail
                  </span>
                  <a
                    href={`mailto:${settings.email}`}
                    className={`transition-colors duration-150 break-all underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] rounded ${
                      isLight ? 'text-slate-600 hover:text-blue-700' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {settings.email}
                  </a>
                </div>
              )}

              {settings.phone && (
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    call
                  </span>
                  <a
                    href={`tel:${settings.phone}`}
                    className={`transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] rounded ${
                      isLight ? 'text-slate-600 hover:text-blue-700' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {settings.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Columna 3: Información */}
          <div className="flex flex-col items-start gap-2">
            <h3
              className={`text-[11px] font-black uppercase tracking-wider ${
                isLight ? 'text-[#0f172a]' : 'text-white'
              }`}
              style={{ color: themedFooterStyle ? 'inherit' : undefined }}
            >
              Información
            </h3>

            <nav aria-label="Enlaces de información" className="flex flex-col gap-1 text-xs">
              {infoLinks.map((item, idx) => (
                <Link
                  key={idx}
                  to={item.url}
                  className={`transition-colors duration-150 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] rounded py-0.5 ${
                    isLight ? 'text-slate-600 hover:text-blue-700' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Columna 4: Síguenos */}
          <div className="flex flex-col items-start gap-2">
            <h3
              className={`text-[11px] font-black uppercase tracking-wider ${
                isLight ? 'text-[#0f172a]' : 'text-white'
              }`}
              style={{ color: themedFooterStyle ? 'inherit' : undefined }}
            >
              Síguenos en redes sociales
            </h3>

            <div className="flex flex-col gap-1 text-xs">
              {socialItems.length > 0 ? (
                socialItems.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 transition-colors duration-150 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] rounded py-0.5 ${
                      isLight ? 'text-slate-600 hover:text-blue-700' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <SocialBrandIcon network={social.name} className="h-3.5 w-3.5 shrink-0" />
                    {social.name}
                  </a>
                ))
              ) : (
                <p className={`text-xs italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Próximamente en redes sociales.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Barra inferior: Copyright */}
        <div
          className={`mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'
          } text-[11px] font-medium`}
          style={{
            borderColor: themedFooterStyle ? 'rgba(255,255,255,0.15)' : undefined,
            color: themedFooterStyle ? 'inherit' : undefined,
            opacity: themedFooterStyle ? 0.8 : undefined
          }}
        >
          <p className="text-center sm:text-left">{copyrightText}</p>
          <div className="flex items-center gap-3">
            <Link
              to="/terminos"
              className={`hover:underline transition-colors ${
                isLight ? 'hover:text-blue-700' : 'hover:text-white'
              }`}
            >
              Términos y condiciones
            </Link>
            <span>&bull;</span>
            <Link
              to="/privacidad"
              className={`hover:underline transition-colors ${
                isLight ? 'hover:text-blue-700' : 'hover:text-white'
              }`}
            >
              Política de privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
