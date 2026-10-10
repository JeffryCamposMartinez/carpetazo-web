import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { ErrorBox, ListSkeleton, dateTime } from './shared';
import CatalogImportReview from './CatalogImportReview';

const FILE_NAME = 'cartas_incrementales.json';
const MAX_BYTES = 12 * 1024 * 1024;
const STEPS = ['Elegir archivo', 'Revisar', 'Cargar'];

const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function Stepper({ current }) {
  return (
    <ol aria-label="Pasos de la carga" className="mb-5 flex items-center gap-2 text-sm font-bold">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex min-w-0 items-center gap-2">
            {index > 0 && <span aria-hidden="true" className={`h-px w-4 sm:w-8 ${done || active ? 'bg-[#1e40af]' : 'bg-slate-300'}`} />}
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums transition-colors duration-200 ${done ? 'bg-[#1e40af] text-white' : active ? 'bg-[#12315f] text-[#facc15]' : 'bg-slate-200 text-slate-500'}`}>
              {done ? <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span> : index + 1}
            </span>
            <span className={`truncate ${active ? 'text-[#12315f]' : done ? 'text-slate-700' : 'text-slate-500'} ${active ? '' : 'max-sm:hidden'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Aviso de confirmación antes de escribir en la base real. Interrumpe a propósito: la carga no se deshace desde aquí.
function ConfirmDialog({ count, busy, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  useBodyScrollLock(true);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  return createPortal(
    <div className="sheet-backdrop fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/55 p-3 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="catalog-confirm-title" className="mod-confirm-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef3c7] text-[#92400e]"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">library_add</span></span>
        <h2 id="catalog-confirm-title" className="mt-4 text-xl font-extrabold text-[#12315f]">¿Cargar {count} {count === 1 ? 'carta nueva' : 'cartas nuevas'}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Se agregan a la base de datos de Carpetazo y quedan visibles en el catálogo. Las cartas que ya existían no se modifican. Esta carga no se deshace desde aquí.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="h-12 rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] text-sm font-extrabold text-[#12315f] transition-[filter,transform] duration-150 active:scale-[0.97] hover:brightness-95 disabled:opacity-70">
            {busy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#12315f]/30 border-t-[#12315f]" />}
            {busy ? 'Cargando…' : 'Sí, cargar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Carga de cartas nuevas a la base desde cartas_incrementales.json (el archivo que genera Carpetazo Update).
// El servidor vuelve a revisar todo al cargar: lo que se ve en la revisión es lo que se guarda.
export default function CatalogImportPanel() {
  const [stage, setStage] = useState('pick'); // pick | reviewing | review | done
  const [file, setFile] = useState(null); // { name, size }
  const [data, setData] = useState(null);
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setStage('pick'); setFile(null); setData(null); setPlan(null); setResult(null); setError(''); setConfirming(false); setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleFile = async (picked) => {
    if (!picked) return;
    setError('');
    if (picked.name !== FILE_NAME) { setError(`Solo se acepta el archivo ${FILE_NAME}. Elegiste "${picked.name}".`); return; }
    if (picked.size === 0 || picked.size > MAX_BYTES) { setError(picked.size === 0 ? 'El archivo está vacío.' : 'El archivo supera los 12 MB.'); return; }
    let parsed;
    try { parsed = JSON.parse(await picked.text()); } catch { setError('El archivo no se pudo leer: no es un JSON válido.'); return; }
    const id = ++runId.current;
    setFile({ name: picked.name, size: picked.size });
    setData(parsed);
    setStage('reviewing');
    try {
      const res = await api.previewCatalogImport(parsed);
      if (id !== runId.current) return;
      setPlan(res);
      setStage('review');
    } catch (err) {
      if (id !== runId.current) return;
      setError(err.message || 'No se pudo revisar el archivo.');
      setStage('pick'); setFile(null); setData(null);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.applyCatalogImport(data, plan.digest);
      setResult(res);
      setConfirming(false);
      setStage('done');
    } catch (err) {
      setConfirming(false);
      setError(err.message || 'No se pudo cargar el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const step = stage === 'pick' ? 0 : stage === 'done' ? 3 : 1;
  const loadable = stage === 'review' && plan?.canApply;

  return (
    <section aria-label="Carga de cartas nuevas" className="mx-auto max-w-3xl">
      <Stepper current={step} />
      <ErrorBox>{error}</ErrorBox>

      {stage === 'pick' && (
        <>
          <label
            htmlFor="catalog-file"
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-[border-color,background-color,transform] duration-200 ease-out focus-within:ring-2 focus-within:ring-[#1e40af] ${dragging ? 'scale-[0.995] border-[#1e40af] bg-[#e8effc]' : 'border-[#b9c7e0] bg-white [@media(hover:hover)]:hover:border-[#1e40af] [@media(hover:hover)]:hover:bg-[#f7f9fd]'}`}
          >
            <span className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af] transition-transform duration-200 ease-out ${dragging ? '-translate-y-1' : ''}`}>
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[34px]">upload_file</span>
            </span>
            <span className="mt-5 text-lg font-extrabold text-[#12315f]">{dragging ? 'Suelta el archivo aquí' : 'Arrastra cartas_incrementales.json'}</span>
            <span className="mt-1.5 text-sm text-slate-600">o toca para buscarlo en tu equipo</span>
            <span className="mt-5 inline-flex h-11 items-center rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white">Elegir archivo</span>
            <input id="catalog-file" ref={inputRef} type="file" accept=".json,application/json" className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          <div className="mt-4 rounded-2xl border border-[#dbe3f0] bg-white p-4 text-sm leading-relaxed text-slate-600">
            <p className="font-bold text-slate-800">Dónde está el archivo</p>
            <p className="mt-1">Lo genera Carpetazo Update al exportar el catálogo local, en la carpeta <b className="break-words text-slate-800">Reportes › BaseDatos › año › mes › día › …_respaldo_catalogo_local</b>.</p>
            <p className="mt-2">Solo se acepta un archivo llamado <b className="text-slate-800">{FILE_NAME}</b>. Antes de agregar nada, el servidor lo revisa y te muestra qué cambiaría.</p>
          </div>
        </>
      )}

      {stage === 'reviewing' && (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#dbe3f0] bg-white p-4" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-[#1e40af]/25 border-t-[#1e40af]" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-700">Revisando {file?.name}… comparando con la base y comprobando las imágenes.</p>
          </div>
          <ListSkeleton rows={4} label="Revisando archivo" />
        </div>
      )}

      {stage === 'review' && plan && (
        <div className="pb-24 sm:pb-0">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#dbe3f0] bg-white p-3 pl-4">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[26px] text-[#1e40af]">description</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{file?.name}</p>
              <p className="truncate text-xs text-slate-500">{sizeLabel(file?.size || 0)}{plan.generatedAt ? ` · generado ${dateTime(plan.generatedAt)}` : ''}</p>
            </div>
            <button type="button" onClick={reset} className="h-10 shrink-0 rounded-full px-4 text-sm font-bold text-[#1e40af] transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-blue-50">Cambiar</button>
          </div>

          <CatalogImportReview plan={plan} />

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe3f0] bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-3xl gap-2 sm:justify-end">
              <button type="button" onClick={reset} className="h-12 flex-1 rounded-full border-2 border-slate-300 bg-white px-6 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 sm:flex-none">Cancelar</button>
              <button type="button" disabled={!loadable} onClick={() => setConfirming(true)} className="h-12 flex-[1.6] rounded-full bg-[#facc15] px-7 text-sm font-extrabold text-[#12315f] transition-[filter,transform,opacity] duration-150 active:scale-[0.97] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none">
                {loadable ? `Cargar ${plan.counts.new} ${plan.counts.new === 1 ? 'carta' : 'cartas'}` : 'Nada que cargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="mod-row-in rounded-3xl border border-emerald-200 bg-white p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[36px]">check_circle</span></span>
          <h3 className="mt-4 text-xl font-extrabold text-[#12315f]">{result.created === 0 ? 'No había cartas nuevas' : `Se ${result.created === 1 ? 'cargó 1 carta nueva' : `cargaron ${result.created} cartas nuevas`}`}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{result.existing > 0 ? `${result.existing} ya ${result.existing === 1 ? 'existía y no se modificó' : 'existían y no se modificaron'}. ` : ''}La carga quedó registrada en la auditoría.</p>
          <button type="button" onClick={reset} className="mt-6 h-12 rounded-full bg-[#12315f] px-7 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af]">Cargar otro archivo</button>
        </div>
      )}

      {confirming && plan && <ConfirmDialog count={plan.counts.new} busy={busy} onCancel={() => setConfirming(false)} onConfirm={apply} />}
    </section>
  );
}
