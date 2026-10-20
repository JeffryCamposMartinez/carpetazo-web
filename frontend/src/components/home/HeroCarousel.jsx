import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import HomeHero from './HomeHero';
import SvgIcon from '../ui/SvgIcon';

// Cada banner dice qué se puede hacer en el sitio, con lo que existe hoy. Los paneles de la derecha son ejemplos ilustrativos de la pantalla real.
const THEMES = {
  sell: { bg: 'from-[#042f2e] via-[#0f766e] to-[#0e7490]', glow: ['bg-cyan-300/30', 'bg-[#facc15]/25'], text: 'text-teal-50/90' },
  filters: { bg: 'from-[#2e1065] via-[#6d28d9] to-[#2563eb]', glow: ['bg-fuchsia-400/30', 'bg-sky-300/25'], text: 'text-violet-100/90' },
  orders: { bg: 'from-[#7c2d12] via-[#ea580c] to-[#db2777]', glow: ['bg-[#facc15]/35', 'bg-rose-300/30'], text: 'text-orange-50/90' },
  search: { bg: 'from-[#14532d] via-[#15803d] to-[#4d7c0f]', glow: ['bg-lime-300/30', 'bg-[#facc15]/25'], text: 'text-green-50/90' },
  wish: { bg: 'from-[#881337] via-[#e11d48] to-[#f59e0b]', glow: ['bg-[#facc15]/35', 'bg-pink-300/30'], text: 'text-rose-50/90' },
};

const money = (value) => `$${value.toLocaleString('es-CL')}`;

function Panel({ children, label }) {
  return (
    <div className="w-full max-w-[22rem] -rotate-2 justify-self-center rounded-2xl bg-white p-4 text-[#12315f] shadow-[0_24px_40px_-18px_rgba(2,12,40,0.7)] ring-1 ring-white/60">
      {children}
      <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">{label}</p>
    </div>
  );
}

// Una carta icónica por juego, guardadas en public/images/carousel (se sacaron del catálogo en R2)
const CARDS = {
  pokemon: { name: 'Charizard', set: 'Base Set', src: '/images/carousel/pokemon.webp' },
  mitos: { name: 'Rey Arturo Pendragón', set: 'Espada Sagrada', src: '/images/carousel/mitos.webp' },
  yugioh: { name: 'Dark Magician', set: 'La Leyenda del Dragón Blanco de Ojos Azules', src: '/images/carousel/yugioh.webp' },
  magic: { name: 'Black Lotus', set: 'Beta Edition', src: '/images/carousel/magic.webp' },
  onepiece: { name: 'Monkey.D.Luffy', set: 'ST-01: Starter Deck 1', src: '/images/carousel/onepiece.webp' },
  riftbound: { name: 'Jinx, Demolitionist', set: 'Origins', src: '/images/carousel/riftbound.webp' },
};

function Thumb({ card }) {
  return <img src={card.src} alt="" loading="lazy" className="h-11 w-8 shrink-0 rounded-[5px] object-cover shadow-sm ring-1 ring-black/10" />;
}

function CardRow({ card, detail, end }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Thumb card={card} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{card.name}</span><span className="block truncate text-[11px] text-slate-500">{detail}</span></span>
      {end}
    </li>
  );
}

