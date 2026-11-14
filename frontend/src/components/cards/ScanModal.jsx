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

// Fila de opciones del panel de ajustes del escáner
function ScanChoice({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-left text-[12px] font-bold text-slate-300">{label}</span>
      <LiquidTabs
        ariaLabel={label}
        layout="inline"
        options={options}
        value={value}
        onChange={onChange}
        className="min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-2xl bg-black/25 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        buttonClassName="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-[12px] font-semibold"
        indicatorClassName="rounded-xl border-b-[3px] border-[#b88f00] bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.55)]"
        activeTextClassName="text-[#1a1400]"
        inactiveTextClassName="text-slate-300 hover:text-white"
      />
    </div>
  );
}

// Número de coleccionista sin ceros ni total: «088/088» y «88» son el mismo
const leadNumber = (value) => String(value || '').match(/\d+/)?.[0]?.replace(/^0+(?=\d)/, '') || '';

const GUIDE_COLOR = { '': '#ffcb05', scan: '#00d2ff', ok: '#34d399', mid: '#fb923c' };
const SAVED_GAME = 'carpetazo.scanGame';
const SAVED_PREFS = 'carpetazo.scanPrefs';
const FINISH_OPTIONS = ['', 'Normal', 'Holofoil', 'Reverse Holofoil'];
const LANG_OPTIONS = ['auto', '3', '100', '85']; // ids de categoría del catálogo: inglés, español, japonés
const readPrefs = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PREFS) || '{}');
    return { lang: LANG_OPTIONS.includes(saved.lang) ? saved.lang : 'auto', finish: FINISH_OPTIONS.includes(saved.finish) ? saved.finish : '', quick: saved.quick === true };
  } catch (_error) { return { lang: 'auto', finish: '', quick: false }; }
};
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
// sin batch → modo búsqueda (barra de búsqueda): mismo visor, mismos ajustes y misma hoja «Selecciona tu carta», pero la carta elegida se busca en «Cartas» en vez de agregarse
export default function ScanModal({ onClose, batch, origin }) {
  const navigate = useNavigate();
  const closeRef = useRef(null);
  const videoRef = useRef(null);
  const areaRef = useRef(null);
  const guideRef = useRef(null);
  const [game, setGame] = useState(readGame);
  const [prefs, setPrefs] = useState(readPrefs); // ajustes del escáner de carpeta: idioma, acabado y agregar sin preguntar
  const [prefsOpen, setPrefsOpen] = useState(false);
  const searchMode = !batch;
  const baseGames = batch ? batch.games : SCAN_GAMES.find((item) => item.value === game)?.ids || '';
  const isPokemonBatch = baseGames === '3,100,85';
  const [tray, setTray] = useState(() => (batch?.initial || []).map((item, index) => ({ ...item, trayId: index + 1, lang: item.language ? item.language.toLowerCase().replace('jp', 'ja') : undefined }))); // lote: cartas que ya entraron a la cola de la carpeta
  const [flash, setFlash] = useState(0); // sube con cada carta reconocida: dispara el pulso breve del marco
  const trayId = useRef(batch?.initial?.length || 0); // clave estable por miniatura: quitar una no reinicia la animación de las demás
  const offered = useRef(new Set()); // cartas cuya foto ya se aportó en esta sesión (una sola vez por carta)
  const games = useMemo(() => (isPokemonBatch && prefs.lang !== 'auto' ? prefs.lang : baseGames), [baseGames, isPokemonBatch, prefs.lang]);
  const setPref = (changes) => setPrefs((current) => { const next = { ...current, ...changes }; try { localStorage.setItem(SAVED_PREFS, JSON.stringify(next)); } catch (_error) { /* sin almacenamiento: no se recuerdan */ } return next; });
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
  const [pick, setPick] = useState(null); // lote: carta reconocida a la espera de que la persona elija su impresión exacta { result, options }
  useEscape(true, () => (pick ? dismissPick() : requestClose()));
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
  // Cambiar la impresión o el acabado de una carta de la bandeja desde «Selecciona tu carta»
  const changeVersion = async (item, candidate) => {
    const code = LANG_CODE[candidate.categoryId];
    const lang = code ? (code === 'JP' ? 'ja' : code.toLowerCase()) : item.lang;
    if (String(candidate.productId) === item.key && (candidate.finish || '') === (item.finish || '')) return;
    const next = await batch.onChangeVersion(item, candidate, { language: { code: lang }, photo: item.scanPhoto });
    if (!next) return;
    buzz();
    const uploading = Boolean(next.noImage && next.photo?.blob && !offered.current.has(next.key));
    setTray((previous) => previous.map((entry) => (entry.trayId === item.trayId ? { ...entry, ...next, lang, uploading, fly: false } : entry)));
    contribute(next);
  };
  // La misma carta en los otros idiomas de Pokémon: con los tres idiomas juntos el motor suele devolver solo el de la carta reconocida,
  // así que la misma foto se consulta una vez por idioma y se queda con la impresión que lleva el mismo número
  const twinScans = async (result, first, categories) => {
    if (!result.photo?.blob || categories.length === 0) return [];
    const scans = await Promise.all(categories.map((id) => api.scanCard(result.photo.blob, { games: String(id) }).catch(() => null)));
    return scans.flatMap((scan) => {
      const top = scan?.top?.[0];
      if (!top || top.productId == null || (top.score ?? 0) < 0.85 || leadNumber(top.number) === '' || leadNumber(top.number) !== leadNumber(first.number)) return [];
      const topKey = plain(baseName(top.name) || top.name);
      return [...(scan.top || []), ...(scan.same || [])].filter((card) => card.productId != null && plain(baseName(card.name) || card.name) === topKey);
    });
  };
  // Impresiones de la misma carta (mismo nombre base) que ya trae el motor, la reconocida primero
  const pickOptions = (result) => {
    const first = result.top?.[0];
    if (!first || first.productId == null) return [];
    const key = plain(baseName(first.name) || first.name);
    // Misma carta: el mismo nombre o, con otro nombre (una carta en español contra su versión inglesa), el mismo número y casi el mismo parecido visual
    const lead = leadNumber;
    const sameCard = (card) => plain(baseName(card.name) || card.name) === key || (lead(card.number) !== '' && lead(card.number) === lead(first.number) && (first.score ?? 0) - (card.score ?? 0) <= 0.06);
    const rest = versionsOf(result).filter((card) => cardId(card) !== cardId(first) && sameCard(card));
    return [first, ...rest];
  };
  // La reconocida primero. El resto, por idioma (primero el de la reconocida) y, dentro de cada idioma, en el mismo orden que el listado en inglés:
  // la versión en español (o japonés) de una impresión queda en el mismo lugar que la inglesa
  const mergeOptions = (base, extra, order = new Map()) => {
    const seen = new Set();
    const all = [];
    [...base, ...extra].forEach((card) => { if (card.productId == null || seen.has(cardId(card))) return; seen.add(cardId(card)); all.push(card); });
    const mine = LANG_CODE[base[0]?.categoryId];
    const rank = (card) => { const code = LANG_CODE[card.categoryId]; return code === mine ? -1 : LANG_ORDER.indexOf(code); };
    const [first, ...rest] = all;
    const place = (card) => (card.productId === first.productId ? -1 : order.has(card.productId) ? order.get(card.productId) : 1e6 + (card.apiIndex ?? 1e5)); // la gemela de la reconocida va primera en cada idioma
    const sorted = [first, ...rest.sort((x, y) => rank(x) - rank(y) || place(x) - place(y))];
    // Impresiones de la misma edición y número (la normal y su versión «Cosmos Holo» de liga) van seguidas, la normal primero
    const slot = (card) => (card.groupId != null && card.number ? `${LANG_CODE[card.categoryId]}|${card.groupId}|${card.number}` : null);
    const groups = new Map();
    sorted.forEach((card) => { const key = slot(card); if (key) groups.set(key, [...(groups.get(key) || []), card]); });
    const emitted = new Set();
    const together = sorted.flatMap((card) => {
      const key = slot(card);
      if (!key || groups.get(key).length < 2) return [card];
      if (emitted.has(key)) return [];
      emitted.add(key);
      return [...groups.get(key)].sort((x, y) => Number(/\)\s*$/.test(x.name)) - Number(/\)\s*$/.test(y.name)));
    });
    return together.slice(0, 200);
  };
  const pickSeq = useRef(0); // invalida respuestas del catálogo si la hoja ya se cerró
  const closePick = () => { pickSeq.current += 1; setPick(null); };
  // Registro de lo que elige la persona frente a lo que propuso el motor (no cambia nada en pantalla; sirve para medir correcciones)
  const logChoice = (kind, result, card, quick = false) => {
    const top = result?.engineTop || result?.top?.[0];
    const int = (value) => (Number.isInteger(value) ? value : undefined);
    const rank = card ? versionsOf(result).findIndex((item) => cardId(item) === cardId(card)) : -1;
    api.logScanChoice({ kind, games, topCategoryId: int(top?.categoryId), topProductId: int(top?.productId), topScore: typeof top?.score === 'number' ? top.score : undefined, chosenCategoryId: int(card?.categoryId), chosenProductId: int(card?.productId), chosenFinish: card?.finish || '', rank: rank >= 0 ? rank : undefined, quick });
  };
  const dismissPick = () => { if (pick) logChoice('dismiss', pick.result, null); closePick(); };
  // Al reconocer una carta se abre «Selecciona tu carta»; mientras esté abierta no entran otras
  const handleBatchCard = (result) => openPick(result, null);
  // replace = carta de la bandeja que se cambia al elegir (al tocarla); null = carta recién reconocida
  const openPick = async (result, replace) => {
    if (pick) return;
    const options = pickOptions(result);
    if (options.length === 0) { if (searchMode) searchFrom(result.top?.[0], result, []); else if (!replace) await addPicked(result); return; }
    // «Agregar sin preguntar»: solo con una carta clara, sin otras impresiones cercanas y, en Pokémon, con el idioma fijado (si no, podría ser la misma carta en otro idioma)
    if (!replace && prefs.quick && !prefs.finish && options.length === 1 && (result.top?.[0]?.score ?? 0) >= 0.9 && (!isPokemonBatch || prefs.lang !== 'auto')) { logChoice('confirm', result, result.top[0], true); if (searchMode) searchFrom(result.top[0], result, []); else await addPicked(result); return; }
    buzz();
    const seq = ++pickSeq.current;
    const first = options[0];
    const game = INDEX_GAME[first.categoryId];
    setPick({ result, options, replace, loading: Boolean(game), lang: LANG_CODE[first.categoryId] || 'all' });
    if (!game) return;
    const name = baseName(first.name) || first.name;
    // Un pedido por idioma (en paralelo) y por páginas hasta agotar el catálogo: así no se pierden impresiones ni las de liga
    const wanted = LANG_CODE[first.categoryId] !== undefined ? ['en', 'es', 'ja'] : [''];
    const keyOf = (card) => plain(baseName(card.name) || card.name);
    const fetchLang = async (lang, text) => {
      const found = [];
      let position = 0; // orden en que el catálogo entrega las cartas de este idioma
      try {
        for (let page = 1; page <= 8; page += 1) {
          const response = await api.searchTcgIndex(text, game, page, '', false, lang);
          if (seq !== pickSeq.current) return found;
          found.push(...(response?.cards || []).map((card) => ({ ...fromIndex(card), apiIndex: position += 1 })));
          if (!response?.cards?.length || page >= (response.pages || 1)) break;
        }
      } catch (_error) { /* de ese idioma quedan las que ya llegaron */ }
      return found;
    };
    const loadNames = (names) => Promise.all(names.map((text) => Promise.all(wanted.map((lang) => fetchLang(lang, text)))));
    // Fase 1 (rápida): el catálogo con el nombre reconocido y el de las otras versiones que trajo el motor
    const names = [...new Set([name, ...options.slice(1).map((card) => baseName(card.name) || card.name)])].slice(0, 3);
    const groups = await loadNames(names);
    if (seq !== pickSeq.current) return;
    const streams = groups[0];
    // El nombre en español no siempre es el del catálogo en inglés («Energía Psychic Telepática» / «Telepathic Psychic Energy»): si ninguna carta lleva el nombre
    // reconocido, las que llegaron del idioma español son las ligadas a ella y su nombre se usa también para traer las impresiones en inglés y japonés
    const spanishAt = wanted.indexOf('es');
    let alias = '';
    if (spanishAt >= 0 && !streams[spanishAt].some((card) => keyOf(card) === plain(name))) {
      const counts = new Map();
      streams[spanishAt].forEach((card) => counts.set(keyOf(card), { text: baseName(card.name) || card.name, total: (counts.get(keyOf(card))?.total || 0) + 1 }));
      alias = [...counts.values()].sort((x, y) => y.total - x.total)[0]?.text || '';
    }
    const aliasStreams = alias ? await Promise.all(wanted.filter((lang) => lang !== 'es').map((lang) => fetchLang(lang, alias))) : [];
    if (seq !== pickSeq.current) return;
    const accepted = new Set([...names.map(plain), ...(alias ? [plain(alias)] : [])]);
    const extra = [...groups.flat(2), ...aliasStreams].flat().filter((card) => accepted.has(keyOf(card)));
    const englishList = groups.map((group) => group[0]).find((list) => list?.length) || aliasStreams.flat().filter((card) => LANG_CODE[card.categoryId] === 'EN');
    const order = new Map(englishList.map((card) => [card.productId, card.apiIndex])); // el orden del listado en inglés
    let merged = mergeOptions(options, extra, order);
    // Una carta reconocida en español (TCGdex) tiene otro nombre que la inglesa: el catálogo dice cuál es su gemela inglesa (por enlace o por edición y número)
    const seen = new Set(accepted);
    if (first.categoryId === 100 && Number(first.productId) >= 9000000) {
      setPick((current) => current && { ...current, options: merged, loading: true });
      const englishNames = await api.getEnglishTwin(first.productId).then((response) => [...new Set((response?.cards || []).map((card) => baseName(card.name) || card.name))]).catch(() => []);
      if (seq !== pickSeq.current) return;
      const fresh = englishNames.filter((text) => !seen.has(plain(text))).slice(0, 2);
      if (fresh.length) {
        fresh.forEach((text) => seen.add(plain(text)));
        const englishGroups = await loadNames(fresh);
        if (seq !== pickSeq.current) return;
        const keys = new Set(fresh.map(plain));
        const englishOrder = new Map([...order, ...(englishGroups.map((group) => group[0]).find((list) => list?.length) || []).map((card) => [card.productId, card.apiIndex])]);
        merged = mergeOptions(merged, englishGroups.flat(2).filter((card) => keys.has(keyOf(card))), englishOrder);
      }
    }
    // Fase 2 (solo si hace falta): idiomas de Pokémon sin ninguna impresión. La misma foto se consulta al motor en esos idiomas
    // (con los tres juntos suele devolver solo el de la carta reconocida) y se busca en el catálogo con el nombre que traiga.
    const missing = isPokemonBatch ? Object.entries(LANG_CODE).filter(([, code]) => !merged.some((card) => LANG_CODE[card.categoryId] === code)).map(([id]) => Number(id)) : [];
    setPick((current) => current && { ...current, options: merged, loading: missing.length > 0 && Boolean(result.photo?.blob) });
    if (!missing.length || !result.photo?.blob) return;
    // Cada idioma que falta se resuelve por su cuenta: apenas llega, sus impresiones se suman a la hoja
    await Promise.all(missing.map(async (categoryId) => {
      const twins = await twinScans(result, first, [categoryId]);
      if (seq !== pickSeq.current || !twins.length) return;
      const twinNames = [...new Set(twins.map((card) => baseName(card.name) || card.name))].filter((text) => !seen.has(plain(text))).slice(0, 2);
      twinNames.forEach((text) => seen.add(plain(text)));
      const twinGroups = twinNames.length ? await loadNames(twinNames) : [];
      if (seq !== pickSeq.current) return;
      const keys = new Set(twinNames.map(plain));
      const more = [...twins, ...twinGroups.flat(2).filter((card) => keys.has(keyOf(card)))];
      const twinOrder = new Map([...order, ...(twinGroups.map((group) => group[0]).find((list) => list?.length) || []).map((card) => [card.productId, card.apiIndex])]);
      setPick((current) => current && { ...current, options: mergeOptions(current.options, more, twinOrder) });
    }));
    if (seq === pickSeq.current) setPick((current) => current && { ...current, loading: false });
  };
  const choosePick = (card) => {
    const { result, options, replace } = pick;
    closePick();
    const engineTop = result.engineTop || result.top?.[0];
    logChoice(replace ? 'change' : engineTop && cardId(engineTop) === cardId(card) ? 'confirm' : 'correct', { ...result, engineTop }, card);
    if (searchMode) { searchFrom(card, result, options); return; }
    if (replace) { changeVersion(replace, card); return; }
    const code = LANG_CODE[card.categoryId]; // elegir una impresión en otro idioma cambia el idioma de la carta agregada
    addPicked({ ...result, engineTop, ...(code ? { language: { ...(result.language || {}), code: code === 'JP' ? 'ja' : code.toLowerCase() } } : {}), top: [card, ...(result.top || []).filter((item) => cardId(item) !== cardId(card))], same: options.filter((item) => cardId(item) !== cardId(card)) });
  };
  const searchManually = () => {
    const first = pick.result.top?.[0];
    const name = baseName(first?.name) || first?.name || '';
    closePick();
    if (searchMode) {
      const tcg = GAME_OF[first?.categoryId];
      requestClose(() => { onClose(); navigate(`/cartas?q=${encodeURIComponent(name)}${tcg ? `&tcg=${encodeURIComponent(tcg)}` : ''}`); });
      return;
    }
    requestClose(() => { onClose(); batch.onManualSearch?.(name); });
  };
  const addPicked = async (result) => {
    const added = await batch.onCard(result);
    if (!added) return;
    const uploading = Boolean(added.noImage && added.photo?.blob && !offered.current.has(added.key));
    const id = ++trayId.current;
    const fly = Boolean(added.image) && !calm() && Boolean(guideRef.current);
    setTray((previous) => [...previous, { ...added, uploading, trayId: id, fly, result, lang: result.language?.code, scanPhoto: result.photo || null }]);
    setFlash((value) => value + 1);
    if (fly) flyToTray(added, id);
    buzz();
    contribute(added);
  };
  const { message, guide, view, cameraError, retryCamera } = useCardScanner({ videoRef, areaRef, guideRef, games, enabled: true, batch: true, paused: Boolean(pick), onCard: handleBatchCard });
  const best = view.result?.top?.[0];
  const removeScanned = (index) => {
    const entry = tray[index];
    if (entry?.result?.top?.[0] && entry.trayId > (batch.initial?.length || 0)) logChoice('reject', entry.result, entry.result.top[0]); // la quitó: lo que se agregó no era la carta
    batch.onRemove?.(entry);
    setTray((previous) => previous.filter((_, position) => position !== index));
  };

  const openSearch = async (card, source) => {
    const found = source || view.result;
    // Una carta reconocida en español (TCGdex) se vende con el id de su gemela inglesa y con su nombre en inglés: se agrega para ordenar y buscar las ofertas
    const twin = card.categoryId === 100 && Number(card.productId) >= 9000000
      ? await api.getEnglishTwin(card.productId).then((response) => (response?.cards || []).slice(0, 3)).catch(() => [])
      : [];
    const params = new URLSearchParams(); // sin texto de búsqueda: la página muestra directamente lo que encontró el escáner
    if (GAME_OF[card.categoryId]) params.set('tcg', GAME_OF[card.categoryId]);
    // La búsqueda muestra primero lo más parecido a lo escaneado: la carta encontrada y, después, las demás por parecido
    const key = (item) => `${item.categoryId}:${item.productId}`;
    const scanOrder = [key(card), ...twin.map(key), ...[...found.top, ...(found.same || [])].filter((item) => key(item) !== key(card)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(key)].filter((value) => !value.includes('null'));
    const scanned = [card, ...twin.map((item) => ({ ...item, set: '', image: '', score: 0 })), ...[...found.top, ...(found.same || [])].filter((item) => key(item) !== key(card)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))]
      .filter((item) => item.productId != null && item.categoryId != null)
      .map((item) => ({ categoryId: item.categoryId, productId: item.productId, groupId: item.groupId ?? null, name: item.name, number: item.number || '', set: item.set || '', image: item.image || '' }))
      .slice(0, 40);
    onClose();
    navigate(`/cartas${params.toString() ? `?${params.toString()}` : ''}`, { state: { scanOrder, scanned, scanName: baseName((twin[0] || card).name) || (twin[0] || card).name } });
  };
  // Modo búsqueda: la carta elegida (o la única candidata) se busca en «Cartas»; las demás impresiones que dio la hoja van detrás en el orden de parecido
  const searchFrom = (card, result, options) => {
    if (!card) return;
    buzz();
    setFlash((value) => value + 1);
    requestClose(() => openSearch(card, { top: [card, ...(result.top || []).filter((item) => cardId(item) !== cardId(card))], same: [...options.filter((item) => cardId(item) !== cardId(card)), ...(result.same || [])] }));
  };

  // La fila de juegos se desplaza sola hasta el elegido (al abrir el visor ya puede estar fuera de la vista)
  useEffect(() => {
    if (batch) return undefined;
    const timer = window.setTimeout(() => {
      rootRef.current?.querySelector('[aria-label="Juego a buscar"] [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [batch, game]);
  const pickGame = (value) => { setGame(value); try { localStorage.setItem(SAVED_GAME, value); } catch (_error) { /* sin almacenamiento: no se recuerda el juego */ } };
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
        {batch && tray.length > 0 && (
          <div className="scan-glass flex w-full max-w-xl items-center gap-2.5 rounded-[22px] p-2">
            <MotionConfig reducedMotion="user">
            <ul className="relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Cartas escaneadas">
              <AnimatePresence initial={false} mode="popLayout">
              {tray.map((item, index) => (
                <motion.li key={item.trayId} layout data-tray-id={item.trayId} initial={item.fly ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ type: 'spring', duration: 0.42, bounce: 0.2, delay: item.fly ? 0.56 : 0 }} className="relative h-[68px] w-12 shrink-0 rounded-lg bg-[#02070f] shadow-[0_6px_14px_-6px_rgba(0,0,0,.7)] ring-1 ring-white/25">
                  <button type="button" onClick={() => openPick(item.result, item)} disabled={!item.result} aria-haspopup="dialog" aria-label={`Cambiar la versión de ${item.name}`} className="absolute inset-0 overflow-hidden rounded-lg transition-transform duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05] disabled:active:scale-100">
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
        <div className="flex w-full max-w-xl flex-col items-center gap-2">
            <AnimatePresence>
              {prefsOpen && (
                <motion.div key="scan-prefs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }} className="scan-glass w-full space-y-2.5 rounded-[22px] p-3">
                  {isPokemonBatch && (
                    <>
                      <ScanChoice label="Idioma" value={prefs.lang} onChange={(value) => setPref({ lang: value })} options={[{ value: 'auto', label: 'Auto' }, { value: '3', label: 'Inglés' }, { value: '100', label: 'Español' }, { value: '85', label: 'Japonés' }]} />
                      <ScanChoice label="Acabado" value={prefs.finish} onChange={(value) => setPref({ finish: value })} options={[{ value: '', label: 'Cualquiera' }, { value: 'Normal', label: 'Normal' }, { value: 'Holofoil', label: 'Holo' }, { value: 'Reverse Holofoil', label: 'Reverse' }]} />
                    </>
                  )}
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-1 text-left text-[13px] font-semibold text-slate-100">
                    <span>{searchMode ? 'Buscar sin preguntar' : 'Agregar sin preguntar'}<span className="block text-[11px] font-medium text-slate-300">Solo cuando la carta es clara{isPokemonBatch ? ' y el idioma está fijado' : ''}</span></span>
                    <input type="checkbox" checked={prefs.quick} onChange={(event) => setPref({ quick: event.target.checked })} className="h-5 w-5 shrink-0 accent-[#ffcb05]" />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
            <button type="button" onClick={() => setPrefsOpen((open) => !open)} aria-expanded={prefsOpen} className="scan-glass flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-slate-200 transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">
              <SvgIcon name="tune" translate="no" aria-hidden="true" className="text-[16px] text-[#ffcb05]" />
              {isPokemonBatch ? `Pokémon · ${prefs.lang === 'auto' ? 'idioma automático' : prefs.lang === '3' ? 'inglés' : prefs.lang === '100' ? 'español' : 'japonés'}${prefs.finish ? ` · ${prefs.finish}` : ''}` : (batch ? batch.label : SCAN_GAMES.find((item) => item.value === game)?.label || '')}
              {prefs.quick && <span className="rounded-full bg-[#ffcb05] px-1.5 text-[10px] font-extrabold text-[#1a1400]">directo</span>}
            </button>
        {searchMode && (
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
      </div>

      <PickCardSheet finishPref={isPokemonBatch ? prefs.finish : ''} pick={pick} onClose={dismissPick} onChoose={choosePick} onLang={(value) => setPick((current) => current && { ...current, lang: value })} onManual={searchMode || batch?.onManualSearch ? searchManually : null} />
    </div>,
    document.body
  );
}
