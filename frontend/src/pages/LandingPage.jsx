import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';

export default function LandingPage() {
  const { loginWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isFromLogo = new URLSearchParams(location.search).get('ref') === 'logo';
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);

  useEffect(() => {
    if (currentUser && !isFromLogo) {
      navigate('/explorar');
    }
  }, [currentUser, navigate, isFromLogo]);

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
      console.error("Error al iniciar sesión con Google:", error);
    }
  };

  const proFeatures = [
    { icon: 'inventory_2', title: 'Gestión Inteligente de Inventario', desc: 'Registra cartas, variaciones, estados y cantidades con una interfaz ultrarrápida diseñada para grandes volúmenes.' },
    { icon: 'monitoring', title: 'Valoración en Tiempo Real', desc: 'Sincronización automática con los mercados globales para que siempre conozcas el valor real de tu colección.' },
    { icon: 'storefront', title: 'Carpetas Públicas y Ventas', desc: 'Convierte tu colección en una vitrina virtual. Comparte tus cartas disponibles para venta o intercambio con un solo link.' },
    { icon: 'style', title: 'Soporte Multi-TCG', desc: 'Centraliza todas tus colecciones en un mismo lugar: Pokémon, Yu-Gi-Oh!, Magic, One Piece, Mitos y Leyendas y más.' },
    { icon: 'query_stats', title: 'Estadísticas Avanzadas', desc: 'Visualiza el crecimiento de tu inversión, cartas más valiosas y fluctuaciones del mercado con gráficos detallados.' },
    { icon: 'security', title: 'Privacidad y Seguridad', desc: 'Tus datos están respaldados en la nube. Controla qué carpetas son públicas y cuáles son estrictamente privadas.' }
  ];

  return (
    <>
      <div className="w-full max-w-[1500px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-outline-variant/30 flex flex-col relative z-10 min-h-screen">
          
          {/* Top Section: White Presentation & Carousel */}
          <div className="min-h-[calc(100vh-100px)] bg-blue-100 text-surface p-4 md:p-8 flex flex-col items-center justify-start pt-8 md:pt-12 relative z-20">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-2 text-center tracking-tight animate-[fadeIn_0.5s_ease-out]">Todo tu universo TCG en un solo lugar</h2>
            <p className="text-sm md:text-lg text-surface/80 text-center max-w-3xl mb-0 px-2 md:px-0 animate-[fadeIn_0.7s_ease-out]">
              Gestiona tu inventario, sigue los precios del mercado y comparte tus carpetas. La plataforma definitiva para coleccionistas y tiendas de TCG.
            </p>

            <div className="w-full overflow-hidden pt-4 pb-12 md:pb-16 relative mt-4 animate-[fadeIn_0.9s_ease-out]">
              <div className="flex w-max animate-marquee gap-8 md:gap-14 pl-8 md:pl-14 pb-4">
                {[
              { img: '/images/4k/magic.png', logo: '/images/logos/magic.png', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.png', logo: '/images/logos/pokemon.png', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.png', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.png', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.png', logo: '/images/logos/riftbound.png', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.png', logo: '/images/logos/yugioh.png', scale: 'scale-[2.2]' },
              { img: '/images/4k/magic.png', logo: '/images/logos/magic.png', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.png', logo: '/images/logos/pokemon.png', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.png', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.png', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.png', logo: '/images/logos/riftbound.png', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.png', logo: '/images/logos/yugioh.png', scale: 'scale-[2.2]' },
              { img: '/images/4k/magic.png', logo: '/images/logos/magic.png', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.png', logo: '/images/logos/pokemon.png', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.png', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.png', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.png', logo: '/images/logos/riftbound.png', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.png', logo: '/images/logos/yugioh.png', scale: 'scale-[2.2]' },
              { img: '/images/4k/magic.png', logo: '/images/logos/magic.png', scale: 'scale-[1.8]' },
              { img: '/images/4k/pokemon.png', logo: '/images/logos/pokemon.png', scale: 'scale-[1.1] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/mitosyleyendas.png', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.4]', bgScale: 'scale-[1.75] origin-top object-top -translate-x-8 group-[.force-hover]:scale-[1.85]' },
              { img: '/images/4k/onepiece.png', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.7]' },
              { img: '/images/4k/riftbound.png', logo: '/images/logos/riftbound.png', scale: 'scale-[1.0] -translate-y-3 md:-translate-y-4' },
              { img: '/images/4k/yugioh.png', logo: '/images/logos/yugioh.png', scale: 'scale-[2.2]' }
            ].map((item, idx) => (
              <div 
                key={idx} 
                className="tcg-card w-44 h-64 md:w-72 md:h-[26rem] flex-shrink-0 relative group cursor-pointer mt-4 -skew-x-[15deg] transition-transform duration-500 [&.force-hover]:scale-[1.1] [&.force-hover]:z-30"
              >
                {/* The Skewed Card Frame */}
                <div className="w-full h-full overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-4 border-white rounded-xl relative">
                  <img 
                    src={item.img} 
                    alt={`TCG Art ${idx}`} 
                    className={`w-full h-full object-cover skew-x-[15deg] transition-transform duration-500 ${item.bgScale || 'scale-[1.55] group-[.force-hover]:scale-[1.65]'}`}
                  />
                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-[.force-hover]:bg-black/20 transition-colors duration-500 z-10 pointer-events-none"></div>
                </div>
                
                {/* Logo Overlay (No Circle, Strong White Outline) */}
                <div className="absolute -bottom-6 md:-bottom-8 left-1/2 -translate-x-1/2 w-36 h-16 md:w-60 md:h-28 z-20 pointer-events-none flex items-center justify-center group-[.force-hover]:-translate-y-2 transition-transform duration-500 skew-x-[15deg]">
                  <img 
                    src={item.logo} 
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

        {/* CTA Button */}
        <div className="z-20 flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4 my-auto">
          <Link to="/explorar" className="w-full sm:w-auto px-6 py-3 md:px-8 md:py-4 bg-primary text-on-primary font-bold rounded-xl shadow-[0_0_20px_rgba(255,203,5,0.4)] hover:shadow-[0_0_30px_rgba(255,203,5,0.6)] transition-all hover:-translate-y-1 text-base md:text-lg flex items-center justify-center gap-3">
            <span className="material-symbols-outlined text-2xl">travel_explore</span>
            Explorar carpetas de la comunidad
          </Link>
        </div>

        {/* Scroll Down Indicator */}
        <div className="w-full flex justify-center pointer-events-none z-30 pt-2 pb-6">
          <div 
            className="flex flex-col items-center cursor-pointer pointer-events-auto group" 
            onClick={() => {
              const el = document.getElementById('features-section');
              if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 60;
                window.scrollTo({ top: y, behavior: 'smooth' });
              }
            }}
          >
            <span className="text-sm font-extrabold tracking-[0.2em] uppercase mb-3 text-surface group-hover:text-primary transition-colors drop-shadow-sm">
              Descubre Más
            </span>
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-[3px] border-surface/20 bg-white shadow-xl flex items-center justify-center animate-bounce group-hover:shadow-2xl group-hover:border-primary group-hover:-translate-y-1 transition-all duration-300">
              <span className="material-symbols-outlined text-4xl text-surface group-hover:text-primary drop-shadow-sm transition-colors">keyboard_arrow_down</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ultra-Smooth Alpha Transition Space */}
      <div className="w-full h-40 md:h-64 bg-gradient-to-b from-blue-100 to-background relative pointer-events-none">
      </div>

      {/* Bottom Section: Professional Features */}
      <div id="features-section" className="relative w-full min-h-[calc(100vh-60px)] overflow-hidden flex flex-col items-center justify-center py-12 px-4 bg-background">
        {/* Background with abstract glowing orbs animated */}
        <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full pointer-events-none animate-float" style={{ animationDuration: '10s' }}></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-tertiary/10 blur-[120px] rounded-full pointer-events-none animate-float" style={{ animationDuration: '12s', animationDelay: '2s' }}></div>
        
        <div className="z-10 text-center w-full max-w-4xl mx-auto flex-shrink-0 mb-8 md:mb-12 animate-[fadeIn_0.5s_ease-out]">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-on-background mb-3 md:mb-4 tracking-tight leading-tight">
            Nivel Profesional para <br className="md:hidden"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-tertiary">Coleccionistas Exigentes</span>
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-on-surface-variant max-w-2xl mx-auto px-4 md:px-0">
            Descubre todas las herramientas que Carpetazo.cl te ofrece para transformar la manera en que gestionas, exhibes y valoras tu colección.
          </p>
        </div>

        {/* Pro Features Grid: Mobile Infinite Scroll */}
        <div className="z-10 w-full overflow-hidden md:hidden pt-6 pb-6"
             onTouchStart={() => setIsMarqueePaused(true)}
             onTouchEnd={() => setIsMarqueePaused(false)}
        >
          <div className={`flex w-max animate-marquee gap-4 px-4 ${isMarqueePaused ? '[animation-play-state:paused]' : ''}`}>
            {[...proFeatures, ...proFeatures].map((feat, idx) => (
            <div 
              key={`mobile-${idx}`} 
              className="flex-shrink-0 w-[80vw] relative bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-5 hover:bg-surface-container/50 hover:border-primary/40 transition-all duration-500 overflow-hidden animate-float"
              style={{ animationDelay: `${(idx % 6) * 0.5}s`, animationDuration: '7s' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="flex flex-col gap-3 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
                    <span className="material-symbols-outlined text-2xl text-primary drop-shadow-md">{feat.icon}</span>
                  </div>
                  <h3 className="text-base font-bold text-on-background leading-tight">{feat.title}</h3>
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed pl-16">
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
          </div>
        </div>

        {/* Pro Features Grid: Desktop */}
        <div className="z-10 w-full max-w-6xl mx-auto hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proFeatures.map((feat, idx) => (
            <div 
              key={`desktop-${idx}`} 
              className="relative bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-6 hover:bg-surface-container/50 hover:border-primary/40 transition-all duration-500 group hover:shadow-[0_8px_30px_rgba(255,203,5,0.15)] overflow-hidden animate-float"
              style={{ animationDelay: `${idx * 0.5}s`, animationDuration: '7s' }}
            >
              {/* Subtle hover gradient background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/30 group-hover:scale-150 transition-all duration-700 pointer-events-none"></div>
              
              <div className="flex flex-col gap-3 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner group-hover:from-primary/40 group-hover:to-primary/10 group-hover:rotate-6 group-hover:scale-110 transition-all duration-300">
                    <span className="material-symbols-outlined text-2xl text-primary drop-shadow-md">{feat.icon}</span>
                  </div>
                  <h3 className="text-lg font-bold text-on-background group-hover:text-primary transition-colors leading-tight">{feat.title}</h3>
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed pl-16">
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
      </div>
    </>
  );
}
