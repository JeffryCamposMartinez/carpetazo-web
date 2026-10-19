import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { storedCardId } from '../../utils/mylIdentity';
import { normalizeCardLanguage } from '../../utils/cardLanguage';
import { ButtonSpinner } from '../ui/LoadingState';
import { useToast } from '../ui/ToastProvider';

// Juego de la ficha del catálogo (nombre que se muestra) → clave de la carpeta
const FOLDER_TCG = { 'Pokémon': 'Pokemon', 'Mitos y Leyendas': 'Mitos y Leyendas', 'One Piece': 'OnePiece', Magic: 'Magic', 'Yu-Gi-Oh!': 'YuGiOh', Riftbound: 'Riftbound' };
const field = 'mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-800 outline-none focus:border-[#1e40af] sm:text-[15px]';

const productIdOf = (card) => String(card.tcgProductId || card.payload?.productId || card.payload?.external?.productId || '').replace(/^(tcgcsv|myl):/, '');

// «Agregar a mi carpeta» desde una ficha del catálogo: elige carpeta del mismo juego, precio y cantidad, y la guarda con los datos de la ficha.
export default function AddToFolderModal({ card, refPrice, onClose }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const folderTcg = FOLDER_TCG[card.game] || 'Pokemon';
  const [folders, setFolders] = useState(null);
  const [folderId, setFolderId] = useState('');
  const [price, setPrice] = useState(refPrice ? String(Math.round(refPrice)) : '');
  const [stock, setStock] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const firstField = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.getMyFolders().then((res) => {
      if (cancelled) return;
      const mine = (res.folders || []).filter((folder) => folder.tcg === folderTcg || (folderTcg === 'Pokemon' && folder.tcg === 'Pokemon_Japan'));
      setFolders(mine);
      setFolderId(mine[0]?.id || '');
    }).catch(() => { if (!cancelled) setFolders([]); });
    return () => { cancelled = true; };
  }, [folderTcg]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    firstField.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, folders]);

  const language = normalizeCardLanguage(card.language);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const folder = folders.find((row) => row.id === folderId);
      await api.addCard(folderId, {
        tcgId: storedCardId(folder?.tcg || folderTcg, productIdOf(card)),
        name: card.name,
        price: Number(price),
        stock: Number(stock),
        imageUrl: card.imageUrl || '',
        data: { set: card.setName || 'Unknown', rarity: 'Unknown', language, number: '' }
      });
      showToast(`${card.name} agregada a «${folder?.name || 'tu carpeta'}»`, { type: 'success', action: { label: 'Ver carpeta', run: () => navigate(`/carpeta/${folderId}`) } });
      onClose();
    } catch (err) {
      if (err.code === 'card_identity_conflict') setError({ text: 'Ya tienes esta carta, en este idioma, en esa carpeta. Cambia su cantidad desde la carpeta.', link: `/carpeta/${folderId}`, linkLabel: 'Abrir la carpeta' });
      else if (String(err.code || '').startsWith('plan_')) setError({ text: err.message, link: '/planes', linkLabel: 'Ver planes' });
      else setError({ text: err.message || 'No se pudo agregar la carta.' });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-folder-title" onClick={(event) => event.stopPropagation()} className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3">
          {card.imageUrl && <img src={card.imageUrl} alt="" referrerPolicy="no-referrer" className="h-20 w-auto shrink-0 rounded-lg object-contain shadow" />}
          <div className="min-w-0 flex-1">
            <h2 id="add-folder-title" className="text-lg font-black leading-tight text-[#12315f]">Agregar a mi carpeta</h2>
            <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-700">{card.name}</p>
            <p className="line-clamp-1 text-xs text-slate-500">{[card.setName, language === 'English' ? 'Inglés' : language === 'Spanish' ? 'Español' : language === 'Japanese' ? 'Japonés' : language].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">close</span></button>
        </div>

        {folders === null && <p role="status" className="py-8 text-center text-sm font-semibold text-slate-500">Cargando tus carpetas…</p>}
        {folders && folders.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-slate-700">Aún no tienes una carpeta de {card.game}. Crea una y vuelve a agregar esta carta.</p>
            <Link to="/dashboard" onClick={onClose} className="mt-4 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Ir a mis carpetas</Link>
          </div>
        )}
        {folders && folders.length > 0 && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm font-bold text-slate-700">Carpeta
              <select ref={firstField} value={folderId} onChange={(event) => setFolderId(event.target.value)} required className={field}>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-bold text-slate-700">Precio (CLP)
                <input type="number" inputMode="numeric" min="1" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} className={field} />
              </label>
              <label className="block text-sm font-bold text-slate-700">Cantidad
                <input type="number" inputMode="numeric" min="1" max="100000" step="1" required value={stock} onChange={(event) => setStock(event.target.value)} className={field} />
              </label>
            </div>
            {refPrice > 0 && <p className="text-xs text-slate-500">Precio de referencia de mercado: ${Math.round(refPrice).toLocaleString('es-CL')}. Es solo una guía; puedes poner el tuyo.</p>}
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
                {error.text} {error.link && <Link to={error.link} onClick={onClose} className="underline">{error.linkLabel}</Link>}
              </p>
            )}
            <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#12315f] active:scale-[0.98] disabled:opacity-60">
              {busy ? <><ButtonSpinner /> Guardando…</> : <><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">add_circle</span> Agregar a mi carpeta</>}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
