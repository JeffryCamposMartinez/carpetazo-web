import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import { ButtonSpinner } from '../ui/LoadingState';
import ThemedSelect from '../ui/ThemedSelect';

const SITE = 'https://carpetazo.cl';
// Solo se imprime la hoja de etiquetas; el resto de la página se oculta al imprimir
const PRINT_CSS = '@media print { body > *:not(.cz-print-labels) { display: none !important; } .cz-print-labels { display: block !important; } @page { margin: 10mm; } } @media screen { .cz-print-labels { display: none; } }';

// Etiquetas de precio con QR (llevan a la ficha de la carta) de una carpeta, listas para imprimir o guardar en PDF
export default function PriceLabels({ showToast }) {
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [labels, setLabels] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.getMyFolders().then((r) => setFolders(r.folders || [])).catch(() => {}); }, []);

  const build = async () => {
    if (!folderId) return;
    setBusy(true);
    try {
      const [{ folder }, qrLib] = await Promise.all([api.getFolder(folderId), import('qrcode-generator')]);
      const cards = (folder.cards || []).filter((c) => Number(c.stock) > 0).slice(0, 300);
      if (!cards.length) { showToast('Esa carpeta no tiene cartas con stock.', 'info'); return; }
      setLabels(cards.map((c) => {
        const qr = qrLib.default(0, 'M');
        qr.addData(`${SITE}/carta/${c.id}`);
        qr.make();
        return { id: c.id, name: c.name, set: c.data?.set && c.data.set !== 'Unknown' ? c.data.set : '', price: c.price, svg: qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true }) };
      }));
      setTimeout(() => window.print(), 300);
    } catch (error) {
      showToast(error.message || 'No se pudieron preparar las etiquetas', 'error');
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-black text-[#1a2b4b]">Etiquetas de precio con QR</h4>
      <p className="mb-2 text-xs text-slate-500">Elige una carpeta e imprime (o guarda como PDF) una etiqueta por carta con stock. El QR abre la carta en Carpetazo.</p>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[12rem] flex-1"><ThemedSelect value={folderId} onChange={setFolderId} options={[{ value: '', label: 'Elige una carpeta' }, ...folders.map((f) => ({ value: f.id, label: f.name }))]} ariaLabel="Carpeta para etiquetas" buttonClassName="!min-h-10 !rounded-xl" /></div>
        <button type="button" disabled={!folderId || busy} onClick={build} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#facc15] px-4 text-sm font-black text-[#12315f] transition hover:bg-yellow-300 active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner />}Imprimir etiquetas</button>
      </div>
      {labels && createPortal(
        <div className="cz-print-labels">
          <style>{PRINT_CSS}</style>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm', fontFamily: 'Arial, sans-serif' }}>
            {labels.map((l) => (
              <div key={l.id} style={{ border: '1px solid #12315f', borderRadius: '3mm', padding: '3mm', display: 'flex', gap: '3mm', alignItems: 'center', breakInside: 'avoid', height: '28mm' }}>
                <div style={{ width: '22mm', height: '22mm', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: l.svg }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '9pt', fontWeight: 700, color: '#12315f', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{l.name}</div>
                  {l.set && <div style={{ fontSize: '7pt', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.set}</div>}
                  <div style={{ fontSize: '14pt', fontWeight: 900, color: '#000' }}>{l.price ? formatCLP(l.price) : 'Consultar'}</div>
                  <div style={{ fontSize: '6pt', color: '#64748b' }}>carpetazo.cl</div>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
