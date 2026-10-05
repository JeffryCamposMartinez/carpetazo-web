import React, { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import AlbumPage from './album/AlbumPage';
import { DRAG_PAGE_TURN_EDGE_RATIO, DRAG_PAGE_TURN_HOLD_MS } from './album/albumDrag';
import { DRAG_SCROLL_EDGE_PX, DRAG_SCROLL_MAX_SPEED } from './dragScroll';
import AlbumCardPreview from './album/AlbumCardPreview';
import AlbumPagination from './album/AlbumPagination';


const stripHtml = (value = '') => String(value || '').replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const getExtDataValue = (extData, fieldName) => {
  if (Array.isArray(extData)) {
    return extData.find(item => String(item?.name || '').toLowerCase() === fieldName.toLowerCase())?.value || '';
  }
  if (extData && typeof extData === 'object') {
    return extData[fieldName] || extData[fieldName.toLowerCase()] || '';
  }
  return '';
};

const getCardAbilityText = (card) => {
  if (!card) return '';
  return stripHtml(
    card.effect ||
    card.ability ||
    card.text ||
    getExtDataValue(card.extData, 'Effect') ||
    getExtDataValue(card.extData, 'Ability') ||
    getExtDataValue(card.extData, 'Text') ||
    getExtDataValue(card.extData, 'Habilidad')
  );
};

export default function AlbumView({ cards = [], renderCardActions, renderCardOverlays, binderColor = '#2f7336', emptyMessage, topRightControls, tcg, reorderEnabled = false, onReorderCard }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  // En móvil la página gira 180° hacia la izquierda (fuera de pantalla); con una curva simétrica,
  // avanzar y retroceder tardan lo mismo y se ven a la misma velocidad
  const pageTurnDurationMs = isDesktop ? 450 : 700;
  const pageTurnEasing = isDesktop ? 'cubic-bezier(0.4, 0.0, 0.2, 1)' : 'cubic-bezier(0.65, 0, 0.35, 1)';
  const [activeCardId, setActiveCardId] = useState(null);
    const [previewCard, setPreviewCard] = useState(null);
  const [fetchedAbility, setFetchedAbility] = useState(null);
  const [fetchingAbility, setFetchingAbility] = useState(false);
  const [targetPage, setTargetPage] = useState(null);
  const [turnDirection, setTurnDirection] = useState(null);
  // Todas las páginas se montan una sola vez; mientras se preparan se muestra "Cargando álbum…"
  const [albumReady, setAlbumReady] = useState(false);
  // Solo las páginas cercanas cargan imágenes (ahorra memoria en móviles); se recalcula al terminar cada giro
  const [warmAnchors, setWarmAnchors] = useState([0]);
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
    if (target === currentPage || targetPage !== null || (!albumReady && cards.length > 0)) return;
    const safeTarget = Math.max(0, Math.min(totalPages - 1, target));
    const direction = safeTarget > currentPage ? 1 : -1;
    if (Math.abs(safeTarget - currentPage) > 1) setWarmAnchors([currentPage, safeTarget]);

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
      }, pageTurnDurationMs);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setTargetPage(null);
      setTurnDirection(null);
    }, pageTurnDurationMs);
    return () => clearTimeout(timer);
  }, [currentPage, targetPage]);

  const jumpToPage = (target) => {
    turnToPage(target);
  };

  // Gesto de deslizar (móvil): la página cambia en cuanto el dedo avanza un poco en horizontal, sin esperar a soltar.
  // Se usa una referencia (no estado) para no volver a renderizar todo el álbum en cada movimiento del dedo.
  const swipeRef = useRef({ x: 0, y: 0, time: 0, done: true });
  const SWIPE_TRIGGER_PX = 16;   // distancia horizontal que dispara el giro mientras se arrastra
  const SWIPE_FLICK_PX = 8;      // distancia mínima de un toque rápido (flick)
  const SWIPE_FLICK_SPEED = 0.35; // px por ms

  const onTouchStart = (e) => {
    if (draggingReorderCardId) return;
    const t = e.targetTouches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, time: performance.now(), done: false };
  };

  const fireSwipe = (dx) => {
    swipeRef.current.done = true;
    if (dx < 0) handleNext();
    else handlePrev();
  };

  const onTouchMove = (e) => {
    const sw = swipeRef.current;
    if (draggingReorderCardId || sw.done) return;
    const t = e.targetTouches[0];
    const dx = t.clientX - sw.x;
    const dy = t.clientY - sw.y;
    // Un movimiento claramente vertical es scroll de la página, no un giro
    if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > 10) { sw.done = true; return; }
    if (Math.abs(dx) >= SWIPE_TRIGGER_PX && Math.abs(dx) > Math.abs(dy) * 1.2) fireSwipe(dx);
  };

  const onTouchEnd = (e) => {
    const sw = swipeRef.current;
    if (draggingReorderCardId || sw.done) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - sw.x;
    const dy = t.clientY - sw.y;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - sw.time);
    if (Math.abs(dx) >= SWIPE_FLICK_PX && Math.abs(dx) > Math.abs(dy) * 1.2 && speed >= SWIPE_FLICK_SPEED) fireSwipe(dx);
    else sw.done = true;
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
      const embeddedAbility = getCardAbilityText(previewCard);
      if (embeddedAbility) {
        setFetchedAbility(embeddedAbility);
        setFetchingAbility(false);
        return;
      }

      const fetchAbility = async () => {
        setFetchingAbility(true);
        setFetchedAbility(null);
        try {
          const json = await api.searchTcgProducts(previewCard.name);
          if (json.success && json.data) {
            const previewTcgId = String(previewCard.tcgId || previewCard.apiId || '');
            let match = json.data.find(c => String(c.productId || '') === previewTcgId);
            if (!match) match = json.data.find(c => c.name.toLowerCase() === previewCard.name.toLowerCase());
            const ability = getCardAbilityText({ ...match, extData: match?.extData });
            if (ability) {
              setFetchedAbility(ability);
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

  // Todas las páginas quedan montadas: montar o desmontar páginas durante un giro congelaba la animación en móviles
  const visiblePages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i), [totalPages]);
  const warmRadius = isDesktop ? 3 : 2;

  // Al terminar el giro se recalculan las páginas con imágenes (sin trabajo pesado durante la animación)
  useEffect(() => {
    if (targetPage !== null) return undefined;
    const id = setTimeout(() => {
      setWarmAnchors(prev => (prev.length === 1 && prev[0] === currentPage ? prev : [currentPage]));
    }, 120);
    return () => clearTimeout(id);
  }, [currentPage, targetPage]);

  // El álbum queda listo cuando sus primeras imágenes están descargadas (máximo 2,5 s de espera)
  const hasCards = cards.length > 0;
  useEffect(() => {
    if (albumReady || !hasCards) return undefined;
    let cancelled = false;
    const finish = () => { if (!cancelled) setTimeout(() => { if (!cancelled) setAlbumReady(true); }, 60); };
    const timeout = setTimeout(finish, 2500);
    const urls = cards.slice(0, cardsPerPage * (isDesktop ? 3 : 2)).map(c => c.imageUrl).filter(Boolean);
    Promise.all(urls.map(url => new Promise(resolve => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = url;
    }))).then(() => { clearTimeout(timeout); finish(); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [albumReady, hasCards]);

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

  const previewSubtitle = previewCard
    ? (tcg === 'Mitos y Leyendas'
      ? ''
      : `${previewCard.set} • ${(previewCard.supertype === 'Unknown' || !previewCard.supertype) ? 'Pokémon' : previewCard.supertype} • #${(() => {
          let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
          return numStr.padStart(3, '0');
        })()}`)
    : '';

  const albumPageProps = { activeCardId, albumDragNavRef, cards, cardsPerPage, currentPage, dragPageTurnDirectionRef,
    dragPageTurnEnteredAtRef, dragScrollSpeedRef, dropPreviewIndex, emptyMessage, isDesktop, isTouchAlbumDragRef,
    longPressTimeoutRef, moveDragFloatingPreview, onReorderCard, pageTurnDurationMs, pageTurnEasing, previewCard,
    renderCardOverlays, reorderEnabled, setActiveCardId, setDragFloatingCard, setDraggingReorderCardId,
    setDropPreviewIndex, setPreviewCard, targetPage, totalPages, touchAlbumCardIdRef, touchAlbumDropIndexRef,
    touchStartPosRef, turnDirection, warmAnchors, warmRadius };

  const albumCardPreviewProps = { fetchedAbility, fetchingAbility, isDesktop, previewCard, previewSubtitle,
    renderCardActions, setActiveCardId, setPreviewCard, tcg };

  const albumPaginationProps = { currentPage, getPaginationItems, handleNext, handlePrev, jumpToPage, targetPage,
    topRightControls, totalPages };

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
      <AlbumPagination inverted={false} {...albumPaginationProps} />

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
               <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('/images/paper.png')] max-sm:hidden" />
               
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
               <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('/images/paper.png')] max-sm:hidden" />
            </div>
            
            {/* Center Spine Crease (Exactly at the page hinge) */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[24%] md:w-[15%] -translate-x-1/2 bg-gradient-to-r from-transparent via-black/80 to-transparent pointer-events-none z-20 blur-[6px] md:blur-[10px] opacity-90" />
            
            {/* Subtle Binder Rings Shadow */}
            <div className="absolute left-1/2 top-[10%] bottom-[10%] w-4 md:w-6 -translate-x-1/2 bg-gradient-to-r from-black/60 via-black/10 to-black/60 pointer-events-none z-20 blur-[2px] opacity-70" />
          </div>

          
            {/* IN-ALBUM SPREAD PREVIEW */}
            {previewCard && (
              <AlbumCardPreview {...albumCardPreviewProps} />
            )}

            {visiblePages.map((pageIndex) => <AlbumPage key={pageIndex} pageIndex={pageIndex} {...albumPageProps} />)}
          {!albumReady && hasCards && (
            <div role="status" className="absolute inset-0 z-[3000] flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-950/85 text-white backdrop-blur-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-yellow-300 motion-reduce:animate-none" />
              <p className="text-base font-bold">Cargando álbum…</p>
              <p className="px-6 text-center text-xs text-slate-300">Preparando las páginas para que giren sin tirones</p>
            </div>
          )}
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
              x{Number(dragFloatingCard.stock || 0) > 999 ? '999+' : (dragFloatingCard.stock || 0)}
            </div>
          </div>
        </div>
      )}
      
      {/* Binder Footer Controls */}
      <AlbumPagination inverted {...albumPaginationProps} />
    </div>
  );
}






