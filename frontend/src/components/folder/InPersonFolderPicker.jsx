import { useEffect, useRef, useState } from 'react';
import SvgIcon from '../ui/SvgIcon';

// Elige la carpeta de la que se hace una venta presencial (desde el menú de la cuenta)
export default function InPersonFolderPicker({ loadFolders, onClose, onPick }) {
  const [folders, setFolders] = useState(null); // null = cargando
  const [failed, setFailed] = useState(false);
  const closeRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    loadFolders()
      .then((list) => {
        if (cancelled) return;
        setFolders(list);
        if (list.length === 1) onPickRef.current(list[0]); // con una sola carpeta no hay nada que elegir
      })
      .catch(() => { if (!cancelled) { setFailed(true); setFolders([]); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (folders === null || folders.length === 1) return null; // cargando o entrando directo a la única carpeta: sin destello

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="in-person-picker-title" className="flex max-h-[85svh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffcb05] text-[#1a2b4b]"><SvgIcon name="payments" translate="no" aria-hidden="true" className="text-[24px]" /></span>
            <div>
              <h2 id="in-person-picker-title" className="text-lg font-extrabold tracking-tight text-[#12315f]">Venta presencial</h2>
              <p className="mt-0.5 text-sm text-slate-600">¿De qué carpeta vendiste?</p>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"><SvgIcon name="close" translate="no" aria-hidden="true" className="text-[22px]" /></button>
        </div>
        <div className="overflow-y-auto p-3">
          {folders === null ? (
            <p className="p-6 text-center text-sm font-semibold text-slate-500">Cargando carpetas…</p>
          ) : failed ? (
            <p className="p-6 text-center text-sm font-semibold text-red-700">No pudimos cargar tus carpetas. Inténtalo de nuevo.</p>
          ) : folders.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-slate-600">Aún no tienes carpetas. Crea una en «Mis carpetas» para registrar ventas.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button type="button" onClick={() => onPick(folder)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left ring-1 ring-slate-900/5 transition-[background-color,transform] duration-150 active:scale-[0.99] hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e0f2fe] text-[#0369a1]"><SvgIcon name="folder" translate="no" aria-hidden="true" className="text-[22px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-extrabold text-[#12315f]">{folder.name}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{folder.tcg} · {folder._count?.cards ?? 0} {folder._count?.cards === 1 ? 'carta' : 'cartas'}</span>
                    </span>
                    <SvgIcon name="chevron_right" translate="no" aria-hidden="true" className="text-[20px] text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
