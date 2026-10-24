import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { storedCardId } from '../../utils/mylIdentity';
import { normalizeCardLanguage } from '../../utils/cardLanguage';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';
import { ButtonSpinner } from '../ui/LoadingState';
import { useToast } from '../ui/ToastProvider';
import { ReferencePriceBox } from '../folder/ReferencePrice';
import { NO_IMAGE_CARD_URL, onCardImageError, tcgplayerCardImage } from '../../utils/cardShape';

// Juego de la ficha del catálogo (nombre que se muestra) → clave de la carpeta
const FOLDER_TCG = { 'Pokémon': 'Pokemon', 'Mitos y Leyendas': 'Mitos y Leyendas', 'One Piece': 'OnePiece', Magic: 'Magic', 'Yu-Gi-Oh!': 'YuGiOh', Riftbound: 'Riftbound', Lorcana: 'Lorcana', Digimon: 'Digimon' };
const NEW_FOLDER = '__new__';
const LANGUAGE_OPTIONS = [{ value: 'English', label: 'Inglés' }, { value: 'Spanish', label: 'Español' }, { value: 'Japanese', label: 'Japonés' }];
const label = 'mb-1 block text-sm font-extrabold text-[#12315f]';
const box = 'flex h-12 w-full items-center rounded-xl border-2 border-[#12315f]/15 bg-white shadow-sm transition-[border-color,box-shadow] duration-150 focus-within:border-[#1e40af] focus-within:shadow-[0_0_0_3px_rgba(30,64,175,0.15)]';
const bare = 'min-w-0 flex-1 border-0 bg-transparent px-3 shadow-none focus:border-0 focus:shadow-none focus:ring-0 focus:ring-offset-0 text-base font-bold text-[#12315f] outline-none placeholder:font-medium placeholder:text-slate-500 sm:text-[15px]';
const stepButton = 'flex h-full w-10 shrink-0 items-center justify-center text-[#1e40af] transition-colors hover:bg-blue-50 active:bg-blue-100 disabled:text-[#12315f]/30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:bg-blue-50';

const productIdOf = (card) => String(card.tcgProductId || card.payload?.productId || card.payload?.external?.productId || '').replace(/^(tcgcsv|myl):/, '');

// Con el plan de la persona: ¿le queda espacio para crear una carpeta más? (si no se sabe, se deja intentar: el servidor decide)
const canCreateFolder = (planState) => {
  const plan = planState?.plan;
  if (!plan) return true;
  const usage = planState.usage || {};
  if (plan.folders !== null && plan.folders !== undefined && (usage.folders || 0) >= plan.folders) return false;
  return true;
};

