import React, { useState, useMemo, useEffect, useRef } from 'react';

const PAGE_TURN_DURATION_MS = 450;
const DRAG_SCROLL_EDGE_PX = 120;
const DRAG_SCROLL_MAX_SPEED = 28;
const DRAG_PAGE_TURN_EDGE_RATIO = 0.18;
const DRAG_PAGE_TURN_HOLD_MS = 1000;

export default function AlbumView({ cards = [], renderCardActions, renderCardOverlays, binderColor = '#2f7336', emptyMessage, topRightControls, tcg, reorderEnabled = false, onReorderCard }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [activeCardId, setActiveCardId] = useState(null);
    const [previewCard, setPreviewCard] = useState(null);
  const [fetchedAbility, setFetchedAbility] = useState(null);
  const [fetchingAbility, setFetchingAbility] = useState(false);
  const [targetPage, setTargetPage] = useState(null);
  const [turnDirection, setTurnDirection] = useState(null);
  const [dropPreviewIndex, setDropPreviewIndex] = useState(null);
  const [draggingReorderCardId, setDraggingReorderCardId] = useState(null);
  const [dragFloatingCard, setDragFloatingCard] = useState(null);
  const albumDragNavRef = useRef(null);
  const dragFloatingPreviewRef = useRef(null);
  const dragScrollFrameRef = useRef(null);
  const dragScrollSpeedRef = useRef(0);
  const dragPageTurnDirectionRef = useRef(0);
  const dragPageTurnEnteredAtRef = useRef(0);
  const lastDragPageTurnAtRef = useRef(0);
  const touchAlbumCardIdRef = useRef(null);
  const touchAlbumDropIndexRef = useRef(null);
  const isTouchAlbumDragRef = useRef(false);
  const longPressTimeoutRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const moveDragFloatingPreview = (clientX, clientY) => {
    if (!dragFloatingPreviewRef.current || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    dragFloatingPreviewRef.current.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
  };

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

  const turnToPage = (target) => {
    if (target === currentPage || targetPage !== null) return;
    const safeTarget = Math.max(0, Math.min(totalPages - 1, target));
    const direction = safeTarget > currentPage ? 1 : -1;

    setTargetPage(safeTarget);
    setTurnDirection(direction > 0 ? 'forward' : 'backward');
    setActiveCardId(null);
    setPreviewCard(null);
    setCurrentPage(page => page + direction);
  };

  useEffect(() => {
    if (!draggingReorderCardId) return undefined;

    const updateDragNavigation = (clientX, clientY) => {
      if (!Number.isFinite(clientY) || clientY <= 0) {
        dragScrollSpeedRef.current = 0;
        dragPageTurnDirectionRef.current = 0;
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      if (clientY < DRAG_SCROLL_EDGE_PX) {
        const intensity = (DRAG_SCROLL_EDGE_PX - clientY) / DRAG_SCROLL_EDGE_PX;
        dragScrollSpeedRef.current = -Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
      } else if (clientY > viewportHeight - DRAG_SCROLL_EDGE_PX) {
        const intensity = (clientY - (viewportHeight - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX;
        dragScrollSpeedRef.current = Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
      } else {
        dragScrollSpeedRef.current = 0;
      }

      const rect = albumDragNavRef.current?.getBoundingClientRect();
      const navWidth = rect?.width || window.innerWidth || document.documentElement.clientWidth;
      const navLeft = rect?.left || 0;
      const navRight = rect?.right || navWidth;
      const edgeWidth = Math.max(90, navWidth * DRAG_PAGE_TURN_EDGE_RATIO);

      let nextDirection = 0;
      if (Number.isFinite(clientX) && clientX <= navLeft + edgeWidth) {
        nextDirection = -1;
      } else if (Number.isFinite(clientX) && clientX >= navRight - edgeWidth) {
        nextDirection = 1;
      }

      if (dragPageTurnDirectionRef.current !== nextDirection) {
        dragPageTurnDirectionRef.current = nextDirection;
        dragPageTurnEnteredAtRef.current = nextDirection === 0 ? 0 : Date.now();
      }
    };

    const handleWindowDragOver = (event) => {
      updateDragNavigation(event.clientX, event.clientY);
      moveDragFloatingPreview(event.clientX, event.clientY);
    };

    const tick = () => {
      const speed = dragScrollSpeedRef.current;
      if (speed !== 0) {
        window.scrollBy({ top: speed, left: 0, behavior: 'auto' });
      }

      const direction = dragPageTurnDirectionRef.current;
      const now = Date.now();
      if (
        direction !== 0 &&
        targetPage === null &&
        dragPageTurnEnteredAtRef.current > 0 &&
        now - dragPageTurnEnteredAtRef.current >= DRAG_PAGE_TURN_HOLD_MS &&
        now - lastDragPageTurnAtRef.current >= DRAG_PAGE_TURN_HOLD_MS
      ) {
        if (direction > 0 && currentPage < totalPages - 1) {
          lastDragPageTurnAtRef.current = now;
          dragPageTurnEnteredAtRef.current = now;
          turnToPage(currentPage + 1);
        } else if (direction < 0 && currentPage > 0) {
          lastDragPageTurnAtRef.current = now;
          dragPageTurnEnteredAtRef.current = now;
          turnToPage(currentPage - 1);
        }
      }

      dragScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    dragScrollFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      dragScrollSpeedRef.current = 0;
      dragPageTurnDirectionRef.current = 0;
      dragPageTurnEnteredAtRef.current = 0;
      if (dragScrollFrameRef.current) {
        window.cancelAnimationFrame(dragScrollFrameRef.current);
        dragScrollFrameRef.current = null;
      }
    };
  }, [currentPage, draggingReorderCardId, targetPage, totalPages]);

  useEffect(() => {
    if (targetPage === null) return;

    if (targetPage !== currentPage) {
      const timer = setTimeout(() => {
        setCurrentPage(page => page + (targetPage > page ? 1 : -1));
      }, PAGE_TURN_DURATION_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setTargetPage(null);
      setTurnDirection(null);
    }, PAGE_TURN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [currentPage, targetPage]);

  const jumpToPage = (target) => {
    turnToPage(target);
  };

  // Handle swipe gestures for mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 40;

  const onTouchStart = (e) => {
    if (draggingReorderCardId) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    if (draggingReorderCardId) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

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
      turnToPage(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0 && targetPage === null) {
      turnToPage(currentPage - 1);
    }
  };

  useEffect(() => {
    if (previewCard && tcg === 'Mitos y Leyendas') {
      const fetchAbility = async () => {
        setFetchingAbility(true);
        setFetchedAbility(null);
        try {
          const res = await fetch('https://api.carpetazo.cl/api/tcg/search?q=' + encodeURIComponent(previewCard.name));
          const json = await res.json();
          if (json.success && json.data) {
            let match = json.data.find(c => c.productId == previewCard.tcgId || c.productId == previewCard.apiId);
            if (!match) match = json.data.find(c => c.name.toLowerCase() === previewCard.name.toLowerCase());
            if (match && match.extData && match.extData.effect) {
              setFetchedAbility(match.extData.effect.replace(/<[^>]*>?/gm, ''));
            } else {
              setFetchedAbility('Sin habilidad (Carta Vainilla)');
            }
          }
        } catch (err) {
          setFetchedAbility('Error al cargar habilidad');
        } finally {
          setFetchingAbility(false);
        }
      };
      fetchAbility();
    }
  }, [previewCard, tcg]);

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
    <div ref={albumDragNavRef} className="w-full flex flex-col items-center py-2 md:pt-4 md:pb-10 md:overflow-visible relative" onClick={() => { setActiveCardId(null); setPreviewCard(null); }}>
      
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
          className="relative w-[95%] max-w-[360px] xl:max-w-[400px] 2xl:max-w-[460px] mt-2 md:mt-4 touch-pan-y"
          style={{ perspective: '3500px', aspectRatio: '7.5/10.5' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Continuous Physical Binder Cover (Spans both Left and Right) */}
          <div 
            className="absolute top-[-10px] bottom-[-10px] right-[-10px] md:top-[-20px] md:bottom-[-20px] md:right-[-28px] rounded-2xl md:rounded-3xl shadow-[0_10px_20px_rgba(0,0,0,0.34)] md:shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[-2] overflow-hidden transition-all duration-300"
            style={{ 
              backgroundColor: binderColor,
              left: isDesktop ? 'calc(-100% - 28px)' : 'calc(-100% - 10px)'
            }}
          >
            {/* Interior Darkening (Slightly darker than exterior) */}
            <div className="absolute inset-0 bg-black/30 z-0" />
            
            {/* Leather Texture for the binder wrap */}
            <div className="absolute inset-0 opacity-40 mix-blend-multiply bg-[url('/images/leather.png')] z-10" />
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

          
            {/* IN-ALBUM SPREAD PREVIEW */}
            {previewCard && (
              <div 
                className="absolute rounded-2xl md:rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.95)] z-[1000] flex flex-col md:flex-row overflow-hidden border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md"
                style={{
                  top: isDesktop ? '-20px' : '-8px',
                  bottom: isDesktop ? '-20px' : '-8px',
                  right: isDesktop ? '-28px' : '-10px',
                  left: isDesktop ? 'calc(-100% - 28px)' : '-10px',
                  transform: 'translateZ(100px)'
                }}
                onClick={(e) => { e.stopPropagation(); setPreviewCard(null); }}
              >
                <style>{`
                  .album-preview-actions > div > button.w-full {
                    padding-top: 10px !important;
                    padding-bottom: 10px !important;
                    font-size: 14px !important;
                  }
                  @media (min-width: 768px) {
                    .album-preview-actions > div > button.w-full {
                      padding-top: 12px !important;
                      padding-bottom: 12px !important;
                      font-size: 16px !important;
                    }
                  }
                  .album-preview-actions .bg-slate-100 {
                    padding: 6px !important;
                  }
                  .album-preview-actions .bg-slate-100 span.font-bold {
                    font-size: 16px !important;
                    padding-left: 12px !important;
                    padding-right: 12px !important;
                  }
                  .album-preview-actions .bg-slate-100 button {
                    width: 28px !important;
                    height: 28px !important;
                  }
                `}</style>

                <button 
                  className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded-full text-white transition-colors z-[1010]"
                  onClick={(e) => { e.stopPropagation(); setPreviewCard(null); }}
                >
                  <span translate="no" className="material-symbols-outlined text-xl md:text-2xl">close</span>
                </button>

                {/* Left Side (Image) */}
                <div className="w-full md:w-1/2 h-[45%] md:h-full bg-black/20 flex items-center justify-center p-4 md:p-8 relative" onClick={(e) => e.stopPropagation()}>
                  {isDesktop && <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10" />}
                  <img 
                    src={previewCard.imageUrl} 
                    alt={previewCard.name} 
                    className="max-h-full max-w-full object-contain rounded-xl md:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.7)] relative z-20"
                  />
                </div>

                {/* Right Side (Info) */}
                <div className="w-full md:w-1/2 h-[55%] md:h-full flex flex-col justify-between p-4 md:p-8 text-white relative bg-transparent" onClick={(e) => e.stopPropagation()}>
                  {isDesktop && <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-10" />}
                  
                  <div className="flex flex-col gap-2 md:gap-4 h-full md:pl-6 relative z-20 overflow-y-auto">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl md:text-4xl font-black leading-tight text-white drop-shadow-md">{previewCard.name}</h2>
                      <p className="text-slate-400 text-xs md:text-base italic leading-tight">
                        {previewCard.set} • {(previewCard.supertype === 'Unknown' || !previewCard.supertype) ? (tcg === 'Mitos y Leyendas' ? 'Carta' : 'Pokémon') : previewCard.supertype} {tcg !== 'Mitos y Leyendas' && ` • #${(() => {
                            let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                            return numStr.padStart(3, '0');
                        })()}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-4 my-1 md:my-2">
                      <span className="bg-yellow-400 text-black px-3 py-1 md:px-5 md:py-2.5 rounded-lg font-black text-xl md:text-3xl shadow-lg leading-none">
                        {previewCard.price ? '$' + Number(previewCard.price).toLocaleString('es-CL') : 'Sin precio'}
                      </span>
                      <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white font-medium text-xs md:text-lg flex items-center gap-1.5 leading-none shadow-md">
                          <span translate="no" className="material-symbols-outlined text-[16px] md:text-xl">inventory_2</span>
                          x{previewCard.stock || 0} Disponibles
                      </span>
                    </div>

                    {tcg === 'Mitos y Leyendas' ? (
                      <div className="w-full bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner overflow-y-auto max-h-[120px] md:max-h-[200px]">
                        <p className="flex flex-col">
                          <strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-1">Habilidad</strong> 
                          <span className="font-medium text-white text-[11px] md:text-sm leading-relaxed whitespace-pre-wrap">
                            {fetchingAbility ? 'Buscando habilidad ancestral...' : (fetchedAbility || 'Sin habilidad registrada')}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-y-3 text-xs md:text-base bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner">
                        <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Rareza</strong> <span className="font-medium text-white truncate">{previewCard.rarity || 'Desconocida'}</span></p>
                        <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Idioma</strong> <span className="font-medium text-white truncate">{previewCard.language || 'Desconocido'}</span></p>
                        <p className="flex flex-col col-span-2 mt-1 md:mt-2 pt-2 md:pt-3 border-t border-white/10"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Estado</strong> <span className="font-medium text-white truncate">{previewCard.condition || 'Near Mint'}</span></p>
                      </div>
                    )}

                    <div className="mt-auto pt-4 md:pt-6 w-full flex justify-center">
                      <div className="w-full max-w-[280px] md:max-w-[320px] album-preview-actions bg-white/5 p-2 md:p-3 rounded-xl border border-white/10">
                        {renderCardActions && renderCardActions(previewCard)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
            const isForwardTurningPage = targetPage !== null && turnDirection === 'forward' && pageIndex === currentPage - 1;
            const isBackwardTurningPage = targetPage !== null && turnDirection === 'backward' && isActive;

            let transform = 'rotateY(0deg)';
            let zIndex = 0;

            if (isPast) {
              transform = 'rotateY(-180deg)';
              zIndex = 30 - (currentPage - pageIndex); 
            } else if (isActive) {
              transform = 'rotateY(0deg)';
              zIndex = 60;
            } else if (isFuture) {
              transform = 'rotateY(0deg)';
              zIndex = 20 - (pageIndex - currentPage);
            }

            if (isForwardTurningPage || isBackwardTurningPage) {
              zIndex = 70;
            }

            const renderPocket = (card, i, isBackFace = false) => {
              const uniqueId = card ? (isBackFace ? `${card.id}-back` : card.id) : null;
              const cardIsActive = card && activeCardId === uniqueId;
              const gridIndex = isBackFace ? backGridIndex : frontGridIndex;
              const targetIndex = gridIndex * cardsPerPage + i;
              const isDropPreview = reorderEnabled && dropPreviewIndex === targetIndex;
              
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
                  data-album-drop-index={targetIndex}
                  draggable={reorderEnabled && !!card}
                  onDragStart={(e) => {
                    if (!reorderEnabled || !card) return;
                    if (isTouchAlbumDragRef.current) {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', card.id);
                    const emptyImg = new Image(); emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    e.dataTransfer.setDragImage(emptyImg, 0, 0);
                    setDraggingReorderCardId(card.id);
                    setDragFloatingCard(card);
                    requestAnimationFrame(() => moveDragFloatingPreview(e.clientX, e.clientY));
                    setDropPreviewIndex(targetIndex);
                    dragPageTurnDirectionRef.current = 0;
                    dragPageTurnEnteredAtRef.current = 0;
                    setActiveCardId(null);
                    setPreviewCard(null);
                  }}
                  onDragEnd={() => {
                    if (!reorderEnabled) return;
                    setDraggingReorderCardId(null);
                    setDragFloatingCard(null);
                    setDropPreviewIndex(null);
                  }}
                  onTouchStart={(e) => {
                    if (!reorderEnabled || !card) return;
                    const touch = e.touches?.[0];
                    if (!touch) return;
                    
                    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
                    
                    longPressTimeoutRef.current = setTimeout(() => {
                      if (navigator.vibrate) navigator.vibrate(50);
                      isTouchAlbumDragRef.current = true;
                      touchAlbumCardIdRef.current = card.id;
                      setDraggingReorderCardId(card.id);
                      setDragFloatingCard(card);
                      requestAnimationFrame(() => moveDragFloatingPreview(touchStartPosRef.current.x, touchStartPosRef.current.y));
                      setDropPreviewIndex(targetIndex);
                      touchAlbumDropIndexRef.current = targetIndex;
                      dragPageTurnDirectionRef.current = 0;
                      dragPageTurnEnteredAtRef.current = 0;
                      setActiveCardId(null);
                      setPreviewCard(null);

                      const handleTouchMove = (ev) => {
                        const t = ev.touches?.[0];
                        if (!t) return;
                        if (ev.cancelable) ev.preventDefault(); // Stop native scroll
                        moveDragFloatingPreview(t.clientX, t.clientY);

                        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                        if (t.clientY < DRAG_SCROLL_EDGE_PX) {
                          const intensity = (DRAG_SCROLL_EDGE_PX - t.clientY) / DRAG_SCROLL_EDGE_PX;
                          dragScrollSpeedRef.current = -Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
                        } else if (t.clientY > viewportHeight - DRAG_SCROLL_EDGE_PX) {
                          const intensity = (t.clientY - (viewportHeight - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX;
                          dragScrollSpeedRef.current = Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
                        } else {
                          dragScrollSpeedRef.current = 0;
                        }

                        const rect = albumDragNavRef.current?.getBoundingClientRect();
                        const navWidth = rect?.width || window.innerWidth || document.documentElement.clientWidth;
                        const navLeft = rect?.left || 0;
                        const navRight = rect?.right || navWidth;
                        const edgeWidth = Math.max(90, navWidth * DRAG_PAGE_TURN_EDGE_RATIO);
                        const now = Date.now();

                        let nextDirection = 0;
                        if (t.clientX <= navLeft + edgeWidth && currentPage > 0) {
                          nextDirection = -1;
                        } else if (t.clientX >= navRight - edgeWidth && currentPage < totalPages - 1) {
                          nextDirection = 1;
                        }

                        if (dragPageTurnDirectionRef.current !== nextDirection) {
                          dragPageTurnDirectionRef.current = nextDirection;
                          dragPageTurnEnteredAtRef.current = nextDirection === 0 ? 0 : now;
                        }

                        const dropEl = document.elementFromPoint(t.clientX, t.clientY)?.closest?.('[data-album-drop-index]');
                        if (dropEl?.dataset?.albumDropIndex !== undefined) {
                          const nextIndex = Number(dropEl.dataset.albumDropIndex);
                          if (Number.isFinite(nextIndex)) {
                            if (touchAlbumDropIndexRef.current !== nextIndex) {
                              touchAlbumDropIndexRef.current = nextIndex;
                              setDropPreviewIndex(nextIndex);
                            }
                          }
                        }
                      };

                      const handleTouchEnd = () => {
                        const targetIdx = touchAlbumDropIndexRef.current;
                        const dragId = touchAlbumCardIdRef.current;
                        if (dragId && Number.isFinite(targetIdx) && onReorderCard) {
                          onReorderCard(dragId, targetIdx);
                        }
                        cleanup();
                      };

                      const cleanup = () => {
                        isTouchAlbumDragRef.current = false;
                        dragScrollSpeedRef.current = 0;
                        touchAlbumCardIdRef.current = null;
                        touchAlbumDropIndexRef.current = null;
                        dragPageTurnDirectionRef.current = 0;
                        dragPageTurnEnteredAtRef.current = 0;
                        setDraggingReorderCardId(null);
                        setDragFloatingCard(null);
                        setDropPreviewIndex(null);
                        window.removeEventListener('touchmove', handleTouchMove);
                        window.removeEventListener('touchend', handleTouchEnd);
                        window.removeEventListener('touchcancel', cleanup);
                      };

                      window.addEventListener('touchmove', handleTouchMove, { passive: false });
                      window.addEventListener('touchend', handleTouchEnd);
                      window.addEventListener('touchcancel', cleanup);
                    }, 500);
                  }}
                  onTouchMove={(e) => {
                    if (isTouchAlbumDragRef.current) return;
                    const touch = e.touches?.[0];
                    if (!touch) return;
                    const dx = touch.clientX - touchStartPosRef.current.x;
                    const dy = touch.clientY - touchStartPosRef.current.y;
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                      if (longPressTimeoutRef.current) {
                        clearTimeout(longPressTimeoutRef.current);
                        longPressTimeoutRef.current = null;
                      }
                    }
                  }}
                  onTouchEnd={() => {
                    if (longPressTimeoutRef.current) {
                      clearTimeout(longPressTimeoutRef.current);
                      longPressTimeoutRef.current = null;
                    }
                  }}
                  onTouchCancel={() => {
                    if (longPressTimeoutRef.current) {
                      clearTimeout(longPressTimeoutRef.current);
                      longPressTimeoutRef.current = null;
                    }
                  }}
                  onDragOver={(e) => {
                    if (!reorderEnabled) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDropPreviewIndex(targetIndex);
                  }}
                  onDragEnter={(e) => {
                    if (!reorderEnabled) return;
                    e.preventDefault();
                    setDropPreviewIndex(targetIndex);
                  }}
                  onDragLeave={(e) => {
                    if (!reorderEnabled) return;
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setDropPreviewIndex(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (!reorderEnabled || !onReorderCard) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const dragId = e.dataTransfer.getData('text/plain');
                    setDraggingReorderCardId(null);
                    setDragFloatingCard(null);
                    setDropPreviewIndex(null);
                    if (dragId) onReorderCard(dragId, targetIndex);
                  }}
                  className={`bg-[#222] rounded-xl border border-white/10 shadow-[inset_0_4px_15px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center relative transition-all duration-300 min-h-0 min-w-0 ${reorderEnabled ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-300/70' : ''} ${isDropPreview ? 'ring-4 ring-emerald-400 border-emerald-300 bg-emerald-950/40 scale-[1.04]' : ''} ${cardIsActive ? 'z-50' : 'z-auto hover:z-50'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (reorderEnabled && e.detail > 1) return;
                    if (card) {
                      setActiveCardId(cardIsActive ? null : uniqueId);
                        setPreviewCard(card);
                        console.log('PreviewCard Data:', card);
                    }
                  }}
                  onMouseEnter={() => {
                    if (isDesktop && card) setActiveCardId(uniqueId);
                  }}
                  onMouseLeave={() => {
                    if (isDesktop && card) setActiveCardId(null);
                  }}
                >
                  {isDropPreview && (
                    <div className="absolute inset-0 z-[130] flex items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-400/15 pointer-events-none">
                      <div className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] md:text-xs font-black uppercase tracking-wide text-white shadow-lg">
                        Soltar aquí
                      </div>
                    </div>
                  )}
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
                          
                          <div className="absolute top-1 right-1 md:top-1.5 md:right-1.5 bg-black/80 text-white text-[12px] md:text-[14px] font-bold px-3 py-1 md:py-1.5 rounded-full shadow-lg border border-white/20 z-[120] inline-block text-center pointer-events-none transition-all backdrop-blur-sm">
                            <span className="relative -top-[5px]">x{card.stock || 0}</span>
                          </div>
                          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-yellow-400 text-[12px] md:text-[14px] font-bold px-4 py-1 md:py-1.5 rounded-full shadow-md z-[120] inline-block text-center border border-white/10 whitespace-nowrap pointer-events-none transition-opacity duration-300 ${cardIsActive ? 'opacity-0' : 'opacity-100'}`}>
                            <span className="relative -top-[5px]">{card.price ? '$' + Number(card.price).toLocaleString('es-CL') : 'Sin precio'}</span>
                          </div>

                          {renderCardOverlays && (
                            <div className="absolute inset-0 pointer-events-none z-[110]">
                              {renderCardOverlays(card)}
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
                  transition: `${PAGE_TURN_DURATION_MS}ms transform cubic-bezier(0.4, 0.0, 0.2, 1)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* FRONT FACE (Cards) */}
                <div 
                  className="absolute inset-0 bg-[#151515] rounded-r-xl md:rounded-r-2xl shadow-[inset_0_0_6px_rgba(0,0,0,0.42),2px_2px_5px_rgba(0,0,0,0.28)] md:shadow-[inset_0_0_10px_rgba(0,0,0,0.5),5px_5px_15px_rgba(0,0,0,0.5)] flex flex-col"
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
                  className="absolute inset-0 bg-[#111] rounded-l-xl md:rounded-l-2xl shadow-[inset_0_0_6px_rgba(0,0,0,0.42),-2px_2px_5px_rgba(0,0,0,0.28)] md:shadow-[inset_0_0_10px_rgba(0,0,0,0.5),-5px_5px_15px_rgba(0,0,0,0.5)] flex flex-col"
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
                      <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[url('/images/cubes.png')]" />
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

      {dragFloatingCard && (
        <div
          ref={dragFloatingPreviewRef}
          className="fixed top-0 left-0 z-[5000] pointer-events-none -translate-x-1/2 -translate-y-1/2 will-change-transform"
        >
          <div className="relative w-24 md:w-32 rotate-3 scale-105 rounded-xl bg-black/80 p-1 shadow-xl ring-2 ring-white/30">
            <img
              src={dragFloatingCard.imageUrl}
              alt={dragFloatingCard.name}
              className="block w-full rounded-[5%] object-contain opacity-90"
            />
            <div className="absolute -top-2 -right-2 rounded-full bg-black px-2.5 py-1 text-xs font-black text-white shadow ring-2 ring-white/30">
              x{dragFloatingCard.stock || 0}
            </div>
          </div>
        </div>
      )}
      
      {/* Binder Footer Controls */}
      {renderPaginationControls(true)}
    </div>
  );
}


