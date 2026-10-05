// Controles de página del álbum (arriba y abajo): anterior, números y siguiente.
export default function AlbumPagination({
  inverted = false, currentPage, getPaginationItems, handleNext, handlePrev, jumpToPage, targetPage,
  topRightControls, totalPages
}) {
  return (
    <div className={`relative z-10 flex flex-col items-center w-full max-w-7xl px-5 md:px-4 ${inverted ? 'mt-6 md:mt-10' : 'mb-2 md:mb-4'}`} onClick={(e) => e.stopPropagation()}>
      {!inverted && (
        <div className="md:hidden flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs mb-3 font-medium bg-slate-200/50 dark:bg-slate-800/50 px-3 py-1 rounded-full">
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
}
