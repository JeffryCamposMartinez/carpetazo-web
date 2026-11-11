import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import LiquidTabs from '../ui/LiquidTabs';
import SvgIcon from '../ui/SvgIcon';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';
import useCardScanner, { SCAN_GAMES } from '../../hooks/useCardScanner';

const GUIDE_COLOR = { '': '#ffcb05', scan: '#00d2ff', ok: '#34d399', mid: '#fb923c' };
const SAVED_GAME = 'carpetazo.scanGame';
const readGame = () => { try { const saved = localStorage.getItem(SAVED_GAME); return SCAN_GAMES.some((game) => game.value === saved) ? saved : 'all'; } catch (_error) { return 'all'; } };

// Juego de la sección Cartas (filtro `tcg`) según la categoría del catálogo
const GAME_OF = { 3: 'Pokémon', 100: 'Pokémon', 85: 'Pokémon', 1: 'Magic', 2: 'Yu-Gi-Oh!', 63: 'Digimon', 68: 'One Piece', 71: 'Lorcana', 89: 'Riftbound', 99: 'Mitos y Leyendas' };
// «Ultra Ball - 213/217 (Cosmos Holo)» → «Ultra Ball»: se busca por nombre para ver todas las ediciones de la carta
const baseName = (name) => String(name || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+-\s+\S*\d\S*$/, '').trim();

