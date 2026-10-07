import { useMemo, useState } from 'react';
import CardLightbox from '../../ui/CardLightbox';
import { DuplicateCardNotice } from '../FolderInventoryComponents';
import FolderAddSearchFilters from '../filters/FolderAddSearchFilters';
import { SafeImage } from '../SafeImage';
import { cardLabel, getExtDataValue } from '../folderCards';
import { ReferencePriceBox, ReferencePriceLine } from '../ReferencePrice';
import useReferencePrices from '../../../hooks/useReferencePrices';
import Select from '../../ui/Select';
import { TCG_LABELS } from '../../../config/folderOptions';

export default function FolderAddTab({
  activeQueueItemId, availableBlocks, availablePhysicalProducts, availableRarities, availableSets,
  decreaseQueueItemQuantity, fileInputRef, filterCounts, filterRarity, filterType, filteredSearchSets,
  folderData, getCardSelectionKey, getCardSetName, getProxyImageUrl, gridCols, handleImageUpload,
  handleResultCardClick, handleRightClickResultCard, handleSaveCard, handleSearchAPI, hasMoreGroups,
  hasSearchedAPI, isBatchAdding, isMylFolder, isSaving, isSearching, isSetDropdownOpen, language,
  multiSelectMode, mylCost, mylRace, mylType, magicFilters, observerTarget, opFilters, price, pseudoName, rbFilters, queueScrollRef,
  removeQueueItem, resetCardForm, scrollToTopIfNeeded, searchBlock, searchCategory, searchLang,
  searchPhysicalProduct, searchQuery, searchResults, searchSet, selectedCard, selectedExistingCard,
  selectedQueue, selectedQueueCountByCard, selectedSupertype, selectedType, setActiveQueueItemId, setMagicFilters, setOpFilters, setRbFilters,
  setFilterRarity, setFilterType, setGridCols, setIsSetDropdownOpen, setLanguage, setMylCost, setMylRace,
  setMylType, setPrice, setPseudoName, setSearchBlock, setSearchLang, setSearchPhysicalProduct,
  setSearchQuery, setSearchSet, setSelectedCard, setSelectedQueue, setSelectedSupertype, setSelectedType,
  setShowCardDetails, setStock, showCardDetails, showScrollTop, startQueuedAdd, stock, toggleMultiSelectMode,
  totalQueuedCards, visibleCount
}) {
  // Precio referencial (Pokémon: TCGplayer; Mitos y Leyendas: vendedores de Carpetazo) de las cartas a la vista y de la que se agrega
  const referenceGame = searchCategory === '1' ? 'pokemon' : searchCategory === '68' ? 'onepiece' : searchCategory === 'magic' ? 'magic' : searchCategory === 'riftbound' ? 'riftbound' : searchCategory === '99' ? 'myl' : null;
  const { variantsFor, source } = useReferencePrices(selectedCard ? [selectedCard, ...searchResults.slice(0, visibleCount)] : searchResults.slice(0, visibleCount), referenceGame);
  const selectedVariants = referenceGame && selectedCard ? variantsFor(selectedCard) : undefined;
  // Carta de la ficha en pantalla grande (al tocar su imagen)
  const [zoomedCard, setZoomedCard] = useState(null);
  const zoomList = useMemo(() => (zoomedCard ? [{ id: 'zoom', name: zoomedCard.name, imageUrl: getProxyImageUrl(zoomedCard.tcgProductId || zoomedCard.id, zoomedCard.imageUrl), set: getCardSetName(zoomedCard), rarity: zoomedCard.rarity || getExtDataValue(zoomedCard.extData, 'Rarity') }] : []), [zoomedCard]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col-reverse lg:flex-row gap-6">
      {zoomedCard && zoomList.length > 0 && (
        <CardLightbox cards={zoomList} cardId="zoom" onChange={() => {}} onClose={() => setZoomedCard(null)} describe={(card) => ({ subtitle: [card.set, card.rarity].filter(Boolean).join(' • '), chips: [] })} />
      )}
      {/* Lado Izquierdo: Buscador de API */}
      <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="bg-white pb-4 mb-4 border-b border-gray-200">
            <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 mb-4">
          <span translate="no" className="material-symbols-outlined text-[#1e40af]">search</span>
            Buscar en {TCG_LABELS[folderData?.tcg] || folderData?.tcg || "Carpeta"}
        </h2>
        
        <form onSubmit={handleSearchAPI} className="flex flex-col gap-2 mb-3">
          <FolderAddSearchFilters
            tcg={folderData?.tcg}
            searchCategory={searchCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchSet={searchSet}
            setSearchSet={setSearchSet}
            searchLang={searchLang}
            setSearchLang={setSearchLang}
            availableSets={availableSets}
            filteredSearchSets={filteredSearchSets}
            isSetDropdownOpen={isSetDropdownOpen}
            setIsSetDropdownOpen={setIsSetDropdownOpen}
            opFilters={opFilters} setOpFilters={setOpFilters} magicFilters={magicFilters} setMagicFilters={setMagicFilters} rbFilters={rbFilters} setRbFilters={setRbFilters} loadedCards={searchResults}
            selectedType={selectedType} setSelectedType={setSelectedType} selectedSupertype={selectedSupertype} setSelectedSupertype={setSelectedSupertype} filterCounts={filterCounts} filterType={filterType}
            setFilterType={setFilterType}
            availableRarities={availableRarities}
            filterRarity={filterRarity}
            setFilterRarity={setFilterRarity}
            searchBlock={searchBlock}
            setSearchBlock={setSearchBlock}
            availableBlocks={availableBlocks}
            searchPhysicalProduct={searchPhysicalProduct}
            setSearchPhysicalProduct={setSearchPhysicalProduct}
            availablePhysicalProducts={availablePhysicalProducts}
            mylType={mylType}
            setMylType={setMylType}
            mylRace={mylRace}
            setMylRace={setMylRace}
            mylCost={mylCost}
            setMylCost={setMylCost}
            scrollToTopIfNeeded={scrollToTopIfNeeded}
          />

          <div className="fixed bottom-[88px] right-6 flex flex-col gap-3 z-[90] lg:hidden">
            <button
              type="button"
              onClick={() => setShowCardDetails(prev => !prev)}
              className={`${showCardDetails ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-[#1e40af] border-gray-200 hover:bg-gray-100'} w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95 border`}
              title={showCardDetails ? 'Ocultar información de cartas' : 'Mostrar información de cartas'}
              aria-label={showCardDetails ? 'Ocultar información de cartas' : 'Mostrar información de cartas'}
              aria-pressed={showCardDetails}
            >
              <span translate="no" className="material-symbols-outlined text-[22px]">{showCardDetails ? 'visibility' : 'visibility_off'}</span>
            </button>
            <button 
              type="button" 
              onClick={toggleMultiSelectMode}
              className={`${multiSelectMode ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-[#1e40af] border-gray-200 hover:bg-gray-100'} w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95 border`}
              title={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
              aria-label={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
            >
              <span translate="no" className="material-symbols-outlined text-[22px]">library_add</span>
              {selectedQueue.length > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full text-xs flex items-center justify-center border-2 border-white ${multiSelectMode ? 'bg-white text-[#1e40af]' : 'bg-[#1e40af] text-white'}`}>
                  {selectedQueue.length}
                </span>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => { const isMobile = window.innerWidth <= 768; const maxCols = isMobile ? 3 : 5; const minCols = isMobile ? 1 : 2; setGridCols(prev => prev >= maxCols ? minCols : prev + 1); }}
              className="bg-white hover:bg-gray-100 text-[#1e40af] border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
              title="Cambiar vista"
              aria-label="Cambiar vista"
            >
              <span translate="no" className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="ml-1">{gridCols}</span>
            </button>
            <button type="submit" className="hidden" />
            <button 
              type="button" 
              onClick={() => { setSearchQuery(''); setSearchPhysicalProduct(''); setSearchSet(''); setMylType(''); setMylRace(''); setMylCost(''); scrollToTopIfNeeded(); }} 
              className="bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
            >
              <span translate="no" className="material-symbols-outlined text-[22px]">filter_alt_off</span>
            </button>
          </div>
        </form>
      </div>
      {(multiSelectMode || selectedQueue.length > 0) && (
        <div className="lg:hidden mb-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-bold text-[#1a2b4b]">Selección múltiple</p>
              <p className="text-xs text-gray-500">{totalQueuedCards} carta{totalQueuedCards === 1 ? '' : 's'} en la lista</p>
            </div>
            <div className="flex gap-2">
              {selectedQueue.length > 0 && (
                <button type="button" onClick={() => { setSelectedQueue([]); setActiveQueueItemId(null); setSelectedCard(null); resetCardForm(); }} className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                  Limpiar
                </button>
              )}
              <button type="button" disabled={selectedQueue.length === 0} onClick={startQueuedAdd} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1e40af] text-white disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm hover:bg-blue-800 transition-colors">
                Agregar selección
              </button>
            </div>
          </div>
          {selectedQueue.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {selectedQueue.map((item, index) => (
                <button key={item.queueId} type="button" onClick={(e) => decreaseQueueItemQuantity(e, item.queueId)} onContextMenu={(e) => e.preventDefault()} className={`relative flex-shrink-0 w-16 rounded-lg border-2 bg-white p-1 shadow-sm transition-all ${activeQueueItemId === item.queueId ? 'border-[#1e40af]' : 'border-blue-200 hover:border-red-300'}`} title="Quitar de la selección">
                  <div className="relative w-full aspect-[63/88]"><SafeImage src={item.card.imageUrl} alt={item.card.name} className="w-full h-full object-contain rounded" fallbackType="queue" /></div>
                  <span className="absolute -top-2 -left-2 bg-[#1e40af] text-white text-[10px] font-bold rounded-full min-w-5 px-1 h-5 flex items-center justify-center border border-white">x{item.quantity || 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={`grid gap-4 pr-2 ${gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : gridCols === 3 ? 'grid-cols-3' : gridCols === 4 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
          {isSearching ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1e40af] mb-4"></div>
              <p className="text-gray-500 font-bold animate-pulse">Consultando la Pokédex mundial...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <>
            {searchResults.slice(0, visibleCount).map((card, index) => {
              const queuedCount = selectedQueueCountByCard[getCardSelectionKey(card)] || 0;
              const isCardSelected = selectedCard?.id === card.id || queuedCount > 0;
              return (
            <div key={card.id || `search-${index}`} className={`relative cursor-pointer flex flex-col justify-between rounded-xl overflow-hidden border-2 transition-all duration-200 bg-blue-50 shadow-sm ${gridCols === 1 ? 'max-w-[255px] mx-auto w-full' : gridCols === 2 ? 'max-w-[350px] mx-auto w-full' : 'w-full'} ${isCardSelected ? 'border-[#1e40af] shadow-md scale-[1.02] ring-2 ring-[#1e40af]/20' : 'border-gray-200 hover:border-[#1e40af]/50'}`} onClick={() => handleResultCardClick(card)} onContextMenu={(e) => handleRightClickResultCard(e, card)} title={multiSelectMode ? "Clic izquierdo: Añadir 1 copia | Clic derecho: Quitar 1 copia" : ""}>
              {queuedCount > 0 && (
                <div className="absolute top-2 right-2 z-20 bg-[#1e40af] text-white text-xs font-bold rounded-full min-w-7 h-7 px-2 flex items-center justify-center border-2 border-white shadow-md">
                  x{queuedCount}
                </div>
              )}
              <div className={`relative w-full ${isMylFolder ? 'aspect-[709/1016]' : 'aspect-[63/88]'} flex items-center justify-center bg-gray-50 overflow-hidden`}>
                <SafeImage src={card.imageUrl} alt={card.name} className="w-full h-full object-cover relative z-10 transition-opacity duration-300" fallbackType="grid" />
              </div>
              {showCardDetails && (
                <div className={`text-center border-t border-gray-100 w-full ${gridCols <= 2 ? 'p-2' : gridCols === 3 ? 'p-3' : gridCols === 4 ? 'p-2' : 'p-1'}`}>
                  <p className={`font-bold text-gray-900 truncate ${gridCols === 1 ? 'text-base' : gridCols === 2 ? 'text-xl' : gridCols === 3 ? 'text-base' : gridCols === 4 ? 'text-sm' : 'text-xs'}`}>{cardLabel(card)}</p>
                  <p className={`text-gray-500 truncate mt-1 ${gridCols === 1 ? 'text-xs' : gridCols === 2 ? 'text-lg' : gridCols === 3 ? 'text-sm' : gridCols === 4 ? 'text-xs' : 'text-[10px]'}`}>{getCardSetName(card)}</p>
                  {referenceGame && <ReferencePriceLine variants={variantsFor(card)}className={`mt-0.5 ${gridCols === 1 ? 'text-sm' : gridCols === 2 ? 'text-lg' : gridCols === 3 ? 'text-sm' : 'text-xs'}`} />}
                </div>
              )}
            </div>
          );})}
          {(visibleCount < searchResults.length || hasMoreGroups) && (
            <div ref={observerTarget} className="col-span-full h-10 w-full flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af]"></div>
            </div>
          )}
          </>
          ) : hasSearchedAPI && hasMoreGroups ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#1e40af] mb-3"></div>
                <p className="text-gray-500 font-bold animate-pulse">Buscando en más ediciones...</p>
              </div>
          ) : hasSearchedAPI ? (
              <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                  <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-50">search_off</span>
                  <p className="font-bold">No se encontraron cartas que coincidan con tu búsqueda.</p>
              </div>
          ) : (
              <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                  <span translate="no" className="material-symbols-outlined text-5xl mb-3 opacity-50">travel_explore</span>
                  <p className="font-bold">Realiza una búsqueda para empezar.</p>
              </div>
          )}
        </div>
      </div>

      {/* Lado Derecho: Añadir a Carpeta */}

        {/* Columna de Botones FAB (Solo PC) */}
        <div className="hidden lg:flex flex-col gap-3 sticky top-[360px] h-fit z-[60] self-start -mx-2">
            <button
                type="button"
                onClick={() => setShowCardDetails(prev => !prev)}
                className={`${showCardDetails ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-[#1e40af] border-gray-200 hover:bg-gray-100'} relative w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95 border`}
                title={showCardDetails ? 'Ocultar información de cartas' : 'Mostrar información de cartas'}
                aria-label={showCardDetails ? 'Ocultar información de cartas' : 'Mostrar información de cartas'}
                aria-pressed={showCardDetails}
            >
                <span translate="no" className="material-symbols-outlined text-[22px]">{showCardDetails ? 'visibility' : 'visibility_off'}</span>
            </button>
            <button 
                type="button" 
                onClick={toggleMultiSelectMode}
                className={`${multiSelectMode ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-[#1e40af] border-gray-200 hover:bg-gray-100'} relative w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95 border`}
                title={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
                aria-label={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
              aria-label={multiSelectMode ? 'Desactivar selección múltiple' : 'Activar selección múltiple'}
            >
                <span translate="no" className="material-symbols-outlined text-[22px]">library_add</span>
                {selectedQueue.length > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full text-xs flex items-center justify-center border-2 border-white ${multiSelectMode ? 'bg-white text-[#1e40af]' : 'bg-[#1e40af] text-white'}`}>
                        {selectedQueue.length}
                    </span>
                )}
            </button>
            <button 
                type="button" 
                onClick={() => { const isMobile = window.innerWidth <= 768; const maxCols = isMobile ? 3 : 5; const minCols = isMobile ? 1 : 2; setGridCols(prev => prev >= maxCols ? minCols : prev + 1); }}
                className="bg-white hover:bg-gray-100 text-[#1e40af] border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
                title="Cambiar vista"
                aria-label="Cambiar vista"
              aria-label="Cambiar vista"
            >
                <span translate="no" className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="ml-1">{gridCols}</span>
            </button>
            <button 
                type="button" 
                onClick={() => { setSearchQuery(''); setSearchPhysicalProduct(''); setSearchSet(''); setMylType(''); setMylRace(''); setMylCost(''); scrollToTopIfNeeded(); }} 
                className="bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 w-14 h-14 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center font-bold hover:scale-110 active:scale-95" 
                title="Limpiar filtros"
              aria-label="Limpiar filtros"
            >
                <span translate="no" className="material-symbols-outlined text-[22px]">filter_alt_off</span>
            </button>
            <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`bg-[#1e40af] text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center transform hover:scale-110 active:scale-95 border-2 border-white/20 ${showScrollTop ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}
                aria-label="Volver arriba"
                title="Volver arriba"
            >
                <span translate="no" className="material-symbols-outlined text-2xl">arrow_upward</span>
            </button>
        </div>

      <div id="add-catalog-panel" className={`w-full max-w-[400px] lg:w-[400px] bg-white p-6 lg:p-6 rounded-2xl shadow-sm border border-gray-200 lg:sticky lg:top-[140px] flex-shrink-0 z-10 hover:z-[60] mx-auto lg:mx-0 self-center lg:self-start scroll-mt-[130px] lg:scroll-mt-[150px] ${selectedCard ? 'block' : 'hidden lg:block'} lg:h-[calc(100vh-160px)] overflow-visible`}>
        <h2 className="font-headline-md text-headline-md text-[#1a2b4b] flex items-center gap-2 border-b border-gray-200 pb-4">
          <span translate="no" className="material-symbols-outlined text-[#1e40af]">add_circle</span>
          {isBatchAdding ? 'Agregar Selección' : 'Añadir a Carpeta'}
        </h2>
        {selectedCard ? (
          <form onSubmit={handleSaveCard} className="flex min-h-[610px] lg:min-h-0 lg:h-[calc(100%-58px)] flex-col justify-between gap-4 mt-2">
            <div className="flex justify-center relative z-50 mt-4 lg:flex-1 lg:min-h-0 w-full">
              <div className="relative inline-block lg:h-full flex justify-center items-center">
                <button type="button" onClick={() => setZoomedCard(selectedCard)} aria-label={`Ver ${selectedCard.name} en pantalla grande`} className="relative block h-72 sm:h-80 lg:h-full lg:max-h-full lg:w-full aspect-[63/88] cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2"><SafeImage src={getProxyImageUrl(selectedCard.tcgProductId || selectedCard.id, selectedCard.imageUrl)} alt={selectedCard.name} className="w-full h-full object-contain rounded-lg shadow-md relative z-50 transition-transform duration-150 active:scale-[0.98]" fallbackType="zoom-main" /></button>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-3 -right-3 z-[60] bg-[#1e40af] text-white rounded-full w-10 h-10 flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-blue-800 hover:scale-110 transition-all border-2 border-white"
                  title="Subir foto real de la carta"
                  aria-label="Subir foto real de la carta"
                >
                  <span translate="no" className="material-symbols-outlined text-[20px]">photo_camera</span>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment" 
                onChange={handleImageUpload} 
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-center px-2">
                <p className="font-bold text-gray-900 leading-tight">{cardLabel(selectedCard)}</p>
                <p className="text-sm text-gray-500 mt-1">{getCardSetName(selectedCard)} • {selectedCard.rarity || getExtDataValue(selectedCard.extData, 'Rarity')}</p>
                {isBatchAdding && (
                  <p className="text-xs font-bold text-[#1e40af] mt-2">
                    Carta {selectedQueue.findIndex(item => item.queueId === activeQueueItemId) + 1} de {selectedQueue.length}
                  </p>
                )}
              </div>

              <DuplicateCardNotice existingCard={selectedExistingCard} selectedCard={selectedCard} />
              {referenceGame && <ReferencePriceBox variants={selectedVariants ?? null} source={source}currentPrice={price} onUse={(clp) => setPrice(String(clp))} />}

              {!isBatchAdding && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Alias / Apodo (Opcional)</label>
                  <input type="text" value={pseudoName} onChange={(e) => setPseudoName(e.target.value)} placeholder="Ej: Charizard de Ash..." maxLength={30} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-sm text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]" />
                </div>
              )}

              <div className="flex gap-4">
                <div className={isBatchAdding ? 'w-full' : 'flex-1'}>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Precio (CLP)*</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input type="number" required min="1" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af]" placeholder="1000" />
                  </div>
                </div>
                {!isBatchAdding && (
                  <div className="w-1/3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Stock*</label>
                    <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 bg-gray-50 focus-within:border-[#1e40af] focus-within:ring-1 focus-within:ring-[#1e40af]">
                      <button type="button" aria-label="Restar stock" disabled={(parseInt(stock, 10) || 1) <= 1} onClick={() => setStock(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))} className="flex w-8 shrink-0 items-center justify-center text-lg font-bold text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40">−</button>
                      <input type="number" required min="1" step="1" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} onBlur={() => { if (!(parseInt(stock, 10) >= 1)) setStock('1'); }} className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-center text-sm font-bold text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" placeholder="1" />
                      <button type="button" aria-label="Sumar stock" onClick={() => setStock(prev => String((parseInt(prev, 10) || 0) + 1))} className="flex w-8 shrink-0 items-center justify-center text-lg font-bold text-gray-600 transition-colors hover:bg-gray-200">+</button>
                    </div>
                  </div>
                )}
              </div>

              {!isMylFolder && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Idioma</label>
                  <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-sm">
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Japanese">Japanese</option>
                  </Select>
                </div>
              )}

              <button type="submit" disabled={isSaving} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-[15px]">
                {isSaving ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <span translate="no" className="material-symbols-outlined">add_circle</span>}
                {isSaving ? 'Guardando...' : isBatchAdding ? 'Guardar y continuar' : selectedExistingCard ? 'Sumar stock' : 'Guardar Carta'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {(multiSelectMode || selectedQueue.length > 0) ? (
              <div className="hidden lg:flex min-h-[610px] lg:min-h-0 lg:h-[calc(100%-58px)] flex-col justify-between gap-4 mt-2">
                  <div className="flex items-center justify-between gap-3 px-2 mt-4">
                    <div>
                      <p className="text-sm font-bold text-[#1a2b4b]">Selección múltiple</p>
                      <p className="text-xs text-gray-500">{totalQueuedCards} carta{totalQueuedCards === 1 ? '' : 's'} en la lista</p>
                    </div>
                    {selectedQueue.length > 0 && (
                      <button type="button" onClick={() => { setSelectedQueue([]); setActiveQueueItemId(null); setSelectedCard(null); resetCardForm(); }} className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                        Limpiar
                      </button>
                    )}
                  </div>

                  <div ref={queueScrollRef} className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden custom-scrollbar mt-2 px-2 pb-4">
                    {selectedQueue.length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {selectedQueue.map((item, index) => (
                          <div key={item.queueId} onContextMenu={(e) => decreaseQueueItemQuantity(e, item.queueId)} title="Clic derecho para quitar 1 copia" className="relative w-full aspect-[63/88] rounded-xl shadow-sm border-2 border-blue-200 bg-white p-1.5 hover:border-red-300 transition-colors flex items-center justify-center cursor-context-menu">
                            <div className="relative w-full h-full"><SafeImage src={getProxyImageUrl(item.card.tcgProductId || item.card.id, item.card.imageUrl)} alt={item.card.name} className="w-full h-full object-contain rounded-md" fallbackType="queue" /></div>
                            <button 
                              type="button" 
                              onClick={() => removeQueueItem(item.queueId)} 
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md border-2 border-white hover:scale-110 transition-transform z-[60]"
                              title="Quitar de la selección"
                            >
                              <span translate="no" className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                            <span className="absolute -bottom-2 -left-2 bg-[#1e40af] text-white text-[11px] font-bold rounded-full min-w-7 px-1 h-7 flex items-center justify-center shadow-md border-2 border-white z-[60]">
                              x{item.quantity || 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 opacity-80 border-2 border-dashed border-gray-200 rounded-xl">
                        <span translate="no" className="material-symbols-outlined text-6xl mb-4 text-gray-300">library_add</span>
                        <div className="text-center px-4">
                          <p className="text-sm font-bold">Usa clic izquierdo para sumar copias.</p>
                          <p className="text-sm font-bold mt-1 opacity-80">Usa clic derecho para restarlas.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="button" disabled={selectedQueue.length === 0} onClick={startQueuedAdd} className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#1e40af] text-white disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm hover:bg-blue-800 transition-colors flex items-center justify-center gap-2">
                    <span translate="no" className="material-symbols-outlined text-[20px]">playlist_add_check</span>
                    Agregar selección
                  </button>
                </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 opacity-80 border-2 border-dashed border-gray-200 rounded-xl mt-6 p-6">
                <span translate="no" className="material-symbols-outlined text-6xl mb-4 text-gray-300">style</span>
                <p className="text-sm font-bold text-center">Selecciona una carta de los resultados.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
