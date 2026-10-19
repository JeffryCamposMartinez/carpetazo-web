import { useCallback, useRef, useState } from 'react';
import { api } from '../../services/api';
import { ErrorBox, ListSkeleton, dateTime } from './shared';
import CatalogImportReview from './CatalogImportReview';
import TcgCatalogImport from './TcgCatalogImport';
import { ButtonSpinner } from '../ui/LoadingState';
import { ConfirmDialog, Stepper, sizeLabel } from './CatalogImportParts';
import SvgIcon from '../ui/SvgIcon';

const FILE_NAME = 'cartas_incrementales.json';
const MAX_BYTES = 12 * 1024 * 1024;
const TCG_FILE = /^cartas_incrementales_tcg_[\w .\-]{1,100}\.json$/;
const MAX_TCG_FILES = 400;
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
  const [overrides, setOverrides] = useState({}); // productId -> edición elegida a mano
  const [rechecking, setRechecking] = useState(false);
  const [tcgFiles, setTcgFiles] = useState(null); // archivos del catálogo de TCGplayer elegidos
  const inputRef = useRef(null);
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setStage('pick'); setFile(null); setData(null); setPlan(null); setResult(null); setError(''); setConfirming(false); setBusy(false); setOverrides({}); setRechecking(false); setTcgFiles(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // Un cartas_incrementales.json (Mitos y Leyendas) o uno o más cartas_incrementales_tcg_*.json (TCGplayer)
  const handleFiles = (list) => {
    const picked = Array.from(list || []);
    if (picked.length === 0) return;
    setError('');
    if (picked.every((item) => TCG_FILE.test(item.name))) {
      if (picked.length > MAX_TCG_FILES) { setError(`Elige hasta ${MAX_TCG_FILES} archivos a la vez.`); return; }
      const bad = picked.find((item) => item.size === 0 || item.size > MAX_BYTES);
      if (bad) { setError(bad.size === 0 ? `El archivo "${bad.name}" está vacío.` : `El archivo "${bad.name}" supera los 12 MB.`); return; }
      setTcgFiles(picked.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })));
      return;
    }
    if (picked.length > 1) { setError(`Elige un solo ${FILE_NAME} (Mitos y Leyendas) o archivos cartas_incrementales_tcg_….json (TCGplayer), sin mezclarlos.`); return; }
    handleFile(picked[0]);
  };

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

  // Elegir otra edición para una carta que ya existe: el servidor revisa de nuevo con esa elección
  const chooseEdition = async (productId, groupId) => {
    const next = { ...overrides, [productId]: groupId };
    const id = ++runId.current;
    setRechecking(true);
    setError('');
    try {
      const res = await api.previewCatalogImport(data, next);
      if (id !== runId.current) return;
      setOverrides(next);
      setPlan(res);
    } catch (err) {
      if (id !== runId.current) return;
      setError(err.message || 'No se pudo aplicar la edición elegida.');
    } finally {
      if (id === runId.current) setRechecking(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.applyCatalogImport(data, plan.digest, overrides);
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
    handleFiles(event.dataTransfer.files);
  };

  const step = stage === 'pick' ? 0 : stage === 'done' ? 3 : 1;
  const loadable = stage === 'review' && plan?.canApply;

  if (tcgFiles) return <TcgCatalogImport files={tcgFiles} onReset={reset} />;

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
              <SvgIcon name="upload_file" translate="no" aria-hidden="true" className="text-[34px]" />
            </span>
            <span className="mt-5 text-lg font-extrabold text-[#12315f]">{dragging ? 'Suelta los archivos aquí' : 'Arrastra cartas_incrementales.json o los archivos del catálogo TCG'}</span>
            <span className="mt-1.5 text-sm text-slate-600">o toca para buscarlos en tu equipo. El catálogo de TCGplayer viene en varios archivos cartas_incrementales_tcg_….json: elígelos todos juntos.</span>
            <span className="mt-5 inline-flex h-11 items-center rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white">Elegir archivo</span>
            <input id="catalog-file" ref={inputRef} type="file" multiple accept=".json,application/json" className="sr-only" onChange={(event) => handleFiles(event.target.files)} />
          </label>
          <div className="mt-4 rounded-2xl border border-[#dbe3f0] bg-white p-4 text-sm leading-relaxed text-slate-600">
            <p className="font-bold text-slate-800">Dónde está el archivo</p>
            <p className="mt-1">Lo genera Carpetazo Update al exportar el catálogo local, en la carpeta <b className="break-words text-slate-800">Reportes › BaseDatos › año › mes › día › …_respaldo_catalogo_local</b>.</p>
            <p className="mt-2">Se acepta un archivo llamado <b className="text-slate-800">{FILE_NAME}</b> (Mitos y Leyendas) o los archivos <b className="text-slate-800">cartas_incrementales_tcg_….json</b> del catálogo de TCGplayer. Antes de agregar nada, el servidor los revisa y te muestra qué cambiaría.</p>
          </div>
        </>
      )}

      {stage === 'reviewing' && (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#dbe3f0] bg-white p-4" role="status">
            <ButtonSpinner tone="dark" className="!h-5 !w-5 !border-[#1e40af]/25 !border-t-[#1e40af]" />
            <p className="text-sm font-bold text-slate-700">Revisando {file?.name}… comparando con la base y comprobando las imágenes.</p>
          </div>
          <ListSkeleton rows={4} label="Revisando archivo" />
        </div>
      )}

      {stage === 'review' && plan && (
        <div className="pb-24 sm:pb-0">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#dbe3f0] bg-white p-3 pl-4">
            <SvgIcon name="description" translate="no" aria-hidden="true" className="text-[26px] text-[#1e40af]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{file?.name}</p>
              <p className="truncate text-xs text-slate-500">{sizeLabel(file?.size || 0)}{plan.generatedAt ? ` · generado ${dateTime(plan.generatedAt)}` : ''}</p>
            </div>
            <button type="button" onClick={reset} className="h-10 shrink-0 rounded-full px-4 text-sm font-bold text-[#1e40af] transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-blue-50">Cambiar</button>
          </div>

          <CatalogImportReview plan={plan} busy={rechecking} onChooseEdition={chooseEdition} />

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe3f0] bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-3xl gap-2 sm:justify-end">
              <button type="button" onClick={reset} className="h-12 flex-1 rounded-full border-2 border-slate-300 bg-white px-6 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 sm:flex-none">Cancelar</button>
              <button type="button" disabled={!loadable || rechecking} onClick={() => setConfirming(true)} className="h-12 flex-[1.6] rounded-full bg-[#facc15] px-7 text-sm font-extrabold text-[#12315f] transition-[filter,transform,opacity] duration-150 active:scale-[0.97] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none">
                {loadable ? `Cargar ${plan.counts.new + plan.counts.updated} ${plan.counts.new + plan.counts.updated === 1 ? 'cambio' : 'cambios'}` : 'Nada que cargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="mod-row-in rounded-3xl border border-emerald-200 bg-white p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><SvgIcon name="check_circle" translate="no" aria-hidden="true" className="text-[36px]" /></span>
          <h3 className="mt-4 text-xl font-extrabold text-[#12315f]">{result.created === 0 && !result.updated ? 'No había cambios' : [result.created > 0 && `${result.created === 1 ? '1 carta nueva' : `${result.created} cartas nuevas`}`, result.updated > 0 && `${result.updated === 1 ? '1 corrección' : `${result.updated} correcciones`}`].filter(Boolean).join(' y ') + ' cargadas'}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{result.existing > 0 ? `${result.existing} ${result.existing === 1 ? 'carta no tenía cambios' : 'cartas no tenían cambios'}. ` : ''}La carga quedó registrada en la auditoría.</p>
          <button type="button" onClick={reset} className="mt-6 h-12 rounded-full bg-[#12315f] px-7 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af]">Cargar otro archivo</button>
        </div>
      )}

      {confirming && plan && <ConfirmDialog count={plan.counts.new} updates={plan.counts.updated} busy={busy} onCancel={() => setConfirming(false)} onConfirm={apply} />}
    </section>
  );
}
