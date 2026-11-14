import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import LiquidTabs from '../ui/LiquidTabs';
import SvgIcon from '../ui/SvgIcon';
import { api } from '../../services/api';
import PickCardSheet from './PickCardSheet';
import { INDEX_GAME, LANG_CODE, LANG_ORDER, baseName, cardId, fromIndex, plain } from './pickCard';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';
import useCardScanner, { SCAN_GAMES } from '../../hooks/useCardScanner';

const GUIDE_COLOR = { '': '#ffcb05', scan: '#00d2ff', ok: '#34d399', mid: '#fb923c' };
const SAVED_GAME = 'carpetazo.scanGame';
const readGame = () => { try { const saved = localStorage.getItem(SAVED_GAME); return SCAN_GAMES.some((game) => game.value === saved) ? saved : 'all'; } catch (_error) { return 'all'; } };

// Juego de la sección Cartas (filtro `tcg`) según la categoría del catálogo
gsap.registerPlugin(CustomEase);
CustomEase.create('ios', '.28,.7,.1,1'); // la curva de apertura de iOS: arranca rápido y se asienta sin rebote
const K = 0.55; // el visor parte a esta escala (con el recorte del tamaño del botón) y llega a 1
// Recorte y origen del visor para que, a escala K, lo visible sea justo el botón de cámara
const morph = (origin, w, h) => {
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  const at = (v, o) => o + (v - o) / K;
  return { t: at(origin.top, oy), l: at(origin.left, ox), r: w - at(origin.left + origin.width, ox), b: h - at(origin.top + origin.height, oy), rad: Math.min(origin.width, origin.height) / 2 / K, origin: `${ox}px ${oy}px` };
};
// x e y van de 0 (forma del botón) a 1 (pantalla completa); el ancho se adelanta al alto para que no se estire como una tira
const clip = (m, x, y) => `inset(${(m.t * (1 - y)).toFixed(1)}px ${(m.r * (1 - x)).toFixed(1)}px ${(m.b * (1 - y)).toFixed(1)}px ${(m.l * (1 - x)).toFixed(1)}px round ${(m.rad * (1 - Math.max(x, y))).toFixed(1)}px)`;
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const buzz = () => { try { navigator.vibrate?.(30); } catch (_error) { /* sin vibración */ } };
const GAME_OF = { 3: 'Pokémon', 100: 'Pokémon', 85: 'Pokémon', 1: 'Magic', 2: 'Yu-Gi-Oh!', 63: 'Digimon', 68: 'One Piece', 71: 'Lorcana', 89: 'Riftbound', 99: 'Mitos y Leyendas' };
// «Ultra Ball - 213/217 (Cosmos Holo)» → «Ultra Ball»: se busca por nombre para ver todas las ediciones de la carta

