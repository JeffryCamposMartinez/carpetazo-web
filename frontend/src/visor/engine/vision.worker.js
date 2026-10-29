// Worker de visión: detecta la carta en fotogramas pequeños y, al ordenarlo, rectifica el recorte. Todo el píxel-trabajo
// ocurre aquí para no bloquear el hilo principal: la página solo envía ImageBitmaps (transferidos, sin copia).
import { toGray, detectCard } from './detector.js';
import { detectCards } from './multiDetector.js';
import { warpQuad } from './geometry.js';
import { assessCrop, signature } from './quality.js';
import { INPUT_SIZE } from './constants.js';

let canvas = null, ctx = null;
const pixels = (bitmap) => {
  if (!canvas || canvas.width !== bitmap.width || canvas.height !== bitmap.height) { canvas = new OffscreenCanvas(bitmap.width, bitmap.height); ctx = canvas.getContext('2d', { willReadFrequently: true }); }
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
};
const toPx = (corners, w, h) => corners.map(([x, y]) => [x * w, y * h]);

const handlers = {
  detect({ id, bitmap }) {
    const t0 = performance.now(), img = pixels(bitmap); bitmap.close?.();
    const gray = toGray(img.data, img.width, img.height, 160); // el detector por bordes está calibrado a 160 px; el de color usa el fotograma tal cual
    // Primero el detector por color (cartas sobre una mesa saturada: encuentra todas y se queda con la más cercana al centro);
    // si no hay mesa de color uniforme o no halla nada, el detector por bordes de siempre.
    const cards = detectCards(img.data, img.width, img.height, { maxDim: Math.max(img.width, img.height) }).cards, mid = (c) => Math.hypot(c.corners.reduce((a, p) => a + p[0], 0) / 4 - 0.5, c.corners.reduce((a, p) => a + p[1], 0) / 4 - 0.5);
    const pick = cards.sort((a, b) => mid(a) - mid(b))[0];
    const found = pick ? { ...pick, rectangularity: pick.fill, score: pick.fill, via: 'color' } : detectCard(gray);
    let detection = null, sig = null;
    if (found.corners) {
      detection = found;
      // Firma pequeña de la carta actual (para saber si la carta cambió mientras está retenida)
      const w = 32, h = 44, small = warpQuad(img, toPx(found.corners, img.width, img.height), w, h);
      if (small) sig = signature(small, w, h);
    }
    self.postMessage({ type: 'detection', id, detection, reason: found.reason || null, signature: sig, ms: Math.round(performance.now() - t0) });
  },

  /** Recorta y rectifica la carta del fotograma completo: 224² para el modelo y, si se pide, alta resolución para OCR. */
  crop({ id, bitmap, corners, hires = true }) {
    const t0 = performance.now(), img = pixels(bitmap); bitmap.close?.();
    const q = toPx(corners, img.width, img.height), model = warpQuad(img, q, INPUT_SIZE, INPUT_SIZE);
    if (!model) { self.postMessage({ type: 'crop', id, error: 'homografia_invalida' }); return; }
    const quality = assessCrop(model, INPUT_SIZE, INPUT_SIZE);
    const out = { type: 'crop', id, quality, ms: 0 }, transfer = [];
    // La firma de la carta de frente en tamaño pequeño; el vídeo no se guarda en ningún sitio
    out.model = model.buffer; transfer.push(model.buffer);
    if (hires) { const W = 600, H = 840, hi = warpQuad(img, q, W, H); out.hires = { data: hi.buffer, width: W, height: H }; transfer.push(hi.buffer); }
    out.ms = Math.round(performance.now() - t0);
    self.postMessage(out, transfer);
  },
};

self.onmessage = ({ data }) => { try { handlers[data.type](data); } catch (error) { self.postMessage({ type: 'error', id: data.id, message: String(error.message || error) }); } };
