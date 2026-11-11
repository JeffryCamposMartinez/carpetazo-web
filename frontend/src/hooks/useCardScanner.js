// Escáner de cartas con la cámara: espera a que la carta esté quieta, nítida y con luz, manda el cuadro al backend (que lo pasa al motor de reconocimiento)
// y confirma cuando la misma carta sale en varias lecturas seguidas. Lógica portada del visor del motor (carpetazo-vision-engine/visor/index.html).
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export const SCAN_GAMES = [
  { value: 'all', label: 'Todos', ids: '' },
  { value: 'pk', label: 'Pokémon', ids: '3,100,85' },
  { value: 'mg', label: 'Magic', ids: '1' },
  { value: 'yg', label: 'Yu-Gi-Oh', ids: '2' },
  { value: 'op', label: 'One Piece', ids: '68' },
  { value: 'lo', label: 'Lorcana', ids: '71' },
  { value: 'di', label: 'Digimon', ids: '63' },
  { value: 'rb', label: 'Riftbound', ids: '89' },
  { value: 'my', label: 'Mitos y Leyendas', ids: '99' },
];

// Umbrales provisionales (ajustados a mano en celulares; no están calibrados con un conjunto verificado).
// Se busca con la primera lectura solo si hay evidencia: el nombre leído en la carta coincide con el catálogo y el parecido llega a OCR_MIN, o el parecido es muy alto (SURE_MIN).
// Una lectura borrosa o en movimiento puede dar 0,58–0,66 con cartas cualquiera: sin esa evidencia hace falta que la misma carta salga `votes` veces y se vea «probable».
const OCR_MIN = 0.6;
const SURE_MIN = 0.82;
const CFG = { movMax: 30, sharpMin: 300, stillFrames: 2, sdMin: 14, meanMin: 25, meanMax: 245, glareMax: 0.18, votes: 3, minScore: 0.55, noCardGapMs: 1200, window: 5, scanGapMs: 400 };
const QW = 160;
const QH = 224;
const TICK_MS = 150;
const MAX_SIDE = 1280;
const SCAN_TIMEOUT_MS = 40000; // el servidor corta a los 30 s
const PHOTO_SIDE = 1400; // lado mayor del recorte que se ofrece como foto de la carta

const idOf = (item) => item.group || `${item.categoryId}:${item.productId}`;
// «Probable» si se parece mucho y se distingue de cartas de otro nombre; si no, «Dudoso»
export const quality = (result) => {
  const top = result.top;
  const margin = result.ocr?.margin != null ? result.ocr.margin : top[0].score - (top[1]?.score ?? 0);
  return { margin, ok: top[0].score >= 0.75 && margin >= 0.06 };
};

