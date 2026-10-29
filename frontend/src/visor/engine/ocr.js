// OCR local (Tesseract.js) bajo demanda: se descarga y arranca solo la primera vez que hace falta desambiguar una impresión.
// Recursos autoalojados (public/ocr/): no se contacta ningún servicio externo.

let workerPromise = null, PSM_ = null;
const NUMBERS = '0123456789/-ABCDEFGHIJKLMNOPQRSTUVWXYZ•·.★* ';
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZáéíóúñÁÉÍÓÚÑ'.- ";

const ensure = async (base) => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js'); PSM_ = PSM;
      const worker = await createWorker('eng', 1, { workerPath: `${base}worker.min.js`, corePath: base, langPath: base, gzip: true });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '0123456789/-ABCDEFGHIJKLMNOPQRSTUVWXYZ•·.★* ' });
      return worker;
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
};

/** Arranca el OCR sin leer nada (descarga y compilación) para tenerlo listo cuando haga falta. */
export const warmOcr = (base = '/ocr/') => ensure(base).then(() => undefined);

const regionCanvas = (hires, region) => {
  const { width: W, height: H } = hires, x = Math.round(region.x * W), y = Math.round(region.y * H), w = Math.round(region.w * W), h = Math.round(region.h * H);
  const src = new OffscreenCanvas(W, H); src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(hires.data), W, H), 0, 0);
  const scale = 3, out = new OffscreenCanvas(w * scale, h * scale), c = out.getContext('2d');
  c.filter = 'grayscale(1) contrast(1.6)'; c.imageSmoothingQuality = 'high';
  c.drawImage(src, x, y, w, h, 0, 0, w * scale, h * scale);
  return out;
};

/**
 * Lee las regiones del adaptador y devuelve el texto junto.
 * @returns {Promise<{text:string, ms:number}>}
 */
export const readRegions = async ({ hires, regions, base = '/ocr/', mode = 'number' }) => {
  const t0 = performance.now(), worker = await ensure(base);
  await worker.setParameters(mode === 'name' ? { tessedit_pageseg_mode: PSM_.SINGLE_LINE, tessedit_char_whitelist: LETTERS } : { tessedit_pageseg_mode: PSM_.SPARSE_TEXT, tessedit_char_whitelist: NUMBERS });
  let text = '';
  for (const region of regions) text += ` ${(await worker.recognize(regionCanvas(hires, region))).data.text}`;
  return { text, ms: Math.round(performance.now() - t0) };
};

export const disposeOcr = async () => { const p = workerPromise; workerPromise = null; if (p) { try { await (await p).terminate(); } catch { /* ya cerrado */ } } };