function SellPanel() {
  const rows = [[CARDS.pokemon, 1, 38000], [CARDS.yugioh, 2, 6000], [CARDS.mitos, 3, 2500]];
  return (
    <Panel label="Ejemplo de una carpeta">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-black">Mi carpeta</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#facc15] px-2.5 py-1 text-[11px] font-extrabold"><SvgIcon name="link" translate="no" className="text-[14px]" />Compartir</span>
      </div>
      <ul className="divide-y divide-blue-50">
        {rows.map(([card, stock, price]) => (
          <CardRow key={card.name} card={card} detail={card.set} end={<><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black">x{stock}</span><span className="w-16 text-right text-[13px] font-black tabular-nums">{money(price)}</span></>} />
        ))}
      </ul>
    </Panel>
  );
}

function FiltersPanel() {
  const chips = [['Edición', true], ['Idioma', true], ['Tipo', false], ['Raza', false], ['Coste', false]];
  return (
    <Panel label="Ejemplo de búsqueda y filtros">
      <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[13px] font-semibold text-[#12315f]/70"><SvgIcon name="search" translate="no" className="text-[18px] text-[#1e40af]" />Buscar carta…</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map(([label, on]) => (
          <span key={label} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold ${on ? 'bg-[#1e40af] text-white' : 'bg-white text-[#1e40af] ring-1 ring-blue-200'}`}>{label}<SvgIcon name={on ? 'check' : 'expand_more'} translate="no" className="text-[14px]" /></span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[CARDS.riftbound, CARDS.onepiece, CARDS.magic].map((card) => <img key={card.name} src={card.src} alt="" loading="lazy" className="aspect-[5/7] w-full rounded-lg object-cover shadow-sm ring-1 ring-black/10" />)}
      </div>
    </Panel>
  );
}

function OrdersPanel() {
  const rows = [[CARDS.yugioh, 2, 6000], [CARDS.riftbound, 1, 3500]];
  return (
    <Panel label="Ejemplo de un pedido">
      <div className="mb-2 flex items-center gap-2 text-sm font-black"><SvgIcon name="shopping_cart" translate="no" className="text-[18px] text-[#1e40af]" />Tu pedido</div>
      <ul className="divide-y divide-blue-50">
        {rows.map(([card, qty, price]) => (
          <CardRow key={card.name} card={card} detail={`${qty} × ${money(price)}`} end={<span className="text-[13px] font-black tabular-nums">{money(qty * price)}</span>} />
        ))}
      </ul>
      <div className="mt-1 flex items-center justify-between border-t-2 border-[#12315f]/10 pt-2.5"><span className="text-sm font-black">Total</span><span className="text-lg font-black tabular-nums">{money(rows.reduce((sum, [, qty, price]) => sum + qty * price, 0))}</span></div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fff7d1] px-3 py-2 text-xs font-bold"><span>Código del pedido</span><span className="rounded-md bg-white px-2 py-0.5 font-black">se lo enviamos al vendedor</span></div>
    </Panel>
  );
}

function SearchPanel() {
  const rows = [[CARDS.magic, 3, 120000], [CARDS.yugioh, 5, 6000], [CARDS.mitos, 2, 2500]];
  return (
    <Panel label="Ejemplo de una búsqueda en Cartas">
      <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[13px] font-semibold text-[#12315f]/70"><SvgIcon name="search" translate="no" className="text-[18px] text-[#1e40af]" />Buscar en todas las carpetas…</div>
      <ul className="mt-2 divide-y divide-blue-50">
        {rows.map(([card, sellers, price]) => (
          <CardRow key={card.name} card={card} detail={`${sellers} ${sellers === 1 ? 'vendedor' : 'vendedores'} · desde ${money(price)}`} end={<SvgIcon name="chevron_right" translate="no" className="text-[18px] text-slate-400" />} />
        ))}
      </ul>
    </Panel>
  );
}

function WishPanel() {
  const rows = [[CARDS.magic, '$120.000', false], [CARDS.onepiece, '$4.000', false], [CARDS.riftbound, '$3.500', true]];
  return (
    <Panel label="Ejemplo de una lista de deseos">
      <div className="mb-2 flex items-center gap-2 text-sm font-black"><SvgIcon name="favorite" translate="no" className="text-[18px] text-rose-500" />Mi lista de deseos</div>
      <ul className="divide-y divide-blue-50">
        {rows.map(([card, max, hit]) => (
          <CardRow key={card.name} card={card} detail={`Precio máximo ${max}`} end={hit ? <span className="rounded-full bg-[#facc15] px-2 py-0.5 text-[11px] font-black">¡A la venta!</span> : null} />
        ))}
      </ul>
    </Panel>
  );
}

const VISUALS = { sell: SellPanel, filters: FiltersPanel, orders: OrdersPanel, search: SearchPanel, wish: WishPanel };

function InfoSlide({ theme, title, text, points, cta, to, secondary }) {
  const { bg, glow: [glow, glow2], text: tone } = THEMES[theme];
  const Visual = VISUALS[theme];
  return (
    <div className={`relative isolate flex h-full w-full select-none flex-col justify-center gap-5 overflow-hidden bg-gradient-to-br ${bg} px-6 py-7 text-left text-white md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-10 md:px-12 lg:px-16`}>
      <div aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full blur-3xl ${glow}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-64 w-64 rounded-full blur-3xl ${glow2}`} />
      <div>
        <h2 className="max-w-[22ch] text-balance text-[clamp(1.5rem,5.6vw,1.9rem)] font-extrabold leading-[1.1] tracking-tight md:text-[clamp(1.95rem,3.1vw,3rem)]">{title}</h2>
        <p className={`mt-3 max-w-[48ch] text-[13px] leading-relaxed ${tone} md:mt-4 md:text-[clamp(0.95rem,1.25vw,1.125rem)]`}>{text}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Link to={to} className="inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#0B1E45] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:h-12 md:px-7 md:text-[15px]">{cta}</Link>
          {secondary && <Link to={secondary.to} className="inline-flex h-11 items-center rounded-full bg-white/10 px-5 text-sm font-bold ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:h-12 md:px-6 md:text-[15px]">{secondary.label}</Link>}
        </div>
        <ul className={`mt-5 hidden flex-wrap gap-x-5 gap-y-2 text-sm font-semibold ${tone} md:flex`}>
          {points.map(({ icon, label }) => (
            <li key={label} className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#facc15]/20 text-[#facc15]"><SvgIcon name={icon} translate="no" className="text-[16px]" /></span>{label}</li>
          ))}
        </ul>
      </div>
      <div className="hidden md:block"><Visual /></div>
    </div>
  );
}

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { currentUser } = useAuth();
  const sellTo = currentUser ? '/dashboard' : '/bienvenida';

  // El gesto se guarda en una referencia: así no se vuelve a renderizar el carrusel en cada movimiento del dedo o del mouse
  const gesture = useRef({ startX: null, endX: null, dragging: false });
  const minSwipeDistance = 50;

  const settleGesture = () => {
    const { startX, endX } = gesture.current;
    gesture.current = { startX: null, endX: null, dragging: false };
    if (startX === null || endX === null) return;
    const distance = startX - endX;
    if (distance > minSwipeDistance) setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    else if (distance < -minSwipeDistance) setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const onTouchStart = (e) => { gesture.current = { startX: e.targetTouches[0].clientX, endX: null, dragging: true }; };
  const onTouchMove = (e) => { if (gesture.current.dragging) gesture.current.endX = e.targetTouches[0].clientX; };
  const onTouchEnd = () => settleGesture();
  const onMouseDown = (e) => { gesture.current = { startX: e.clientX, endX: null, dragging: true }; };
  const onMouseMove = (e) => { if (gesture.current.dragging) gesture.current.endX = e.clientX; };
  const onMouseUp = () => { if (gesture.current.dragging) settleGesture(); };
  const onMouseLeave = () => { gesture.current = { startX: null, endX: null, dragging: false }; };

  const slides = [
    {
      id: 'marketplace',
      mobileContent: <HomeHero compact />,
      desktopContent: <HomeHero />,
    },
    {
      id: 'sell',
      content: (
        <InfoSlide
          theme="sell"
          title="Vende tus cartas con una carpeta pública"
          text="Empieza gratis con una carpeta. Carga tus cartas con precio y stock, comparte el enlace y recibe los pedidos en tu panel. Cuando crezcas, un plan te da más carpetas y cartas."
          points={[
            { icon: 'sell', label: 'Precio y stock por carta' },
            { icon: 'link', label: 'Un enlace para compartir' },
            { icon: 'workspace_premium', label: 'Planes desde $990 al mes' },
          ]}
          cta={currentUser ? 'Ir a mis carpetas' : 'Crear mi carpeta'}
          to={sellTo}
          secondary={{ label: 'Ver planes', to: '/planes' }}
        />
      ),
    },
    {
      id: 'filters',
      content: (
        <InfoSlide
          theme="filters"
          title="Encuentra la carta exacta en cualquier juego"
          text="Dentro de cada carpeta busca por nombre y filtra por edición. Cada juego suma sus propios filtros, como tipo, raza o coste, y los puedes combinar."
          points={[
            { icon: 'search', label: 'Búsqueda por nombre' },
            { icon: 'tune', label: 'Filtros propios de cada juego' },
          ]}
          cta="Ver carpetas"
          to="/carpetas"
        />
      ),
    },
    {
      id: 'orders',
      content: (
        <InfoSlide
          theme="orders"
          title="Arma tu pedido y ciérralo con el vendedor"
          text="Agrega cartas al carrito y genera el pedido. El vendedor recibe el detalle con el total y un código, y coordinan pago y envío por el medio que él tenga disponible."
          points={[
            { icon: 'receipt_long', label: 'Pedido con total y código' },
            { icon: 'forum', label: 'Contacto directo con el vendedor' },
          ]}
          cta="Ver carpetas"
          to="/carpetas"
        />
      ),
    },
    {
      id: 'search',
      content: (
        <InfoSlide
          theme="search"
          title="Busca una carta y mira quién la vende"
          text="En Cartas escribes el nombre y ves en qué carpetas está, con el precio de cada vendedor. Entras a la que más te convenga."
          points={[
            { icon: 'search', label: 'Todas las carpetas a la vez' },
            { icon: 'sell', label: 'Precio de cada vendedor' },
          ]}
          cta="Buscar cartas"
          to="/cartas"
        />
      ),
    },
    {
      id: 'wish',
      content: (
        <InfoSlide
          theme="wish"
          title="Guarda lo que buscas y entérate cuando aparezca"
          text="Arma tu lista de deseos con el precio máximo que pagarías. Si una de esas cartas sale a la venta o baja de precio, te avisamos."
          points={[
            { icon: 'favorite', label: 'Lista con precio máximo' },
            { icon: 'notifications_active', label: 'Aviso por correo y en el navegador' },
          ]}
          cta={currentUser ? 'Ir a mi lista' : 'Crear mi cuenta'}
          to={currentUser ? '/dashboard?tab=deseadas' : '/bienvenida'}
        />
      ),
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 15000);
    return () => clearInterval(timer);
  }, [slides.length, currentSlide]);

  return (
    <div className="w-full max-w-[1280px] mb-6 flex flex-col items-center">
      <div
        className="w-full relative overflow-hidden rounded-3xl h-[350px] sm:h-[clamp(360px,46vh,470px)] select-none cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="flex transition-transform duration-700 ease-in-out h-full"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="w-full h-full flex-shrink-0 relative bg-[#0B1E45]" aria-hidden={slides[currentSlide].id !== slide.id} inert={slides[currentSlide].id !== slide.id}>
              {slide.content ? slide.content : (
                <>
                  <div className="block md:hidden h-full w-full">{slide.mobileContent}</div>
                  <div className="hidden md:flex h-full w-full">{slide.desktopContent}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-center mt-6">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={() => setCurrentSlide(idx)}
            className={`relative h-2 rounded-full transition-all duration-300 after:absolute after:-inset-x-1.5 after:-inset-y-4 after:content-[''] ${
              currentSlide === idx ? 'bg-[#12315f] w-8' : 'bg-slate-300 hover:bg-slate-400 w-3'
            }`}
            aria-label={`Ir al banner ${idx + 1}`}
            aria-current={currentSlide === idx}
          />
        ))}
      </div>
    </div>
  );
}
