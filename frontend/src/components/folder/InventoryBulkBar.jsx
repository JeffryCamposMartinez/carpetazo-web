import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';

const ACTION_BUTTON = 'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]';
const FIELD = 'h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70';

const ACTIONS = [
  { key: 'price', label: 'Precio', icon: 'sell' },
  { key: 'stock', label: 'Stock', icon: 'inventory_2' },
  { key: 'percent', label: 'Ajustar %', icon: 'percent' },
  { key: 'move', label: 'Mover', icon: 'drive_file_move' },
  { key: 'delete', label: 'Eliminar', icon: 'delete' },
];

// Cuadro de una acción en bloque. Se cierra con Escape o tocando fuera.
function BulkDialog({ action, count, busy, currentFolderId, tcg, onClose, onSetValues, onAdjust, onMove, onDelete }) {
  const [value, setValue] = useState('');
  const [folders, setFolders] = useState(null);
  const [target, setTarget] = useState('');
  const inputRef = useRef(null);
  const plural = count === 1 ? 'carta' : 'cartas';

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Carpetas de destino: las mías del mismo juego, menos esta
  useEffect(() => {
    if (action !== 'move') return undefined;
    let cancelled = false;
    api.getMyFolders().then((res) => {
      if (!cancelled) setFolders((res.folders || []).filter((folder) => folder.id !== currentFolderId && folder.tcg === tcg));
    }).catch(() => { if (!cancelled) setFolders([]); });
    return () => { cancelled = true; };
  }, [action, currentFolderId, tcg]);

  const number = Number(value);
  const config = {
    price: { title: 'Cambiar el precio', hint: 'Mismo precio (CLP) para todas las cartas elegidas.', valid: value !== '' && Number.isFinite(number) && number >= 0 && number <= 100000000, apply: () => onSetValues({ price: number }), cta: 'Aplicar precio', prefix: '$', min: 0, max: 100000000 },
    stock: { title: 'Cambiar el stock', hint: 'Misma cantidad para todas las cartas elegidas.', valid: value !== '' && Number.isInteger(number) && number >= 0 && number <= 100000, apply: () => onSetValues({ stock: number }), cta: 'Aplicar stock', min: 0, max: 100000 },
    percent: { title: 'Subir o bajar precios', hint: 'Cada precio cambia ese porcentaje y se redondea a pesos enteros. Las cartas sin precio no cambian.', valid: value !== '' && Number.isFinite(number) && number >= -90 && number <= 500 && number !== 0, apply: () => onAdjust(number), cta: 'Ajustar precios', suffix: '%', min: -90, max: 500 },
  }[action];
  const percentExample = action === 'percent' && config.valid ? Math.round(10000 * (1 + number / 100)) : null;

  let body;
  if (action === 'delete') {
    body = (
      <>
        <p className="text-sm text-slate-600">Se quitan {count} {plural} de esta carpeta. No se puede deshacer.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700 active:scale-[0.98]">Cancelar</button>
          <button type="button" disabled={busy} onClick={onDelete} className="h-12 flex-[1.4] rounded-full bg-red-600 text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-60">{busy ? 'Eliminando...' : `Eliminar ${count} ${plural}`}</button>
        </div>
      </>
    );
  } else if (action === 'move') {
    body = (
      <>
        <p className="text-sm text-slate-600">Las cartas pasan al final de la carpeta elegida. Solo hay carpetas tuyas del mismo juego.</p>
        {folders === null && <p className="mt-4 text-sm text-slate-500">Cargando carpetas...</p>}
        {folders && folders.length === 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">No tienes otra carpeta de este juego. Crea una desde Mis carpetas.</p>}
        {folders && folders.length > 0 && (
          <label className="mt-4 block text-sm font-bold text-slate-600">
            Carpeta de destino
            <select ref={inputRef} value={target} onChange={(event) => setTarget(event.target.value)} className={`${FIELD} mt-1`}>
              <option value="">Elige una carpeta</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </label>
        )}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700 active:scale-[0.98]">Cancelar</button>
          <button type="button" disabled={busy || !target} onClick={() => onMove(target, folders.find((folder) => folder.id === target)?.name || 'la otra carpeta')} className="h-12 flex-[1.4] rounded-full bg-[#1e40af] text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-50">{busy ? 'Moviendo...' : `Mover ${count} ${plural}`}</button>
        </div>
      </>
    );
  } else {
    body = (
      <form onSubmit={(event) => { event.preventDefault(); if (config.valid && !busy) config.apply(); }}>
        <p className="text-sm text-slate-600">{config.hint}</p>
        <div className="relative mt-4">
          {config.prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">{config.prefix}</span>}
          <input ref={inputRef} type="number" inputMode={action === 'percent' ? 'decimal' : 'numeric'} min={config.min} max={config.max} step={action === 'price' ? 'any' : 1} value={value} onChange={(event) => setValue(event.target.value)} className={`${FIELD} ${config.prefix ? 'pl-7' : ''} ${config.suffix ? 'pr-9' : ''}`} aria-label={config.title} />
          {config.suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">{config.suffix}</span>}
        </div>
        {action === 'percent' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {[-10, -5, 5, 10, 20].map((step) => (
              <button key={step} type="button" onClick={() => setValue(String(step))} className="h-9 rounded-full bg-slate-100 px-3 text-sm font-bold tabular-nums text-slate-700 active:scale-[0.97]">{step > 0 ? `+${step}` : step}%</button>
            ))}
          </div>
        )}
        {percentExample !== null && <p className="mt-2 text-xs font-semibold text-slate-500">Ejemplo: $10.000 pasa a ${percentExample.toLocaleString('es-CL')}.</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700 active:scale-[0.98]">Cancelar</button>
          <button type="submit" disabled={busy || !config.valid} className="h-12 flex-[1.4] rounded-full bg-[#1e40af] text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-50">{busy ? 'Guardando...' : `${config.cta} a ${count}`}</button>
        </div>
      </form>
    );
  }

  const title = action === 'delete' ? `¿Eliminar ${count} ${plural}?` : action === 'move' ? 'Mover a otra carpeta' : config.title;
  return createPortal(
    <div className="fixed inset-0 z-[1300] flex items-end justify-center sm:items-center">
      <div className="sheet-backdrop absolute inset-0 bg-[#0b1d3d]/55" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className="folder-sheet relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <h2 className="mb-1 text-lg font-extrabold text-[#12315f]">{title}</h2>
        {body}
      </div>
    </div>,
    document.body
  );
}

// Barra de la selección en bloque: queda abajo mientras se eligen cartas
export default function InventoryBulkBar({ busy, count, currentFolderId, onAdjust, onClear, onClose, onDelete, onMove, onSelectAll, onSetValues, tcg, total }) {
  const [dialog, setDialog] = useState(null);
  const disabled = count === 0 || busy;
  const closeDialog = useCallback(() => setDialog(null), []);

  // Va al <body>: dentro del panel animado quedaría por debajo de los botones flotantes de la página
  return createPortal(
    <>
      <div className="fixed inset-x-0 bottom-0 z-[1250] border-t border-white/10 bg-[#12315f] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-12px_30px_-12px_rgba(8,18,42,0.6)]" role="toolbar" aria-label="Acciones sobre las cartas elegidas">
        <div className="mx-auto flex max-w-[1470px] items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Salir de la selección" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px]">close</span>
          </button>
          <div className="min-w-0 shrink-0 pr-1">
            <p className="text-sm font-extrabold leading-tight" aria-live="polite">{count} {count === 1 ? 'elegida' : 'elegidas'}</p>
            <button type="button" onClick={count === total ? onClear : onSelectAll} className="text-xs font-bold text-[#facc15] underline-offset-2 hover:underline focus:outline-none focus-visible:underline">{count === total && total > 0 ? 'Quitar todas' : `Elegir las ${total} visibles`}</button>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={disabled}
                onClick={() => setDialog(action.key)}
                className={`${ACTION_BUTTON} ${action.key === 'delete' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white/10 text-white hover:bg-white/20'} disabled:opacity-40`}
              >
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[19px]">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {dialog && (
        <BulkDialog
          action={dialog}
          count={count}
          busy={busy}
          currentFolderId={currentFolderId}
          tcg={tcg}
          onClose={closeDialog}
          onSetValues={async (values) => { if (await onSetValues(values)) closeDialog(); }}
          onAdjust={async (percent) => { if (await onAdjust(percent)) closeDialog(); }}
          onMove={async (target, name) => { if (await onMove(target, name)) closeDialog(); }}
          onDelete={async () => { if (await onDelete()) closeDialog(); }}
        />
      )}
    </>,
    document.body
  );
}
