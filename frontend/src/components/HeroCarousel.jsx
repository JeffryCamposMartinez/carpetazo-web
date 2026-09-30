import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HomeHero from './home/HomeHero';

// Cada banner dice qué se puede hacer en el sitio, con lo que existe hoy.
function InfoSlide({ title, text, points, cta, to }) {
  return (
    <div className="flex h-full w-full select-none flex-col justify-center gap-5 px-6 py-7 text-left text-white md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-10 md:px-14">
      <div>
        <h2 className="max-w-[22ch] text-balance text-[clamp(1.5rem,5.6vw,1.9rem)] font-extrabold leading-[1.1] tracking-tight md:text-[clamp(1.95rem,3.1vw,3rem)]">{title}</h2>
        <p className="mt-3 max-w-[48ch] text-[13px] leading-relaxed text-blue-100/85 md:mt-4 md:text-[clamp(0.95rem,1.25vw,1.125rem)]">{text}</p>
        <Link
          to={to}
          className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-7 text-sm font-extrabold text-[#0B1E45] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:mt-6 md:h-12 md:px-8 md:text-[15px]"
        >
          {cta}
        </Link>
      </div>
      <ul className="hidden divide-y divide-white/15 rounded-lg border border-white/20 bg-[#12315f] md:block">
        {points.map(({ icon, label }) => (
          <li key={label} className="flex items-center gap-4 px-5 py-4 text-[15px] font-semibold">
            <span translate="no" className="material-symbols-outlined text-[24px] text-[#facc15]">{icon}</span>
            {label}
          </li>
        ))}
      </ul>
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
          title="Vende tus cartas con una carpeta pública"
          text="Carga tus cartas con precio y stock, comparte el enlace de tu carpeta y recibe los pedidos en tu panel."
          points={[
            { icon: 'sell', label: 'Precio y stock por carta' },
            { icon: 'link', label: 'Un enlace para compartir tu carpeta' },
            { icon: 'inbox', label: 'Pedidos y ventas en un solo panel' },
          ]}
          cta={currentUser ? 'Ir a mis carpetas' : 'Crear mi carpeta'}
          to={sellTo}
        />
      ),
    },
    {
      id: 'filters',
      content: (
        <InfoSlide
          title="Encuentra la carta exacta en Mitos y Leyendas"
          text="Dentro de cada carpeta puedes buscar por nombre y filtrar por bloque, edición, producto, tipo, raza y coste."
          points={[
            { icon: 'search', label: 'Búsqueda por nombre de carta' },
            { icon: 'tune', label: 'Filtros por bloque, edición y producto' },
            { icon: 'style', label: 'Tipo, raza y coste de cada carta' },
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
          title="Arma tu pedido y ciérralo por WhatsApp"
          text="Agrega cartas al carrito y genera el pedido. El vendedor recibe el detalle con el total y un código para coordinar pago y envío."
          points={[
            { icon: 'shopping_cart', label: 'Carrito con las cartas que elijas' },
            { icon: 'receipt_long', label: 'Pedido con total y código' },
            { icon: 'chat', label: 'Conversación directa con el vendedor' },
          ]}
          cta="Ver carpetas"
          to="/carpetas"
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
            <div key={slide.id} className="w-full h-full flex-shrink-0 relative bg-[#0B1E45]" aria-hidden={slides[currentSlide].id !== slide.id}>
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
            className={`h-2 rounded-full transition-all duration-300 ${
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
