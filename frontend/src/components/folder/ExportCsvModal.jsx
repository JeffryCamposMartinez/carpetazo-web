import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { saveDownload } from '../../utils/saveDownload';
import { useToast } from '../ui/ToastProvider';
import { ButtonSpinner } from '../ui/LoadingState';
import LiquidTabs from '../ui/LiquidTabs';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';

const TCG_NAMES = { 'Mitos y Leyendas': 'Mitos y Leyendas', Pokemon: 'Pokémon', Pokemon_Japan: 'Pokémon Japón', OnePiece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Lorcana: 'Lorcana', Digimon: 'Digimon' };
const label = 'mb-1 block text-sm font-extrabold text-[#12315f]';

// Exportar el inventario a CSV: todas las carpetas juntas o solo una (la que se elija)
export default function ExportCsvModal({ onClose }) {
  const { showToast } = useToast();
  const [folders, setFolders] = useState(null);
  const [scope, setScope] = useState('all'); // 'all' | 'one'
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getMyFolders()
      .then((response) => { if (!cancelled) { const mine = response.folders || []; setFolders(mine); setFolderId(mine[0]?.id || ''); } })
      .catch(() => { if (!cancelled) { setFolders([]); setError('No se pudieron cargar tus carpetas.'); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const options = (folders || []).map((folder) => ({ value: folder.id, label: `${folder.name} · ${TCG_NAMES[folder.tcg] || folder.tcg}${folder._count?.cards !== undefined ? ` · ${folder._count.cards}` : ''}` }));
  const ready = folders !== null && !busy && (scope === 'all' ? folders.length > 0 : Boolean(folderId));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { blob, name } = await api.downloadInventory(scope === 'one' ? folderId : undefined);
      saveDownload(blob, name);
      showToast(scope === 'one' ? 'Carpeta exportada' : 'Inventario exportado', 'success');
      onClose();
    } catch (failure) {
      setError(failure.message || 'No se pudo exportar.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-[#08122a]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="export-csv-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_30px_60px_-20px_rgba(8,18,42,0.7)] sm:rounded-3xl">
        <div className="relative shrink-0 border-b-4 border-[#facc15] bg-[#12315f] px-5 pb-4 pt-5 text-white">
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">
            <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[22px]" />
          </button>
          <h2 id="export-csv-title" className="flex items-center gap-2 pr-10 text-lg font-black leading-tight"><SvgIcon name="download" translate="no" aria-hidden="true" className="shrink-0 text-[22px] text-[#facc15]" />Exportar CSV</h2>
          <p className="mt-1 text-sm font-medium text-blue-100">Elige qué quieres descargar.</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {folders === null ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500" role="status">Cargando tus carpetas…</p>
          ) : folders.length === 0 ? (
            <p className="py-4 text-center text-sm font-semibold text-slate-600">{error || 'Todavía no tienes carpetas para exportar.'}</p>
          ) : (
            <>
              <div>
                <span className={label}>¿Qué exportar?</span>
                <LiquidTabs
                  ariaLabel="Qué exportar"
                  layout="inline"
                  options={[{ value: 'all', label: 'Todas las carpetas' }, { value: 'one', label: 'Una carpeta' }]}
                  value={scope}
                  onChange={setScope}
                  className="gap-0.5 rounded-2xl border border-blue-100 bg-white p-1 shadow-sm"
                  buttonClassName="flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold"
                  indicatorClassName="rounded-xl border-b-[3px] border-[#b88f00] bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.55)]"
                  activeTextClassName="text-[#1a1400]"
                  inactiveTextClassName="text-[#12315f]/70 hover:text-[#12315f]"
                />
                <p className="mt-1.5 text-xs font-medium text-slate-500">{scope === 'all' ? `Un solo archivo con las cartas de tus ${folders.length} ${folders.length === 1 ? 'carpeta' : 'carpetas'}.` : 'Un archivo solo con las cartas de la carpeta que elijas.'}</p>
              </div>
              {scope === 'one' && (
                <div>
                  <span className={label}>Carpeta</span>
                  <ThemedSelect value={folderId} onChange={setFolderId} options={options} icon="folder" ariaLabel="Carpeta a exportar" disabled={busy} />
                </div>
              )}
            </>
          )}
          {error && folders?.length > 0 && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={submit} disabled={!ready} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#12315f] text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <><ButtonSpinner />Exportando…</> : <><SvgIcon name="download" translate="no" aria-hidden="true" className="text-[20px]" />{scope === 'one' ? 'Exportar carpeta' : 'Exportar todo'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
