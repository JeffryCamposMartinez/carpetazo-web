import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef } from 'react';

const BUY_STEPS = [
  'Busca una carta o una carpeta.',
  'Agrega cartas al carrito y genera el pedido.',
  'Cierra el trato por WhatsApp con el vendedor.',
];

const SELL_STEPS = [
  'Entra con tu cuenta de Google.',
  'Crea una carpeta y carga tus cartas con precio y stock.',
  'Comparte el enlace y recibe los pedidos en tu panel.',
];

const FEATURES = [
  { icon: 'auto_stories', title: 'Carpetas públicas', text: 'Cada carpeta se ve como un álbum o en cuadrícula, con el stock y el precio de cada carta.' },
  { icon: 'tune', title: 'Filtros para Mitos y Leyendas', text: 'Filtra por bloque, edición, producto, tipo, raza y coste.' },
  { icon: 'inbox', title: 'Panel de pedidos', text: 'Revisa las solicitudes de compra, confirma las ventas y consulta tu historial.' },
  { icon: 'chat', title: 'Mensajes directos', text: 'Habla con compradores y vendedores sin salir de Carpetazo.' },
  { icon: 'badge', title: 'Perfil de vendedor', text: 'Un perfil público con tu descripción, tu ubicación y tus redes.' },
];

export default function LandingPage() {
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
      <div className="relative z-10 flex min-h-screen w-full flex-col overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30">

        {/* Presentación y carrusel de juegos */}
        <section className="relative z-20 bg-blue-100 px-4 pb-6 pt-8 text-[#12315f] md:px-12 md:pt-14">
          <div className="mx-auto w-full max-w-[1200px]">
            <h1 className="max-w-[20ch] text-balance text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Compra y vende cartas TCG en Chile</h1>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-slate-700 md:text-lg">
              Carpetazo reúne las carpetas de cartas de jugadores y tiendas chilenas. Encuentra la carta que buscas, arma tu pedido y ciérralo por WhatsApp.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/carpetas" className="inline-flex h-12 items-center justify-center rounded-full bg-[#12315f] px-7 text-[15px] font-extrabold text-white transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                Explorar carpetas
              </Link>
              <Link to="/cartas" className="inline-flex h-12 items-center justify-center rounded-full border-2 border-[#12315f] px-7 text-[15px] font-extrabold text-[#12315f] transition-colors hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                Buscar cartas
              </Link>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#12315f]">
              ¿Buscas a alguien en particular? <Link to="/vendedores" className="font-extrabold underline underline-offset-2">Mira los vendedores</Link>.
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

        {/* Cómo funciona */}
        <section className="bg-white px-4 py-14 md:px-12 md:py-20">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="max-w-[24ch] text-balance text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Cómo funciona</h2>
            <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
              {[{ title: 'Si quieres comprar', steps: BUY_STEPS }, { title: 'Si quieres vender', steps: SELL_STEPS }].map((group) => (
                <div key={group.title}>
                  <h3 className="border-b-2 border-[#facc15] pb-2 text-xl font-extrabold text-[#12315f]">{group.title}</h3>
                  <ol className="mt-4 divide-y divide-slate-200">
                    {group.steps.map((step, index) => (
                      <li key={step} className="flex items-baseline gap-4 py-4">
                        <span className="w-6 shrink-0 text-lg font-black tabular-nums text-[#1e40af]">{index + 1}</span>
                        <span className="text-base leading-relaxed text-slate-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Qué incluye */}
        <section className="bg-[#F4F6FA] px-4 py-14 md:px-12 md:py-20">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="max-w-[24ch] text-balance text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Lo que puedes hacer en Carpetazo</h2>
            <dl className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="grid gap-1 py-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8">
                  <dt className="flex items-center gap-3 text-lg font-extrabold text-[#12315f]">
                    <span translate="no" className="material-symbols-outlined text-[24px] text-[#1e40af]">{feature.icon}</span>
                    {feature.title}
                  </dt>
                  <dd className="text-base leading-relaxed text-slate-600 md:pl-0">{feature.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Juegos disponibles */}
        <section className="bg-white px-4 py-14 md:px-12 md:py-20">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="max-w-[24ch] text-balance text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Juegos con catálogo de cartas</h2>
            <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-slate-600">Hoy puedes buscar y cargar cartas de estos dos juegos. Las carpetas de otros juegos se irán sumando.</p>
            <ul className="mt-8 grid max-w-2xl grid-cols-2 gap-4">
              {[{ name: 'Pokémon', logo: '/images/logos/pokemon.webp' }, { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp' }].map((game) => (
                <li key={game.name}>
                  <Link to={`/carpetas?tcg=${encodeURIComponent(game.name)}`} className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                    <img src={game.logo} alt="" className="h-16 w-auto max-w-full object-contain" loading="lazy" />
                    <span className="text-sm font-bold text-[#12315f]">Ver carpetas de {game.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Llamado final */}
        <section className="bg-[#12315f] px-4 py-14 text-white md:px-12 md:py-20">
          <div className="mx-auto w-full max-w-[1200px]">
            <h2 className="max-w-[22ch] text-balance text-3xl font-extrabold tracking-tight md:text-4xl">Publica tu primera carpeta</h2>
            <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-blue-100">Es gratis. Con tu cuenta de Google puedes cargar tus cartas y compartir el enlace hoy mismo.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {primaryCta}
              <Link to="/carpetas" className="inline-flex h-12 items-center justify-center rounded-full border-2 border-white/40 px-7 text-[15px] font-bold text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                Explorar carpetas
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
