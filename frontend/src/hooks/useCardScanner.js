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

// Umbrales provisionales (ajustados a mano en celulares; no están calibrados con un conjunto verificado)
const CFG = { movMax: 30, sharpMin: 300, stillFrames: 2, sdMin: 14, meanMin: 25, meanMax: 245, glareMax: 0.18, votes: 3, minScore: 0.55, noCardGapMs: 1200, window: 5, scanGapMs: 400 };
const QW = 160;
const QH = 224;
const TICK_MS = 150;
const MAX_SIDE = 1280;

const idOf = (item) => item.group || `${item.categoryId}:${item.productId}`;
// «Probable» si se parece mucho y se distingue de cartas de otro nombre; si no, «Dudoso»
export const quality = (result) => {
  const top = result.top;
  const margin = result.ocr?.margin != null ? result.ocr.margin : top[0].score - (top[1]?.score ?? 0);
  return { margin, ok: top[0].score >= 0.75 && margin >= 0.06 };
};

export default function useCardScanner({ videoRef, areaRef, guideRef, games, enabled }) {
  const [message, setMessage] = useState('Iniciando cámara…');
  const [guide, setGuide] = useState(''); // '' · scan · ok · mid
  const [view, setView] = useState({ result: null, votes: 0, reads: 0, done: false });
  const [cameraError, setCameraError] = useState('');
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const run = useRef({ prev: null, still: 0, busy: false, hist: [], confirmed: null, lastScanAt: 0, moveSince: 0, lost: 0, stopped: false });
  const canvas = useRef(null);

  const reset = useCallback(() => {
    Object.assign(run.current, { hist: [], confirmed: null, lastScanAt: 0 });
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

    const vote = (data) => {
      if (!data.found || !data.top?.length) { setGuide(''); setMessage('No veo la carta'); return; }
      if (data.top[0].score < CFG.minScore) { // no parece una carta del catálogo: se descarta y se espera un poco
        state.hist = []; state.confirmed = null; state.lastScanAt = Date.now() + CFG.noCardGapMs - CFG.scanGapMs;
        setGuide(''); setMessage('No veo una carta'); setView({ result: null, votes: 0, reads: 0, done: false });
        return;
      }
      state.hist.push(data);
      if (state.hist.length > CFG.window) state.hist.shift();
      const counts = {};
      state.hist.forEach((entry) => { const id = idOf(entry.top[0]); counts[id] = (counts[id] || 0) + 1; });
      const [bestId, votes] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const last = [...state.hist].reverse().find((entry) => idOf(entry.top[0]) === bestId);
      const done = votes >= CFG.votes;
      setView({ result: last, votes, reads: state.hist.length, done });
      if (done) {
        state.confirmed = bestId;
        setGuide(quality(last).ok ? 'ok' : 'mid');
        setMessage(quality(last).ok ? 'Probable ✓' : 'Dudoso: revisa las candidatas');
      } else {
        setGuide('scan');
        setMessage(`Confirmando… ${votes}/${CFG.votes}`);
      }
    };

    const scan = async () => {
      const video = videoRef.current;
      const box = guideBox();
      if (!video || !box) return;
      state.busy = true; state.lastScanAt = Date.now();
      setGuide('scan'); setMessage('Buscando…');
      try {
        const k = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
        const shot = document.createElement('canvas');
        shot.width = Math.round(video.videoWidth * k); shot.height = Math.round(video.videoHeight * k);
        shot.getContext('2d').drawImage(video, 0, 0, shot.width, shot.height);
        const crop = [box.x / box.vw, box.y / box.vh, box.w / box.vw, box.h / box.vh].map((v) => Math.max(0, Math.min(1, v)).toFixed(4)).join(',');
        const blob = await new Promise((resolve) => shot.toBlob(resolve, 'image/jpeg', 0.88));
        if (!blob) throw new Error('no se pudo capturar');
        const data = await api.scanCard(blob, { crop, games: gamesRef.current });
        if (!state.stopped) vote(data);
      } catch (error) {
        if (!state.stopped) {
          setGuide('');
          setMessage(error.status === 401 ? 'Inicia sesión para usar la cámara' : error.status === 429 ? 'Un momento…' : 'No se pudo reconocer. Intenta de nuevo');
          if (error.status === 401) state.stopped = true;
        }
      } finally {
        state.busy = false;
      }
    };

    const tick = () => {
      const video = videoRef.current;
      if (state.stopped || !video?.videoWidth) return;
      const a = analyze();
      if (!a) return;
      const moving = a.mov > CFG.movMax;
      state.still = moving ? 0 : state.still + 1;
      if (moving) {
        if (!state.moveSince) state.moveSince = Date.now();
        if (Date.now() - state.moveSince > 500 && (state.hist.length || state.confirmed)) { reset(); }
      } else state.moveSince = 0;
      if (a.sd < CFG.sdMin) { setGuide(''); setMessage('Apunta a una carta'); state.lost += 1; if (state.lost > 6 && (state.hist.length || state.confirmed)) reset(); return; }
      state.lost = 0;
      if (a.mean < CFG.meanMin) { setMessage('Muy oscuro: busca más luz'); return; }
      if (a.mean > CFG.meanMax || a.high > CFG.glareMax) { setMessage('Demasiada luz o reflejo'); return; }
      if (moving) { setMessage('Mantén quieta la carta…'); return; }
      if (state.still < CFG.stillFrames) return;
      if (a.sharp < CFG.sharpMin) { setMessage('Desenfocado: acerca o aleja un poco'); return; }
      if (state.confirmed) return; // ya reconocida: no vuelve a pedir hasta que cambie la escena
      if (!state.busy && Date.now() - state.lastScanAt > CFG.scanGapMs) scan();
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (state.stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setCameraError('');
        setMessage('Apunta a una carta');
        timer = window.setInterval(tick, TICK_MS);
      } catch (error) {
        setCameraError(error?.name === 'NotAllowedError' ? 'Permite el acceso a la cámara en tu navegador para escanear cartas.' : error?.message || 'No se pudo abrir la cámara.');
      }
    })();

    return () => {
      state.stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      Object.assign(state, { prev: null, still: 0, busy: false, hist: [], confirmed: null, moveSince: 0, lost: 0 });
    };
  }, [enabled, videoRef, areaRef, guideRef, reset]);

  return { message, guide, view, cameraError, reset };
}
