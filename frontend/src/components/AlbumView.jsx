import React, { useState, useMemo, useEffect, useRef } from 'react';
import HTMLFlipBook from 'react-pageflip';

const Page = React.forwardRef(({ isLeft, children, pageNumber, isEmpty }, ref) => {
  return (
    <div 
      className="page relative h-full w-full overflow-hidden flex flex-col" 
      ref={ref}
      style={{ backgroundColor: '#151515' }} // Dark inner page color
    >
      {/* Spine shading depending on left or right page */}
      {isLeft ? (
        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-black/90 to-transparent pointer-events-none z-20" />
      ) : (
        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-r from-black/90 to-transparent pointer-events-none z-20" />
      )}

      {/* Grid container for cards */}
      <div className={`flex-1 grid gap-1.5 md:gap-3 h-full p-2 md:p-5 grid-cols-3 grid-rows-3 ${isLeft ? 'pr-8 md:pr-16' : 'pl-8 md:pl-16'}`}>
        {children}
      </div>

      {pageNumber && (
        <div className={`absolute bottom-2 text-slate-600 text-[10px] md:text-xs font-bold z-10 ${isLeft ? 'left-4' : 'right-4'}`}>
          {pageNumber}
        </div>
      )}

      {/* If it's empty and it's the very first page or something, maybe a message? */}
      {isEmpty && (
         <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <span translate="no" className="material-symbols-outlined text-[8rem] md:text-[12rem]">style</span>
         </div>
      )}
    </div>
  );
});

export default function AlbumView({ cards = [], renderCardActions, renderCardOverlays, binderColor = '#2f7336', emptyMessage, topRightControls }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const flipBook = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cardsPerPage = 9;
  
  const pages = useMemo(() => {
    const pagesArray = [];
    for (let i = 0; i < cards.length; i += cardsPerPage) {
      pagesArray.push(cards.slice(i, i + cardsPerPage));
    }
    // To see the back cover properly on the last turn, we can ensure an EVEN number of pages
    // So the last page always flips over and leaves the right side empty (showing the leather)
    if (pagesArray.length % 2 !== 0) {
      pagesArray.push([]);
    }
    // Add one more empty spread at the end so the user can turn past the last cards and see the back cover fully!
    pagesArray.push([]);
    pagesArray.push([]);
    
    return pagesArray;
  }, [cards]);

  const renderPocket = (card, i) => {
    if (!card) {
      return (
        <div key={`empty-${i}`} className="w-full h-full flex flex-col items-center justify-center opacity-20 select-none relative z-0">
          <span translate="no" className="material-symbols-outlined text-white text-3xl md:text-4xl mb-1">style</span>
        </div>
      );
    }

    return (
      <div key={card.id || i} className="bg-[#222] rounded-xl border border-white/10 shadow-[inset_0_4px_15px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center relative transition-all duration-300 min-h-0 min-w-0 hover:z-50 group">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none z-10 rounded-xl" />
        
        <div className="relative w-[95%] h-[95%] flex items-center justify-center group-hover:scale-[1.3] group-hover:-translate-y-4 transition-transform duration-300 ease-out z-30">
          <img
            src={card.imageUrl}
            alt={card.name}
            loading="lazy"
            className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] rounded-[4%]"
          />
          
          <div className="absolute top-0 right-0 bg-black/80 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded shadow-md z-[120] pointer-events-none">
            x{card.stock || 0}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-yellow-400 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full shadow-md z-[120] whitespace-nowrap pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity">
            {card.price ? `$${card.price}` : 'Sin precio'}
          </div>

          <div className="absolute top-[92%] left-1/2 -translate-x-1/2 w-[130%] min-w-[140px] bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.9)] rounded-lg transition-all duration-300 flex flex-col p-2 z-[110] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none">
            <div className="flex justify-center items-center gap-1.5 mb-1">
              <h3 className="text-white font-bold text-xs text-center break-words leading-tight">{card.name}</h3>
            </div>
            {renderCardActions && (
              <div className="w-full mt-1 pointer-events-auto">
                {renderCardActions(card)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (cards.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400 font-medium">
        <span translate="no" className="material-symbols-outlined text-5xl mb-2 opacity-50">search_off</span>
        <p>{emptyMessage || "No hay cartas en esta carpeta."}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center py-4 md:py-8 perspective-[3000px] select-none">
      
      {/* Outer Leather Binder */}
      <div className="relative w-[95%] max-w-[500px] md:max-w-[900px] mx-auto" style={{ aspectRatio: isDesktop ? '15/10.5' : '7.5/10.5' }}>
        
        {/* Leather Cover Background */}
        <div 
          className="absolute inset-[-10px] md:inset-[-20px] rounded-2xl md:rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] md:shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-0 overflow-hidden"
          style={{ backgroundColor: binderColor }}
        >
          <div className="absolute inset-0 bg-black/30 z-0" />
          <div className="absolute inset-0 opacity-40 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/leather.png')] z-10" />
          
          {/* Spine indent */}
          {isDesktop && (
            <div className="absolute left-1/2 top-0 bottom-0 w-12 -translate-x-1/2 bg-gradient-to-r from-black/40 via-transparent to-black/40 z-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border-x border-white/5" />
          )}

          {/* Stamped Logo on back cover */}
          {isDesktop && (
            <div className="absolute right-[25%] top-1/2 -translate-y-1/2 -translate-x-1/2 flex justify-center items-center opacity-20 pointer-events-none mix-blend-overlay">
               <img src="/images/logos/logo_completo.webp" alt="Carpetazo" className="w-48 grayscale" />
            </div>
          )}
        </div>

        {/* The FlipBook Pages */}
        <div className="absolute inset-0 z-10">
          <HTMLFlipBook key={pages.length + (isDesktop ? 'd' : 'm')}
            width={isDesktop ? 450 : 350}
            height={isDesktop ? 630 : 490}
            size="stretch"
            minWidth={200}
            maxWidth={600}
            minHeight={300}
            maxHeight={800}
            maxShadowOpacity={0.6}
            showCover={false}
            mobileScrollSupport={true}
            className="w-full h-full"
            ref={flipBook}
          >
            {pages.map((pageCards, pageIndex) => {
              const isLeft = isDesktop ? pageIndex % 2 === 0 : false;
              
              // Pad to 9 slots
              const slots = [...pageCards];
              while (slots.length < 9) slots.push(null);

              return (
                <Page 
                  key={pageIndex} 
                  isLeft={isLeft} 
                  pageNumber={pageIndex + 1}
                  isEmpty={pageCards.length === 0}
                >
                  {slots.map((card, idx) => renderPocket(card, idx))}
                </Page>
              );
            })}
          </HTMLFlipBook>
        </div>

        {/* Binder Rings (Rendered ON TOP of the pages in the center) */}
        {isDesktop && (
          <div className="absolute left-1/2 top-[5%] bottom-[5%] w-8 -translate-x-1/2 z-50 pointer-events-none flex flex-col justify-evenly py-4">
             {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full h-2 md:h-3 bg-gradient-to-b from-gray-300 via-white to-gray-400 rounded-full shadow-[0_4px_5px_rgba(0,0,0,0.6)] border border-gray-500" />
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
