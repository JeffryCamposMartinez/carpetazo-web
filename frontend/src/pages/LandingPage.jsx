import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import SvgIcon from '../components/ui/SvgIcon';
import SocialBrandIcon from '../components/ui/SocialBrandIcon';
import { api } from '../services/api';
import { FinalCta, Features, Games, HowItWorks, PlansTeaser, SocialLinks } from '../components/home/LandingSections';

const MARQUEE_GAMES = [
  { tcg: 'Magic', img: '/images/4k/magic.webp', logo: '/images/logos/magic.webp', scale: 'scale-[1.8]' },
  { tcg: 'Pokémon', img: '/images/4k/pokemon.webp', logo: '/images/logos/pokemon.webp', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
  { tcg: 'Mitos y Leyendas', img: '/images/4k/mitosyleyendas.webp', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
  { tcg: 'One Piece', img: '/images/4k/onepiece.webp', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
  { tcg: 'Riftbound', img: '/images/4k/riftbound.webp', logo: '/images/logos/riftbound.webp', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
  { tcg: 'Yu-Gi-Oh!', img: '/images/4k/yugioh.webp', logo: '/images/logos/yugioh.webp', scale: 'scale-[2.2]' },
];

const MARQUEE_ITEMS = [...MARQUEE_GAMES, ...MARQUEE_GAMES, ...MARQUEE_GAMES, ...MARQUEE_GAMES];

export default function LandingPage() {
  usePageMeta({ title: 'Vende tus cartas TCG en Chile | Carpetazo', description: 'Arma tu carpeta de cartas, comparte el enlace y recibe pedidos de compradores de todo Chile. Gratis, con perfil de vendedor, mensajes y panel de pedidos.', path: '/bienvenida' });
  const { loginWithGoogle, currentUser } = useAuth();
  const [socialNetworks, setSocialNetworks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.getFooterSettings().then((response) => {
      if (cancelled || !response?.settings) return;
      const configured = [
        ['Facebook', 'facebookUrl'], ['Instagram', 'instagramUrl'],
        ['WhatsApp', 'whatsappUrl'], ['Discord', 'discordUrl'],
        ['X / Twitter', 'twitterUrl'], ['TikTok', 'tiktokUrl'],
      ].flatMap(([name, field]) => {
        const url = String(response.settings[field] || '').trim();
        if (!url) return [];
        try { if (!['https:', 'http:'].includes(new URL(url).protocol)) return []; }
        catch { return []; }
        return [{ name, url }];
      });
      setSocialNetworks(configured);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Detecta hover en el carrusel cuando el puntero está quieto sobre él y las cartas se desplazan debajo (solo en dispositivos con puntero y mientras el mouse está dentro del carrusel)
  const marqueeRef = useRef(null);
  const mousePos = useRef({ x: -1, y: -1, active: false });
  useEffect(() => {
    const node = marqueeRef.current;
    if (!node || !window.matchMedia('(hover: hover)').matches) return undefined;
    let animationFrameId = null;
    let lastHoveredCard = null;

    const clearHovered = () => {
      if (lastHoveredCard) {
        lastHoveredCard.classList.remove('force-hover');
        lastHoveredCard = null;
      }
    };

    const checkHover = () => {
      if (!mousePos.current.active) {
        animationFrameId = null;
        return;
      }
      const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
      const card = el ? el.closest('.tcg-card') : null;
      if (card !== lastHoveredCard) {
        if (lastHoveredCard) lastHoveredCard.classList.remove('force-hover');
        if (card) card.classList.add('force-hover');
        lastHoveredCard = card;
      }
      animationFrameId = requestAnimationFrame(checkHover);
    };

    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY, active: true };
      if (!animationFrameId) animationFrameId = requestAnimationFrame(checkHover);
    };

    const handleMouseLeave = () => {
      mousePos.current.active = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      clearHovered();
    };

    node.addEventListener('mousemove', handleMouseMove, { passive: true });
    node.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      node.removeEventListener('mousemove', handleMouseMove);
      node.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      clearHovered();
    };
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
    }
  };

  const primaryCta = currentUser ? (
    <Link to="/dashboard" className="inline-flex h-12 items-center rounded-full bg-[#facc15] px-7 text-[15px] font-extrabold text-[#12315f] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#12315f]/50">
      Ir a mis carpetas
    </Link>
  ) : (
    <button type="button" onClick={handleLogin} className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[#facc15] px-7 text-[15px] font-extrabold text-[#12315f] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#12315f]/50">
      <img src="/images/logos/google.svg" alt="" className="h-5 w-5 rounded-full bg-white p-[2px]" />
      Crear mi carpeta con Google
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16">
      <div className="relative z-10 flex min-h-[100svh] w-full flex-col overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30">

        {/* Presentación y carrusel de juegos */}
        <section className="relative z-20 bg-blue-100 px-4 pb-5 pt-5 text-[#12315f] md:px-12 md:pb-6 md:pt-14">
          <div className="relative mx-auto w-full max-w-[1200px] text-center">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 -top-16 -z-10 -translate-x-1/2 h-56 w-56 rounded-full bg-[#facc15]/30 blur-3xl md:h-80 md:w-80" />
            <h1 style={{ '--d': '0ms' }} className="lp-rise mx-auto max-w-[18ch] text-balance text-[2.15rem] font-extrabold leading-[1.04] tracking-tight sm:text-5xl md:text-7xl">Compra y vende cartas TCG en Chile</h1>
            <p style={{ '--d': '90ms' }} className="lp-rise mx-auto mt-3 max-w-[50ch] text-[15px] leading-relaxed text-[#12315f]/80 md:mt-5 md:text-xl">
              Carpetazo reúne las carpetas de jugadores y tiendas chilenas. Encuentra la carta que buscas, arma tu pedido y ciérralo directo con el vendedor.
            </p>
            <div style={{ '--d': '180ms' }} className="lp-rise mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:flex sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
              {currentUser ? (
                <Link to="/dashboard" className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] px-6 text-[15px] font-extrabold text-[#12315f] shadow-[0_10px_20px_-12px_rgba(180,130,0,0.9)] transition-[transform,background-color] duration-150 hover:bg-[#fbd53a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#12315f]/40 active:scale-[0.97] sm:h-14 sm:px-8 sm:text-base">
                  <SvgIcon name="folder_special" translate="no" className="text-[20px] sm:text-[22px]" />
                  Ir a mis carpetas
                </Link>
              ) : (
                <button type="button" onClick={handleLogin} className="col-span-2 inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#facc15] px-6 text-[15px] font-extrabold text-[#12315f] shadow-[0_10px_20px_-12px_rgba(180,130,0,0.9)] transition-[transform,background-color] duration-150 hover:bg-[#fbd53a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#12315f]/40 active:scale-[0.97] sm:h-14 sm:px-8 sm:text-base">
                  <img src="/images/logos/google.svg" alt="" className="h-5 w-5 rounded-full bg-white p-[2px]" />
                  Crear mi carpeta con Google
                </button>
              )}
              <Link to="/carpetas" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#12315f] px-4 text-sm font-extrabold text-white shadow-[0_10px_20px_-10px_rgba(18,49,95,0.8)] transition-[transform,background-color] duration-150 hover:bg-[#1e40af] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] active:scale-[0.97] sm:h-14 sm:gap-2 sm:px-8 sm:text-base">
                <SvgIcon name="auto_stories" translate="no" className="text-[19px] sm:text-[22px]" />
                Explorar carpetas
              </Link>
              <Link to="/cartas" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-extrabold text-[#12315f] ring-1 ring-[#12315f]/15 shadow-sm transition-[transform,background-color] duration-150 hover:bg-white/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#12315f]/40 active:scale-[0.97] sm:h-14 sm:gap-2 sm:px-8 sm:text-base">
                <SvgIcon name="search" translate="no" className="text-[19px] sm:text-[22px]" />
                Buscar cartas
              </Link>
            </div>
            <ul style={{ '--d': '270ms' }} className="lp-rise mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs font-bold text-[#12315f] sm:mt-6 sm:gap-x-5 sm:gap-y-2 sm:text-sm">
              {[['check_circle', 'Gratis para empezar'], ['style', 'Tus juegos TCG favoritos'], ['chat', 'Cierras directo con el vendedor']].map(([icon, label]) => (
                <li key={label} className="flex items-center gap-1"><SvgIcon name={icon} translate="no" className="text-[16px] text-[#1e40af] sm:text-[19px]" />{label}</li>
              ))}
            </ul>
            <p style={{ '--d': '330ms' }} className="lp-rise mt-3 text-xs font-semibold text-[#12315f]/80 sm:mt-4 sm:text-sm">
              ¿Buscas a alguien en particular? <Link to="/vendedores" className="font-extrabold text-[#1e40af] underline underline-offset-4 transition-colors hover:text-[#12315f]">Mira los vendedores</Link>
            </p>
            {socialNetworks.length > 0 && (
              <div className="lp-rise mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:mt-5" aria-label="Redes sociales oficiales de Carpetazo">
                {socialNetworks.map((network) => (
                  <a key={network.name} href={network.url} target="_blank" rel="noopener noreferrer" aria-label={`Visitar Carpetazo en ${network.name}`} title={network.name} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#12315f]/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] sm:h-10 sm:w-10">
                    <SocialBrandIcon network={network.name} className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div ref={marqueeRef} className="relative mt-2 w-full overflow-hidden pb-10 pt-3 md:mt-4 md:pb-16 md:pt-4">
            <div className="flex w-max animate-marquee gap-6 pb-3 pl-6 md:gap-14 md:pb-4 md:pl-14">
              {MARQUEE_ITEMS.map((item, idx) => (
                <Link
                  key={idx}
                  to={`/carpetas?tcg=${encodeURIComponent(item.tcg)}`}
                  aria-label={`Ver carpetas de ${item.tcg}`}
                  className="tcg-card group relative mt-3 h-56 w-40 flex-shrink-0 -skew-x-[15deg] cursor-pointer transition-transform duration-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] md:mt-4 md:h-[min(26rem,38vh)] md:w-[min(18rem,26.5vh)] [&.force-hover]:z-30 [&.force-hover]:scale-[1.1]"
                >
                  {/* The Skewed Card Frame */}
                  <div className="relative h-full w-full overflow-hidden rounded-xl border-4 border-white shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                    <img
                      src={item.img}
                      loading={idx < 6 ? 'eager' : 'lazy'}
                      fetchPriority={idx < 6 ? 'high' : 'auto'}
                      decoding="async"
                      alt={item.tcg}
                      className={`h-full w-full skew-x-[15deg] object-cover transition-transform duration-500 ${item.bgScale || 'scale-[1.55] group-[.force-hover]:scale-[1.65]'}`}
                    />
                    {/* Subtle hover overlay */}
                    <div className="pointer-events-none absolute inset-0 z-10 bg-black/0 transition-colors duration-500 group-[.force-hover]:bg-black/20"></div>
                  </div>

                  {/* Logo Overlay (No Circle, Strong White Outline) */}
                  <div className="pointer-events-none absolute -bottom-6 left-1/2 z-20 flex h-16 w-36 -translate-x-1/2 skew-x-[15deg] items-center justify-center transition-transform duration-500 group-[.force-hover]:-translate-y-2 md:-bottom-8 md:h-28 md:w-60">
                    <img
                      src={item.logo}
                      loading={idx < 6 ? 'eager' : 'lazy'}
                      decoding="async"
                      alt=""
                      className={`h-full w-full object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,1)] drop-shadow-[0_-1px_1px_rgba(255,255,255,1)] drop-shadow-[1px_0_1px_rgba(255,255,255,1)] drop-shadow-[-1px_0_1px_rgba(255,255,255,1)] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] ${item.scale}`}
                    />
                  </div>
                </Link>
              ))}
            </div>

            {/* Gradient masks for smooth fading at the edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-blue-100 to-transparent md:w-32"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-blue-100 to-transparent md:w-32"></div>
          </div>
        </section>

        <HowItWorks />
        <Features />
        <Games />
        <SocialLinks networks={socialNetworks} />
        <PlansTeaser />
        <FinalCta primaryCta={primaryCta} />
      </div>
    </div>
  );
}
