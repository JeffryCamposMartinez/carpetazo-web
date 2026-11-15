import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls } from 'motion/react';
import { api } from '../../services/api';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';
import { useToast } from '../ui/ToastProvider';
import StorePhotosEditor from './StorePhotosEditor';
import { parseCardLines, totalCards } from './sellCollection';

const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 };
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';

// «Vende tu colección»: la persona escribe su lista (o la pega desde un CSV), agrega fotos y la manda a la tienda
export default function SellCollectionModal({ username, storeName, games = [], onClose }) {
  const { showToast } = useToast();
  const [game, setGame] = useState(games[0] || '');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const items = useMemo(() => parseCardLines(text), [text]);
  const dragControls = useDragControls(); // en el celular la hoja se cierra arrastrándola hacia abajo desde la cabecera

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    setSending(true);
    try {
      await api.sendBuyRequest(username, { game, items, note, photos });
      showToast(`Lista enviada a ${storeName}. Te avisaremos cuando responda`, 'success');
      onClose();
    } catch (error) {
      showToast(error.message || 'No se pudo enviar la lista', 'error');
    } finally { setSending(false); }
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="sell-collection-title" initial={{ y: '100%' }} animate={{ y: 0, transition: SHEET_SPRING }} drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.03, bottom: 0.75 }} onDragEnd={(_e, info) => { if (info.offset.y > 110 || info.velocity.y > 520) onClose(); }} className="flex max-h-[92svh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.55)] sm:rounded-[28px]">
        <div onPointerDown={(e) => dragControls.start(e)} style={{ touchAction: 'none' }} className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden"><span className="h-1.5 w-10 rounded-full bg-slate-300" /></div>
        <header onPointerDown={(e) => dragControls.start(e)} style={{ touchAction: 'none' }} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-4 pt-1 sm:p-5">
          <div>
            <h2 id="sell-collection-title" className="text-lg font-extrabold text-[#12315f]">Vende tu colección a {storeName}</h2>
            <p className="text-sm text-slate-600">La tienda revisa tu lista y te responde con una oferta.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"><SvgIcon name="close" className="text-xl" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {games.length > 1 && (
            <div><span className="mb-1 block text-sm font-bold text-[#1a2b4b]">Juego</span>
              <ThemedSelect value={game} onChange={setGame} options={games.map((g) => ({ value: g, label: g }))} ariaLabel="Juego" buttonClassName="!min-h-11 !rounded-xl" />
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-[#1a2b4b]">Tus cartas, una por línea</span>
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'2x Charizard ex\nPikachu x3\nUmbreon VMAX'} className={`${field} py-2.5 font-mono text-[13px] leading-relaxed`} />
            <span className="mt-1 block text-xs text-slate-500">{items.length ? `${items.length} cartas distintas · ${totalCards(items)} en total` : 'Puedes pegar la columna de nombres de un CSV.'}</span>
          </label>
          <div><span className="mb-1 block text-sm font-bold text-[#1a2b4b]">Fotos (opcional)</span><StorePhotosEditor value={photos} onChange={setPhotos} uploadType="card" onError={(m) => showToast(m, 'error')} /></div>
          <label className="block"><span className="mb-1 block text-sm font-bold text-[#1a2b4b]">Nota (opcional)</span>
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Estado general, si están en fundas, cuándo puedes llevarlas…" className={`${field} py-2`} />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-100 px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} className="h-11 rounded-full px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={send} disabled={sending || !items.length} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1e40af] px-5 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{sending && <ButtonSpinner tone="dark" />}Enviar lista</button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body
  );
}
