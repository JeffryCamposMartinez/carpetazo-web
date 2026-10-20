import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import SvgIcon from '../components/ui/SvgIcon';
import { FinalCta, Features, Games, HowItWorks, PlansTeaser } from '../components/home/LandingSections';

export default function LandingPage() {
  usePageMeta({ title: 'Vende tus cartas TCG en Chile | Carpetazo', description: 'Arma tu carpeta de cartas, comparte el enlace y recibe pedidos de compradores de todo Chile. Gratis, con perfil de vendedor, mensajes y panel de pedidos.', path: '/bienvenida' });
  const { loginWithGoogle, currentUser } = useAuth();

  // Hook para detectar hover en el carrusel cuando el mouse está quieto y las cartas se mueven debajo
  const mousePos = useRef({ x: -1, y: -1 });
  useEffect(() => {
    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    let animationFrameId;
    let lastHoveredCard = null;

    const checkHover = () => {
      if (mousePos.current.x >= 0 && mousePos.current.y >= 0) {
        const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
        const card = el ? el.closest('.tcg-card') : null;
        if (card !== lastHoveredCard) {
          if (lastHoveredCard) lastHoveredCard.classList.remove('force-hover');
          if (card) card.classList.add('force-hover');
          lastHoveredCard = card;
        }
      }
      animationFrameId = requestAnimationFrame(checkHover);
    };
    checkHover();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (lastHoveredCard) lastHoveredCard.classList.remove('force-hover');
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
        <section className="relative z-20 bg-blue-100 px-4 pb-6 pt-8 text-[#12315f] md:px-12 md:pt-14">
          <div className="relative mx-auto w-full max-w-[1200px] text-center">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 -top-16 -z-10 -translate-x-1/2 h-56 w-56 rounded-full bg-[#facc15]/30 blur-3xl md:h-80 md:w-80" />
            <h1 style={{ '--d': '0ms' }} className="lp-rise mx-auto max-w-[18ch] text-balance text-[2.6rem] font-extrabold leading-[1.02] tracking-tight md:text-7xl">Compra y vende cartas TCG en Chile</h1>
            <p style={{ '--d': '90ms' }} className="lp-rise mx-auto mt-5 max-w-[50ch] text-base leading-relaxed text-[#12315f]/80 md:text-xl">
              Carpetazo reúne las carpetas de jugadores y tiendas chilenas. Encuentra la carta que buscas, arma tu pedido y ciérralo directo con el vendedor.
            </p>
            <div style={{ '--d': '180ms' }} className="lp-rise mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/carpetas" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#12315f] px-8 text-base font-extrabold text-white shadow-[0_10px_20px_-10px_rgba(18,49,95,0.8)] transition-[transform,background-color] duration-150 hover:bg-[#1e40af] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] active:scale-[0.97]">
                <SvgIcon name="auto_stories" translate="no" className="text-[22px]" />
                Explorar carpetas
              </Link>
              <Link to="/cartas" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#facc15] px-8 text-base font-extrabold text-[#12315f] shadow-[0_10px_20px_-12px_rgba(180,130,0,0.9)] transition-[transform,background-color] duration-150 hover:bg-[#fbd53a] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#12315f]/40 active:scale-[0.97]">
                <SvgIcon name="search" translate="no" className="text-[22px]" />
                Buscar cartas
              </Link>
            </div>
            <ul style={{ '--d': '270ms' }} className="lp-rise mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-[#12315f]">
              {[['check_circle', 'Gratis para empezar'], ['style', 'Ocho juegos de cartas'], ['chat', 'Cierras directo con el vendedor']].map(([icon, label]) => (
                <li key={label} className="flex items-center gap-1.5"><SvgIcon name={icon} translate="no" className="text-[19px] text-[#1e40af]" />{label}</li>
              ))}
            </ul>
            <p style={{ '--d': '330ms' }} className="lp-rise mt-4 text-sm font-semibold text-[#12315f]/80">
              ¿Buscas a alguien en particular? <Link to="/vendedores" className="font-extrabold text-[#1e40af] underline underline-offset-4 transition-colors hover:text-[#12315f]">Mira los vendedores</Link>
            </p>
          </div>

            <div className="w-full overflow-hidden pt-4 pb-12 md:pb-16 relative mt-4 ">
              <div className="flex w-max animate-marquee gap-8 md:gap-14 pl-8 md:pl-14 pb-4">
                {[
              { img: '/images/4k/magic.webp', logo: '/images/logos/magic.webp', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.webp', logo: '/images/logos/pokemon.webp', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.webp', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.webp', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.webp', logo: '/images/logos/riftbound.webp', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.webp', logo: '/images/logos/yugioh.webp', scale: 'scale-[2.2]' },
              { img: '/images/4k/magic.webp', logo: '/images/logos/magic.webp', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.webp', logo: '/images/logos/pokemon.webp', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.webp', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.webp', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.webp', logo: '/images/logos/riftbound.webp', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.webp', logo: '/images/logos/yugioh.webp', scale: 'scale-[2.2]' },
              { img: '/images/4k/magic.webp', logo: '/images/logos/magic.webp', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.webp', logo: '/images/logos/pokemon.webp', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.webp', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.webp', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.webp', logo: '/images/logos/riftbound.webp', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.webp', logo: '/images/logos/yugioh.webp', scale: 'scale-[2.2]' },
              { img: '/images/4k/magic.webp', logo: '/images/logos/magic.webp', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.webp', logo: '/images/logos/pokemon.webp', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.webp', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.webp', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.webp', logo: '/images/logos/riftbound.webp', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.webp', logo: '/images/logos/yugioh.webp', scale: 'scale-[2.2]' }
            ].map((item, idx) => (
              <div 
                key={idx} 
                className="tcg-card w-44 h-64 md:w-[min(18rem,26.5vh)] md:h-[min(26rem,38vh)] flex-shrink-0 relative group cursor-pointer mt-4 -skew-x-[15deg] transition-transform duration-500 [&.force-hover]:scale-[1.1] [&.force-hover]:z-30"
              >
                {/* The Skewed Card Frame */}
                <div className="w-full h-full overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-4 border-white rounded-xl relative">
                  <img src={item.img} loading="lazy" 
                    alt={`TCG Art ${idx}`} 
                    className={`w-full h-full object-cover skew-x-[15deg] transition-transform duration-500 ${item.bgScale || 'scale-[1.55] group-[.force-hover]:scale-[1.65]'}`}
                    fetchPriority="high"
                    decoding="sync"
                  />
                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-[.force-hover]:bg-black/20 transition-colors duration-500 z-10 pointer-events-none"></div>
                </div>
                
                {/* Logo Overlay (No Circle, Strong White Outline) */}
                <div className="absolute -bottom-6 md:-bottom-8 left-1/2 -translate-x-1/2 w-36 h-16 md:w-60 md:h-28 z-20 pointer-events-none flex items-center justify-center group-[.force-hover]:-translate-y-2 transition-transform duration-500 skew-x-[15deg]">
                  <img src={item.logo} loading="lazy" 
                    alt="Logo" 
                    className={`w-full h-full object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,1)] drop-shadow-[0_-1px_1px_rgba(255,255,255,1)] drop-shadow-[1px_0_1px_rgba(255,255,255,1)] drop-shadow-[-1px_0_1px_rgba(255,255,255,1)] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] ${item.scale}`} 
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Gradient masks for smooth fading at the edges */}
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-blue-100 to-transparent pointer-events-none z-20"></div>
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-blue-100 to-transparent pointer-events-none z-20"></div>
        </div>
        </section>

        <HowItWorks />
        <Features />
        <Games />
        <PlansTeaser />
        <FinalCta primaryCta={primaryCta} />
      </div>
    </div>
  );
}
