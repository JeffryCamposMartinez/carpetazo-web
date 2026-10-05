import { api } from '../services/api';
import { sortCatalogCards } from '../components/folder/folderCards';

import { DRAG_SCROLL_EDGE_PX, DRAG_SCROLL_MAX_SPEED } from '../components/folder/dragScroll';

// Orden manual de las cartas de la carpeta: arrastrar con mouse o con el dedo (vista previa flotante y desplazamiento en los bordes) y guardar el orden.
export default function useCatalogOrder({ cards, catalogDragScrollSpeedRef, draggedCatalogCardId, fetchCards,
  filteredCatalog, hasUnsavedCatalogOrder, id, isTouchDragRef, moveCatalogDragFloatingPreview,
  savingCatalogOrder, setCards, setCatalogDragFloatingPreview, setDraggedCatalogCardId, setDropCatalogIndex,
  setHasUnsavedCatalogOrder, setSavingCatalogOrder, showToast, touchCatalogCardIdRef, touchCatalogDropIndexRef }) {
  const saveCatalogOrder = async () => {
    const nextCards = sortCatalogCards(cards);
    if (!hasUnsavedCatalogOrder || savingCatalogOrder) return;

    setSavingCatalogOrder(true);
    try {
      await api.saveFolderOrder(id, nextCards.map((card) => card.id));
      setHasUnsavedCatalogOrder(false);
      showToast('Orden actualizado correctamente', 'success');
    } catch (error) {
      console.error(error);
      showToast('No se pudo guardar el nuevo orden.', 'error');
      fetchCards();
    } finally {
      setSavingCatalogOrder(false);
    }
  };

  const handleCatalogReorder = (dragCardId, targetVisibleIndex) => {
    if (!dragCardId || targetVisibleIndex === null || targetVisibleIndex === undefined) return;

    const visibleCards = filteredCatalog;
    const targetCard = visibleCards[targetVisibleIndex] || null;
    if (targetCard?.id === dragCardId) return;

    const currentOrdered = sortCatalogCards(cards);
    const fromIndex = currentOrdered.findIndex(card => card.id === dragCardId);
    const toIndex = targetCard
      ? currentOrdered.findIndex(card => card.id === targetCard.id)
      : currentOrdered.length;
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const nextOrdered = [...currentOrdered];
    const [movedCard] = nextOrdered.splice(fromIndex, 1);
    const dropIndex = Math.min(toIndex, nextOrdered.length);
    nextOrdered.splice(dropIndex, 0, movedCard);

    const reorderedCards = nextOrdered.map((card, index) => ({
      ...card,
      catalogOrder: index,
      data: {
        ...(card.data || {}),
        catalogOrder: index
      }
    }));

    setCards(reorderedCards);
    setHasUnsavedCatalogOrder(true);
    setDraggedCatalogCardId(null);
    setDropCatalogIndex(null);
  };

  const getCatalogDragHandleProps = (card, visibleIndex) => ({
    draggable: !savingCatalogOrder,
    onDragStart: (event) => {
      if (isTouchDragRef.current) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
      const emptyImg = new Image(); emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      event.dataTransfer.setDragImage(emptyImg, 0, 0);
      setDraggedCatalogCardId(card.id);
      setCatalogDragFloatingPreview({ card });
      requestAnimationFrame(() => moveCatalogDragFloatingPreview(event.clientX, event.clientY));
      setDropCatalogIndex(visibleIndex);
    },
    onDragEnd: () => {
      setDraggedCatalogCardId(null);
      setCatalogDragFloatingPreview(null);
      setDropCatalogIndex(null);
    },
    onTouchStart: (event) => {
      if (savingCatalogOrder) return;
      isTouchDragRef.current = true;
      event.stopPropagation();
      touchCatalogCardIdRef.current = card.id;
      setDraggedCatalogCardId(card.id);
      const startTouch = event.touches?.[0];
      setCatalogDragFloatingPreview({ card });
      if (startTouch) requestAnimationFrame(() => moveCatalogDragFloatingPreview(startTouch.clientX, startTouch.clientY));
      setDropCatalogIndex(visibleIndex);
      touchCatalogDropIndexRef.current = visibleIndex;

      const handleTouchMove = (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        if (e.cancelable) e.preventDefault(); // Prevent native scroll to stop touchcancel
        moveCatalogDragFloatingPreview(touch.clientX, touch.clientY);

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        if (touch.clientY < DRAG_SCROLL_EDGE_PX) {
          const intensity = (DRAG_SCROLL_EDGE_PX - touch.clientY) / DRAG_SCROLL_EDGE_PX;
          catalogDragScrollSpeedRef.current = -Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
        } else if (touch.clientY > viewportHeight - DRAG_SCROLL_EDGE_PX) {
          const intensity = (touch.clientY - (viewportHeight - DRAG_SCROLL_EDGE_PX)) / DRAG_SCROLL_EDGE_PX;
          catalogDragScrollSpeedRef.current = Math.ceil(intensity * DRAG_SCROLL_MAX_SPEED);
        } else {
          catalogDragScrollSpeedRef.current = 0;
        }

        const dropEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest?.('[data-catalog-drop-index]');
        if (dropEl?.dataset?.catalogDropIndex !== undefined) {
          const nextIndex = Number(dropEl.dataset.catalogDropIndex);
          if (Number.isFinite(nextIndex)) {
            if (touchCatalogDropIndexRef.current !== nextIndex) {
              touchCatalogDropIndexRef.current = nextIndex;
              setDropCatalogIndex(nextIndex);
            }
          }
        }
      };

      const handleTouchEnd = () => {
        const targetIndex = touchCatalogDropIndexRef.current;
        const dragId = touchCatalogCardIdRef.current;
        if (dragId && Number.isFinite(targetIndex)) {
          handleCatalogReorder(dragId, targetIndex);
        }
        cleanup();
      };

      const cleanup = () => {
        isTouchDragRef.current = false;
        catalogDragScrollSpeedRef.current = 0;
        touchCatalogCardIdRef.current = null;
        touchCatalogDropIndexRef.current = null;
        setDraggedCatalogCardId(null);
        setCatalogDragFloatingPreview(null);
        setDropCatalogIndex(null);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', cleanup);
      };

      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', cleanup);
    }
  });

  const getCatalogDropProps = (visibleIndex) => ({
    onDragEnter: (event) => {
      event.preventDefault();
      setDropCatalogIndex(visibleIndex);
    },
    onDragOver: (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropCatalogIndex(visibleIndex);
    },
    onDrop: (event) => {
      event.preventDefault();
      const dragId = event.dataTransfer.getData('text/plain') || draggedCatalogCardId;
      setCatalogDragFloatingPreview(null);
      handleCatalogReorder(dragId, visibleIndex);
    }
  });

  return { getCatalogDragHandleProps, getCatalogDropProps, handleCatalogReorder, saveCatalogOrder };
}