// batch: el visor no termina al reconocer una carta; la entrega con `onCard(resultado)` y espera a que la cambien por otra
export default function useCardScanner({ videoRef, areaRef, guideRef, games, enabled, batch = false, onCard }) {
  const [message, setMessage] = useState('Iniciando cámara…');
  const [guide, setGuide] = useState(''); // '' · scan · ok · mid
  const [view, setView] = useState({ result: null, votes: 0, reads: 0, done: false });
  const [cameraError, setCameraError] = useState('');
  const [attempt, setAttempt] = useState(0); // sube al reintentar la cámara
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const batchRef = useRef(batch);
  batchRef.current = batch;
  const onCardRef = useRef(onCard);
  onCardRef.current = onCard;
  const run = useRef({ prev: null, still: 0, busy: false, hist: [], confirmed: null, lastScanAt: 0, moveSince: 0, lost: 0, stopped: false, waitRemoval: false, removeTicks: 0, lastA: null });
  const canvas = useRef(null);

  const reset = useCallback(() => {
    Object.assign(run.current, { hist: [], confirmed: null, lastScanAt: 0, waitRemoval: false, removeTicks: 0 });
    setView({ result: null, votes: 0, reads: 0, done: false });
    setGuide('');
    setMessage('Apunta a una carta');
  }, []);

  useEffect(() => { reset(); }, [games, reset]);

  useEffect(() => {
    if (!enabled) return undefined;
    const state = run.current;
    state.stopped = false;
    let stream = null;
    let timer = 0;

    const guideBox = () => { // marco -> fracciones del cuadro de video (object-fit: cover)
      const video = videoRef.current;
      const area = areaRef.current?.getBoundingClientRect();
      const frame = guideRef.current?.getBoundingClientRect();
      if (!video || !area || !frame || !video.videoWidth) return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(area.width / vw, area.height / vh);
      const ox = (vw * scale - area.width) / 2;
      const oy = (vh * scale - area.height) / 2;
      return { x: (frame.left - area.left + ox) / scale, y: (frame.top - area.top + oy) / scale, w: frame.width / scale, h: frame.height / scale, vw, vh };
    };

    const analyze = () => { // movimiento, nitidez, contraste y brillo dentro del marco
      const box = guideBox();
      if (!box) return null;
      if (!canvas.current) { canvas.current = document.createElement('canvas'); canvas.current.width = QW; canvas.current.height = QH; }
      const ctx = canvas.current.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(videoRef.current, box.x, box.y, box.w, box.h, 0, 0, QW, QH);
      const data = ctx.getImageData(0, 0, QW, QH).data;
      const n = QW * QH;
      const gray = new Float32Array(n);
      let mean = 0;
      let high = 0;
      for (let i = 0; i < n; i++) { const j = i * 4; gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]; mean += gray[i]; if (gray[i] >= 248) high++; }
      mean /= n; high /= n;
      let variance = 0;
      for (let i = 0; i < n; i++) variance += (gray[i] - mean) ** 2;
      const sd = Math.sqrt(variance / n);
      const lap = new Float32Array(n);
      let lapMean = 0;
      for (let y = 1; y < QH - 1; y++) for (let x = 1; x < QW - 1; x++) { const i = y * QW + x; const l = gray[i - 1] + gray[i + 1] + gray[i - QW] + gray[i + QW] - 4 * gray[i]; lap[i] = l; lapMean += l; }
      lapMean /= n;
      let sharp = 0;
      for (let i = 0; i < n; i++) sharp += (lap[i] - lapMean) ** 2;
      sharp /= n;
      let mov = 99;
      if (state.prev) { mov = 0; for (let i = 0; i < n; i += 7) mov += Math.abs(gray[i] - state.prev[i]); mov /= n / 7; }
      state.prev = gray;
      return { mean, sd, sharp, mov, high };
    };

    const finish = (result, id, votes, reads) => {
      if (batchRef.current) { // lote: se entrega la carta, el visor sigue abierto y se espera a que la cambien
        state.hist = []; state.waitRemoval = true; state.removeTicks = 0;
        setGuide('ok'); setMessage('Carta agregada ✓ Cambia de carta');
        onCardRef.current?.(result);
        return;
      }
      state.confirmed = id;
      setView({ result, votes, reads, done: true });
      setGuide('ok'); setMessage('Carta encontrada ✓');
    };

    const vote = (data) => {
      if (!data.found || !data.top?.length) { setGuide(''); setMessage('No veo la carta'); return; }
      if (data.top[0].score < CFG.minScore) { // no parece una carta del catálogo: se descarta y se espera un poco
        state.hist = []; state.confirmed = null; state.lastScanAt = Date.now() + CFG.noCardGapMs - CFG.scanGapMs;
        setGuide(''); setMessage('No veo una carta'); setView({ result: null, votes: 0, reads: 0, done: false });
        return;
      }
      const topScore = data.top[0].score;
      if ((data.ocr?.names?.length > 0 && topScore >= OCR_MIN) || topScore >= SURE_MIN) { // evidencia suficiente: no hace falta repetir la lectura
        finish(data, idOf(data.top[0]), 1, state.hist.length + 1);
        return;
      }
      state.hist.push(data);
      if (state.hist.length > CFG.window) state.hist.shift();
      const counts = {};
      state.hist.forEach((entry) => { const id = idOf(entry.top[0]); counts[id] = (counts[id] || 0) + 1; });
      const [bestId, votes] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const last = [...state.hist].reverse().find((entry) => idOf(entry.top[0]) === bestId);
      setView({ result: last, votes, reads: state.hist.length, done: false });
      if (votes >= CFG.votes && quality(last).ok) finish(last, bestId, votes, state.hist.length); // sin nombre leído, solo si se repite y el parecido es claro («probable»)
      else setGuide('scan');
    };

    const scan = async () => {
      const video = videoRef.current;
      const box = guideBox();
      if (!video || !box) return;
      state.busy = true; state.lastScanAt = Date.now();
      setGuide('scan');
      const controller = new AbortController();
      state.abort = controller;
      const timeout = window.setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
      try {
        const k = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
        const shot = document.createElement('canvas');
        shot.width = Math.round(video.videoWidth * k); shot.height = Math.round(video.videoHeight * k);
        shot.getContext('2d').drawImage(video, 0, 0, shot.width, shot.height);
        const crop = [box.x / box.vw, box.y / box.vh, box.w / box.vw, box.h / box.vh].map((v) => Math.max(0, Math.min(1, v)).toFixed(4)).join(',');
        const blob = await new Promise((resolve) => shot.toBlob(resolve, 'image/jpeg', 0.88));
        if (!blob) throw new Error('no se pudo capturar');
        // Lote: el recorte del marco a la resolución de la cámara (lo único que se ofrece como foto, y solo si la persona lo pide)
        let photo = null;
        if (batchRef.current) {
          const sw = Math.min(box.w, video.videoWidth - Math.max(0, box.x));
          const sh = Math.min(box.h, video.videoHeight - Math.max(0, box.y));
          const f = Math.min(1, PHOTO_SIDE / Math.max(sw, sh));
          const cut = document.createElement('canvas');
          cut.width = Math.round(sw * f); cut.height = Math.round(sh * f);
          cut.getContext('2d').drawImage(video, Math.max(0, box.x), Math.max(0, box.y), sw, sh, 0, 0, cut.width, cut.height);
          // Toma con margen (se ve el borde de la carta): el servidor la usa para enderezar y centrar la carta
          const padX = box.w * 0.12; const padY = box.h * 0.12;
          const wx = Math.max(0, box.x - padX); const wy = Math.max(0, box.y - padY);
          const ww = Math.min(video.videoWidth - wx, box.w + 2 * padX); const wh = Math.min(video.videoHeight - wy, box.h + 2 * padY);
          const wf = Math.min(1, (PHOTO_SIDE * 1.3) / Math.max(ww, wh));
          const wide = document.createElement('canvas');
          wide.width = Math.round(ww * wf); wide.height = Math.round(wh * wf);
          wide.getContext('2d').drawImage(video, wx, wy, ww, wh, 0, 0, wide.width, wide.height);
          const toJpeg = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          const [cutBlob, wideBlob] = await Promise.all([toJpeg(cut), toJpeg(wide)]);
          if (cutBlob) photo = { blob: cutBlob, wide: wideBlob, sharp: state.lastA?.sharp ?? 0, glare: state.lastA?.high ?? 0 };
        }
        const data = await api.scanCard(blob, { crop, games: gamesRef.current, signal: controller.signal });
        if (photo) data.photo = photo;
        if (!state.stopped) vote(data);
      } catch (error) {
        if (!state.stopped) {
          setGuide('');
          const status = error.status;
          setMessage(status === 401 ? 'Inicia sesión para usar la cámara' : status === 429 ? 'Hay muchas cartas en cola. Reintentando…' : error.name === 'AbortError' ? 'Tardó demasiado. Reintentando…' : status >= 500 ? 'El reconocimiento no responde. Reintentando…' : !status ? 'Sin conexión. Reintentando…' : 'No se pudo reconocer. Intenta de nuevo');
          if (status === 401) state.stopped = true;
          else state.lastScanAt = Date.now() + 1500 - CFG.scanGapMs; // espera antes de reintentar para no saturar al servidor
        }
      } finally {
        window.clearTimeout(timeout);
        state.abort = null;
        state.busy = false;
      }
    };

    const tick = () => {
      const video = videoRef.current;
      if (state.stopped || state.confirmed || !video?.videoWidth) return; // reconocida: el resultado queda fijo hasta tocar «Escanear otra carta»
      const a = analyze();
      if (!a) return;
      state.lastA = a;
      if (state.waitRemoval) { // lote: la carta anterior sigue en el marco; se rearma cuando el marco queda vacío o la cambian (movimiento sostenido)
        state.removeTicks = (a.sd < CFG.sdMin || a.mov > CFG.movMax) ? state.removeTicks + 1 : 0;
        if (state.removeTicks >= 3) { state.waitRemoval = false; state.removeTicks = 0; state.lastScanAt = 0; setGuide(''); setMessage('Apunta a la siguiente carta'); }
        return;
      }
      const moving = a.mov > CFG.movMax;
      state.still = moving ? 0 : state.still + 1;
      if (moving) {
        if (!state.moveSince) state.moveSince = Date.now();
        if (Date.now() - state.moveSince > 500 && state.hist.length && !state.confirmed) { reset(); } // con la carta ya reconocida el resultado se queda hasta que se pida otra
      } else state.moveSince = 0;
      if (a.sd < CFG.sdMin) { setGuide(''); setMessage('Apunta a una carta'); state.lost += 1; if (state.lost > 6 && state.hist.length && !state.confirmed) reset(); return; }
      state.lost = 0;
      if (a.mean < CFG.meanMin) { setMessage('Muy oscuro: busca más luz'); return; }
      if (a.mean > CFG.meanMax || a.high > CFG.glareMax) { setMessage('Demasiada luz o reflejo'); return; }
      if (moving) { setMessage('Mantén quieta la carta…'); return; }
      if (state.still < CFG.stillFrames) return;
      if (a.sharp < CFG.sharpMin) { setMessage('Desenfocado: acerca o aleja un poco'); return; }
      setMessage('Buscando…');
      if (!state.busy && Date.now() - state.lastScanAt > CFG.scanGapMs) scan();
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (state.stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        stream.getVideoTracks().forEach((track) => { track.onended = () => { if (!state.stopped) { clearInterval(timer); setCameraError('La cámara se detuvo. Vuelve a intentarlo.'); } }; });
        video.srcObject = stream;
        await video.play().catch(() => {});
        setCameraError('');
        setMessage('Apunta a una carta');
        timer = window.setInterval(tick, TICK_MS);
      } catch (error) {
        const name = error?.name;
        setCameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'Permite el acceso a la cámara en tu navegador para escanear cartas.'
          : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'No encontramos una cámara en este dispositivo.'
          : name === 'NotReadableError' || name === 'AbortError' ? 'La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.'
          : error?.message || 'No se pudo abrir la cámara.');
      }
    })();

    return () => {
      state.stopped = true;
      state.abort?.abort();
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      Object.assign(state, { prev: null, still: 0, busy: false, hist: [], confirmed: null, moveSince: 0, lost: 0 });
    };
  }, [enabled, attempt, videoRef, areaRef, guideRef, reset]);

  const retryCamera = useCallback(() => { setCameraError(''); setMessage('Iniciando cámara…'); setAttempt((value) => value + 1); }, []);

  return { message, guide, view, cameraError, reset, retryCamera };
}
