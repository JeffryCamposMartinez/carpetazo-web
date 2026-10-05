import AdminCardEdit from '../AdminCardEdit';
import AlbumView from '../AlbumView';
import { CATALOG_CARDS_PER_PAGE, DETAIL_MODES, chunkCardsByPage } from '../folderCards';
import CardLightbox from '../../ui/CardLightbox';
import InventoryBulkBar from '../InventoryBulkBar';
import InventoryToolbar from '../InventoryToolbar';
import { DragFloatingPreview, FolderInventorySummary, InventoryEmptyState, InventoryFilters, InventoryStatusBar, InventoryViewSwitcher } from '../FolderInventoryComponents';

export default function FolderCatalogTab({
  availableSets, cards, catQuery, catSet, catalogDragFloatingPreview, catalogDragFloatingPreviewRef,
  cardDetailsMode, currentFolderId, inventory, catalogGridClass, catalogGridColumns, catalogGridDense, catalogViewMode, clearCatalogFilters, copyBuyerLink,
  cycleCardDetailsMode, cycleCatalogGridDensity, draggedCatalogCardId, dropCatalogIndex, filteredCatSets, filteredCatalog,
  folderData, getCatalogDragHandleProps, getCatalogDropProps, handleCatalogReorder, handleDeleteRequest,
  handleUpdateCard, hasCatalogFilters, hasUnsavedCatalogOrder, isCatSetDropdownOpen, isMylFolder,
  openBuyerPreview, previewCatalog, saveCatalogOrder, savingCatalogOrder, scrollToTopIfNeeded, setActiveTab,
  setCatQuery, setCatSet, setCatalogViewMode, setIsCatSetDropdownOpen,
  showScrollTop
}) {
  const isGrid = catalogViewMode === 'grid';
  const visibleCards = isGrid ? inventory.gridCards : filteredCatalog;
  const gridPages = isGrid ? chunkCardsByPage(inventory.gridCards) : [];
  const clearAllFilters = () => { clearCatalogFilters(); inventory.setQuickFilter(''); };

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm sm:p-4 ${inventory.selecting ? 'pb-28' : ''}`}>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black leading-tight text-[#1a2b4b] sm:text-xl">
            <span translate="no" className="material-symbols-outlined text-[22px] text-[#1e40af]">inventory_2</span>
            Inventario Actual
          </h2>
          <p className="text-xs text-gray-500">Carpeta de {folderData?.tcg || 'este TCG'}.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={openBuyerPreview}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-black text-[#1e40af] shadow-sm transition-colors hover:bg-blue-100 sm:gap-2 sm:px-4"
          >
            <span translate="no" className="material-symbols-outlined text-[18px]">visibility</span>
            <span className="truncate">Vista</span>
            <span className="hidden sm:inline">comprador</span>
          </button>
          <button
            type="button"
            onClick={copyBuyerLink}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-[#1e40af] sm:gap-2 sm:px-4"
          >
            <span translate="no" className="material-symbols-outlined text-[18px]">link</span>
            <span className="truncate">Copiar</span>
            <span className="hidden sm:inline">enlace</span>
          </button>
        </div>
      </div>

      <FolderInventorySummary
        cards={cards}
        filteredCards={filteredCatalog}
        tcg={folderData?.tcg}
        hasUnsavedCatalogOrder={hasUnsavedCatalogOrder}
        catalogViewMode={catalogViewMode}
      />

      <InventoryStatusBar
        hasUnsavedCatalogOrder={hasUnsavedCatalogOrder}
        savingCatalogOrder={savingCatalogOrder}
        onSave={saveCatalogOrder}
      />

      <InventoryFilters
        query={catQuery}
        onQueryChange={(e) => { setCatQuery(e.target.value); scrollToTopIfNeeded(); }}
        selectedSet={catSet}
        availableSets={availableSets}
        filteredSets={filteredCatSets}
        isOpen={isCatSetDropdownOpen}
        setIsOpen={setIsCatSetDropdownOpen}
        onSelectSet={(nextSet) => { setCatSet(nextSet); setIsCatSetDropdownOpen(false); scrollToTopIfNeeded(); }}
        onClearFilters={clearAllFilters}
        hasFilters={hasCatalogFilters || Boolean(inventory.quickFilter)}
      />

      {isGrid && (
        <InventoryToolbar
          counts={inventory.counts}
          draftCount={inventory.draftCount}
          onQuickFilter={inventory.setQuickFilter}
          onSaveDrafts={inventory.saveDrafts}
          onSort={inventory.setSortKey}
          onStartSelecting={inventory.startSelecting}
          quickFilter={inventory.quickFilter}
          saving={inventory.busy}
          selecting={inventory.selecting}
          sortKey={inventory.sortKey}
        />
      )}

      {!inventory.selecting && <InventoryViewSwitcher
        mode={catalogViewMode}
        onChange={setCatalogViewMode}
        detailMode={cardDetailsMode}
        onCycleDetails={cycleCardDetailsMode}
        gridDensity={catalogGridColumns}
        onCycleGridDensity={cycleCatalogGridDensity}
      />}

      <div className={`fixed right-[max(1rem,calc((100vw-1470px)/2+1rem))] top-1/2 z-[1190] hidden -translate-y-1/2 flex-col gap-3 ${inventory.selecting ? '' : 'md:flex'}`}>
        {catalogViewMode === 'grid' && (
          <>
          <button
            type="button"
            onClick={cycleCardDetailsMode}
            className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all hover:scale-105 active:scale-95 ${cardDetailsMode !== 'none' ? 'border-[#1e40af] bg-[#1e40af] text-white' : 'border-blue-100 bg-white text-[#1e40af] hover:bg-blue-50'}`}
            title={`Información de las cartas: ${DETAIL_MODES[cardDetailsMode].label}. Toca para cambiar`}
            aria-label={`Información de las cartas: ${DETAIL_MODES[cardDetailsMode].label}. Toca para cambiar`}
          >
            <span translate="no" className="material-symbols-outlined text-[21px]">{DETAIL_MODES[cardDetailsMode].icon}</span>
          </button>
          <button
            type="button"
            onClick={cycleCatalogGridDensity}
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-blue-100 bg-white text-sm font-black text-[#1e40af] shadow-lg transition-all hover:scale-105 hover:bg-blue-50 active:scale-95"
            title="Cambiar tamaño de cuadrícula"
            aria-label="Cambiar tamaño de cuadrícula"
          >
            <span translate="no" className="material-symbols-outlined text-[20px]">grid_view</span>
            <span className="ml-0.5">{catalogGridColumns}</span>
          </button>
          </>
        )}
        <button
          type="button"
          onClick={clearAllFilters}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-lg transition-all hover:scale-105 hover:bg-red-50 hover:text-red-500 active:scale-95"
          title="Limpiar filtros"
          aria-label="Limpiar filtros"
        >
          <span translate="no" className="material-symbols-outlined text-[21px]">filter_alt_off</span>
        </button>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/20 bg-[#1e40af] text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-800 active:scale-95 ${showScrollTop ? 'opacity-100 scale-100' : 'pointer-events-none scale-0 opacity-0'}`}
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <span translate="no" className="material-symbols-outlined text-[24px]">arrow_upward</span>
        </button>
      </div>

      {hasUnsavedCatalogOrder && (
        <div className="fixed bottom-6 right-[5.75rem] z-[1200] md:bottom-8 md:right-[max(1rem,calc((100vw-1470px)/2+1rem))]">
          <button
            type="button"
            onClick={saveCatalogOrder}
            disabled={savingCatalogOrder}
            className="inline-flex h-14 whitespace-nowrap items-center gap-2 rounded-full bg-[#1e40af] px-4 text-xs font-black text-white shadow-2xl ring-4 ring-white/70 transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:text-sm"
          >
            <span translate="no" className="material-symbols-outlined text-[20px]">
              {savingCatalogOrder ? 'hourglass_empty' : 'save'}
            </span>
            <span className="hidden min-[360px]:inline">
              {savingCatalogOrder ? 'Guardando orden...' : 'Guardar orden del álbum'}
            </span>
            <span className="min-[360px]:hidden">
              {savingCatalogOrder ? 'Guardando...' : 'Orden'}
            </span>
          </button>
        </div>
      )}

      {visibleCards.length === 0 ? (
        <InventoryEmptyState
          hasFilters={hasCatalogFilters || Boolean(inventory.quickFilter)}
          onClearFilters={clearAllFilters}
          onAddCards={() => setActiveTab('add')}
        />
      ) : catalogViewMode === 'album' ? (
        <div className="rounded-2xl bg-[#dbeafe] py-6 overflow-hidden">
          <AlbumView
            tcg={folderData?.tcg}
            cards={previewCatalog}
            binderColor={folderData?.color || '#2f7336'}
            emptyMessage="No se encontraron cartas que coincidan con los filtros."
            reorderEnabled={!savingCatalogOrder}
            onReorderCard={handleCatalogReorder}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {savingCatalogOrder && (
            <div className="sticky top-24 z-20 mx-auto w-fit rounded-full bg-[#1e40af] px-4 py-2 text-sm font-bold text-white shadow-lg">
              Guardando nuevo orden...
            </div>
          )}

          {gridPages.map((pageCards, pageIndex) => (
            <section
              key={`catalog-page-${pageIndex}`}
              className="rounded-3xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-blue-100 pb-3">
                <div>
                  <h3 className="text-lg font-black text-[#1a2b4b]">Página {pageIndex + 1}</h3>
                  <p className="text-xs font-medium text-gray-500">
                    Estas {pageCards.length} carta{pageCards.length === 1 ? '' : 's'} se verán juntas en esta página del álbum.
                  </p>
                </div>
                <span className="rounded-full bg-[#1e40af] px-3 py-1 text-xs font-bold text-white">
                  {pageCards.length}/{CATALOG_CARDS_PER_PAGE}
                </span>
              </div>

              <div className={`grid ${catalogGridClass} gap-3 xl:gap-4`}>
                {pageCards.map((card, cardIndex) => {
                  const visibleIndex = pageIndex * CATALOG_CARDS_PER_PAGE + cardIndex;
                  const isDragging = draggedCatalogCardId === card.id;
                  const isDropTarget = dropCatalogIndex === visibleIndex && draggedCatalogCardId && draggedCatalogCardId !== card.id;

                  return (
                    <div
                      key={card.id || `catalog-${visibleIndex}`}
                      data-catalog-drop-index={visibleIndex}
                      {...(inventory.dragEnabled ? getCatalogDropProps(visibleIndex) : {})}
                      className={`rounded-2xl transition-all ${
                        isDragging ? 'ring-4 ring-emerald-400/80 bg-emerald-50/80 scale-[1.02]' : ''
                      } ${
                        isDropTarget ? 'ring-4 ring-[#1e40af]/30 bg-blue-100/70 scale-[1.02]' : ''
                      }`}
                    >
                      <AdminCardEdit
                        card={card}
                        onUpdate={handleUpdateCard}
                        onDelete={handleDeleteRequest}
                        dragHandleProps={inventory.dragEnabled ? getCatalogDragHandleProps(card, visibleIndex) : null}
                        selectable={inventory.selecting}
                        selected={inventory.selectedIds.has(card.id)}
                        onToggleSelect={inventory.toggleSelected}
                        onPreview={inventory.setPreviewId}
                        onDraftChange={inventory.onDraftChange}
                        compact
                        detailLevel={cardDetailsMode}
                        showLanguage={!isMylFolder}
                        dense={catalogGridDense}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <DragFloatingPreview preview={catalogDragFloatingPreview} previewRef={catalogDragFloatingPreviewRef} />

      {isGrid && inventory.selecting && (
        <InventoryBulkBar
          busy={inventory.busy}
          count={inventory.selectedIds.size}
          currentFolderId={currentFolderId}
          onAdjust={inventory.adjustPrices}
          onClear={inventory.clearSelected}
          onClose={inventory.stopSelecting}
          onDelete={inventory.removeSelected}
          onMove={inventory.moveSelected}
          onSelectAll={inventory.selectAllVisible}
          onSetValues={inventory.setValues}
          tcg={folderData?.tcg}
          total={inventory.gridCards.length}
        />
      )}

      {isGrid && inventory.previewId && (
        <CardLightbox cards={inventory.gridCards} cardId={inventory.previewId} onChange={inventory.setPreviewId} onClose={() => inventory.setPreviewId(null)} />
      )}
    </div>
  );
}