// «Agregar a mi carpeta» desde una ficha del catálogo, sin salir de la página: elige una carpeta del mismo juego (o crea una nueva),
// usa un precio de referencia si quiere, y fija precio, cantidad y un alias opcional.
export default function AddToFolderModal({ card, variants = [], onClose }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const folderTcg = FOLDER_TCG[card.game] || 'Pokemon';
  const [folders, setFolders] = useState(null);
  const [mayCreate, setMayCreate] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [alias, setAlias] = useState('');
  const [price, setPrice] = useState(''); // empieza vacío: el precio de referencia se aplica solo al pulsar «Usar»
  const [stock, setStock] = useState('1');
  const [cardLanguage, setCardLanguage] = useState(() => (LANGUAGE_OPTIONS.some((option) => option.value === normalizeCardLanguage(card.language)) ? normalizeCardLanguage(card.language) : 'English'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const firstField = useRef(null);
  const bumpStock = (delta) => setStock((current) => String(Math.min(100000, Math.max(1, (parseInt(current, 10) || 1) + delta))));

  useEffect(() => {
    let cancelled = false;
    api.getMyFolders().then((res) => {
      if (cancelled) return;
      const mine = (res.folders || []).filter((folder) => folder.tcg === folderTcg || (folderTcg === 'Pokemon' && folder.tcg === 'Pokemon_Japan'));
      const allowed = canCreateFolder(res.planState);
      setMayCreate(allowed);
      setFolders(mine);
      setFolderId(mine[0]?.id || (allowed ? NEW_FOLDER : ''));
    }).catch(() => { if (!cancelled) { setFolders([]); setMayCreate(false); } });
    return () => { cancelled = true; };
  }, [folderTcg]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const languageName = LANGUAGE_OPTIONS.find((option) => option.value === cardLanguage)?.label || cardLanguage;
  const creating = folderId === NEW_FOLDER;
  const noRoom = folders && folders.length === 0 && !mayCreate;
  const options = [
    ...(folders || []).map((folder) => ({ value: folder.id, label: folder.name })),
    ...(mayCreate ? [{ value: NEW_FOLDER, label: `Crear una carpeta nueva de ${card.game}` }] : [])
  ];

  // Usar un precio de referencia: el precio y, si no hay un alias propio, el nombre del acabado (Normal, Reverse Holofoil…)
  const useReference = (clp, variant) => {
    setPrice(String(clp));
    const known = (variants || []).map((item) => item.name);
    if (variant?.name && (!alias.trim() || known.includes(alias.trim()))) setAlias(variant.name);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    let targetId = folderId;
    let targetName = folders.find((row) => row.id === folderId)?.name;
    let created = false;
    try {
      if (creating) {
        const response = await api.createFolder({ name: newName.trim(), tcg: folderTcg, color: 'blue', isPublic: newPublic });
        targetId = response.folder.id;
        targetName = response.folder.name;
        created = true;
      }
      await api.addCard(targetId, {
        tcgId: storedCardId(folderTcg, productIdOf(card)),
        name: card.name,
        price: Number(price),
        stock: Number(stock),
        imageUrl: card.imageUrl || '',
        data: { pseudoName: alias.trim(), set: card.setName || 'Unknown', rarity: 'Unknown', language: folderTcg === 'Mitos y Leyendas' ? 'Spanish' : cardLanguage, number: '' }
      });
      showToast(`${card.name} agregada a «${targetName || 'tu carpeta'}»${created ? ' (carpeta nueva)' : ''}`, { type: 'success', action: { label: 'Ver carpeta', run: () => navigate(`/carpeta/${targetId}`) } });
      onClose();
    } catch (err) {
      if (created) {
        // La carpeta ya existe: se deja elegida para que un nuevo intento solo agregue la carta
        setFolders((previous) => [...(previous || []), { id: targetId, name: targetName, tcg: folderTcg }]);
        setFolderId(targetId);
      }
      if (err.code === 'card_identity_conflict') setError({ text: 'Ya tienes esta carta, en este idioma, en esa carpeta. Cambia su cantidad desde la carpeta.', link: `/carpeta/${targetId}`, linkLabel: 'Abrir la carpeta' });
      else if (String(err.code || '').startsWith('plan_')) setError({ text: err.message, link: '/planes', linkLabel: 'Ver planes' });
      else setError({ text: err.message || 'No se pudo agregar la carta.' });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-[#08122a]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-folder-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_30px_60px_-15px_rgba(8,18,42,0.7)] sm:rounded-3xl">
        <div className="relative shrink-0 border-b-4 border-[#facc15] bg-[#12315f] px-5 pb-4 pt-5 text-white">
          <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"><SvgIcon name="close" className="text-[22px]" /></button>
          <div className="flex items-center gap-3.5 pr-10">
            <img src={card.imageUrl || tcgplayerCardImage(card) || NO_IMAGE_CARD_URL} onError={(e) => onCardImageError(e, tcgplayerCardImage(card))} alt="" referrerPolicy="no-referrer" className="h-24 w-auto shrink-0 rounded-lg object-contain shadow-[0_8px_18px_-6px_rgba(0,0,0,0.6)] ring-2 ring-white/20" />
            <div className="min-w-0">
              <h2 id="add-folder-title" className="flex items-center gap-1.5 text-lg font-black leading-tight"><SvgIcon name="folder" className="shrink-0 text-[22px] text-[#facc15]" />Agregar a mi carpeta</h2>
              <p className="mt-1.5 line-clamp-2 text-sm font-extrabold leading-snug">{card.name}</p>
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-blue-100">{[card.setName, languageName].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {folders === null && <p role="status" className="py-8 text-center text-sm font-semibold text-slate-500">Cargando tus carpetas…</p>}
          {noRoom && (
            <div className="py-4 text-center">
              <p className="text-sm font-semibold text-slate-700">No tienes carpetas de {card.game} y tu plan no permite crear más. Cambia de plan o libera espacio para agregar esta carta.</p>
              <Link to="/planes" onClick={onClose} className="mt-4 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Ver planes</Link>
            </div>
          )}
          {folders && !noRoom && (
            <form onSubmit={submit} className="space-y-4">
              {folders.length === 0 && <p className="rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-semibold text-[#12315f]">Aún no tienes una carpeta de {card.game}. Créala aquí y la carta se guarda en ella.</p>}
              <div>
                <span className={label}>{creating ? 'Dónde guardarla' : 'Carpeta'}</span>
                <ThemedSelect value={folderId} onChange={setFolderId} options={options} icon="folder" ariaLabel="Carpeta" innerRef={firstField} />
              </div>
              {creating && (
                <div className="space-y-3 rounded-2xl bg-[#f3f7ff] p-3.5 ring-1 ring-[#1e40af]/15">
                  <label className="block">
                    <span className={label}>Nombre de la carpeta</span>
                    <span className={box}><input value={newName} onChange={(event) => setNewName(event.target.value)} required maxLength={60} placeholder={`Mi colección de ${card.game}`} className={bare} /></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm font-bold text-[#12315f]">
                    <input type="checkbox" checked={newPublic} onChange={(event) => setNewPublic(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1e40af]" />
                    <span>Hacerla pública<span className="block text-xs font-medium text-slate-500">Aparece en Carpetas y puede recibir pedidos. Puedes cambiarlo después.</span></span>
                  </label>
                </div>
              )}

              {(variants === null || variants.length > 0) && <ReferencePriceBox variants={variants} source="tcgplayer" currentPrice={price} onUse={useReference} />}

              <label className="block">
                <span className={label}>Alias o apodo <span className="font-medium text-slate-500">(opcional)</span></span>
                <span className={box}><input value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={60} placeholder="Ej: Charizard de Ash" className={bare} /></span>
              </label>

              {folderTcg !== 'Mitos y Leyendas' && (
                <div>
                  <span className={label}>Idioma de la carta</span>
                  <ThemedSelect value={cardLanguage} onChange={setCardLanguage} options={LANGUAGE_OPTIONS} ariaLabel="Idioma de la carta" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={label}>Precio (CLP)</span>
                  <span className={box}>
                    <span aria-hidden="true" className="pl-3 text-base font-extrabold text-[#12315f]/50">$</span>
                    <input type="number" inputMode="numeric" min="1" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} className={`${bare} pl-1.5`} />
                  </span>
                </label>
                <div>
                  <span className={label}>Cantidad</span>
                  <span className={`${box} overflow-hidden`}>
                    <button type="button" onClick={() => bumpStock(-1)} disabled={(parseInt(stock, 10) || 1) <= 1} aria-label="Una copia menos" className={stepButton}><SvgIcon name="remove" className="text-[20px]" /></button>
                    <input type="number" inputMode="numeric" min="1" max="100000" step="1" required value={stock} onChange={(event) => setStock(event.target.value)} aria-label="Cantidad" className={`${bare} px-0 text-center`} />
                    <button type="button" onClick={() => bumpStock(1)} aria-label="Una copia más" className={stepButton}><SvgIcon name="add" className="text-[20px]" /></button>
                  </span>
                </div>
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800">
                  <SvgIcon name="error" className="mt-px shrink-0 text-[18px]" />
                  <span>{error.text} {error.link && <Link to={error.link} onClick={onClose} className="underline">{error.linkLabel}</Link>}</span>
                </p>
              )}
              <button type="submit" disabled={busy || !folderId} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] text-sm font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(30,64,175,0.8)] transition-[background-color,transform] duration-150 hover:bg-[#12315f] active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2">
                {busy ? <><ButtonSpinner /> Guardando…</> : <><SvgIcon name="add_circle" className="text-[20px]" /> {creating ? 'Crear carpeta y agregar' : 'Agregar a mi carpeta'}</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
