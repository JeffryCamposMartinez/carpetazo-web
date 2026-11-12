import { useState } from 'react';
import { api } from '../../services/api';
import { saveDownload } from '../../utils/saveDownload';
import { useToast } from '../ui/ToastProvider';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import ImportCsvModal from './ImportCsvModal';

const buttonClass = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-600 shadow-sm transition-[background-color,transform] duration-150 hover:bg-gray-50 hover:text-[#1e40af] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-60 sm:gap-2 sm:px-4';

// Importar cartas a esta carpeta desde un CSV y exportar solo esta carpeta
export default function FolderCsvTools({ folderId, onImported }) {
  const { showToast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportFolder = async () => {
    setExporting(true);
    try {
      const { blob, name } = await api.downloadInventory(folderId);
      saveDownload(blob, name);
      showToast('Carpeta exportada', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo exportar la carpeta.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setImportOpen(true)} className={buttonClass}><SvgIcon name="upload" translate="no" aria-hidden="true" className="text-[18px]" /><span className="truncate">Importar CSV</span></button>
      <button type="button" onClick={exportFolder} disabled={exporting} className={buttonClass}>{exporting ? <ButtonSpinner tone="dark" /> : <SvgIcon name="download" translate="no" aria-hidden="true" className="text-[18px]" />}<span className="truncate">Exportar CSV</span></button>
      {importOpen && <ImportCsvModal folderId={folderId} onDone={onImported} onClose={() => setImportOpen(false)} />}
    </>
  );
}
