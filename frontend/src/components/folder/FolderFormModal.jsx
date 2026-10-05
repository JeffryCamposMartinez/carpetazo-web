import { COLOR_NAMES, FOLDER_COLORS, TCG_OPTIONS } from '../../config/folderOptions';
import FolderBinder from './FolderBinder';

// Crear o editar una carpeta: nombre, juego, color y visibilidad, con vista previa en vivo.
export default function FolderFormModal({
  editFolderColor, editFolderName, editingFolder, handleCreateFolder, isCreating, newFolderColor,
  newFolderName, newFolderTcg, setEditFolderColor, setEditFolderName, setEditingFolder, setIsCreateModalOpen,
  setNewFolderColor, setNewFolderName, setNewFolderTcg, submitEditFolder
}) {
  const isEdit = Boolean(editingFolder);
  const name = isEdit ? editFolderName : newFolderName;
  const color = isEdit ? editFolderColor : newFolderColor;
  const close = () => (isEdit ? setEditingFolder(null) : setIsCreateModalOpen(false));
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a2b4b]/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-dialog-title"
        className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[1fr_1.15fr]"
        onClick={e => e.stopPropagation()}
      >
        <div className="hidden items-center justify-center bg-[#DBEAFE] p-8 md:flex">
          <div className="w-full max-w-[230px]">
            <FolderBinder folder={{
              name: name.trim() || 'Nombre de tu carpeta',
              color,
              tcg: isEdit ? editingFolder.tcg : newFolderTcg,
              cardsCount: isEdit ? editingFolder.cardsCount : 0,
              validWeeklyVisits: isEdit ? editingFolder.validWeeklyVisits : 0,
              isPublic: isEdit ? editingFolder.isPublic : false
            }} />
          </div>
        </div>

        <form onSubmit={isEdit ? submitEditFolder : handleCreateFolder} className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h3 id="folder-dialog-title" className="text-2xl font-extrabold text-[#1a2b4b]">{isEdit ? 'Editar carpeta' : 'Nueva carpeta'}</h3>
            <button type="button" onClick={close} aria-label="Cerrar" className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
              <span translate="no" className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <label className="flex flex-col gap-2">
            <span className="flex justify-between text-sm font-bold text-[#1a2b4b]">
              Nombre <span className="font-normal text-slate-400 tabular-nums">{name.length}/22</span>
            </span>
            <input
              type="text"
              maxLength={22}
              placeholder="Ej: Ventas de la semana"
              value={name}
              onChange={(e) => (isEdit ? setEditFolderName(e.target.value) : setNewFolderName(e.target.value))}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-semibold text-[#1a2b4b] focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30"
              autoFocus
              required
            />
          </label>

          {!isEdit && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-bold text-[#1a2b4b]">Juego</legend>
              <div className="grid grid-cols-2 gap-2">
                {TCG_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={newFolderTcg === value}
                    onClick={() => setNewFolderTcg(value)}
                    className={`h-11 rounded-xl px-3 text-sm font-bold ring-1 transition-colors ${newFolderTcg === value ? 'bg-[#1e40af] text-white ring-[#1e40af]' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">El juego no se puede cambiar después.</p>
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-3 text-sm font-bold text-[#1a2b4b]">Color</legend>
            <div className="flex flex-wrap gap-3">
              {FOLDER_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => (isEdit ? setEditFolderColor(c.id) : setNewFolderColor(c.id))}
                  aria-pressed={color === c.id}
                  aria-label={`Color ${COLOR_NAMES[c.id] || c.id}`}
                  className={`h-10 w-10 rounded-full ring-offset-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${color === c.id ? 'scale-110 ring-2 ring-[#1a2b4b]' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-auto flex justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="h-11 rounded-xl px-5 font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex h-11 items-center gap-2 rounded-xl bg-[#1e40af] px-6 font-bold text-white shadow-md hover:bg-[#1e3a8a] disabled:opacity-60"
            >
              {isEdit ? 'Guardar cambios' : isCreating ? 'Creando…' : 'Crear carpeta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
