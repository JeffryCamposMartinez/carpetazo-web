import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_MAX_SECONDS = 120;
const BARS = 40;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export const voiceSupported = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

// Reduce las muestras de volumen a las barras que se dibujan (0 a 100)
const toBars = (samples) => {
  if (!samples.length) return Array(BARS).fill(12);
  const max = Math.max(...samples, 0.05);
  return Array.from({ length: BARS }, (_, index) => {
    const from = Math.floor((index / BARS) * samples.length);
    const to = Math.max(from + 1, Math.floor(((index + 1) / BARS) * samples.length));
    const slice = samples.slice(from, to);
    const peak = Math.max(...slice);
    return Math.max(10, Math.min(100, Math.round((peak / max) * 100)));
  });
};

// Grabadora de notas de voz: pide el micrófono al empezar y entrega { blob, seconds, wave } al terminar.
// Mientras graba expone el tiempo y el volumen actual para dibujar la barra.
export default function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const ref = useRef({});

  const release = useCallback(() => {
    const state = ref.current;
    window.clearInterval(state.timer);
    window.cancelAnimationFrame(state.raf);
    state.stream?.getTracks().forEach((track) => track.stop());
    state.context?.close?.().catch(() => {});
    ref.current = {};
    setRecording(false);
    setSeconds(0);
    setLevel(0);
  }, []);

  // Empieza a grabar. Lanza un error con `code` ('unsupported' | 'denied') si no se puede.
  const start = useCallback(async () => {
    if (!voiceSupported()) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      throw Object.assign(new Error('denied'), { code: error?.name === 'NotFoundError' ? 'unsupported' : 'denied' });
    }
    const mime = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const state = { stream, recorder, chunks: [], samples: [], startedAt: Date.now(), mime: recorder.mimeType || mime || 'audio/webm' };
    recorder.ondataavailable = (event) => { if (event.data?.size) state.chunks.push(event.data); };
    recorder.start(250);

    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      state.context = context;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
        state.samples.push(rms);
        setLevel(rms);
        state.raf = window.requestAnimationFrame(tick);
      };
      state.raf = window.requestAnimationFrame(tick);
    } catch { /* sin medidor de volumen: se graba igual */ }

    state.timer = window.setInterval(() => {
      const elapsed = (Date.now() - state.startedAt) / 1000;
      setSeconds(Math.floor(elapsed));
      if (elapsed >= VOICE_MAX_SECONDS) state.onLimit?.();
    }, 200);
    ref.current = state;
    setRecording(true);
    return state;
  }, []);

  // Termina y entrega el audio (o null si se canceló o dura menos de un segundo)
  const stop = useCallback((keep = true) => new Promise((resolve) => {
    const state = ref.current;
    if (!state.recorder) { resolve(null); return; }
    const elapsed = (Date.now() - state.startedAt) / 1000;
    state.recorder.onstop = () => {
      const blob = new Blob(state.chunks, { type: state.mime });
      const wave = toBars(state.samples);
      release();
      resolve(keep && elapsed >= 1 && blob.size > 0 ? { blob, seconds: Math.min(VOICE_MAX_SECONDS, Math.max(1, Math.round(elapsed))), wave } : null);
    };
    try { state.recorder.stop(); } catch { release(); resolve(null); }
  }), [release]);

  const setLimitHandler = useCallback((handler) => { ref.current.onLimit = handler; }, []);
  useEffect(() => () => { try { ref.current.recorder?.stop(); } catch { /* ya estaba detenida */ } release(); }, [release]);

  return { recording, seconds, level, start, stop, setLimitHandler };
}
