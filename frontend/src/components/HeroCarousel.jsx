import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFolderFilter } from '../pages/Dashboard';

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  // Swipe / Drag logic
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    } else if (isRightSwipe) {
      setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }
  };

  const onMouseDown = (e) => {
    setDragEnd(null);
    setDragStart(e.clientX);
    setIsDragging(true);
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    setDragEnd(e.clientX);
  };

  const onMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!dragStart || !dragEnd) return;
    const distance = dragStart - dragEnd;
    if (distance > minSwipeDistance) {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    } else if (distance < -minSwipeDistance) {
      setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const slides = [
    {
      id: 'explore-community',
      bgClass: 'bg-white',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-4 pb-3 h-full w-full overflow-hidden select-none">
          <div className="z-20 flex flex-col items-center">
            <h1 className="text-[20px] font-extrabold text-[#1a2b4b] mb-1 leading-tight">
              Colecciona e intercambia con{' '}
              <span className="text-[#f59e0b]">Total Seguridad</span>
            </h1>
            <p className="text-gray-500 text-[12px] leading-tight max-w-xs">
              Perfiles verificados y soporte constante para que armes tu mazo sin riesgos.
            </p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[70px] w-full">
            <div className="absolute flex justify-center items-center scale-[0.45] w-full">
              <div className="relative w-48 h-36 transform -rotate-12 z-10 opacity-90 -mr-16">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-xl" style={{ filter: getFolderFilter('black') }}></div>
                <img src="/images/logos/yugioh.png" className="absolute bottom-6 right-8 h-16 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" alt="Yugioh" />
              </div>
              <div className="relative w-56 h-40 transform rotate-6 z-20 flex items-center justify-center">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-2xl" style={{ filter: 'hue-rotate(30deg) brightness(1.1) saturate(1.2)' }}></div>
                <img src="/images/logos/pokemon.png" className="absolute bottom-8 right-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" alt="Pokemon" />
              </div>
              <div className="relative w-48 h-36 transform rotate-[15deg] z-10 opacity-90 -ml-16">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-xl" style={{ filter: getFolderFilter('blue') }}></div>
                <img src="/images/logos/magic.png" className="absolute bottom-6 left-8 h-14 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" alt="Magic" />
              </div>
            </div>
          </div>
          <div className="z-20 pb-1">
            <button
              onClick={() => navigate('/explorar')}
              className="px-4 py-1.5 bg-[#1e40af] text-white font-bold rounded-xl shadow-md text-xs"
            >
              Conoce nuestras garantías
            </button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between p-8 h-full w-full gap-4">
          <div className="w-1/2 z-10 flex flex-col justify-center">
            <h1 className="text-4xl font-extrabold text-[#1a2b4b] mb-3 leading-tight">
              Colecciona e intercambia con{' '}
              <span className="text-[#f59e0b]">Total Seguridad</span>
            </h1>
            <p className="text-gray-500 text-base mb-6 max-w-lg">
              Protegemos cada transacción. Contamos con perfiles verificados y soporte constante para que armes tu mazo sin riesgos ni preocupaciones.
            </p>
            <button
              onClick={() => navigate('/explorar')}
              className="w-fit px-5 py-2.5 bg-[#1e40af] text-white font-bold rounded-lg shadow-md hover:bg-blue-800 transition-colors text-sm"
            >
              Conoce nuestras garantías
            </button>
          </div>
          <div className="w-1/2 relative h-[220px] flex items-center justify-center">
            <div className="absolute right-0 top-0 w-full h-full bg-gradient-to-l from-blue-50 to-transparent rounded-full blur-3xl opacity-50"></div>
            <div className="relative w-56 h-40 transform rotate-12 hover:rotate-6 hover:scale-105 duration-300 z-20 flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)]" style={{ filter: 'hue-rotate(30deg) brightness(1.1) saturate(1.2)' }}></div>
              <img src="/images/logos/pokemon.png" className="absolute bottom-8 right-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" alt="Pokemon" />
            </div>
            <div className="absolute right-8 top-2 w-48 h-36 transform -rotate-6 hover:-rotate-2 hover:scale-105 duration-300 z-10 opacity-90">
              <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-xl" style={{ filter: getFolderFilter('black') }}></div>
              <img src="/images/logos/yugioh.png" className="absolute bottom-6 right-8 h-16 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" alt="Yugioh" />
            </div>
            <div className="absolute left-4 bottom-2 w-48 h-36 transform rotate-[-15deg] hover:scale-105 duration-300 z-10 opacity-90">
              <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-xl" style={{ filter: getFolderFilter('blue') }}></div>
              <img src="/images/logos/magic.png" className="absolute bottom-6 left-8 h-14 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" alt="Magic" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'premium-collection',
      bgClass: 'bg-[#FFD8B3]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-4 pb-3 h-full w-full overflow-hidden select-none">
          <div className="z-20 flex flex-col items-center">
            <div className="inline-block px-2 py-0.5 bg-white/80 border border-blue-200 rounded-full text-[9px] font-bold text-[#1e40af] mb-1 shadow-sm">
              NUEVA EXPERIENCIA
            </div>
            <h1 className="text-[20px] font-extrabold text-[#1a2b4b] mb-1 leading-tight">
              Eleva tu nivel de{' '}
              <span className="text-[#f59e0b]">Colección</span>
            </h1>
            <p className="text-gray-600 text-[12px] leading-tight max-w-xs font-medium">
              Conecta con miles de jugadores, encuentra rarezas y sella los mejores tratos.
            </p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[75px] w-full">
            <div className="absolute flex justify-center items-center scale-[0.45] w-full">
              <div className="relative w-32 h-44 transform -rotate-[15deg] z-10 rounded-[6px] shadow-xl overflow-hidden -mr-12">
                <img src="/images/promos/luffy.png" alt="Luffy" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; }} />
              </div>
              <div className="relative w-40 h-56 transform -translate-y-4 z-30 rounded-[6px] shadow-2xl overflow-hidden">
                <img src="/images/promos/charizard.png" alt="Charizard" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; }} />
              </div>
              <div className="relative w-32 h-44 transform rotate-[15deg] z-20 rounded-[6px] shadow-xl overflow-hidden -ml-12">
                <img src="/images/promos/onering.png" alt="The One Ring" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; }} />
              </div>
            </div>
          </div>
          <div className="z-20 flex gap-2 pb-1">
            <button onClick={() => navigate('/explorar')} className="px-3.5 py-1.5 bg-[#1e40af] text-white font-bold rounded-xl shadow-md text-xs">Explorar</button>
            <button onClick={() => navigate('/explorar')} className="px-3.5 py-1.5 bg-white text-[#1a2b4b] border border-[#1a2b4b]/20 font-bold rounded-xl shadow-sm text-xs">Vender</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row-reverse items-center justify-between p-8 h-full w-full gap-4">
          <div className="w-1/2 flex flex-col justify-center">
            <div className="inline-block px-3 py-1 bg-white/60 backdrop-blur-md border border-blue-200 rounded-full text-xs font-bold text-[#1e40af] mb-4 w-max shadow-sm">
              NUEVA EXPERIENCIA
            </div>
            <h1 className="text-4xl font-extrabold text-[#1a2b4b] mb-3 leading-tight tracking-tight">
              Eleva tu nivel de{' '}
              <span className="text-[#f59e0b] drop-shadow-sm">Colección</span>
            </h1>
            <p className="text-gray-600 text-base mb-6 max-w-sm font-medium">
              Conecta con miles de jugadores, encuentra rarezas y sella los mejores tratos.
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/explorar')} className="px-5 py-2.5 bg-[#1e40af] text-white font-bold rounded-xl shadow-lg hover:bg-blue-800 hover:-translate-y-0.5 transition-all text-sm">Explorar cartas</button>
              <button onClick={() => navigate('/explorar')} className="px-5 py-2.5 bg-white/80 text-[#1a2b4b] border border-[#1a2b4b]/20 font-bold rounded-xl shadow-sm hover:bg-white hover:-translate-y-0.5 transition-all text-sm">Vender ahora</button>
            </div>
          </div>
          <div className="w-1/2 relative h-[220px] flex items-center justify-center">
            <div className="absolute left-[15%] transform -rotate-[15deg] hover:-translate-y-4 hover:scale-110 transition-all duration-300 z-10 w-32 h-44 rounded-[6px] shadow-[0_10px_20px_rgba(0,0,0,0.3)] overflow-hidden">
              <img src="/images/promos/luffy.png" alt="Luffy" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; }} />
            </div>
            <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-4 hover:-translate-y-8 hover:scale-110 transition-all duration-300 z-30 w-40 h-56 rounded-[6px] shadow-[0_15px_25px_rgba(0,0,0,0.4)] overflow-hidden">
              <img src="/images/promos/charizard.png" alt="Charizard" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; }} />
            </div>
            <div className="absolute right-[15%] transform rotate-[15deg] hover:-translate-y-4 hover:scale-110 transition-all duration-300 z-20 w-32 h-44 rounded-[6px] shadow-[0_10px_20px_rgba(0,0,0,0.3)] overflow-hidden">
              <img src="/images/promos/onering.png" alt="The One Ring" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; }} />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'store-power',
      bgClass: 'bg-[#0b1121]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-4 pb-3 h-full w-full overflow-hidden select-none">
          <div className="z-20 flex flex-col items-center">
            <div className="border border-gray-600 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-full mb-1">
              PARA TIENDAS
            </div>
            <h1 className="text-[20px] font-extrabold text-white mb-1 leading-tight">
              Potencia tu tienda con{' '}
              <span className="text-[#38bdf8]">toda la tecnología</span>
            </h1>
            <p className="text-gray-400 text-[12px] leading-tight max-w-xs">
              Sitio web, punto de venta y un marketplace dedicado para tu tienda TCG.
            </p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[60px] w-full">
            <div className="absolute flex justify-center items-center scale-[0.55] w-full">
              <span translate="no" className="material-symbols-outlined text-[#38bdf8] text-7xl drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">storefront</span>
            </div>
          </div>
          <div className="z-20 pb-1">
            <button className="px-4 py-1.5 bg-[#3b82f6] text-white font-bold rounded-full shadow-lg shadow-blue-500/30 text-xs">
              Conocer más
            </button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex items-center justify-center p-8 h-full w-full">
          <div className="flex flex-col items-center text-center">
            <div className="border border-gray-600 text-gray-300 text-xs font-bold px-3 py-1 rounded-full mb-4">
              PARA TIENDAS
            </div>
            <h1 className="text-4xl font-extrabold text-white mb-4 leading-tight">
              Potencia tu tienda con{' '}
              <span className="text-[#38bdf8]">todo el poder de la tecnología</span>
            </h1>
            <p className="text-gray-400 text-base mb-8 max-w-xl">
              Sitio web, punto de venta, puntos de retiro y un marketplace dedicado para tu tienda de TCG.
            </p>
            <button className="px-6 py-2.5 bg-[#3b82f6] text-white font-bold rounded-full shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors text-sm">
              Conocer más
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'time-of-battle',
      bgClass: 'bg-[#fde047]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-4 pb-3 h-full w-full overflow-hidden select-none">
          <div className="z-20 flex flex-col items-center">
            <h1 className="text-[22px] font-black text-black mb-0.5 leading-tight tracking-tight">The Time of Battle</h1>
            <p className="text-gray-700 text-[12px] font-semibold">OP 16, Disponible</p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[75px] w-full">
            <div className="absolute flex justify-center items-center scale-[0.45] w-full">
              <div className="relative w-28 h-40 transform -rotate-12 scale-110 opacity-90 shadow-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center rounded-md -mr-16">
                <span className="text-white font-bold rotate-[-12deg] text-xs">OP Card 1</span>
              </div>
              <div className="relative transform rotate-6 scale-125 z-20 shadow-xl w-28 h-40 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center rounded-md">
                <span className="text-white font-bold rotate-[6deg] text-xs">OP Card 2</span>
              </div>
              <div className="relative transform rotate-[15deg] scale-110 opacity-90 shadow-xl w-28 h-40 bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center rounded-md -ml-16">
                <span className="text-white font-bold rotate-[15deg] text-xs">OP Card 3</span>
              </div>
            </div>
          </div>
          <div className="z-20 flex gap-2 pb-1">
            <button className="px-3.5 py-1.5 bg-white text-gray-800 font-bold rounded-lg shadow-sm text-xs">Comprar</button>
            <button className="px-3.5 py-1.5 bg-[#2563eb] text-white font-bold rounded-lg shadow-md text-xs">Vender ahora</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between p-8 h-full w-full gap-4">
          <div className="w-1/2 z-10 flex flex-col justify-center">
            <h1 className="text-5xl font-black text-black mb-2 leading-tight tracking-tight">The Time of Battle</h1>
            <p className="text-gray-800 text-base mb-6 font-medium">OP 16, Disponible</p>
            <div className="flex gap-4">
              <button className="px-5 py-2.5 bg-white text-gray-800 font-bold rounded-md shadow-sm hover:bg-gray-50 transition-colors text-sm">Comprar</button>
              <button className="px-5 py-2.5 bg-[#2563eb] text-white font-bold rounded-md shadow-md hover:bg-blue-700 transition-colors text-sm">Vender ahora</button>
            </div>
          </div>
          <div className="w-1/2 relative h-[220px] flex items-center justify-center overflow-hidden">
            <div className="absolute right-8 top-2 transform rotate-12 scale-125 opacity-90 shadow-xl w-32 h-44 bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center rounded-md">
              <span className="text-white font-bold rotate-[-12deg] text-xs">OP Card 1</span>
            </div>
            <div className="absolute right-40 top-0 transform -rotate-6 scale-125 z-10 shadow-xl w-32 h-44 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center rounded-md">
              <span className="text-white font-bold rotate-[6deg] text-xs">OP Card 2</span>
            </div>
            <div className="absolute right-72 bottom-2 transform rotate-[-15deg] scale-125 opacity-90 shadow-xl w-32 h-44 bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center rounded-md">
              <span className="text-white font-bold rotate-[15deg] text-xs">OP Card 3</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'unleashed',
      bgClass: 'bg-white',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-4 pb-3 h-full w-full overflow-hidden select-none">
          <div className="z-20 flex flex-col items-center">
            <h1 className="text-[22px] font-black text-black mb-0.5 leading-tight tracking-tight">Unleashed</h1>
            <p className="text-gray-600 text-[12px] font-semibold">Riftbound, Disponible</p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[75px] w-full">
            <div className="absolute flex justify-center items-center scale-[0.45] w-full">
              <div className="relative w-28 h-40 transform -rotate-12 scale-110 opacity-90 shadow-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center rounded-lg -mr-16">
                <span className="text-white font-bold rotate-[-12deg] text-xs">Riftbound 1</span>
              </div>
              <div className="relative transform rotate-6 scale-110 z-20 shadow-2xl w-28 h-40 bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center rounded-lg">
                <span className="text-white font-bold rotate-[12deg] text-xs">Riftbound 2</span>
              </div>
              <div className="relative transform rotate-[20deg] scale-110 opacity-90 shadow-xl w-28 h-40 bg-gradient-to-br from-blue-800 to-blue-950 flex items-center justify-center rounded-lg -ml-16">
                <span className="text-white font-bold rotate-[20deg] text-xs">Riftbound 3</span>
              </div>
            </div>
          </div>
          <div className="z-20 flex gap-2 pb-1">
            <button className="px-3.5 py-1.5 bg-white text-gray-800 border border-gray-200 font-bold rounded-lg shadow-sm text-xs">Comprar</button>
            <button className="px-3.5 py-1.5 bg-[#2563eb] text-white font-bold rounded-lg shadow-md text-xs">Vender ahora</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between p-8 h-full w-full gap-4">
          <div className="w-1/2 z-10 flex flex-col justify-center">
            <h1 className="text-5xl font-black text-black mb-2 leading-tight tracking-tight">Unleashed</h1>
            <p className="text-gray-600 text-base mb-6 font-medium">Riftbound, Disponible</p>
            <div className="flex gap-4">
              <button className="px-5 py-2.5 bg-white text-gray-800 border border-gray-200 font-bold rounded-md shadow-sm hover:bg-gray-50 transition-colors text-sm">Comprar</button>
              <button className="px-5 py-2.5 bg-[#2563eb] text-white font-bold rounded-md shadow-md hover:bg-blue-700 transition-colors text-sm">Vender ahora</button>
            </div>
          </div>
          <div className="w-1/2 relative h-[220px] flex items-center justify-center overflow-hidden">
            <div className="absolute right-8 top-2 transform rotate-12 scale-110 opacity-90 shadow-xl w-32 h-44 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center rounded-lg">
              <span className="text-white font-bold rotate-[-12deg] text-xs">Riftbound 1</span>
            </div>
            <div className="absolute right-40 top-4 transform -rotate-12 scale-110 z-10 shadow-xl w-32 h-44 bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center rounded-lg">
              <span className="text-white font-bold rotate-[12deg] text-xs">Riftbound 2</span>
            </div>
            <div className="absolute right-72 bottom-2 transform rotate-[-25deg] scale-110 opacity-90 shadow-xl w-32 h-44 bg-gradient-to-br from-blue-800 to-blue-950 flex items-center justify-center rounded-lg">
              <span className="text-white font-bold rotate-[25deg] text-xs">Riftbound 3</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 15000);
    return () => clearInterval(timer);
  }, [slides.length, currentSlide]);

  return (
    <div className="w-full max-w-[1200px] mb-6 flex flex-col items-center">
      <div 
        className="w-full relative overflow-hidden rounded-3xl shadow-sm border border-gray-100 h-[280px] sm:h-[280px] select-none cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="flex transition-transform duration-500 ease-in-out h-full"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className={`w-full h-full flex-shrink-0 relative ${slide.bgClass}`}
            >
              <div className="block md:hidden h-full w-full">
                {slide.mobileContent}
              </div>
              <div className="hidden md:flex h-full w-full">
                {slide.desktopContent}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-center mt-4">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === idx ? 'bg-[#2563eb] w-5' : 'bg-gray-300 hover:bg-gray-400 w-2'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
