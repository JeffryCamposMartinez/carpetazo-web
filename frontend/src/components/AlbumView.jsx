import React, { useState, useMemo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import PokemonCard from './PokemonCard';

const Page = React.forwardRef((props, ref) => {
  return (
    <div className={`page bg-[#111827] border-r border-[#1f2937] shadow-inner relative overflow-hidden ${props.className || ''}`} ref={ref}>
      {/* Texture overlay */}
      <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none"></div>
      
      {/* Binder rings edge */}
      <div className={`absolute top-0 bottom-0 w-8 bg-gradient-to-r from-black/40 to-transparent pointer-events-none ${props.isLeft ? 'right-0 rotate-180' : 'left-0'}`}></div>

      <div className="h-full w-full p-2 sm:p-4 md:p-6 flex flex-col relative z-10">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 content-start">
          {props.children}
        </div>
        
        {props.pageNumber && (
          <div className="absolute bottom-2 left-0 w-full text-center text-gray-500 text-xs font-bold font-mono">
            - {props.pageNumber} -
          </div>
        )}
      </div>
    </div>
  );
});

export default function AlbumView({ cards, cart, onAddToCart, onRemoveFromCart }) {
  const isMobile = window.innerWidth < 640;
  const cardsPerPage = isMobile ? 4 : 9; // 2x2 on mobile, 3x3 on desktop

  const pages = useMemo(() => {
    const pagesArray = [];
    for (let i = 0; i < cards.length; i += cardsPerPage) {
      pagesArray.push(cards.slice(i, i + cardsPerPage));
    }
    // Ensure we have an even number of inner pages so it closes nicely
    if (pagesArray.length % 2 !== 0) {
      pagesArray.push([]);
    }
    return pagesArray;
  }, [cards, cardsPerPage]);

  if (cards.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-500 font-bold">
        No hay cartas para mostrar en el álbum.
      </div>
    );
  }

  const containerWidth = Math.min(window.innerWidth - 40, 1200);
  const isPortrait = window.innerWidth < 768; 
  
  const pageWidth = isPortrait ? containerWidth : containerWidth / 2;
  const pageHeight = pageWidth * 1.4; 

  return (
    <div className="w-full flex justify-center items-center py-8 perspective-[2000px] overflow-hidden">
      <HTMLFlipBook
        width={pageWidth}
        height={pageHeight}
        size="stretch"
        minWidth={280}
        maxWidth={600}
        minHeight={400}
        maxHeight={840}
        maxShadowOpacity={0.5}
        showCover={true}
        mobileScrollSupport={true}
        className="album-flipbook drop-shadow-2xl mx-auto"
        usePortrait={isPortrait}
      >
        {/* Cover */}
        <Page className="bg-[#1e3a8a] flex items-center justify-center border-4 border-[#1e40af]">
          <div className="text-center p-8 border-4 border-yellow-400 rounded-lg bg-[#1a2b4b]/80 backdrop-blur-sm">
            <span translate="no" className="material-symbols-outlined text-6xl text-yellow-400 mb-4 block">menu_book</span>
            <h1 className="text-3xl font-black text-white uppercase tracking-widest drop-shadow-md">Catálogo</h1>
            <p className="text-yellow-200 mt-2 font-bold tracking-widest">Carpetazo</p>
          </div>
        </Page>

        {/* Inside Cover */}
        <Page className="bg-[#111827]">
          <div className="w-full h-full border-[10px] border-[#1e3a8a] bg-gray-900/50 flex flex-col items-center justify-center opacity-30">
            <span translate="no" className="material-symbols-outlined text-9xl">auto_stories</span>
          </div>
        </Page>

        {/* Pages */}
        {pages.map((pageCards, index) => (
          <Page key={index} pageNumber={index + 1} isLeft={index % 2 !== 0}>
            {pageCards.map((card, idx) => {
              const cartItem = cart.find(i => i.id === card.id);
              const availableStock = card.stock - (cartItem ? cartItem.quantity : 0);
              return (
                <div key={card.id || idx} className="w-full aspect-[63/88] p-1 bg-black/40 rounded-lg border border-gray-700/50 shadow-inner flex flex-col hover:z-50 transition-all hover:scale-110 origin-center group">
                  <PokemonCard 
                    card={card} 
                    availableStock={availableStock}
                    cartQuantity={cartItem ? cartItem.quantity : 0}
                    onAddToCart={onAddToCart}
                    onRemoveFromCart={onRemoveFromCart}
                    minimal={true}
                  />
                </div>
              );
            })}
            
            {/* Fill empty pockets */}
            {Array.from({ length: Math.max(0, cardsPerPage - pageCards.length) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="w-full aspect-[63/88] p-1 bg-black/20 rounded-lg border border-gray-800/50 shadow-inner flex items-center justify-center">
                <span className="material-symbols-outlined text-gray-800/30 text-3xl">crop_portrait</span>
              </div>
            ))}
          </Page>
        ))}

        {/* Inside Back Cover */}
        <Page className="bg-[#111827]">
          <div className="w-full h-full border-[10px] border-[#1e3a8a] bg-gray-900/50 flex flex-col items-center justify-center opacity-30">
            <span translate="no" className="material-symbols-outlined text-9xl">auto_stories</span>
          </div>
        </Page>

        {/* Back Cover */}
        <Page className="bg-[#1e3a8a] flex items-center justify-center border-4 border-[#1e40af]">
          <div className="opacity-20 text-center">
            <span translate="no" className="material-symbols-outlined text-6xl text-white">verified</span>
          </div>
        </Page>
      </HTMLFlipBook>
    </div>
  );
}
