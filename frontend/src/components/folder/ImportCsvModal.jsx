import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { parseCardsCsv } from '../../utils/csvImport';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';
import { ButtonSpinner } from '../ui/LoadingState';

const BATCH = 300; // el servidor recibe las filas en tandas de este tamaño
const REASONS = { invalid: 'datos inválidos', notFound: 'no está en el catálogo', ambiguous: 'hay varias ediciones posibles', limit: 'supera el límite de tu plan' };
const TCG_NAMES = { 'Mitos y Leyendas': 'Mitos y Leyendas', Pokemon: 'Pokémon', Pokemon_Japan: 'Pokémon Japón', OnePiece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Lorcana: 'Lorcana', Digimon: 'Digimon' };
const label = 'mb-1 block text-sm font-extrabold text-[#12315f]';

// Importar cartas a una carpeta desde un CSV (TCGplayer, TCGmatch o la exportación de Carpetazo)
export default function ImportCsvModal({ onClose }) {
  const [folders, setFolders] = useState(null);
  const [folderId, setFolderId] = useState('');
  const [parsed, setParsed] = useState(null); // { fileName, rows, withIds, copies } | { error }
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.getMyFolders().then((response) => {
      if (cancelled) return;
      const mine = (response.folders || []).filter((folder) => TCG_NAMES[folder.tcg]);
      setFolders(mine);
      setFolderId(mine[0]?.id || '');
    }).catch(() => { if (!cancelled) setFolders([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setResult(null);
    setError('');
    setParsed({ ...parseCardsCsv(await file.text(), file.size), fileName: file.name });
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    setProgress(0);
    const total = { created: 0, merged: 0, skipped: [], skippedCount: 0 };
    try {
      for (let start = 0; start < parsed.rows.length; start += BATCH) {
        const response = await api.importCards(folderId, parsed.rows.slice(start, start + BATCH));
        total.created += response.created;
        total.merged += response.merged;
        total.skippedCount += response.skippedCount;
        total.skipped.push(...response.skipped);
        setProgress(Math.min(start + BATCH, parsed.rows.length));
      }
      setResult(total);
    } catch (failure) {
      // Lo que ya se guardó en tandas anteriores se informa igual
      if (total.created || total.merged) setResult(total);
      setError(String(failure.code || '').startsWith('plan_') ? failure.message : (failure.message || 'No se pudo importar el archivo.'));
    } finally {
      setBusy(false);
    }
  };

  const options = (folders || []).map((folder) => ({ value: folder.id, label: `${folder.name} · ${TCG_NAMES[folder.tcg]}` }));
  const ready = parsed?.rows && folderId && !busy && !result;

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-[#08122a]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="import-csv-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_30px_60px_-15px_rgba(8,18,42,0.7)] sm:rounded-3xl">
        <div className="relative shrink-0 border-b-4 border-[#facc15] bg-[#12315f] px-5 pb-4 pt-5 text-white">
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-40"><SvgIcon name="close" className="text-[22px]" /></button>
          <h2 id="import-csv-title" className="flex items-center gap-2 pr-10 text-lg font-black leading-tight"><SvgIcon name="upload" className="shrink-0 text-[22px] text-[#facc15]" />Importar cartas desde CSV</h2>
          <p className="mt-1 text-sm font-medium text-blue-100">Archivo exportado de TCGplayer, TCGmatch o de Carpetazo.</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {folders === null ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500" role="status">Cargando tus carpetas…</p>
          ) : folders.length === 0 ? (
            <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-[#12315f]">Primero crea una carpeta del juego de tus cartas (Pokémon, Magic, One Piece…) y vuelve a importar.</p>
          ) : (
            <>
              <div>
                <span className={label}>Carpeta de destino</span>
                <ThemedSelect value={folderId} onChange={setFolderId} options={options} icon="folder" ariaLabel="Carpeta de destino" disabled={busy || Boolean(result)} />
                <p className="mt-1 text-xs font-medium text-slate-500">Las cartas se buscan en el catálogo de ese juego.</p>
              </div>

              <div>
                <span className={label}>Archivo CSV</span>
                <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={pickFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
                <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#12315f]/25 bg-blue-50/50 px-4 py-3 text-sm font-extrabold text-[#12315f] transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-60 [@media(hover:hover)]:hover:border-[#1e40af] [@media(hover:hover)]:hover:bg-blue-50">
                  <SvgIcon name="upload" className="shrink-0 text-[20px] text-[#1e40af]" />
                  <span className="min-w-0 truncate">{parsed?.fileName || 'Elegir archivo'}</span>
                </button>
                {parsed?.error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{parsed.error}</p>}
                {parsed?.rows && (
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    <strong className="text-[#12315f]">{parsed.rows.length.toLocaleString('es-CL')}</strong> {parsed.rows.length === 1 ? 'carta lista' : 'cartas listas'} · {parsed.copies.toLocaleString('es-CL')} {parsed.copies === 1 ? 'copia' : 'copias'}
                    {parsed.withIds < parsed.rows.length && <span className="block text-xs font-medium text-slate-500">{parsed.rows.length - parsed.withIds} sin ID de TCGplayer: se buscan por nombre y número.</span>}
                  </p>
                )}
              </div>
            </>
          )}

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}{String(error).includes('plan') && <> <Link to="/planes" className="underline">Ver planes</Link></>}</p>}

          {result && (
            <div role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
              <p className="font-extrabold">{result.created + result.merged > 0 ? 'Importación lista' : 'No se importó ninguna carta'}</p>
              <ul className="mt-1 list-inside list-disc font-medium">
                <li>{result.created.toLocaleString('es-CL')} {result.created === 1 ? 'carta nueva' : 'cartas nuevas'}</li>
                {result.merged > 0 && <li>{result.merged.toLocaleString('es-CL')} {result.merged === 1 ? 'carta que ya tenías sumó cantidad' : 'cartas que ya tenías sumaron cantidad'}</li>}
                {result.skippedCount > 0 && <li>{result.skippedCount.toLocaleString('es-CL')} sin importar</li>}
              </ul>
              {result.skipped.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs font-medium text-emerald-900/80">
                  {result.skipped.slice(0, 30).map((item, index) => <li key={`${item.line}-${index}`} className="truncate">Fila {item.line}: {item.name || 'sin nombre'} — {REASONS[item.reason] || item.reason}</li>)}
                  {result.skippedCount > 30 && <li>…y {(result.skippedCount - 30).toLocaleString('es-CL')} más</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4">
          {result ? (
            <>
              <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-blue-200 bg-white text-sm font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] [@media(hover:hover)]:hover:bg-blue-50">Cerrar</button>
              <Link to={`/carpeta/${folderId}`} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#facc15] text-sm font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:bg-[#eab308]">Ver carpeta</Link>
            </>
          ) : (
            <button type="button" onClick={submit} disabled={!ready} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#12315f] text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 disabled:opacity-50 [@media(hover:hover)]:hover:bg-[#1e40af]">
              {busy ? <><ButtonSpinner />Importando {progress.toLocaleString('es-CL')} de {parsed.rows.length.toLocaleString('es-CL')}…</> : 'Importar cartas'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
