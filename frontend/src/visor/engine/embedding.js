// Pre y postproceso del modelo, compartidos por Node (indexador) y navegador (worker) para que los vectores sean comparables.
import { INPUT_SIZE } from './constants.js';

const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

/** Píxeles (RGB o RGBA, `stride` canales) de INPUT_SIZE² → Float32 CHW normalizado con media/desv. ImageNet. Reutiliza `out` si se pasa. */
export const toChw = (pixels, stride, out = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)) => {
  const px = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0; i < px; i++) for (let c = 0; c < 3; c++) out[c * px + i] = (pixels[i * stride + c] / 255 - MEAN[c]) / STD[c];
  return out;
};

/** last_hidden_state [1, tokens, d] → vector 2d: CLS y media de parches concatenados, normalizado L2. */
export const poolEmbedding = (hidden, tokens, d) => {
  const v = new Float32Array(d * 2);
  for (let k = 0; k < d; k++) {
    v[k] = hidden[k];
    let s = 0; for (let t = 1; t < tokens; t++) s += hidden[t * d + k];
    v[d + k] = s / (tokens - 1);
  }
  let norm = 0; for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
};
