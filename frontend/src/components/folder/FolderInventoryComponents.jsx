import React from 'react';

const formatCLP = (value) => {
  const number = Number(value || 0);
  return `$${number.toLocaleString('es-CL')}`;
};

export const FolderInventorySummary = ({ cards = [], filteredCards = [], tcg, hasUnsavedCatalogOrder, catalogViewMode }) => {
  const totalCopies = cards.reduce((sum, card) => sum + Number(card.stock || 0), 0);
  const totalValue = cards.reduce((sum, card) => sum + (Number(card.price || 0) * Number(card.stock || 0)), 0);
  const pages = Math.max(1, Math.ceil(filteredCards.length / 9));
  const zeroStock = cards.filter(card => Number(card.stock || 0) <= 0).length;
  const withoutPrice = cards.filter(card => Number(card.price || 0) <= 0).length;

  const stats = [
    { label: 'Cartas únicas', value: cards.length, icon: 'style' },
    { label: 'Copias totales', value: totalCopies, icon: 'inventory_2' },
    { label: 'Páginas', value: pages, icon: 'auto_stories' },
    { label: 'Valor estimado', value: formatCLP(totalValue), icon: 'paid' },
  ];

  return (
    <section className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 shadow-sm sm:mb-6 sm:rounded-3xl sm:bg-gradient-to-br sm:from-blue-50 sm:via-white sm:to-indigo-50 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-4 sm:flex-row sm:items-start">
        <div>
          <p className="hidden text-xs font-black uppercase tracking-[0.18em] text-[#1e40af] sm:block">Resumen de carpeta</p>
          <h3 className="text-sm font-black text-[#1a2b4b] sm:mt-1 sm:text-xl">{tcg || 'TCG'} · {catalogViewMode === 'album' ? 'Álbum' : 'Cuadrícula'}</h3>
          <p className="mt-1 hidden text-xs text-gray-500 sm:block">Vista rápida de stock, páginas y valor antes de publicar o compartir.</p>
        </div>
        <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs ${hasUnsavedCatalogOrder ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'}`}>
          <span translate="no" className="material-symbols-outlined text-[16px]">{hasUnsavedCatalogOrder ? 'pending_actions' : 'check_circle'}</span>
          <span className="hidden min-[360px]:inline">{hasUnsavedCatalogOrder ? 'Pendiente' : 'Guardado'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {[
          { label: 'Únicas', value: cards.length },
          { label: 'Copias', value: totalCopies },
          { label: 'Valor', value: formatCLP(totalValue) },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-white/70 bg-white/85 px-2 py-1.5 text-center shadow-sm">
            <p className="truncate text-sm font-black leading-none text-[#1a2b4b]">{stat.value}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e40af]/10 text-[#1e40af]">
              <span translate="no" className="material-symbols-outlined text-[18px]">{stat.icon}</span>
            </div>
            <p className="text-lg font-black leading-none text-[#1a2b4b]">{stat.value}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {(zeroStock > 0 || withoutPrice > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold sm:mt-4">
          {zeroStock > 0 && <span className="rounded-full bg-red-50 px-3 py-1 text-red-600 ring-1 ring-red-100">{zeroStock} sin stock</span>}
          {withoutPrice > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-100">{withoutPrice} sin precio</span>}
        </div>
      )}
    </section>
  );
};

export const InventoryStatusBar = ({ hasUnsavedCatalogOrder, savingCatalogOrder, onSave }) => (
  <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm sm:mb-5 sm:flex-row sm:p-3">
    <div className="flex min-w-0 items-center gap-2 text-gray-600 sm:items-start">
      <span translate="no" className={`material-symbols-outlined text-[18px] sm:mt-0.5 ${hasUnsavedCatalogOrder ? 'text-amber-600' : 'text-emerald-600'}`}>
        {hasUnsavedCatalogOrder ? 'edit_note' : 'verified'}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-gray-800 sm:text-sm">
          {hasUnsavedCatalogOrder ? 'Posiciones sin guardar' : 'Posiciones guardadas'}
        </p>
        <p className="hidden text-xs text-gray-500 sm:block">Stock y precio se guardan por carta; el orden se guarda con “Guardar orden del álbum”.</p>
      </div>
    </div>
    {hasUnsavedCatalogOrder && (
      <button
        type="button"
        onClick={onSave}
        disabled={savingCatalogOrder}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1e40af] px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-blue-800 disabled:opacity-60 sm:gap-2 sm:px-4"
      >
        <span translate="no" className="material-symbols-outlined text-[17px]">{savingCatalogOrder ? 'hourglass_empty' : 'save'}</span>
        {savingCatalogOrder ? 'Guardando...' : 'Guardar orden'}
      </button>
    )}
  </div>
);

export const InventoryFilters = ({
  query,
  onQueryChange,
  selectedSet,
  availableSets = [],
  filteredSets = [],
  isOpen,
  setIsOpen,
  onSelectSet,
  onClearFilters,
}) => (
  <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50/70 p-3 sm:mb-6 sm:gap-3 sm:p-4">
    <div className="flex flex-col gap-2 sm:gap-3 md:flex-row">
      <div className="relative flex-1">
        <span translate="no" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
        <input
          type="text"
          value={query}
          onChange={onQueryChange}
          placeholder="Buscar carta..."
          className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 shadow-sm transition-colors focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
        />
      </div>

      <div className="relative w-full md:w-72">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm transition-colors hover:border-[#1e40af]"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate font-bold">
            {selectedSet === '' ? 'Todas las ediciones' : availableSets.find(s => s.groupId === selectedSet)?.name || 'Seleccionado'}
          </span>
          <span translate="no" className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
            <div className="absolute z-[110] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl custom-scrollbar">
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${selectedSet === '' ? 'font-bold text-[#1e40af]' : 'text-gray-700'}`}
                onClick={() => onSelectSet('')}
              >
                {selectedSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                <span className={selectedSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
              </button>
              {filteredSets.map(set => (
                <button
                  type="button"
                  key={set.groupId}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${selectedSet === set.groupId ? 'font-bold text-[#1e40af]' : 'text-gray-700'}`}
                  onClick={() => onSelectSet(set.groupId)}
                >
                  {selectedSet === set.groupId && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
                  <span className={selectedSet !== set.groupId ? 'ml-6' : ''}>{set.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onClearFilters}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <span translate="no" className="material-symbols-outlined text-[18px]">filter_alt_off</span>
        <span className="sm:hidden">Limpiar</span>
        <span className="hidden sm:inline">Limpiar filtros</span>
      </button>
    </div>
  </div>
);

export const InventoryViewSwitcher = ({ mode, onChange }) => (
  <div className="fixed bottom-[5.75rem] right-6 z-[1200] flex justify-end md:static md:mb-6 md:border-b md:border-gray-100 md:pb-4">
    <div className="w-14 rounded-full bg-white/95 p-1 shadow-2xl ring-4 ring-white/70 backdrop-blur md:w-auto md:flex md:flex-row md:items-center md:rounded-xl md:bg-gray-100 md:shadow-inner md:ring-0 md:backdrop-blur-0">
      {[
        { value: 'album', label: 'Álbum', icon: 'auto_stories' },
        { value: 'grid', label: 'Cuadrícula', icon: 'grid_view' },
      ].map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-xs font-bold transition-all md:h-auto md:w-auto md:gap-2 md:rounded-lg md:px-4 md:py-2 md:text-sm ${
            mode === option.value
              ? 'bg-[#1e40af] text-white shadow-md md:bg-white md:text-[#1e40af] md:shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span translate="no" className="material-symbols-outlined text-[21px] md:text-[18px]">{option.icon}</span>
          <span className="sr-only md:not-sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export const InventoryEmptyState = ({ hasFilters, onClearFilters, onAddCards }) => (
  <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 px-6 py-12 text-center text-gray-600">
    <span translate="no" className="material-symbols-outlined mb-3 text-5xl text-[#1e40af]/40">
      {hasFilters ? 'search_off' : 'inventory_2'}
    </span>
    <h3 className="text-lg font-black text-[#1a2b4b]">
      {hasFilters ? 'No hay cartas con esos filtros' : 'Esta carpeta todavía no tiene cartas'}
    </h3>
    <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
      {hasFilters
        ? 'Prueba limpiando la búsqueda o cambiando la edición seleccionada.'
        : 'Agrega cartas desde la pestaña de búsqueda para empezar a construir el álbum.'}
    </p>
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      {hasFilters && (
        <button type="button" onClick={onClearFilters} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#1e40af] shadow-sm ring-1 ring-blue-100">
          Limpiar filtros
        </button>
      )}
      {onAddCards && (
        <button type="button" onClick={onAddCards} className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-bold text-white shadow-sm">
          Agregar cartas
        </button>
      )}
    </div>
  </div>
);

export const DragFloatingPreview = ({ preview, previewRef }) => {
  if (!preview) return null;
  return (
    <div
      ref={previewRef}
      className="fixed left-0 top-0 z-[5000] pointer-events-none -translate-x-1/2 -translate-y-1/2 will-change-transform"
    >
      <div className="relative w-24 rotate-3 scale-105 rounded-xl bg-black/80 p-1 shadow-xl ring-2 ring-white/30 md:w-32">
        <img
          src={preview.card.imageUrl}
          alt={preview.card.name}
          className="block w-full rounded-[5%] object-contain opacity-90"
        />
        <div className="absolute -right-2 -top-2 rounded-full bg-black px-2.5 py-1 text-xs font-black text-white shadow ring-2 ring-white/30">
          x{preview.card.stock || 0}
        </div>
      </div>
    </div>
  );
};

export const DuplicateCardNotice = ({ existingCard, selectedCard }) => {
  if (!existingCard || !selectedCard) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
      <div className="flex gap-2">
        <span translate="no" className="material-symbols-outlined text-[18px]">add_task</span>
        <div>
          <p className="font-black">Esta carta ya existe en la carpeta</p>
          <p className="mt-0.5">Al guardar, se sumará el stock al registro existente y se actualizará el precio.</p>
        </div>
      </div>
    </div>
  );
};