// Visor de la cámara: apuntas a una carta, se detecta sola y, en cuanto se reconoce, se abre la búsqueda de la sección Cartas (ordenada por parecido).
// Aquí no se muestran resultados: solo la cámara, el marco, el estado y el juego a buscar.
// batch = { games, label, onCard } → modo carpeta: juego fijo, el visor sigue abierto tras cada carta y una bandeja cuenta las agregadas
export default function ScanModal({ onClose, batch, origin }) {
  const navigate = useNavigate();
  const closeRef = useRef(null);
  const videoRef = useRef(null);
  const areaRef = useRef(null);
  const guideRef = useRef(null);
  const [game, setGame] = useState(readGame);
  const [tray, setTray] = useState([]); // lote: cartas que ya entraron a la cola de la carpeta
  const [flash, setFlash] = useState(0); // sube con cada carta reconocida: dispara el pulso breve del marco
  const trayId = useRef(0); // clave estable por miniatura: quitar una no reinicia la animación de las demás
  const offered = useRef(new Set()); // cartas cuya foto ya se aportó en esta sesión (una sola vez por carta)
  const games = useMemo(() => (batch ? batch.games : SCAN_GAMES.find((item) => item.value === game)?.ids || ''), [batch, game]);
  // Como al abrir una app en el iPhone: el visor crece desde el botón de cámara y al cerrar vuelve a él
  const zoom = origin && origin.width ? origin : null;
  const rootRef = useRef(null);
  const ui = () => [...rootRef.current.querySelectorAll('[data-ui]')];
  // Apertura: del botón al visor completo. El recorte pasa de la forma del botón a pantalla completa, el contenido se cruza con el icono y la interfaz entra al final
  useLayoutEffect(() => {
    if (!zoom || calm()) return undefined;
    const root = rootRef.current;
    const m = morph(zoom, root.offsetWidth, root.offsetHeight);
    const launch = root.querySelector('[data-launch]');
    const pos = { x: 0, y: 0 };
    const paint = () => { root.style.clipPath = clip(m, pos.x, pos.y); };
    paint();
    const tl = gsap.timeline({ onComplete: () => gsap.set(root, { clearProps: 'all' }) });
    tl.fromTo(root, { scale: K, transformOrigin: m.origin, willChange: 'transform, clip-path' }, { scale: 1, duration: 0.55, ease: 'ios' }, 0)
      .to(pos, { x: 1, duration: 0.4, ease: 'ios', onUpdate: paint }, 0)
      .to(pos, { y: 1, duration: 0.58, ease: 'ios', onUpdate: paint }, 0)
      .fromTo(launch, { opacity: 1 }, { opacity: 0, duration: 0.16, ease: 'power1.out' }, 0.03)
      .fromTo(ui(), { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.04, clearProps: 'opacity' }, 0.18);
    return () => { tl.kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState(''); // '' · closing (animación de salida en curso)
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  // Cierra con animación de salida (sin ella si la persona pidió menos movimiento)
  const requestClose = (after = onClose) => {
    if (phase === 'closing') return;
    setPhase('closing');
    if (zoom && !calm()) {
      // Vuelve al botón: la interfaz se va primero, el recorte se cierra sobre el botón y el icono lo sustituye al llegar
      const root = rootRef.current;
      const m = morph(zoom, root.offsetWidth, root.offsetHeight);
      const launch = root.querySelector('[data-launch]');
      const pos = { x: 1, y: 1 };
      const paint = () => { root.style.clipPath = clip(m, pos.x, pos.y); };
      paint();
      gsap.timeline({ onComplete: after })
        .to(ui(), { opacity: 0, duration: 0.1, ease: 'power1.in' }, 0)
        .set(root, { transformOrigin: m.origin, willChange: 'transform, clip-path' }, 0)
        .to(root, { scale: K, duration: 0.44, ease: 'ios' }, 0.02)
        .to(pos, { y: 0, duration: 0.38, ease: 'ios', onUpdate: paint }, 0.02)
        .to(pos, { x: 0, duration: 0.46, ease: 'ios', onUpdate: paint }, 0.02)
        .to(launch, { opacity: 1, duration: 0.14, ease: 'power1.in' }, 0.27)
        .to(root, { opacity: 0, duration: 0.06, ease: 'none' }, 0.44);
      return;
    }
    later(after, calm() ? 0 : 260);
  };
  useBodyScrollLock();
  const [menuId, setMenuId] = useState(null); // carta de la bandeja cuyo menú de versiones está abierto
  const [pick, setPick] = useState(null); // lote: carta reconocida a la espera de que la persona elija su impresión exacta { result, options }
  useEscape(true, () => (pick ? closePick() : menuId ? setMenuId(null) : requestClose()));
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  // El foco no sale del visor con Tab (el resto de la página queda detrás)
  const trapTab = (event) => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll('button:not([disabled])')];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  // La carta reconocida vuela del marco a su lugar en la bandeja
  const flyToTray = (item, id) => {
    const from = guideRef.current?.getBoundingClientRect();
    if (!from || !item.image || calm()) return false;
    const ghost = document.createElement('img');
    ghost.src = item.image;
    ghost.alt = '';
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, objectFit: 'cover', borderRadius: '14px', zIndex: '30', pointerEvents: 'none', opacity: '0', boxShadow: '0 18px 40px -10px rgba(0,0,0,.7)' });
    rootRef.current?.appendChild(ghost);
    const start = () => requestAnimationFrame(() => {
      const target = rootRef.current?.querySelector(`[data-tray-id="${id}"]`)?.getBoundingClientRect();
      if (!target) { ghost.remove(); return; }
      const dx = target.left + target.width / 2 - (from.left + from.width / 2);
      const dy = target.top + target.height / 2 - (from.top + from.height / 2);
      gsap.timeline({ onComplete: () => ghost.remove() })
        .to(ghost, { opacity: 1, scale: 1.04, duration: 0.14, ease: 'power2.out' })
        .to(ghost, { x: dx, y: dy, scale: target.width / from.width, borderRadius: 8, duration: 0.5, ease: 'power3.inOut' }, '>0.04')
        .to(ghost, { opacity: 0, duration: 0.08, ease: 'none' });
    });
    (ghost.decode ? ghost.decode().catch(() => {}) : Promise.resolve()).then(() => requestAnimationFrame(start));
    return true;
  };
  // Otras ediciones o impresiones de la carta reconocida, sin repetir, para el menú de versiones
  const versionsOf = (result) => {
    const seen = new Set();
    return [...(result.top || []), ...(result.same || [])].filter((card) => { const id = `${card.categoryId}:${card.productId}`; if (card.productId == null || seen.has(id)) return false; seen.add(id); return true; }).slice(0, 14);
  };
  // Sin imagen oficial: la foto del escaneo se aporta sola (se endereza, se sube y va a Moderación al guardar la carta)
  const contribute = async (added) => {
    if (!(added.noImage && added.photo?.blob && !offered.current.has(added.key))) return;
    offered.current.add(added.key);
    const done = new Map((await batch.onShare([added])).map(({ from, to }) => [from, to]));
    if (done.size === 0) offered.current.delete(added.key); // no se pudo subir: se reintenta con el próximo escaneo de esa carta
    setTray((previous) => previous.map((item) => (done.has(item.queueKey) ? { ...item, queueKey: done.get(item.queueKey), shared: true, uploading: false, photo: null } : item.uploading && item.key === added.key ? { ...item, uploading: false } : item)));
  };
  const changeVersion = async (item, candidate) => {
    setMenuId(null);
    if (String(candidate.productId) === item.key) return;
    const next = await batch.onChangeVersion(item, candidate, { language: { code: item.lang }, photo: item.scanPhoto });
    if (!next) return;
    buzz();
    const uploading = Boolean(next.noImage && next.photo?.blob && !offered.current.has(next.key));
    setTray((previous) => previous.map((entry) => (entry.trayId === item.trayId ? { ...entry, ...next, uploading, fly: false } : entry)));
    contribute(next);
  };
  // Impresiones de la misma carta (mismo nombre base) que ya trae el motor, la reconocida primero
  const pickOptions = (result) => {
    const first = result.top?.[0];
    if (!first || first.productId == null) return [];
    const key = plain(baseName(first.name) || first.name);
    const rest = versionsOf(result).filter((card) => cardId(card) !== cardId(first) && plain(baseName(card.name) || card.name) === key);
    return [first, ...rest];
  };
  // Lo que ya había primero; después lo del catálogo: primero el idioma de la carta reconocida y luego los demás
  const mergeOptions = (base, extra) => {
    const seen = new Set(base.map(cardId));
    const mine = LANG_CODE[base[0]?.categoryId];
    const more = extra.filter((card) => card.productId != null && !seen.has(cardId(card)) && seen.add(cardId(card)));
    const rank = (card) => { const code = LANG_CODE[card.categoryId]; return code === mine ? -1 : LANG_ORDER.indexOf(code); };
    return [...base, ...more.map((card, index) => ({ card, index })).sort((x, y) => rank(x.card) - rank(y.card) || x.index - y.index).map(({ card }) => card)].slice(0, 40);
  };
  const pickSeq = useRef(0); // invalida respuestas del catálogo si la hoja ya se cerró
  const closePick = () => { pickSeq.current += 1; setPick(null); };
  // Al reconocer una carta se abre «Selecciona tu carta»; mientras esté abierta no entran otras
  const handleBatchCard = async (result) => {
    if (pick) return;
    const options = pickOptions(result);
    if (options.length === 0) { await addPicked(result); return; }
    buzz();
    const seq = ++pickSeq.current;
    const first = options[0];
    const game = INDEX_GAME[first.categoryId];
    setPick({ result, options, loading: Boolean(game), lang: 'all' });
    if (!game) return;
    const name = baseName(first.name) || first.name;
    const extra = [];
    try {
      for (let page = 1; page <= 3; page += 1) {
        const response = await api.searchTcgIndex(name, game, page, '', LANG_CODE[first.categoryId] !== undefined);
        if (seq !== pickSeq.current) return;
        extra.push(...(response?.cards || []).map(fromIndex).filter((card) => plain(baseName(card.name) || card.name) === plain(name)));
        if (!response?.cards?.length || page >= (response.pages || 1)) break;
      }
    } catch (_error) { /* se quedan las impresiones del motor */ }
    if (seq === pickSeq.current) setPick((current) => current && { ...current, options: mergeOptions(current.options, extra), loading: false });
  };
  const choosePick = (card) => {
    const { result, options } = pick;
    closePick();
    const code = LANG_CODE[card.categoryId]; // elegir una impresión en otro idioma cambia el idioma de la carta agregada
    addPicked({ ...result, ...(code ? { language: { ...(result.language || {}), code: code === 'JP' ? 'ja' : code.toLowerCase() } } : {}), top: [card, ...(result.top || []).filter((item) => cardId(item) !== cardId(card))], same: options.filter((item) => cardId(item) !== cardId(card)) });
  };
  const searchManually = () => {
    const name = baseName(pick.result.top?.[0]?.name) || pick.result.top?.[0]?.name || '';
    closePick();
    requestClose(() => { onClose(); batch.onManualSearch?.(name); });
  };
  const addPicked = async (result) => {
    const added = await batch.onCard(result);
    if (!added) return;
    const uploading = Boolean(added.noImage && added.photo?.blob && !offered.current.has(added.key));
    const id = ++trayId.current;
    const fly = Boolean(added.image) && !calm() && Boolean(guideRef.current);
    setTray((previous) => [...previous, { ...added, uploading, trayId: id, fly, versions: versionsOf(result), lang: result.language?.code, scanPhoto: result.photo || null }]);
    setFlash((value) => value + 1);
    if (fly) flyToTray(added, id);
    buzz();
    contribute(added);
  };
  const { message, guide, view, cameraError, retryCamera } = useCardScanner({ videoRef, areaRef, guideRef, games, enabled: true, batch: Boolean(batch), onCard: handleBatchCard });
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
  useEffect(() => { if (!batch && view.done && best) { buzz(); setFlash((value) => value + 1); later(() => requestClose(() => openSearch(best)), 650); } }, [view.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickGame = (value) => { setGame(value); try { localStorage.setItem(SAVED_GAME, value); } catch (_error) { /* sin almacenamiento: no se recuerda el juego */ } };
  const menuItem = menuId == null ? null : tray.find((entry) => entry.trayId === menuId && (entry.versions?.length || 0) > 1) || null;
  const color = GUIDE_COLOR[guide] || GUIDE_COLOR[''];
  const corner = 'absolute h-[34px] w-[34px] transition-[border-color,filter] duration-300';
  const live = !cameraError;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Buscar con la cámara" onKeyDown={trapTab} ref={rootRef} className={`${zoom ? 'scan-zoom' : 'scan-root'} fixed inset-0 z-[1300] overflow-hidden bg-[#02070f] text-slate-100 ${phase === 'closing' ? 'scan-out' : ''}`}>
      <style>{`
        @keyframes scan-in{from{opacity:0}to{opacity:1}}
        @keyframes frame-in{from{opacity:0;transform:scale(1.07)}to{opacity:1;transform:none}}
        @keyframes scan-sweep{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(100cqh - 100%))}}
        @keyframes lock-bump{0%{transform:scale(1)}40%{transform:scale(.965)}100%{transform:scale(1)}}
        @keyframes guide-pulse{0%{opacity:.6;transform:scale(1)}100%{opacity:0;transform:scale(1.06)}}
        @keyframes check-pop{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}40%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
        @keyframes check-draw{from{stroke-dashoffset:26}to{stroke-dashoffset:0}}
        @keyframes msg-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes dot-ping{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.6);opacity:0}}
        @keyframes dock-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes cam-in{from{opacity:.4;transform:scale(1.1);filter:blur(14px)}to{opacity:1;transform:none;filter:blur(0)}}
        @keyframes scan-out-root{to{opacity:0}}
        @keyframes scan-out-frame{to{opacity:0;transform:scale(.9)}}
        @keyframes scan-out-dock{to{opacity:0;transform:translateY(18px)}}
        @keyframes search-ring{0%{opacity:.7;transform:translate(-50%,-50%) scale(.35)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
        @keyframes pill-shimmer{from{transform:translateX(-120%)}to{transform:translateX(220%)}}
        .scan-root{animation:scan-in 220ms cubic-bezier(.23,1,.32,1)}
        .scan-zoom.scan-out,.scan-zoom .scan-dock,.scan-zoom .scan-cam{animation:none}
        .scan-zoom.scan-out .scan-frame,.scan-zoom.scan-out .scan-dock{animation:none}
        .scan-cam{animation:cam-in 640ms cubic-bezier(.23,1,.32,1)}
        .scan-out{animation:scan-out-root 260ms cubic-bezier(.4,0,1,1) forwards;pointer-events:none}
        .scan-out .scan-frame{animation:scan-out-frame 260ms cubic-bezier(.4,0,1,1) forwards}
        .scan-out .scan-dock{animation:scan-out-dock 220ms cubic-bezier(.4,0,1,1) forwards}
        @keyframes corner-in{from{opacity:0;transform:scale(1.9)}to{opacity:1;transform:none}}
        @keyframes gloss{0%{opacity:0;transform:translateX(0) skewX(-18deg)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateX(420%) skewX(-18deg)}}
        .scan-frame{animation:frame-in 520ms cubic-bezier(.23,1,.32,1)}
        .scan-corners>span{animation:corner-in 560ms cubic-bezier(.23,1,.32,1) backwards}
        .scan-corners>span:nth-child(2){animation-delay:80ms}.scan-corners>span:nth-child(3){animation-delay:160ms}.scan-corners>span:nth-child(4){animation-delay:240ms}
        .scan-gloss{opacity:0;animation:gloss 1000ms cubic-bezier(.4,0,.2,1) 380ms forwards}
        .scan-dock{animation:dock-in 420ms cubic-bezier(.23,1,.32,1) 60ms backwards}
        .scan-glass{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.04)),rgba(7,21,38,.62);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 10px 30px -12px rgba(0,0,0,.6);-webkit-backdrop-filter:blur(22px) saturate(1.5);backdrop-filter:blur(22px) saturate(1.5)}
        @media (prefers-reduced-motion:reduce){.scan-root,.scan-zoom.scan-out,.scan-cam,.scan-out,.scan-out .scan-frame,.scan-out .scan-dock,.search-ring,.pill-shimmer,.scan-frame,.scan-corners>span,.scan-gloss,.scan-dock,.scan-sweep,.guide-pulse,.lock-bump,.msg-in,.dot-ping{animation:none!important}.check-pop{display:none}}
      `}</style>

      {/* La cámara ocupa toda la pantalla; el marco se mide contra este contenedor */}
      {zoom && (
        <div data-launch aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 bg-[#0b1f3a]">
          <span className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-white" style={{ left: zoom.left + zoom.width / 2, top: zoom.top + zoom.height / 2 }}><SvgIcon name="photo_camera" translate="no" className="text-[26px]" /></span>
        </div>
      )}
      <div ref={areaRef} className="scan-cam absolute inset-0">
        <video ref={videoRef} playsInline muted autoPlay className="block h-full w-full object-cover" />
      </div>

      {live && (
        <div ref={guideRef} data-ui className="pointer-events-none absolute left-1/2 top-[46%] aspect-[63/88] w-[min(80vw,calc(58svh*63/88))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] shadow-[0_0_0_999px_rgba(2,9,20,0.6)]">
          <span className="scan-frame absolute inset-0"><span key={guide === 'ok' ? 'ok' : 'idle'} className="scan-corners absolute inset-0" style={guide === 'ok' ? { animation: 'lock-bump 320ms cubic-bezier(.23,1,.32,1)' } : undefined}>
            <span className={`${corner} -left-[2px] -top-[2px] rounded-tl-[22px] border-l-[3px] border-t-[3px]`} style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }} />
            <span className={`${corner} -right-[2px] -top-[2px] rounded-tr-[22px] border-r-[3px] border-t-[3px]`} style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }} />
            <span className={`${corner} -bottom-[2px] -left-[2px] rounded-bl-[22px] border-b-[3px] border-l-[3px]`} style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }} />
            <span className={`${corner} -bottom-[2px] -right-[2px] rounded-br-[22px] border-b-[3px] border-r-[3px]`} style={{ borderColor: color, filter: `drop-shadow(0 0 6px ${color})` }} />
          </span></span>
          {flash > 0 && <span key={`p${flash}`} className="guide-pulse absolute inset-0 rounded-[22px] border-[3px] border-[#34d399]" style={{ animation: 'guide-pulse 480ms cubic-bezier(.23,1,.32,1) forwards' }} />}
          {flash > 0 && (
            <span key={`c${flash}`} aria-hidden="true" className="check-pop absolute left-1/2 top-1/2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#34d399] opacity-0 shadow-[0_8px_30px_-6px_rgba(52,211,153,0.7)]" style={{ animation: 'check-pop 900ms cubic-bezier(.23,1,.32,1) forwards' }}>
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="#04281c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="26" style={{ animation: 'check-draw 320ms cubic-bezier(.23,1,.32,1) 120ms backwards' }} /></svg>
            </span>
          )}
          {guide === 'scan' && [0, 1].map((n) => <span key={n} aria-hidden="true" className="search-ring absolute left-1/2 top-1/2 aspect-square w-[90%] rounded-full border-2 border-[#00d2ff]" style={{ animation: 'search-ring 1.8s cubic-bezier(.23,1,.32,1) infinite', animationDelay: `${n * 0.9}s`, opacity: 0 }} />)}
          <span className="absolute inset-0 overflow-hidden rounded-[22px] [container-type:size]">
            <span aria-hidden="true" className="scan-gloss absolute inset-y-0 -left-[30%] w-[30%] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            {guide === 'scan' && <span className="scan-sweep absolute inset-x-[4%] top-0 h-14 will-change-transform" style={{ animation: 'scan-sweep 1.5s cubic-bezier(.65,0,.35,1) infinite', background: 'linear-gradient(180deg,transparent,rgba(0,210,255,.22) 70%,rgba(0,210,255,.85) 98%,rgba(255,255,255,.9) 100%)', borderRadius: '0 0 6px 6px' }} />}
          </span>
        </div>
      )}

      {cameraError && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#071526] px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffcb05]/15 text-[#ffcb05]"><SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="text-[28px]" /></span>
          <p className="max-w-xs text-[15px] font-semibold leading-snug text-slate-200">{cameraError}</p>
          <button type="button" onClick={retryCamera} className="h-11 rounded-full bg-[#ffcb05] px-6 text-sm font-extrabold text-[#1a1400] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Reintentar</button>
        </div>
      )}

      <button ref={closeRef} data-ui type="button" onClick={() => requestClose()} aria-label="Cerrar" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center scan-glass rounded-full text-white transition-[filter,transform] duration-150 hover:brightness-125 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">
        <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[24px]" />
      </button>

      {menuItem && <div aria-hidden="true" className="absolute inset-0 z-[5]" onClick={() => setMenuId(null)} />}
      <div data-ui className="scan-dock absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        {live && (
          <div role="status" className="scan-glass relative flex max-w-[92%] items-center gap-2.5 overflow-hidden rounded-full py-2 pl-3.5 pr-4 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {guide === 'scan' && <span className="dot-ping absolute inset-0 rounded-full" style={{ background: color, animation: 'dot-ping 1.1s cubic-bezier(0,0,.2,1) infinite' }} />}
              <span className="relative h-2.5 w-2.5 rounded-full transition-colors duration-300" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
            </span>
            {guide === 'scan' && <span aria-hidden="true" className="pill-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ animation: 'pill-shimmer 1.6s cubic-bezier(.4,0,.2,1) infinite' }} />}
            <span key={message} className="msg-in truncate" style={{ animation: 'msg-in 220ms cubic-bezier(.23,1,.32,1)' }}>{message}</span>
          </div>
        )}
        <AnimatePresence>
          {batch && menuItem && (
            <motion.div key={menuItem.trayId} role="menu" aria-label={`Versiones de ${menuItem.name}`} initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 6 }} transition={{ type: 'spring', duration: 0.36, bounce: 0.12 }} style={{ transformOrigin: 'bottom center' }} className="scan-glass relative z-10 flex max-h-[46svh] w-full max-w-xl flex-col overflow-hidden rounded-[22px]">
              <p className="shrink-0 px-4 pb-1.5 pt-3 text-xs font-bold text-slate-300">Versiones de {baseName(menuItem.name) || menuItem.name}</p>
              <ul className="min-h-0 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {menuItem.versions.map((version) => {
                  const current = String(version.productId) === menuItem.key;
                  return (
                    <li key={`${version.categoryId}:${version.productId}`}>
                      <button type="button" role="menuitemradio" aria-checked={current} onClick={() => changeVersion(menuItem, version)} className={`flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05] ${current ? 'bg-[#ffcb05]/15' : 'hover:bg-white/10'}`}>
                        <span className="flex h-[52px] w-[37px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#02070f] ring-1 ring-white/20">
                          {version.image ? <img src={version.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-400">?</span>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{version.set || version.group || 'Edición'}</span>
                          <span className="block truncate text-xs text-slate-300">{[version.number && `N.º ${version.number}`, version.rarity, version.lang].filter(Boolean).join(' · ')}</span>
                        </span>
                        {current && <SvgIcon name="check" translate="no" aria-hidden="true" className="shrink-0 text-[20px] text-[#ffcb05]" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
        {batch && tray.length > 0 && (
          <div className="scan-glass flex w-full max-w-xl items-center gap-2.5 rounded-[22px] p-2">
            <MotionConfig reducedMotion="user">
            <ul className="relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Cartas escaneadas">
              <AnimatePresence initial={false} mode="popLayout">
              {tray.map((item, index) => (
                <motion.li key={item.trayId} layout data-tray-id={item.trayId} initial={item.fly ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ type: 'spring', duration: 0.42, bounce: 0.2, delay: item.fly ? 0.56 : 0 }} className="relative h-[68px] w-12 shrink-0 rounded-lg bg-[#02070f] shadow-[0_6px_14px_-6px_rgba(0,0,0,.7)] ring-1 ring-white/25">
                  <button type="button" onClick={() => setMenuId(menuId === item.trayId ? null : item.trayId)} disabled={(item.versions?.length || 0) < 2} aria-haspopup="true" aria-expanded={menuId === item.trayId} aria-label={`Cambiar la versión de ${item.name}`} className="absolute inset-0 overflow-hidden rounded-lg transition-transform duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05] disabled:active:scale-100">
                  {item.image ? <img src={item.image} alt={item.name} title={item.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[10px]">?</span>}
                  {item.language && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[8px] font-bold uppercase text-white">{item.language}</span>}
                  </button>
                  <button type="button" onClick={() => removeScanned(index)} aria-label={`Quitar ${item.name}`} title="Quitar carta" className="absolute left-0 top-0 z-[1] flex h-7 w-7 items-center justify-center rounded-br-lg bg-black/75 before:absolute before:-bottom-2 before:-right-2 before:h-11 before:w-11 before:content-[''] text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">
                    <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[14px]" />
                  </button>
                  {item.uploading && <span role="status" aria-label="Subiendo foto" className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/55"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-[#ffcb05] motion-reduce:animate-none" /></span>}
                  {item.shared && <span className="absolute right-0 top-0 rounded-bl bg-[#ffcb05] px-1 text-[9px] font-extrabold text-[#1a1400]" title="Tu foto se ofrece a Moderación">✓</span>}
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
            </MotionConfig>
            <button type="button" onClick={() => requestClose()} className="h-11 shrink-0 rounded-full bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] px-5 text-sm font-extrabold text-[#1a1400] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.6)] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Listo ({tray.length})</button>
          </div>
        )}
        {batch ? (
          <p className="scan-glass rounded-full px-4 py-2 text-xs font-bold text-slate-200">{batch.label}</p>
        ) : (
        <LiquidTabs
          ariaLabel="Juego a buscar"
          layout="inline"
          options={SCAN_GAMES.map((item) => ({ value: item.value, label: item.label }))}
          value={game}
          onChange={pickGame}
          className="scan-glass w-full max-w-xl gap-0.5 overflow-x-auto rounded-[20px] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          buttonClassName="shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[13px] font-semibold"
          indicatorClassName="rounded-xl border-b-[3px] border-[#b88f00] bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.55)]"
          activeTextClassName="text-[#1a1400]"
          inactiveTextClassName="text-slate-300 hover:text-white"
        />
        )}
      </div>

      <PickCardSheet pick={batch ? pick : null} onClose={closePick} onChoose={choosePick} onLang={(value) => setPick((current) => current && { ...current, lang: value })} onManual={batch?.onManualSearch ? searchManually : null} />
    </div>,
    document.body
  );
}
