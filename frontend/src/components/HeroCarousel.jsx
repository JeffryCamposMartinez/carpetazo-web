import React, { useState, useEffect } from 'react';
import { getFolderFilter } from '../pages/Dashboard';

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Define the slides based on the user's mockups
  const slides = [
    // Slide 1: Original Explore Community
    {
      id: 'explore-community',
      bgClass: 'bg-white',
      content: (
        <div className="md:w-1/2 z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#1a2b4b] mb-2 md:mb-3 leading-tight">
            Colecciona e intercambia con <br className="hidden md:block"/>
            <span className="text-primary">Total Seguridad</span>
          </h1>
          <p className="text-gray-500 text-sm md:text-base mb-6 max-w-lg">
            Protegemos cada transacción. Contamos con perfiles verificados y soporte constante para que armes tu mazo sin riesgos ni preocupaciones.
          </p>
          <div className="flex gap-4">
            <button className="px-5 py-2.5 bg-[#1e40af] text-white font-bold rounded-lg shadow-md hover:bg-blue-800 transition-colors text-sm">
              Conoce nuestras garantías
            </button>
          </div>
        </div>
      ),
      imageContent: (
        <div className="md:w-1/2 relative h-[180px] md:h-[220px] w-full flex items-center justify-center">
          <div className="absolute right-0 top-0 w-full h-full bg-gradient-to-l from-blue-50 to-transparent rounded-full blur-3xl opacity-50"></div>
          
          <div className="relative w-48 h-36 md:w-56 md:h-40 transform rotate-12 transition-transform hover:rotate-6 hover:scale-105 duration-300 z-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat transition-all drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)]" style={{ filter: 'hue-rotate(30deg) brightness(1.1) saturate(1.2)' }}></div>
            <img src="/images/logos/pokemon.png" className="absolute bottom-6 right-8 md:bottom-8 md:right-10 h-8 md:h-10 object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,1)] drop-shadow-[0_-1px_1px_rgba(255,255,255,1)] drop-shadow-[1px_0_1px_rgba(255,255,255,1)] drop-shadow-[-1px_0_1px_rgba(255,255,255,1)] drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10" alt="Pokemon" />
          </div>
          
          <div className="absolute right-4 md:right-8 top-2 w-40 h-28 md:w-48 md:h-36 transform -rotate-6 transition-transform hover:-rotate-2 hover:scale-105 duration-300 z-10 flex items-center justify-center opacity-90">
            <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat transition-all drop-shadow-xl" style={{ filter: getFolderFilter('black') }}></div>
            <img src="/images/logos/yugioh.png" className="absolute bottom-4 right-6 md:bottom-6 md:right-8 h-12 md:h-16 object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,1)] drop-shadow-[0_-1px_1px_rgba(255,255,255,1)] drop-shadow-[1px_0_1px_rgba(255,255,255,1)] drop-shadow-[-1px_0_1px_rgba(255,255,255,1)] drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10" alt="Yugioh" />
          </div>
          
          <div className="absolute left-0 md:left-4 bottom-2 w-40 h-28 md:w-48 md:h-36 transform rotate-[-15deg] transition-transform hover:-rotate-10 hover:scale-105 duration-300 z-10 flex items-center justify-center opacity-90">
            <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat transition-all drop-shadow-xl" style={{ filter: getFolderFilter('blue') }}></div>
            <img src="/images/logos/magic.png" className="absolute bottom-4 left-6 md:bottom-6 md:left-8 h-10 md:h-14 object-contain drop-shadow-[0_1px_1px_rgba(255,255,255,1)] drop-shadow-[0_-1px_1px_rgba(255,255,255,1)] drop-shadow-[1px_0_1px_rgba(255,255,255,1)] drop-shadow-[-1px_0_1px_rgba(255,255,255,1)] drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10" alt="Magic" />
          </div>
        </div>
      )
    },
    // Slide 2: Colección Premium (Glassmorphism Light)
    {
      id: 'premium-collection',
      bgClass: 'bg-slate-50 overflow-hidden',
      layoutClass: 'flex-col md:flex-row-reverse items-center justify-between',
      content: (
        <>
          <div className="md:w-1/2 z-20 flex flex-col justify-center h-full px-4 md:px-12 text-center md:text-left relative">
            <div className="inline-block px-3 py-1 bg-white/60 backdrop-blur-md border border-blue-200 rounded-full text-xs font-bold text-[#1e40af] mb-3 md:mb-4 w-max mx-auto md:mx-0 shadow-sm">
              NUEVA EXPERIENCIA
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#1a2b4b] mb-2 md:mb-3 leading-tight tracking-tight">
              Eleva tu nivel <br className="hidden md:block" /> de <span className="text-primary drop-shadow-sm">Colección</span>
            </h1>
            <p className="text-gray-600 text-sm md:text-base mb-5 md:mb-6 max-w-sm mx-auto md:mx-0 font-medium">
              Conecta con miles de jugadores, encuentra rarezas y sella los mejores tratos.
            </p>
            <div className="flex gap-3 justify-center md:justify-start">
              <button className="px-5 py-2.5 bg-[#1e40af] text-white font-bold rounded-xl shadow-[0_10px_20px_-10px_rgba(30,64,175,0.6)] hover:bg-blue-800 hover:-translate-y-0.5 transition-all text-sm">
                Explorar cartas
              </button>
              <button className="px-5 py-2.5 bg-white/80 backdrop-blur-md text-[#1a2b4b] border border-[#1a2b4b]/20 font-bold rounded-xl shadow-sm hover:bg-white hover:-translate-y-0.5 transition-all text-sm">
                Vender ahora
              </button>
            </div>
          </div>
        </>
      ),
      imageContent: (
        <div className="md:w-1/2 relative h-[160px] md:h-[220px] w-full flex items-center justify-center mt-4 md:mt-0 perspective-1000 z-10">
          {/* Luffy (Izquierda) */}
          <div className="absolute left-[10%] md:left-[15%] transform -rotate-[15deg] hover:-translate-y-4 hover:-rotate-[10deg] hover:scale-110 hover:z-40 transition-all duration-300 z-10 w-24 md:w-32 h-36 md:h-44 rounded-[6px] shadow-[0_10px_20px_rgba(0,0,0,0.3)] overflow-hidden">
            <img src="/images/promos/luffy.png" alt="Luffy Gear 5" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; e.target.className = 'w-full h-full object-contain p-2'; }} />
          </div>
          
          {/* Charizard (Centro - Protagonista) */}
          <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-2 md:-translate-y-4 hover:-translate-y-8 hover:scale-110 hover:z-40 transition-all duration-300 z-30 w-28 md:w-40 h-40 md:h-56 rounded-[6px] shadow-[0_15px_25px_rgba(0,0,0,0.4)] overflow-hidden">
            <img src="/images/promos/charizard.png" alt="Mega Charizard" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; e.target.className = 'w-full h-full object-contain p-2'; }} />
          </div>

          {/* The One Ring (Derecha) */}
          <div className="absolute right-[10%] md:right-[15%] transform rotate-[15deg] hover:-translate-y-4 hover:rotate-[10deg] hover:scale-110 hover:z-40 transition-all duration-300 z-20 w-24 md:w-32 h-36 md:h-44 rounded-[6px] shadow-[0_10px_20px_rgba(0,0,0,0.3)] overflow-hidden">
            <img src="/images/promos/onering.png" alt="The One Ring" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/images/carpeta_v4.png'; e.target.className = 'w-full h-full object-contain p-2'; }} />
          </div>
        </div>
      )
    },
    // Slide 3: Potencia tu tienda
    {
      id: 'store-power',
      bgClass: 'bg-[#0b1121]', // Dark background
      content: (
        <div className="w-full z-10 flex flex-col justify-center items-center text-center h-full px-4 py-8">
          <div className="border border-gray-600 text-gray-300 text-xs font-bold px-3 py-1 rounded-full mb-4">
            PARA TIENDAS
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
            Potencia tu tienda con <span className="text-[#38bdf8]">todo el <br/> poder de la tecnología</span>
          </h1>
          <p className="text-gray-400 text-base mb-8 max-w-xl mx-auto">
            Sitio web, punto de venta, puntos de retiro y un marketplace dedicado para tu tienda de TCG.
          </p>
          <button className="px-6 py-2.5 bg-[#3b82f6] text-white font-bold rounded-full shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors text-sm">
            Conocer más
          </button>
        </div>
      ),
      imageContent: null // Centered text, no side image
    },
    // Slide 4: The Time of Battle
    {
      id: 'time-of-battle',
      bgClass: 'bg-[#fde047]', // Yellow background
      content: (
        <div className="md:w-1/2 z-10 flex flex-col justify-center h-full pl-4 md:pl-8">
          <h1 className="text-3xl md:text-5xl font-black text-black mb-2 leading-tight tracking-tight">
            The Time of Battle
          </h1>
          <p className="text-gray-800 text-base mb-6 font-medium">
            OP 16, Disponible
          </p>
          <div className="flex gap-4">
            <button className="px-5 py-2.5 bg-white text-gray-800 font-bold rounded-md shadow-sm hover:bg-gray-50 transition-colors text-sm">
              Comprar
            </button>
            <button className="px-5 py-2.5 bg-[#2563eb] text-white font-bold rounded-md shadow-md hover:bg-blue-700 transition-colors text-sm">
              Vender ahora
            </button>
          </div>
        </div>
      ),
      imageContent: (
        <div className="md:w-1/2 relative h-[180px] md:h-[220px] w-full flex items-center justify-center overflow-hidden">
           {/* Placeholder for One Piece Cards */}
           <div className="absolute right-4 md:right-8 top-2 transform rotate-12 scale-125 opacity-90 shadow-xl border border-black/10 w-32 h-44 bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center rounded-md">
             <span className="text-white font-bold text-center rotate-[-12deg] text-xs">OP Card 1</span>
           </div>
           <div className="absolute right-28 md:right-40 top-0 transform -rotate-6 scale-125 z-10 shadow-xl border border-black/10 w-32 h-44 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center rounded-md">
             <span className="text-white font-bold text-center rotate-[6deg] text-xs">OP Card 2</span>
           </div>
           <div className="absolute right-52 md:right-72 bottom-2 transform rotate-[-15deg] scale-125 opacity-90 shadow-xl border border-black/10 w-32 h-44 bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center rounded-md">
             <span className="text-white font-bold text-center rotate-[15deg] text-xs">OP Card 3</span>
           </div>
        </div>
      )
    },
    // Slide 5: Unleashed
    {
      id: 'unleashed',
      bgClass: 'bg-white', // White background
      content: (
        <div className="md:w-1/2 z-10 flex flex-col justify-center h-full pl-4 md:pl-8">
          <h1 className="text-3xl md:text-5xl font-black text-black mb-2 leading-tight tracking-tight">
            Unleashed
          </h1>
          <p className="text-gray-600 text-base mb-6 font-medium">
            Riftbound, Disponible
          </p>
          <div className="flex gap-4">
            <button className="px-5 py-2.5 bg-white text-gray-800 border border-gray-200 font-bold rounded-md shadow-sm hover:bg-gray-50 transition-colors text-sm">
              Comprar
            </button>
            <button className="px-5 py-2.5 bg-[#2563eb] text-white font-bold rounded-md shadow-md hover:bg-blue-700 transition-colors text-sm">
              Vender ahora
            </button>
          </div>
        </div>
      ),
      imageContent: (
        <div className="md:w-1/2 relative h-[180px] md:h-[220px] w-full flex items-center justify-center overflow-hidden">
           {/* Placeholder for Riftbound Cards */}
           <div className="absolute right-4 md:right-8 top-2 transform rotate-12 scale-110 opacity-90 shadow-xl border border-black/10 w-32 h-44 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center rounded-lg">
             <span className="text-white font-bold text-center rotate-[-12deg] text-xs">Riftbound 1</span>
           </div>
           <div className="absolute right-28 md:right-40 top-4 transform -rotate-12 scale-110 z-10 shadow-xl border border-black/10 w-32 h-44 bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center rounded-lg">
             <span className="text-white font-bold text-center rotate-[12deg] text-xs">Riftbound 2</span>
           </div>
           <div className="absolute right-52 md:right-72 bottom-2 transform rotate-[-25deg] scale-110 opacity-90 shadow-xl border border-black/10 w-32 h-44 bg-gradient-to-br from-blue-800 to-blue-950 flex items-center justify-center rounded-lg">
             <span className="text-white font-bold text-center rotate-[25deg] text-xs">Riftbound 3</span>
           </div>
        </div>
      )
    }
  ];

  // Auto-advance logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 15000); // 15 seconds per slide
    
    return () => clearInterval(timer);
  }, [slides.length, currentSlide]);

  return (
    <div className="w-full max-w-[1200px] mb-6 flex flex-col items-center">
      <div className="w-full relative overflow-hidden rounded-3xl shadow-sm border border-gray-100 h-[240px] md:h-[280px]">
        {/* Slider Track */}
        <div 
          className="flex transition-transform duration-500 ease-in-out h-full"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div 
              key={slide.id} 
              className={`w-full h-full flex-shrink-0 flex ${slide.layoutClass || 'flex-col md:flex-row'} items-center justify-between p-6 md:p-8 relative ${slide.bgClass}`}
            >
              {slide.content}
              {slide.imageContent}
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="flex gap-2 justify-center mt-4">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all duration-300 ${
              currentSlide === idx 
                ? 'bg-[#2563eb] w-4 md:w-5' // Active dot (blue and wider)
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
