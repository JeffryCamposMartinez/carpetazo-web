import React, { useState, useMemo, useEffect } from 'react';

export default function AlbumView({ cards = [], renderCardActions, renderCardOverlays, binderColor = '#2f7336', emptyMessage, topRightControls }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [activeCardId, setActiveCardId] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [targetPage, setTargetPage] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cardsPerPage = 9;
  
  const totalPages = useMemo(() => {
    if (!isDesktop) {
      return Math.max(1, Math.ceil(cards.length / cardsPerPage));
    }
    const totalGrids = Math.max(1, Math.ceil(cards.length / cardsPerPage));
    return 1 + Math.ceil((totalGrids - 1) / 2);
  }, [cards.length, isDesktop, cardsPerPage]);

  // Bound currentPage when resizing crosses breakpoints and totalPages changes
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
    setActiveCardId(null);
  }, [totalPages, currentPage]);

  const jumpToPage = (target) => {
    if (target === currentPage || targetPage !== null) return;
    setTargetPage(target);
    setActiveCardId(null);
  };

  useEffect(() => {
    if (targetPage !== null && targetPage !== currentPage) {
      const dir = targetPage > currentPage ? 1 : -1;
      const timer = setTimeout(() => {
        setCurrentPage(p => p + dir);
      }, 120);
      return () => clearTimeout(timer);
    } else if (targetPage === currentPage) {
      setTargetPage(null);
    }
  }, [currentPage, targetPage]);

  // Handle swipe gestures for mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 40;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1 && targetPage === null) {
      setCurrentPage(p => p + 1);
      setActiveCardId(null);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0 && targetPage === null) {
      setCurrentPage(p => p - 1);
      setActiveCardId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input to prevent interfering with search
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, targetPage]);

  // Pre-load next page images for smoothness (Cost efficient lazy-loading)
  useEffect(() => {
    if (currentPage < totalPages - 1) {
      const nextCards = cards.slice((currentPage + 1) * cardsPerPage, (currentPage + 2) * cardsPerPage);
      nextCards.forEach(card => {
        if (card?.imageUrl) {
          const img = new Image();
          img.src = card.imageUrl;
        }
      });
    }
  }, [currentPage, cards, totalPages, cardsPerPage]);

  // Windowing: Render only necessary pages to keep DOM light and 60FPS
  const visiblePages = useMemo(() => {
    const pages = [];
    const buffer = targetPage !== null ? 8 : 2; 
    for (
      let i = Math.max(0, currentPage - buffer);
      i <= Math.min(totalPages - 1, currentPage + buffer);
      i++
    ) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages, targetPage]);

  const displayStart = useMemo(() => {
    if (cards.length === 0) return 0;
    if (!isDesktop) return currentPage * cardsPerPage + 1;
    return currentPage === 0 ? 1 : ((currentPage * 2 - 1) * cardsPerPage + 1);
  }, [currentPage, isDesktop, cardsPerPage, cards.length]);

  const displayEnd = useMemo(() => {
    if (cards.length === 0) return 0;
    if (!isDesktop) return Math.min(cards.length, (currentPage + 1) * cardsPerPage);
    const maxEnd = currentPage === 0 ? cardsPerPage : ((currentPage * 2 + 1) * cardsPerPage);
    return Math.min(cards.length, maxEnd);
  }, [currentPage, isDesktop, cardsPerPage, cards.length]);

  const getPaginationItems = () => {
    const items = [];
    const active = targetPage !== null ? targetPage : currentPage;
    
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) items.push(i);
    } else {
      if (active <= 3) {
        for (let i = 0; i < 5; i++) items.push(i);
        items.push('...');
        items.push(totalPages - 1);
      } else if (active >= totalPages - 4) {
        items.push(0);
        items.push('...');
        for (let i = totalPages - 5; i < totalPages; i++) items.push(i);
      } else {
        items.push(0);
        items.push('...');
        items.push(active - 1);
        items.push(active);
        items.push(active + 1);
        items.push('...');
        items.push(totalPages - 1);
      }
    }
    return items;
  };

  const renderPaginationControls = (inverted = false) => (
    <div className={`relative z-10 flex flex-col items-center w-full max-w-7xl px-5 md:px-4 ${inverted ? 'mt-6 md:mt-10' : 'mb-2 md:mb-4'}`} onClick={(e) => e.stopPropagation()}>
      {!inverted && (
        <div className="md:hidden flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-3 font-medium bg-slate-200/50 dark:bg-slate-800/50 px-3 py-1 rounded-full">
          <span translate="no" className="material-symbols-outlined text-[16px]">swipe</span>
          Desliza para cambiar de página
        </div>
      )}

      <div className="w-full flex flex-col md:flex-row items-center justify-between relative min-h-[40px]">
        <div className="hidden md:block md:w-[220px]"></div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 flex-1">
          {!inverted && (
            <div className="hidden md:block"></div>
          )}

      <div className="flex items-center gap-1 md:gap-2">
        <button
          onClick={handlePrev}
          disabled={currentPage === 0 || targetPage !== null}
          className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <span translate="no" className="material-symbols-outlined text-sm md:text-base">arrow_back_ios_new</span>
        </button>
        
        <div className="flex items-center gap-1 md:gap-2 font-medium text-slate-700 dark:text-slate-300">
          {getPaginationItems().map((item, index) => {
            if (item === '...') {
              return <span key={`ellipsis-${index}`} className="px-1 md:px-2">...</span>;
            }
            const isSelected = item === (targetPage !== null ? targetPage : currentPage);
            return (
              <button
                key={`page-${item}`}
                onClick={() => jumpToPage(item)}
                disabled={targetPage !== null}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg transition-all ${
                  isSelected 
                    ? 'bg-slate-100 dark:bg-slate-700 font-bold text-slate-900 dark:text-white' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
                }`}
              >
                {item + 1}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage >= totalPages - 1 || targetPage !== null}
          className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <span translate="no" className="material-symbols-outlined text-sm md:text-base">arrow_forward_ios</span>
        </button>
      </div>

        {inverted && (
          <div className="hidden md:block"></div>
        )}
        </div>

        {!inverted ? (
          <div className="mt-3 md:mt-0 md:w-[220px] flex justify-center md:justify-end">
            {topRightControls}
          </div>
        ) : (
          <div className="hidden md:block md:w-[220px]"></div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center py-2 md:pt-4 md:pb-10 md:overflow-visible relative" onClick={() => setActiveCardId(null)}>
      
      {/* Desktop Side Navigation Arrows */}
      {isDesktop && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            disabled={currentPage === 0 || targetPage !== null}
            className="hidden md:flex absolute left-2 xl:left-6 2xl:left-12 top-1/2 -translate-y-1/2 w-16 h-16 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 items-center justify-center rounded-full shadow-lg text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-white/80 transition-all z-50 cursor-pointer border border-slate-200 dark:border-slate-700 hover:scale-110"
          >
            <span translate="no" className="material-symbols-outlined text-4xl">chevron_left</span>
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            disabled={currentPage >= totalPages - 1 || targetPage !== null}
            className="hidden md:flex absolute right-2 xl:right-6 2xl:right-12 top-1/2 -translate-y-1/2 w-16 h-16 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 items-center justify-center rounded-full shadow-lg text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-white/80 transition-all z-50 cursor-pointer border border-slate-200 dark:border-slate-700 hover:scale-110"
          >
            <span translate="no" className="material-symbols-outlined text-4xl">chevron_right</span>
          </button>
        </>
      )}

      {/* Binder Header Controls */}
      {renderPaginationControls(false)}

      {/* 3D Binder Wrapper for Spine Centering on Desktop */}
      <div className={`w-full flex justify-center md:justify-start md:ml-[50%] md:w-[50%] perspective-[3500px] relative ${targetPage !== null ? 'pointer-events-none' : ''} ${activeCardId !== null ? 'z-[70]' : 'z-10'}`}>
        <div
          className="relative w-[95%] max-w-[450px] xl:max-w-[500px] 2xl:max-w-[600px] mt-2 md:mt-4 touch-pan-y"
          style={{ perspective: '3500px', aspectRatio: '7.5/10.5' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Continuous Physical Binder Cover (Spans both Left and Right) */}
          <div 
            className="absolute top-[-8px] bottom-[-8px] right-[-10px] md:top-[-20px] md:bottom-[-20px] md:right-[-28px] rounded-2xl md:rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] md:shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[-2] overflow-hidden transition-all duration-300"
            style={{ 
              backgroundColor: binderColor,
              left: isDesktop ? 'calc(-100% - 28px)' : 'calc(-100% - 10px)'
            }}
          >
            {/* Interior Darkening (Slightly darker than exterior) */}
            <div className="absolute inset-0 bg-black/30 z-0" />
            
            {/* Leather Texture for the binder wrap */}
            <div className="absolute inset-0 opacity-40 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/leather.png')] z-10" />
            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] md:shadow-[inset_0_0_50px_rgba(0,0,0,0.6)] z-10" />
            
            {/* Stitched Edge (Costura) */}
            <div className="absolute inset-[4px] md:inset-[8px] rounded-[14px] md:rounded-[20px] border-[2px] border-dashed border-black/60 z-10 pointer-events-none" />
            <div className="absolute inset-[4px] md:inset-[8px] rounded-[14px] md:rounded-[20px] border-[2px] border-dashed border-white/20 z-10 pointer-events-none translate-y-[1px]" />

            {/* Inner Lining LEFT (Tapa Interior) - Darker paper glued to the inside */}
            <div className="absolute top-2 bottom-2 left-2 md:top-5 md:bottom-5 md:left-5 rounded-l-md md:rounded-l-lg shadow-[inset_0_2px_20px_rgba(0,0,0,0.6)] border border-r-0 border-black/40 z-[15] overflow-hidden transition-all duration-300 flex items-center justify-center"
                 style={{ 
                   backgroundColor: 'rgba(0, 0, 0, 0.45)',
                   right: '50%'
                 }}
            >
               <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/paper.png')]" />
               
               {/* Stamped Logo Watermark */}
               <img 
                 src="/images/logos/logo_completo.webp" 
                 alt="Carpetazo" 
                 className="w-1/2 max-w-[200px] opacity-40 grayscale pointer-events-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)] transition-opacity" 
                 style={{ mixBlendMode: 'overlay' }}
               />
            </div>
            
            {/* Inner Lining RIGHT (Tapa Posterior) */}
            <div className="absolute top-2 bottom-2 right-2 md:top-5 md:bottom-5 md:right-5 rounded-r-md md:rounded-r-lg shadow-[inset_0_2px_20px_rgba(0,0,0,0.6)] border border-l-0 border-black/40 z-[15] overflow-hidden transition-all duration-300"
                 style={{ 
                   backgroundColor: 'rgba(0, 0, 0, 0.45)',
                   left: '50%'
                 }}
            >
               <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/paper.png')]" />
            </div>
            
            {/* Center Spine Crease (Exactly at the page hinge) */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[24%] md:w-[15%] -translate-x-1/2 bg-gradient-to-r from-transparent via-black/80 to-transparent pointer-events-none z-20 blur-[6px] md:blur-[10px] opacity-90" />
            
            {/* Subtle Binder Rings Shadow */}
            <div className="absolute left-1/2 top-[10%] bottom-[10%] w-4 md:w-6 -translate-x-1/2 bg-gradient-to-r from-black/60 via-black/10 to-black/60 pointer-events-none z-20 blur-[2px] opacity-70" />
          </div>

          {visiblePages.map((pageIndex) => {
            const frontGridIndex = isDesktop ? (pageIndex * 2) : pageIndex;
            const backGridIndex = isDesktop ? (pageIndex * 2 + 1) : null;

            const frontCards = cards.slice(
              frontGridIndex * cardsPerPage,
              (frontGridIndex + 1) * cardsPerPage
            );
            const frontPockets = Array.from({ length: cardsPerPage }).map(
              (_, i) => frontCards[i] || null
            );

            let backPockets = [];
            if (isDesktop) {
              const backCards = cards.slice(
                backGridIndex * cardsPerPage,
                (backGridIndex + 1) * cardsPerPage
              );
              backPockets = Array.from({ length: cardsPerPage }).map(
                (_, i) => backCards[i] || null
              );
            }

            const isPast = pageIndex < currentPage;
            const isActive = pageIndex === currentPage;
            const isFuture = pageIndex > currentPage;

            let transform = 'rotateY(0deg)';
            let zIndex = 0;

            if (isPast) {
              transform = 'rotateY(-180deg)';
              zIndex = 50 - (currentPage - pageIndex); 
            } else if (isActive) {
              transform = 'rotateY(0deg)';
              zIndex = 40;
            } else if (isFuture) {
              transform = 'rotateY(0deg)';
              zIndex = 30 - (pageIndex - currentPage);
            }

            const renderPocket = (card, i, isBackFace = false) => {
              const uniqueId = card ? (isBackFace ? `${card.id}-back` : card.id) : null;
              const cardIsActive = card && activeCardId === uniqueId;
              
              const colIndex = i % 3;
              let tooltipPosClass = 'left-1/2 -translate-x-1/2';
              if (colIndex === 0) {
                tooltipPosClass = 'left-[5%] md:left-1/2 md:-translate-x-1/2';
              } else if (colIndex === 2) {
                tooltipPosClass = 'right-[5%] md:right-auto md:left-1/2 md:-translate-x-1/2';
              }

              return (
                <div
                  key={card ? uniqueId : `empty-${isBackFace ? 'back-' : ''}${i}`}
                  className={`bg-[#222] rounded-xl border border-white/10 shadow-[inset_0_4px_15px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center relative transition-all duration-300 min-h-0 min-w-0 ${cardIsActive ? 'z-50' : 'z-auto hover:z-50'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (card) {
                      setPreviewCard(card);
                    }
                  }}
                  onMouseEnter={() => {
                    if (isDesktop && card) setActiveCardId(uniqueId);
                  }}
                  onMouseLeave={() => {
                    if (isDesktop && card) setActiveCardId(null);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none z-10 rounded-xl" />

                  {card ? (
                    <div 
                      className="w-full h-full relative z-30 flex items-center justify-center cursor-pointer"
                      style={{ transform: cardIsActive ? 'translateZ(80px)' : 'translateZ(0px)', transition: 'transform 300ms ease-out', transformStyle: 'preserve-3d' }}
                    >
                      <div className={`relative w-full h-full flex flex-col items-center justify-center transition-all duration-300 ease-out min-h-0 min-w-0 ${cardIsActive ? 'scale-[1.25] md:scale-[1.4] -translate-y-4 md:-translate-y-6 z-[100]' : ''}`}>
                        <div className="relative w-[95%] h-[95%] flex items-center justify-center">
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            loading="lazy"
                            className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] rounded-[4%]"
                          />
                          
                          <div className="absolute top-0 right-0 md:-top-1 md:-right-1 bg-black/80 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded shadow-md z-[120] pointer-events-none transition-all">
                            x{card.stock || 0}
                          </div>
                          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-yellow-400 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full shadow-md z-[120] whitespace-nowrap pointer-events-none transition-opacity duration-300 ${cardIsActive ? 'opacity-0' : 'opacity-100'}`}>
                            {card.price ? `$${card.price}` : 'Sin precio'}
                          </div>

                          {renderCardOverlays && (
                            <div className="absolute inset-0 pointer-events-none z-[110]">
                              {renderCardOverlays(card)}
                            </div>
                          )}
                        </div>
                        
                        <div className={`absolute top-[92%] ${tooltipPosClass} w-[130%] min-w-[140px] bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.9)] rounded-lg transition-all duration-300 flex flex-col p-2 z-[110] pointer-events-none ${cardIsActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                          <div className="flex justify-center items-center gap-1.5 mb-1">
                            <h3 className="text-white font-bold text-xs text-center break-words leading-tight">{card.name}</h3>
                            <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded-sm text-[9px] font-black leading-none whitespace-nowrap shadow-sm">
                              {card.price ? `$${card.price}` : 'N/A'}
                            </span>
                          </div>
                          <p className="text-gray-400 text-[9px] text-center mb-1.5 break-words w-full leading-tight mt-0.5">
                            {card.set} • {card.supertype || 'Pokémon'} • #{(() => {
                              let numStr = (card.number || card.apiId?.split('-')[1] || card.id?.split('-')[1] || '').toString();
                              let totalStr = (card.total || '---').toString();
                              if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
                              if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
                              return `${numStr}/${totalStr}`;
                            })()}
                          </p>
                          
                          {(card.rarity || card.language) && (
                            <p className="text-gray-400 text-[9px] text-center mb-1.5 italic leading-tight">
                              {[card.rarity, card.language].filter(Boolean).join(' • ')}
                            </p>
                          )}
                          
                          <div className="w-full h-px bg-white/10 my-1"></div>
                          {renderCardActions && (
                            <div className="w-full mt-1 pointer-events-auto">
                              {renderCardActions(card)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-20 select-none relative z-0">
                      <span translate="no" className="material-symbols-outlined text-white text-4xl mb-1">style</span>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div
                key={pageIndex}
                className="absolute top-0 left-0 right-0 bottom-0"
                style={{
                  transformOrigin: 'left center',
                  transform,
                  zIndex,
                  transition: 'transform 0.9s cubic-bezier(0.4, 0.0, 0.2, 1)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* FRONT FACE (Cards) */}
                <div 
                  className="absolute inset-0 bg-[#151515] rounded-r-xl md:rounded-r-2xl shadow-[inset_0_0_8px_rgba(0,0,0,0.5),3px_3px_10px_rgba(0,0,0,0.5)] md:shadow-[inset_0_0_10px_rgba(0,0,0,0.5),5px_5px_15px_rgba(0,0,0,0.5)] flex flex-col"
                  style={{ transform: 'translateZ(1px)' }}
                >
                  {/* Binder inner spine shading */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-20" />

                  {/* Card Pockets Grid */}
                  <div className="flex-1 grid gap-1.5 md:gap-3 h-full p-2 md:p-5 pl-6 md:pl-12 grid-cols-3 grid-rows-3">
                    {frontPockets.map((card, i) => renderPocket(card, i, false))}
                  </div>
                  
                  {/* Empty Message Overlay */}
                  {cards.length === 0 && emptyMessage && pageIndex === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-50">
                       <div className="bg-[#1a1a1a]/80 backdrop-blur-md text-white p-6 rounded-2xl border border-white/10 shadow-2xl text-center max-w-[80%]">
                         <span translate="no" className="material-symbols-outlined text-4xl md:text-5xl mb-2 opacity-50">search_off</span>
                         <p className="font-medium text-sm md:text-lg">{emptyMessage}</p>
                       </div>
                    </div>
                  )}
                </div>

                {/* BACK FACE (Textured Black Page OR Left Page Cards) */}
                <div 
                  className="absolute inset-0 bg-[#111] rounded-l-xl md:rounded-l-2xl shadow-[inset_0_0_8px_rgba(0,0,0,0.5),-3px_3px_10px_rgba(0,0,0,0.5)] md:shadow-[inset_0_0_10px_rgba(0,0,0,0.5),-5px_5px_15px_rgba(0,0,0,0.5)] flex flex-col"
                  style={{ transform: 'rotateY(180deg) translateZ(1px)' }}
                >
                  {isDesktop ? (
                    <div className="absolute inset-0 bg-[#151515] flex flex-col">
                      {/* Spine shading on the right side since this is the left page */}
                      <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-20" />
                      
                      {/* Notice pr-12 instead of pl-12 for the spine margin! */}
                      <div className="flex-1 grid gap-3 h-full p-5 pr-12 grid-cols-3 grid-rows-3">
                        {backPockets.map((card, i) => renderPocket(card, i, true))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Back page texture and subtle logo for mobile */}
                      <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                      <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-black/90 to-transparent pointer-events-none z-20" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <span translate="no" className="material-symbols-outlined text-[10rem] md:text-[15rem]">style</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {cards.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
              No hay cartas en esta carpeta.
            </div>
          )}
        </div>
      </div>
      
      {/* Binder Footer Controls */}
      {renderPaginationControls(true)}

      {/* FULL SCREEN PREVIEW MODAL */}
      {previewCard && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setPreviewCard(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white hover:text-gray-300 transition-colors z-[10000]"
            onClick={() => setPreviewCard(null)}
          >
            <span translate="no" className="material-symbols-outlined text-4xl md:text-5xl">close</span>
          </button>
          
          <div 
            className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-5xl w-full bg-[#1a1a1a] rounded-2xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 overflow-y-auto max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="w-full md:w-1/2 flex justify-center shrink-0">
               <img 
                  src={previewCard.imageUrl} 
                  alt={previewCard.name} 
                  className="max-h-[50vh] md:max-h-[75vh] w-auto object-contain rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10" 
               />
             </div>
             
             <div className="w-full md:w-1/2 flex flex-col gap-4 text-white">
                <div>
                  <h2 className="text-3xl md:text-5xl font-black mb-2 leading-tight">{previewCard.name}</h2>
                  <p className="text-slate-400 text-lg italic">
                     {previewCard.set} • {previewCard.supertype || 'Pokémon'} • #{(() => {
                        let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                        return numStr.padStart(3, '0');
                     })()}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3 my-2">
                   <span className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-black text-xl md:text-2xl shadow-lg">
                      {previewCard.price ? '$' + previewCard.price : 'Sin precio'}
                   </span>
                   <span className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-white font-medium text-lg flex items-center gap-2">
                      <span translate="no" className="material-symbols-outlined text-xl">inventory_2</span>
                      x{previewCard.stock || 0} Disponibles
                   </span>
                </div>
                
                <div className="text-slate-300 space-y-2 text-base md:text-lg bg-black/30 p-4 rounded-xl border border-white/5">
                   <p className="flex justify-between border-b border-white/10 pb-2"><strong className="text-white">Rareza:</strong> {previewCard.rarity || 'Desconocida'}</p>
                   <p className="flex justify-between border-b border-white/10 pb-2"><strong className="text-white">Idioma:</strong> {previewCard.language || 'Desconocido'}</p>
                   <p className="flex justify-between pb-1"><strong className="text-white">Estado:</strong> {previewCard.condition || 'Near Mint'}</p>
                </div>
                
                <div className="mt-6 w-[80%] md:w-[66%] scale-125 md:scale-150 origin-top-left">
                  {renderCardActions && renderCardActions(previewCard)}
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
