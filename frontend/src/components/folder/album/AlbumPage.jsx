import { DRAG_PAGE_TURN_EDGE_RATIO } from './albumDrag';
import { DRAG_SCROLL_EDGE_PX, DRAG_SCROLL_MAX_SPEED } from '../dragScroll';
// Una hoja del álbum: sus bolsillos de cartas por delante y por detrás, y su giro.
export default function AlbumPage({
  pageIndex, activeCardId, albumDragNavRef, cards, cardsPerPage, currentPage, dragPageTurnDirectionRef,
  dragPageTurnEnteredAtRef, dragScrollSpeedRef, dropPreviewIndex, emptyMessage, isDesktop,
  isTouchAlbumDragRef, longPressTimeoutRef, moveDragFloatingPreview, onReorderCard, pageTurnDurationMs,
  pageTurnEasing, previewCard, renderCardOverlays, reorderEnabled, setActiveCardId, setDragFloatingCard,
  setDraggingReorderCardId, setDropPreviewIndex, setPreviewCard, targetPage, totalPages, touchAlbumCardIdRef,
  touchAlbumDropIndexRef, touchStartPosRef, turnDirection, warmAnchors, warmRadius
}) {
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

  const isTurningPage = isForwardTurningPage || isBackwardTurningPage;
  if (isTurningPage) {
    zIndex = 70;
  }
  // Solo se pinta lo que se ve o está girando: la página anterior, la actual y la siguiente
  const isNear = Math.abs(pageIndex - currentPage) <= 1;
  const isHiddenPage = !isTurningPage && (!isNear || (!isDesktop && isPast));
  const isWarmPage = warmAnchors.some(anchor => Math.abs(pageIndex - anchor) <= warmRadius);

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
          }, 1000);
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
            setActiveCardId(null);
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
            <div className={`relative w-full h-full flex flex-col items-center justify-center transition-all duration-300 ease-out min-h-0 min-w-0 ${cardIsActive && !previewCard ? 'scale-[1.25] md:scale-[1.4] -translate-y-4 md:-translate-y-6 z-[100]' : ''}`}>
              <div className="relative w-[95%] h-[95%] flex items-center justify-center">
                {isWarmPage ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    decoding="async"
                    className={`max-w-full max-h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] rounded-[4%] ${Number(card.stock || 0) <= 0 ? 'grayscale opacity-60' : ''}`}
                  />
                ) : (
                  <div className="h-full max-h-full w-[72%] rounded-[4%] bg-white/5 ring-1 ring-white/10" aria-label={card.name} />
                )}

                <div className="absolute top-1 right-1 md:top-1.5 md:right-1.5 z-[120] flex min-w-8 items-center justify-center rounded-full border border-white/20 bg-slate-950/85 px-2 py-0.5 text-[10px] md:text-xs font-black leading-none text-white shadow-lg backdrop-blur-sm pointer-events-none">
                  x{Number(card.stock || 0) > 999 ? '999+' : (card.stock || 0)}
                </div>
                <div className={`absolute -bottom-1 left-1/2 z-[120] flex -translate-x-1/2 items-center justify-center rounded-full border border-yellow-300/40 bg-yellow-400 px-3 py-0.5 text-[10px] md:text-xs font-black leading-none text-slate-950 shadow-md whitespace-nowrap pointer-events-none transition-opacity duration-300 ${cardIsActive || previewCard ? 'opacity-0' : 'opacity-100'}`}>
                  {card.price ? '$' + Number(card.price).toLocaleString('es-CL') : 'Sin precio'}
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
        // En móvil, una página ya pasada se oculta al terminar el giro para que no asome su reverso en el borde
        visibility: isHiddenPage ? 'hidden' : 'visible',
        willChange: isActive || isTurningPage ? 'transform' : 'auto',
        transition: `${pageTurnDurationMs}ms transform ${pageTurnEasing}`,
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
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-5 md:p-8">
             <div className="max-w-[82%] rounded-[1.6rem] border border-yellow-300/30 bg-slate-950/80 p-5 text-center text-white shadow-2xl backdrop-blur-md md:p-7">
               <div className="mx-auto mb-3 flex h-16 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                 <span translate="no" className="material-symbols-outlined text-4xl text-yellow-200/70 md:text-5xl">inventory_2</span>
               </div>
               <p className="text-base font-black leading-tight text-white md:text-xl">Carpeta vacía</p>
               <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-300 md:text-sm">{emptyMessage}</p>
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
}
