import FolderBinder from './FolderBinder';
import FolderStatusChip from './FolderStatusChip';
import { createPortal } from 'react-dom';

// Botón redondo de icono: 36 px visibles y 44 px de zona táctil
const ICON_BUTTON = "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.94] active:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] after:absolute after:-inset-1 after:content-['']";

// Grilla de mis carpetas: hueco para crear una nueva y cada carpeta con su estado y su menú de acciones.
export default function FolderGrid({
  MENU_ITEM, activeMenuFolderId, closeFolderMenu, copiedFolderId, folders, handleShareFolder,
  handleTogglePublic, navigate, onFolderMenuKeyDown, renderFolderMenuItems, setActiveMenuFolderId,
  setIsCreateModalOpen
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(11.75rem,1fr))] sm:gap-x-6 sm:gap-y-10">
      {/* Pantallas anchas: el hueco de la próxima carpeta, con el mismo tamaño que las demás */}
      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className="group mx-auto hidden aspect-[32/37] w-full max-w-[260px] flex-col items-center justify-center gap-3 self-start rounded-[22px] border-[3px] border-dashed border-[#1e40af]/35 bg-white/40 text-[#1e40af] transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-[#1e40af] hover:bg-white/80 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e40af]/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-md transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-3xl">add</span>
        </span>
        <span className="text-lg font-extrabold">Nueva carpeta</span>
        {folders.length === 0 && <span className="max-w-[80%] text-center text-sm text-slate-600">Crea la primera para empezar a subir cartas</span>}
      </button>

      {folders.map(folder => (
        <div key={folder.id} className={`@container relative mx-auto flex w-full max-w-[260px] flex-col ${activeMenuFolderId === folder.id ? 'z-50' : 'z-10'}`}>
          <button
            type="button"
            onClick={() => navigate(`/carpeta/${folder.id}`)}
            className="group block w-full rounded-2xl text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e40af]/40"
            aria-label={`Abrir carpeta ${folder.name}`}
          >
            <FolderBinder folder={folder} />
          </button>

          {folder.moderationState && folder.moderationState !== 'visible' && (
            <p role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200">Moderación ocultó esta carpeta. Si crees que fue un error, escríbenos a carpetazo.soporte@gmail.com.</p>
          )}

          {/* Acciones bajo la carpeta: visibilidad, compartir y más opciones */}
          <div className="folder-menu-container relative mt-3 flex items-center justify-between gap-0.5">
            <FolderStatusChip folder={folder} onToggle={handleTogglePublic} />
            <div className="flex items-center">
              <button
                type="button"
                onClick={(e) => handleShareFolder(e, folder)}
                title="Compartir enlace"
                aria-label={`Compartir ${folder.name}`}
                className={`${ICON_BUTTON} text-[#1e40af]`}
              >
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-xl">{copiedFolderId === folder.id ? 'check' : 'share'}</span>
              </button>
              <button
                type="button"
                id={`folder-more-${folder.id}`}
                onClick={(e) => { e.stopPropagation(); setActiveMenuFolderId(activeMenuFolderId === folder.id ? null : folder.id); }}
                aria-haspopup="menu"
                aria-expanded={activeMenuFolderId === folder.id}
                aria-label={`Más opciones de ${folder.name}`}
                className={`${ICON_BUTTON} text-slate-600`}
              >
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-xl">more_horiz</span>
              </button>
            </div>

            {activeMenuFolderId === folder.id && (
              <>
                {/* Pantallas anchas: menú anclado al botón, abre hacia arriba */}
                <div
                  id={`folder-popover-${folder.id}`}
                  role="menu"
                  aria-label={`Opciones de ${folder.name}`}
                  onKeyDown={onFolderMenuKeyDown}
                  className="folder-popover absolute bottom-full right-0 z-[100] mb-2 hidden w-56 rounded-2xl bg-white p-1.5 shadow-[0_20px_40px_-12px_rgba(26,43,75,0.35)] ring-1 ring-slate-200 sm:block"
                >
                  {renderFolderMenuItems(folder, `${MENU_ITEM} min-h-10 py-2`)}
                </div>
                {/* Móvil: hoja inferior a pantalla completa, con zonas táctiles de 48 px; va al <body> para quedar sobre el encabezado */}
                {createPortal(
                  <div className="folder-menu-container sm:hidden">
                    <div className="sheet-backdrop fixed inset-0 z-[90] bg-[#0b1d3d]/50" onClick={() => closeFolderMenu(true)} aria-hidden="true" />
                    <div
                      id={`folder-sheet-${folder.id}`}
                      role="menu"
                      aria-label={`Opciones de ${folder.name}`}
                      onKeyDown={onFolderMenuKeyDown}
                      className="folder-sheet fixed inset-x-0 bottom-0 z-[100] rounded-t-3xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-12px_rgba(8,18,42,0.5)]"
                    >
                      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
                      <p className="truncate px-4 pb-2 text-sm font-extrabold text-[#1a2b4b]">{folder.name}</p>
                      {renderFolderMenuItems(folder, `${MENU_ITEM} min-h-12 py-3 text-[15px]`)}
                    </div>
                  </div>,
                  document.body
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
