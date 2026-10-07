import AlbumView from '../AlbumView';
import CatalogCard from '../CatalogCard';
import LiquidTabs from '../../ui/LiquidTabs';
import PublicCatalogFilters from '../filters/PublicCatalogFilters';
import { ReportMenu } from '../../moderation/ReportButton';
import Select from '../../ui/Select';

// Catálogo público: búsqueda, filtros y vista de álbum o cuadrícula de las cartas.
export default function CatalogBrowser({
  activeFilterCount, addToCart, addToWishlist, availableRarities, availableSets, cards, cart, cartItemsCount,
  cartTotal, counts, decrementCart, folderData, formatCLP, isMobileFiltersOpen, isOwner, isSetDropdownOpen,
  mylCost, mylFilterOptions, mylRace, mylType, onlyAvailable, quickRarity, searchQuery, searchSet,
  selectedSupertype, selectedType, setIsMobileFiltersOpen, setIsSetDropdownOpen, setMylCost, setMylRace,
  setMylType, setOnlyAvailable, setQuickRarity, setSearchQuery, setSearchSet, setSelectedSupertype,
  setSelectedType, setSortBy, setViewMode, sortBy, sortedCards, viewMode, wanted
}) {
  return (
      <div className="relative z-10 flex min-h-[calc(100vh-230px)] w-full flex-col overflow-hidden rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem]">
        <main className="relative z-20 flex flex-1 flex-col px-3 pb-3 pt-2 text-gray-900 sm:px-6 md:px-8 md:py-8">
          <div className="mb-1 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-900/5 md:mb-5 md:p-3">
            <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 md:gap-3">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <span translate="no" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar carta por nombre"
                    aria-label="Buscar carta"
                    className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm font-medium text-slate-900 transition focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]/70 md:h-11 md:pr-4"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <LiquidTabs
                    ariaLabel="Vista del catálogo"
                    axis="auto"
                    layout="inline"
                    value={viewMode}
                    onChange={setViewMode}
                    className="flex-1 rounded-full bg-slate-100 p-1 md:flex-none"
                    buttonClassName="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold md:flex-none"
                    indicatorClassName="rounded-full bg-[#12315f] shadow-sm"
                    activeTextClassName="text-white"
                    inactiveTextClassName="text-slate-500 hover:text-slate-800"
                    options={[
                      { value: 'album', label: <><span translate="no" className="material-symbols-outlined text-[18px]" aria-hidden="true">auto_stories</span><span className="hidden min-[420px]:inline">Álbum</span><span className="sr-only min-[420px]:hidden">Álbum</span></> },
                      { value: 'grid', label: <><span translate="no" className="material-symbols-outlined text-[18px]" aria-hidden="true">grid_view</span><span className="hidden min-[420px]:inline">Cuadrícula</span><span className="sr-only min-[420px]:hidden">Cuadrícula</span></> }
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => setIsMobileFiltersOpen((value) => !value)}
                    aria-expanded={isMobileFiltersOpen}
                    className={`relative flex h-10 w-10 flex-none items-center justify-center gap-2 rounded-full border px-0 text-sm font-black transition-all min-[420px]:w-auto min-[420px]:px-4 md:h-11 ${
                      isMobileFiltersOpen || activeFilterCount > 0
                        ? 'border-[#12315f] bg-[#12315f] text-white shadow-md'
                        : 'border-slate-200 bg-white text-[#12315f] hover:border-[#12315f]/40'
                    }`}
                  >
                    <span translate="no" className="material-symbols-outlined text-[20px]">tune</span>
                    <span className="hidden min-[420px]:inline">Filtros</span>
                    {activeFilterCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#facc15] px-1 text-[11px] font-black text-[#12315f] ring-2 ring-white min-[420px]:static min-[420px]:ring-0">{activeFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>

              {isMobileFiltersOpen && (
                <div className="grid gap-2 border-t border-slate-100 pt-3">
                  <PublicCatalogFilters
                    tcg={folderData?.tcg}
                    cards={cards}
                    counts={counts}
                    selectedSupertype={selectedSupertype}
                    onSupertypeChange={setSelectedSupertype}
                    selectedType={selectedType}
                    onTypeChange={setSelectedType}
                    searchSet={searchSet}
                    setSearchSet={setSearchSet}
                    availableSets={availableSets}
                    isSetDropdownOpen={isSetDropdownOpen}
                    setIsSetDropdownOpen={setIsSetDropdownOpen}
                    mylType={mylType}
                    setMylType={setMylType}
                    mylRace={mylRace}
                    setMylRace={setMylRace}
                    mylCost={mylCost}
                    setMylCost={setMylCost}
                    mylFilterOptions={mylFilterOptions}
                  />

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-[11px] font-black text-slate-500">
                      Ordenar
                      <Select
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-[#1a2b4b] outline-none transition focus:border-[#1e40af] focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="featured">Orden del vendedor</option>
                        <option value="price_asc">Precio: menor a mayor</option>
                        <option value="price_desc">Precio: mayor a menor</option>
                        <option value="name_asc">Nombre A-Z</option>
                        <option value="name_desc">Nombre Z-A</option>
                        <option value="newest">Más nuevas primero</option>
                        <option value="rarity_desc">Rareza: la más alta primero</option>
                        <option value="rarity_asc">Rareza: la más baja primero</option>
                        <option value="set_asc">Edición A-Z</option>
                        <option value="number_asc">Número de carta</option>
                        <option value="stock_desc">Más stock</option>
                        <option value="stock_asc">Menos stock</option>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-black text-slate-500">
                      Rareza
                      <Select
                        value={quickRarity}
                        onChange={(event) => setQuickRarity(event.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-[#1a2b4b] outline-none transition focus:border-[#1e40af] focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Todas</option>
                        {availableRarities.map(rarity => (
                          <option key={rarity} value={rarity}>{rarity}</option>
                        ))}
                      </Select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setOnlyAvailable(value => !value)}
                      className={`mt-auto flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition-all ${
                        onlyAvailable
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:text-[#1e40af]'
                      }`}
                    >
                      <span translate="no" className="material-symbols-outlined text-[18px]">{onlyAvailable ? 'visibility' : 'visibility_off'}</span>
                      Disponibles
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs font-bold text-slate-500">
                    <span><strong className="text-[#1a2b4b]">{sortedCards.length}</strong> carta{sortedCards.length === 1 ? '' : 's'} en esta vista</span>
                    <span>{cartItemsCount > 0 ? `${cartItemsCount} en el carrito · ${formatCLP(cartTotal)}` : 'Filtra, ordena y agrega al pedido sin salir de la carpeta'}</span>
                  </div>
                </div>
              )}
            </form>
          </div>

        <div className="min-w-0">
            {sortedCards.length === 0 || viewMode === 'album' ? (
              <AlbumView tcg={folderData?.tcg} cards={sortedCards} 
                binderColor={folderData?.color || '#2f7336'}
                emptyMessage="Carpeta vacía con estos filtros. No encontramos cartas que coincidan con tu búsqueda actual."
                renderCardOverlays={(card) => Number(card.stock || 0) <= 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-[4%] bg-transparent">
                    <span className="relative rounded-full bg-slate-950/85 px-3 py-1 text-[10px] font-black text-white shadow-lg ring-2 ring-white/70 md:text-xs">Sin stock</span>
                  </div>
                ) : null}
                renderCardActions={(card) => {
                  const cartItem = cart.find(i => i.id === card.id);
                  const availableStock = Number(card.stock || 0) - (cartItem ? cartItem.quantity : 0);
                  return (
                    <div className="flex items-center gap-1 w-full mt-2" onClick={(e) => e.stopPropagation()}>
                      {!isOwner && (
                        <ReportMenu label="" buttonClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-red-600" options={[{ targetType: 'card', targetId: card.id, label: 'Reportar esta carta' }, { targetType: 'card_image', targetId: card.imageUrl && (card.isCustomImage || card.data?.isCustomImage) ? card.id : null, label: 'Reportar la foto de esta carta' }]} />
                      )}
                      {!isOwner && (
                        <button
                        type="button"
                        onClick={() => addToWishlist(card)}
                        aria-pressed={Boolean(wanted[card.id])}
                        aria-label={wanted[card.id] ? `${card.name} está en tu lista de deseadas` : `Agregar ${card.name} a mis deseadas`}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm transition active:scale-90 ${wanted[card.id] ? 'text-rose-500' : 'text-slate-500'}`}
                      >
                        <span translate="no" className="material-symbols-outlined text-[16px]" style={wanted[card.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
                      </button>
                      )}
                      {cartItem ? (
                        <div className="flex items-center justify-between w-full bg-slate-100 rounded-md p-1 border border-slate-200">
                          <button 
                            onClick={() => decrementCart(card.id)}
                            className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <span translate="no" className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className="font-bold text-slate-800 text-xs px-2">{cartItem.quantity}</span>
                          <button 
                            onClick={() => addToCart(card)}
                            disabled={availableStock <= 0}
                            className="w-6 h-6 flex items-center justify-center bg-[#2563eb] rounded shadow-sm text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                          >
                            <span translate="no" className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(card)}
                          disabled={availableStock <= 0}
                          className="w-full flex items-center justify-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-1.5 rounded-md font-bold transition-all disabled:opacity-50 shadow-sm text-[10px]"
                        >
                          <span translate="no" className="material-symbols-outlined text-[14px]">shopping_cart</span>
                          {availableStock <= 0 ? 'Agotado' : 'Agregar'}
                        </button>
                      )}
                    </div>
                  );
                }}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {sortedCards.map(card => {
                const cartItem = cart.find(i => i.id === card.id);
                const availableStock = Number(card.stock || 0) - (cartItem ? cartItem.quantity : 0);
                return (
                  <CatalogCard 
                    tcg={folderData?.tcg}
                    key={card.id} 
                    card={card} 
                    availableStock={availableStock}
                    cartQuantity={cartItem ? cartItem.quantity : 0}
                    onAddToCart={addToCart}
                    onRemoveFromCart={() => decrementCart(card.id)}
                    onWish={isOwner ? undefined : addToWishlist}
                    wished={Boolean(wanted[card.id])}
                  />
                );
              })}
            </div>
          )}
        </div>
    </main>
      </div>
  );
}
