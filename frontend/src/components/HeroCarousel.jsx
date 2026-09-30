import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFolderFilter } from '../pages/Dashboard';
import HomeHero from './home/HomeHero';

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

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
      bgClass: 'bg-[#0B1E45]',
      mobileContent: <HomeHero compact />,
      desktopContent: <HomeHero />
    },
    {
      id: 'explore-community',
      bgClass: 'bg-gradient-to-br from-[#0A1128] to-[#102B4E]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-6 pb-4 h-full w-full overflow-hidden select-none relative">
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-blue-500/20 blur-[60px] rounded-full"></div>
          <div className="z-20 flex flex-col items-center">
            <h1 className="text-[22px] font-black text-white mb-2 leading-tight tracking-tight">
              Colecciona e intercambia con <br/><span className="text-blue-400">Total Seguridad</span>
            </h1>
            <p className="text-blue-100/80 text-[12px] leading-relaxed max-w-xs font-light">
              Protegemos cada transacción. Perfiles verificados para que armes tu mazo sin riesgos.
            </p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[90px] w-full mt-2">
            <div className="absolute flex justify-center items-center scale-[0.55] w-full">
              <div className="relative w-48 h-36 transform -rotate-12 z-10 opacity-90 -mr-16 drop-shadow-2xl">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat" style={{ filter: getFolderFilter('black') }}></div>
                <img src="/images/logos/yugioh.webp" className="absolute bottom-6 right-8 h-16 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10" alt="Yugioh" />
              </div>
              <div className="relative w-56 h-40 transform rotate-6 z-20 flex items-center justify-center drop-shadow-2xl">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat" style={{ filter: 'hue-rotate(30deg) brightness(1.1) saturate(1.2)' }}></div>
                <img src="/images/logos/pokemon.webp" className="absolute bottom-8 right-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10" alt="Pokemon" />
              </div>
              <div className="relative w-48 h-36 transform rotate-[15deg] z-10 opacity-90 -ml-16 drop-shadow-2xl">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat" style={{ filter: getFolderFilter('blue') }}></div>
                <img src="/images/logos/magic.webp" className="absolute bottom-6 left-8 h-14 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10" alt="Magic" />
              </div>
            </div>
          </div>
          <div className="z-20 pb-1 w-full flex justify-center mt-4">
            <button onClick={() => navigate('/explorar')} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all text-xs w-fit">Conoce nuestras garantías</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between px-12 py-8 h-full w-full gap-4 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500/20 blur-[80px] rounded-full"></div>
          <div className="w-1/2 z-10 flex flex-col justify-center">
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 leading-[1.1] tracking-tight">
              Colecciona e intercambia con <span className="text-blue-400">Total Seguridad</span>
            </h1>
            <p className="text-blue-100/80 text-base mb-6 font-light max-w-lg leading-relaxed">
              Protegemos cada transacción. Contamos con perfiles verificados y soporte constante para que armes tu mazo comprando y vendiendo a otros jugadores sin riesgos.
            </p>
            <button onClick={() => navigate('/explorar')} className="w-fit px-8 py-3 bg-blue-600 text-white font-bold rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-all text-sm">
              Conocer garantías
            </button>
          </div>
          <div className="w-1/2 relative h-[250px] flex items-center justify-center">
            <div className="relative w-64 h-48 transform rotate-12 hover:rotate-6 hover:scale-105 duration-300 z-20 flex items-center justify-center drop-shadow-2xl">
              <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat" style={{ filter: 'hue-rotate(30deg) brightness(1.1) saturate(1.2)' }}></div>
              <img src="/images/logos/pokemon.webp" className="absolute bottom-10 right-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] z-10" alt="Pokemon" />
            </div>
            <div className="absolute right-4 top-0 w-56 h-40 transform -rotate-6 hover:-rotate-2 hover:scale-105 duration-300 z-10 opacity-90 drop-shadow-2xl">
              <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat" style={{ filter: getFolderFilter('black') }}></div>
              <img src="/images/logos/yugioh.webp" className="absolute bottom-8 right-10 h-20 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] z-10" alt="Yugioh" />
            </div>
            <div className="absolute left-0 bottom-0 w-56 h-40 transform rotate-[-15deg] hover:scale-105 duration-300 z-10 opacity-90 drop-shadow-2xl">
              <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat" style={{ filter: getFolderFilter('blue') }}></div>
              <img src="/images/logos/magic.webp" className="absolute bottom-8 left-10 h-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] z-10" alt="Magic" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'premium-collection',
      bgClass: 'bg-[radial-gradient(circle_at_70%_50%,_#451a03_0%,_#050505_80%)]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-5 pb-3 h-full w-full overflow-hidden select-none relative">
          <div className="z-20 flex flex-col items-center">
            <div className="inline-block px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-[9px] font-bold text-orange-400 mb-2">
              LA COMUNIDAD MÁS GRANDE
            </div>
            <h1 className="text-[24px] font-black text-white mb-1 leading-none tracking-tight">
              Eleva tu nivel de <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">Colección</span>
            </h1>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[95px] w-full mt-2">
            <div className="absolute flex justify-center items-center scale-[0.55] w-full">
              <div className="relative w-32 h-44 transform -rotate-[15deg] z-10 rounded-lg shadow-2xl overflow-hidden -mr-12 border border-white/10">
                <img src="/images/promos/luffy.webp" alt="Luffy" className="w-full h-full object-cover" />
              </div>
              <div className="relative w-40 h-56 transform -translate-y-4 z-30 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.3)] overflow-hidden border border-orange-500/30">
                <img src="/images/promos/charizard.webp" alt="Charizard" className="w-full h-full object-cover" />
              </div>
              <div className="relative w-32 h-44 transform rotate-[15deg] z-20 rounded-lg shadow-2xl overflow-hidden -ml-12 border border-white/10">
                <img src="/images/promos/onering.webp" alt="The One Ring" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          <div className="z-20 flex gap-3 pb-1 mt-4">
            <button onClick={() => navigate('/explorar')} className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.4)] text-xs">Comprar a jugadores</button>
            <button onClick={() => navigate('/explorar')} className="px-5 py-2 bg-white/5 text-white border border-white/20 font-bold rounded-xl text-xs">Publicar mis cartas</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row-reverse items-center justify-between px-12 py-8 h-full w-full gap-4 relative">
          <div className="absolute -inset-10 bg-orange-500/10 blur-[100px] rounded-full"></div>
          <div className="w-1/2 flex flex-col justify-center z-10 relative">
            <div className="inline-block px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full text-xs font-bold text-orange-400 mb-3 w-max">
              LA COMUNIDAD MÁS GRANDE
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 leading-tight tracking-tight">
              Eleva tu nivel de <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">Colección</span>
            </h1>
            <p className="text-amber-100/70 text-base mb-6 max-w-sm font-light">
              Conecta con miles de coleccionistas. Compra directamente a otros jugadores o vende tus cartas repetidas al instante.
            </p>
            <div className="flex gap-4">
              <button onClick={() => navigate('/explorar')} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:opacity-90 transition-all text-sm">Comprar a jugadores</button>
              <button onClick={() => navigate('/explorar')} className="px-6 py-3 bg-white/5 text-white border border-white/20 font-bold rounded-xl hover:bg-white/10 transition-all text-sm">Publicar mis cartas</button>
            </div>
          </div>
          <div className="w-1/2 relative h-[250px] flex items-center justify-center z-10">
            <div className="absolute left-[15%] transform -rotate-[15deg] hover:-translate-y-4 hover:scale-110 transition-all duration-300 z-10 w-36 h-52 rounded-lg shadow-2xl overflow-hidden border border-white/10">
              <img src="/images/promos/luffy.webp" alt="Luffy" className="w-full h-full object-cover" />
            </div>
            <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-4 hover:-translate-y-8 hover:scale-110 transition-all duration-300 z-30 w-44 h-64 rounded-lg shadow-[0_0_40px_rgba(245,158,11,0.4)] overflow-hidden border border-orange-500/40">
              <img src="/images/promos/charizard.webp" alt="Charizard" className="w-full h-full object-cover" />
            </div>
            <div className="absolute right-[15%] transform rotate-[15deg] hover:-translate-y-4 hover:scale-110 transition-all duration-300 z-20 w-36 h-52 rounded-lg shadow-2xl overflow-hidden border border-white/10">
              <img src="/images/promos/onering.webp" alt="The One Ring" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'store-tech',
      bgClass: 'bg-[#09090b]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-6 pb-4 h-full w-full overflow-hidden select-none relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMDkwOTBiIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjMjJkM2VlIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIgc3Ryb2tlLXdpZHRoPSIxIj48L3BhdGg+Cjwvc3ZnPg==')]"></div>
          <div className="z-20 flex flex-col items-center relative">
            <div className="inline-block border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 px-2 py-0.5 text-[9px] font-mono tracking-widest mb-2 uppercase">Vendedores Pro</div>
            <h1 className="text-[22px] font-black text-white mb-2 leading-tight tracking-tight">
              Potencia tus ventas con<br/><span className="text-cyan-400">tecnología</span>
            </h1>
            <p className="text-gray-400 text-[12px] font-light max-w-[250px]">Llega a miles de compradores todos los días en el marketplace más grande.</p>
          </div>
          <div className="z-20 w-full flex justify-center mt-6">
            <button className="px-6 py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30 font-mono text-xs rounded shadow-[0_0_10px_rgba(34,211,238,0.2)]">Crear Perfil de Tienda _</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between px-12 py-8 h-full w-full gap-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+CjxyZWN0IHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iIzA5MDkwYiI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwTDE2IDE2Wk0xNiAwTDAgMTZaIiBzdHJva2U9IiMyMmQzZWUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')]"></div>
          <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 blur-[100px] rounded-full -bottom-40 -right-20"></div>
          <div className="w-3/5 z-10 flex flex-col justify-center relative">
            <div className="inline-block border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 px-3 py-1 text-xs font-mono tracking-widest mb-3 w-max">Para Tiendas y Vendedores Pro</div>
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 leading-tight tracking-tight">
              Escala tus ventas con<br/><span className="text-cyan-400">tecnología</span>
            </h1>
            <p className="text-gray-400 text-base mb-6 font-light max-w-md">
              Maneja un inventario masivo, sincroniza en tiempo real y recibe pedidos de jugadores de todo el país directamente en tu panel.
            </p>
            <div className="flex gap-10">
              <div className="border-l-2 border-cyan-500 pl-4">
                <div className="text-2xl font-bold text-white mb-1">Miles</div>
                <div className="text-xs text-cyan-400 font-mono">De usuarios diarios</div>
              </div>
              <div className="border-l-2 border-cyan-500 pl-4">
                <div className="text-2xl font-bold text-white mb-1">Cero</div>
                <div className="text-xs text-cyan-400 font-mono">Mensualidades</div>
              </div>
            </div>
          </div>
          <div className="w-2/5 relative z-10 flex flex-col gap-4">
             <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg backdrop-blur flex justify-between items-center group hover:border-cyan-500/50 transition-colors cursor-pointer">
                <div><h3 className="text-white font-semibold mb-1 text-sm">Crear Perfil Vendedor Pro</h3><p className="text-xs text-gray-500">Destaca en la comunidad</p></div>
                <div className="text-cyan-400 group-hover:translate-x-1 transition-transform">→</div>
             </div>
             <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg backdrop-blur flex justify-between items-center group hover:border-cyan-500/50 transition-colors cursor-pointer">
                <div><h3 className="text-white font-semibold mb-1 text-sm">Gestionar Inventario</h3><p className="text-xs text-gray-500">Publica masivamente</p></div>
                <div className="text-cyan-400 group-hover:translate-x-1 transition-transform">→</div>
             </div>
          </div>
        </div>
      )
    },
    {
      id: 'op-battle-singles',
      bgClass: 'bg-gradient-to-r from-red-900 via-red-950 to-black',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-6 pb-4 h-full w-full overflow-hidden select-none relative">
          <div className="z-20 flex flex-col items-center">
            <h1 className="text-[20px] font-black text-white mb-1 leading-tight tracking-tighter uppercase italic text-red-500">The Time of Battle</h1>
            <p className="text-gray-300 text-[12px] font-light max-w-[250px]">¡Miles de jugadores ya están vendiendo las cartas que te faltan de <span className="font-bold text-red-400">OP16</span>!</p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[90px] w-full mt-2">
            <div className="absolute flex justify-center items-center scale-[0.55] w-full">
              <div className="relative w-28 h-40 transform -rotate-[15deg] z-10 rounded-lg shadow-xl overflow-hidden -mr-8 border-2 border-red-500/50 bg-gray-900 flex flex-col items-center justify-center p-2">
                <span className="text-gray-400 font-bold text-[10px] uppercase text-center">De la<br/>carpeta de<br/><span className="text-white">@Zoro</span></span>
              </div>
              <div className="relative w-32 h-48 transform -translate-y-2 z-30 rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.4)] overflow-hidden border-2 border-red-400 bg-black flex flex-col items-center justify-center p-2">
                <span className="text-red-400 font-bold text-xs uppercase text-center">De la<br/>carpeta de<br/><span className="text-white">@LuffyFan</span></span>
              </div>
              <div className="relative w-28 h-40 transform rotate-[15deg] z-20 rounded-lg shadow-xl overflow-hidden -ml-8 border-2 border-red-500/50 bg-gray-900 flex flex-col items-center justify-center p-2">
                <span className="text-gray-400 font-bold text-[10px] uppercase text-center">De la<br/>carpeta de<br/><span className="text-white">@Nami</span></span>
              </div>
            </div>
          </div>
          <div className="z-20 flex gap-2 pb-1 mt-4">
            <button className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md text-xs">Comprar a jugadores</button>
            <button className="px-5 py-2 bg-transparent text-red-400 border border-red-400/50 font-bold rounded-lg text-xs">Publicar mis OP16</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between px-12 py-8 h-full w-full gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-[600px] h-full bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="w-1/2 z-10 flex flex-col justify-center">
            <div className="inline-block px-3 py-1 bg-red-950 border border-red-500/50 rounded-full text-xs font-bold text-red-400 mb-3 w-max">
              LA COMUNIDAD VENDE SUS SINGLES
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 leading-tight tracking-tighter uppercase italic">
              The Time <span className="text-red-500">of Battle</span>
            </h1>
            <p className="text-gray-300 text-base mb-6 max-w-md font-light">
              ¡Cientos de jugadores ya están subiendo sus singles de <span className="font-bold text-red-400">OP16</span>! Navega entre los listados de la comunidad y compra directo a otros usuarios.
            </p>
            <div className="flex gap-4">
              <button className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-colors text-sm">Ver publicaciones OP16</button>
              <button className="px-6 py-3 bg-transparent border border-gray-600 text-gray-300 font-bold rounded-lg hover:border-red-500 hover:text-red-400 transition-colors text-sm">Publicar mis repetidas</button>
            </div>
          </div>
          <div className="w-1/2 relative h-[250px] flex items-center justify-center">
            <div className="absolute right-12 lg:right-20 top-6 transform rotate-12 shadow-2xl w-28 h-40 bg-gray-900 flex flex-col items-center justify-center rounded-lg border-2 border-gray-700/50 p-2">
              <span className="text-gray-400 font-bold text-xs uppercase text-center">Carpeta de<br/><span className="text-white">@Zoro_x</span></span>
            </div>
            <div className="absolute right-40 lg:right-48 top-0 transform -rotate-6 z-10 shadow-[0_0_40px_rgba(239,68,68,0.4)] w-36 h-52 bg-black flex flex-col items-center justify-center rounded-lg border-2 border-red-500 p-3">
              <span className="text-red-500 font-black text-sm uppercase text-center">Carpeta de<br/><span className="text-white">@LuffyFan</span></span>
            </div>
            <div className="absolute right-68 lg:right-76 bottom-6 transform rotate-[-15deg] shadow-2xl w-28 h-40 bg-gray-900 flex flex-col items-center justify-center rounded-lg border-2 border-gray-700/50 p-2">
              <span className="text-gray-400 font-bold text-xs uppercase text-center">Carpeta de<br/><span className="text-white">@Nami99</span></span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'unleashed-singles',
      bgClass: 'bg-[#0f172a]',
      mobileContent: (
        <div className="flex flex-col items-center justify-between text-center px-4 pt-6 pb-4 h-full w-full overflow-hidden select-none relative">
          <div className="absolute top-0 right-0 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
          <div className="z-20 flex flex-col items-center">
            <h1 className="text-[22px] font-black text-blue-400 mb-1 leading-tight tracking-widest uppercase">Unleashed</h1>
            <p className="text-gray-300 text-[12px] font-light max-w-[250px]">Encuentra ese single de <span className="font-bold text-blue-300">Riftbound</span> publicado por otros jugadores.</p>
          </div>
          <div className="z-10 relative flex justify-center items-center h-[90px] w-full mt-2">
            <div className="absolute flex justify-center items-center scale-[0.55] w-full">
              <div className="relative w-28 h-40 transform -rotate-12 z-10 shadow-2xl bg-[#1e293b] flex flex-col items-center justify-center rounded-lg border border-[#334155] -mr-8 p-2">
                <span className="text-gray-400 font-bold text-[10px] text-center">Vendido por<br/><span className="text-white">@rift</span></span>
              </div>
              <div className="relative w-32 h-48 transform z-30 shadow-[0_0_30px_rgba(96,165,250,0.3)] bg-black flex flex-col items-center justify-center rounded-lg border-2 border-blue-400 p-2">
                <span className="text-blue-400 font-bold text-xs text-center">Vendido por<br/><span className="text-white">@wizard</span></span>
              </div>
              <div className="relative w-28 h-40 transform rotate-12 z-20 shadow-2xl bg-[#1e293b] flex flex-col items-center justify-center rounded-lg border border-[#334155] -ml-8 p-2">
                <span className="text-gray-400 font-bold text-[10px] text-center">Vendido por<br/><span className="text-white">@player</span></span>
              </div>
            </div>
          </div>
          <div className="z-20 flex gap-2 pb-1 mt-4">
             <button className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md text-xs">Ver listados</button>
             <button className="px-5 py-2 bg-transparent text-blue-400 border border-blue-400/50 font-bold rounded-lg text-xs">Vender singles</button>
          </div>
        </div>
      ),
      desktopContent: (
        <div className="flex flex-row items-center justify-between px-12 py-8 h-full w-full gap-4 relative overflow-hidden">
          <div className="absolute -right-20 top-0 w-[500px] h-[500px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="w-1/2 z-10 flex flex-col justify-center">
             <div className="inline-block px-3 py-1 bg-blue-900/30 border border-blue-500/30 rounded-full text-xs font-bold text-blue-400 mb-3 w-max">
              CONECTANDO COLECCIONISTAS
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 leading-tight tracking-widest uppercase">
              Unleashed <br/><span className="text-blue-400">Riftbound</span>
            </h1>
            <p className="text-gray-400 text-base mb-6 font-light max-w-md">
              Miles de coleccionistas están publicando sus singles de la nueva expansión. Compra tus rarezas directamente a otros usuarios al mejor precio del mercado.
            </p>
            <div className="flex gap-4">
              <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-colors text-sm">Explorar mercado</button>
              <button className="px-6 py-3 bg-transparent border border-gray-700 text-gray-300 font-bold rounded-lg hover:border-blue-500 hover:text-blue-400 transition-colors text-sm">Publicar mis cartas</button>
            </div>
          </div>
          <div className="w-1/2 relative h-[250px] flex items-center justify-center z-10">
            <div className="absolute right-12 lg:right-20 top-6 transform rotate-12 shadow-2xl w-28 h-40 bg-[#1e293b] flex flex-col items-center justify-center rounded-xl border border-[#334155] p-2">
              <span className="text-gray-400 font-bold text-xs text-center">Carpeta de<br/><span className="text-white">@rift</span></span>
            </div>
            <div className="absolute right-40 lg:right-48 top-2 transform -rotate-6 z-10 shadow-[0_0_40px_rgba(96,165,250,0.3)] w-36 h-52 bg-black flex flex-col items-center justify-center rounded-xl border-2 border-blue-500 p-3">
              <span className="text-blue-400 font-bold text-sm text-center">Carpeta de<br/><span className="text-white">@wizard</span></span>
            </div>
            <div className="absolute right-68 lg:right-76 bottom-4 transform rotate-[-20deg] shadow-2xl w-28 h-40 bg-[#1e293b] flex flex-col items-center justify-center rounded-xl border border-[#334155] p-2">
              <span className="text-gray-400 font-bold text-xs text-center">Carpeta de<br/><span className="text-white">@player1</span></span>
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
    <div className="w-full max-w-[1280px] mb-6 flex flex-col items-center">
      <div 
        className="w-full relative overflow-hidden rounded-3xl shadow-2xl h-[350px] sm:h-[clamp(360px,46vh,470px)] select-none cursor-grab active:cursor-grabbing border-none"
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
            <div key={slide.id} className={`w-full h-full flex-shrink-0 relative ${slide.bgClass}`}>
              <div className="block md:hidden h-full w-full">{slide.mobileContent}</div>
              <div className="hidden md:flex h-full w-full">{slide.desktopContent}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 justify-center mt-6">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentSlide === idx ? 'bg-blue-600 w-8' : 'bg-gray-300 hover:bg-gray-400 w-3'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
