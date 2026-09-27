import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
      <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-outline-variant/30 flex flex-col relative z-10 min-h-[calc(100vh-80px)]">
        <div className="flex-1 bg-[#DBEAFE] text-surface flex flex-col items-center justify-center relative z-20 overflow-hidden py-20">
          
          {/* Fondo cuadriculado sutil */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+CjxyZWN0IHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwTDMyIDMyWk0zMiAwTDAgMzJaIiBzdHJva2U9IiMxZTRwYWYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')]"></div>

          {/* 404 Formado por 3 Cartas TCG Gigantes */}
          <div className="relative z-10 flex flex-row items-center justify-center gap-3 md:gap-8 mb-12 px-4">
            
            {/* Primer "4" */}
            <div className="relative w-28 h-40 md:w-48 md:h-72 transform -rotate-12 hover:-translate-y-6 hover:-rotate-6 transition-all duration-500 drop-shadow-2xl bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl md:rounded-2xl border-4 md:border-[8px] border-white flex items-center justify-center shadow-[0_20px_50px_rgba(30,64,175,0.4)]">
               <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat opacity-40 mix-blend-overlay rounded-lg"></div>
               <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-lg"></div>
               <span className="text-white text-7xl md:text-[130px] font-black drop-shadow-lg z-10">4</span>
            </div>

            {/* El "0" */}
            <div className="relative w-32 h-44 md:w-56 md:h-80 transform -translate-y-4 hover:-translate-y-10 transition-all duration-500 drop-shadow-2xl bg-gradient-to-br from-red-600 to-red-900 rounded-xl md:rounded-2xl border-4 md:border-[8px] border-white flex items-center justify-center shadow-[0_20px_60px_rgba(220,38,38,0.5)] z-20">
               <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat opacity-40 mix-blend-overlay rounded-lg"></div>
               <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg"></div>
               <span className="text-white text-8xl md:text-[160px] font-black drop-shadow-lg z-10">0</span>
            </div>

            {/* Segundo "4" */}
            <div className="relative w-28 h-40 md:w-48 md:h-72 transform rotate-12 hover:-translate-y-6 hover:rotate-6 transition-all duration-500 drop-shadow-2xl bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl md:rounded-2xl border-4 md:border-[8px] border-white flex items-center justify-center shadow-[0_20px_50px_rgba(30,64,175,0.4)]">
               <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat opacity-40 mix-blend-overlay rounded-lg"></div>
               <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-lg"></div>
               <span className="text-white text-7xl md:text-[130px] font-black drop-shadow-lg z-10">4</span>
            </div>

          </div>

          {/* Mensaje */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-lg">
            <div className="inline-block px-4 py-1.5 bg-red-100 border border-red-200 rounded-full text-xs font-bold text-red-600 mb-4 tracking-widest uppercase shadow-sm">
              Error de Conexión
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black text-[#1a2b4b] mb-4 drop-shadow-sm">
              Esta carta no está <span className="text-[#1e40af]">en el tablero</span>
            </h2>
            
            <p className="text-slate-600 text-base md:text-lg mb-8 font-medium">
              Te has adentrado en una zona inexplorada. La página que buscas no existe o ha sido retirada del juego.
            </p>
            
            <button onClick={() => navigate('/')} className="px-8 py-4 bg-[#1e40af] hover:bg-blue-800 text-white font-bold rounded-xl shadow-[0_10px_20px_rgba(30,64,175,0.3)] transition-all text-sm w-full md:w-auto">
              Volver al Mercado Principal
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