// Visor de la cámara: apuntas a una carta, se detecta sola y, en cuanto se reconoce, se abre la búsqueda de la sección Cartas (ordenada por parecido).
// Aquí no se muestran resultados: solo la cámara, el marco, el estado y el juego a buscar.
// batch = { games, label, onCard } → modo carpeta: juego fijo, el visor sigue abierto tras cada carta y una bandeja cuenta las agregadas
export default function ScanModal({ onClose, batch }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const areaRef = useRef(null);
  const guideRef = useRef(null);
  const [game, setGame] = useState(readGame);
  const [tray, setTray] = useState([]); // lote: cartas que ya entraron a la cola de la carpeta
  const offered = useRef(new Set()); // cartas cuya foto ya se aportó en esta sesión (una sola vez por carta)
  const games = useMemo(() => (batch ? batch.games : SCAN_GAMES.find((item) => item.value === game)?.ids || ''), [batch, game]);
  useBodyScrollLock();
  useEscape(true, onClose);
  const handleBatchCard = async (result) => {
    const added = await batch.onCard(result);
    if (!added) return;
    setTray((previous) => [...previous, added]);
    // Sin imagen oficial: la foto del escaneo se aporta sola (se endereza, se sube y va a Moderación al guardar la carta)
    if (added.noImage && added.photo?.blob && !offered.current.has(added.key)) {
      offered.current.add(added.key);
      const done = new Map((await batch.onShare([added])).map(({ from, to }) => [from, to]));
      if (done.size === 0) offered.current.delete(added.key); // no se pudo subir: se reintenta con el próximo escaneo de esa carta
      setTray((previous) => previous.map((item) => (done.has(item.queueKey) ? { ...item, queueKey: done.get(item.queueKey), shared: true, photo: null } : item)));
    }
  };
  const { message, guide, view, cameraError } = useCardScanner({ videoRef, areaRef, guideRef, games, enabled: true, batch: Boolean(batch), onCard: handleBatchCard });
  const best = view.result?.top?.[0];
  const removeScanned = (index) => {
    batch.onRemove?.(tray[index]);
    setTray((previous) => previous.filter((_, position) => position !== index));
  };

  const openSearch = (card) => {
    const params = new URLSearchParams({ q: baseName(card.name) || card.name });
    if (GAME_OF[card.categoryId]) params.set('tcg', GAME_OF[card.categoryId]);
    // La búsqueda muestra primero lo más parecido a lo escaneado: la carta encontrada y, después, las demás por parecido
    const key = (item) => `${item.categoryId}:${item.productId}`;
    const scanOrder = [key(card), ...[...view.result.top, ...(view.result.same || [])].filter((item) => key(item) !== key(card)).sort((a, b) => b.score - a.score).map(key)].filter((value) => !value.includes('null'));
    onClose();
    navigate(`/cartas?${params.toString()}`, { state: { scanOrder } });
  };
  useEffect(() => { if (!batch && view.done && best) openSearch(best); }, [view.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickGame = (value) => { setGame(value); try { localStorage.setItem(SAVED_GAME, value); } catch (_error) { /* sin almacenamiento: no se recuerda el juego */ } };
  const color = GUIDE_COLOR[guide] || GUIDE_COLOR[''];
  const corner = 'absolute h-[30px] w-[30px] transition-colors duration-200';
  const live = !cameraError;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Buscar con la cámara" className="fixed inset-0 z-[1300] overflow-hidden bg-[#02070f] text-slate-100">
      <style>{'@keyframes scan-sweep{0%{top:3%}50%{top:96%}100%{top:3%}}'}</style>

      {/* La cámara ocupa toda la pantalla; el marco se mide contra este contenedor */}
      <div ref={areaRef} className="absolute inset-0">
        <video ref={videoRef} playsInline muted autoPlay className="block h-full w-full object-cover" />
      </div>

      {live && (
        <div ref={guideRef} className="pointer-events-none absolute left-1/2 top-[46%] aspect-[63/88] w-[min(80vw,calc(58svh*63/88))] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-[0_0_0_999px_rgba(2,9,20,0.55)]">
          <span className={`${corner} -left-[3px] -top-[3px] rounded-tl-2xl border-l-4 border-t-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
          <span className={`${corner} -right-[3px] -top-[3px] rounded-tr-2xl border-r-4 border-t-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
          <span className={`${corner} -bottom-[3px] -left-[3px] rounded-bl-2xl border-b-4 border-l-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
          <span className={`${corner} -bottom-[3px] -right-[3px] rounded-br-2xl border-b-4 border-r-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
          <span className="absolute inset-0 overflow-hidden rounded-2xl">
            {guide === 'scan' && <span className="absolute inset-x-[6%] h-0.5 bg-gradient-to-r from-transparent via-[#00d2ff] to-transparent shadow-[0_0_18px_3px_rgba(0,210,255,0.55)]" style={{ animation: 'scan-sweep 1.35s ease-in-out infinite' }} />}
          </span>
        </div>
      )}

      {cameraError && <p role="alert" className="absolute inset-0 flex items-center justify-center bg-[#071526] px-6 text-center text-sm font-semibold text-slate-200">{cameraError}</p>}

      <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#071526]/70 text-white backdrop-blur-md transition-[background-color,transform] duration-150 hover:bg-[#071526]/90 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">
        <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[24px]" />
      </button>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        {live && (
          <div role="status" className="flex max-w-[92%] items-center gap-2 overflow-hidden rounded-full border border-sky-300/15 bg-[#071526]/75 px-3.5 py-2 text-sm font-semibold backdrop-blur-md">
            <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
            <span className="truncate">{message}</span>
          </div>
        )}
        {batch && tray.length > 0 && (
          <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-sky-300/15 bg-[#071526]/80 p-2 backdrop-blur-md">
            <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Cartas escaneadas">
              {tray.map((item, index) => (
                <li key={`${item.key}-${index}`} className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[#02070f] ring-1 ring-white/20">
                  {item.image ? <img src={item.image} alt={item.name} title={item.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[10px]">?</span>}
                  {item.language && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[8px] font-bold uppercase text-white">{item.language}</span>}
                  <button type="button" onClick={() => removeScanned(index)} aria-label={`Quitar ${item.name}`} title="Quitar carta" className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-br-lg bg-black/75 text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">
                    <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[14px]" />
                  </button>
                  {item.shared && <span className="absolute right-0 top-0 rounded-bl bg-[#ffcb05] px-1 text-[9px] font-extrabold text-[#1a1400]" title="Tu foto se ofrece a Moderación">✓</span>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-full bg-[#ffcb05] px-4 text-sm font-extrabold text-[#1a1400] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Listo ({tray.length})</button>
          </div>
        )}
        {batch ? (
          <p className="rounded-full border border-sky-300/15 bg-[#071526]/80 px-4 py-2 text-xs font-bold text-slate-200 backdrop-blur-md">{batch.label}</p>
        ) : (
        <LiquidTabs
          ariaLabel="Juego a buscar"
          layout="inline"
          options={SCAN_GAMES.map((item) => ({ value: item.value, label: item.label }))}
          value={game}
          onChange={pickGame}
          className="w-full max-w-xl gap-0.5 overflow-x-auto rounded-2xl border border-sky-300/15 bg-[#071526]/80 p-1 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          buttonClassName="shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[13px] font-semibold"
          indicatorClassName="rounded-xl border-b-[3px] border-[#b88f00] bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.55)]"
          activeTextClassName="text-[#1a1400]"
          inactiveTextClassName="text-slate-300 hover:text-white"
        />
        )}
      </div>
    </div>,
    document.body
  );
}
