// Calidad del recorte y firma visual barata para saber si la carta cambió. Sin DOM: opera sobre RGBA.

const gray = (rgba, n) => { const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = (rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114); return g; };

/** Varianza del laplaciano: mide nitidez (más alto = más nítido). */
export const sharpness = (rgba, w, h) => {
  const g = gray(rgba, w * h); let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
    s += l; s2 += l * l; n++;
  }
  const mean = s / n;
  return s2 / n - mean * mean;
};

/** Fracción de píxeles casi blancos (reflejo) y brillo medio (0..255). */
export const exposure = (rgba, w, h) => {
  let glare = 0, sum = 0; const n = w * h;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    if (r > 248 && g > 248 && b > 248) glare++;
    sum += (r + g + b) / 3;
  }
  return { glare: glare / n, mean: sum / n };
};

// Umbrales medidos con scripts/calibrate_quality.mjs sobre imágenes del catálogo (nítidas vs desenfocadas σ=2.2).
// Se vuelven a calibrar con fotos reales de cámara (pendiente: ver docs/EVALUACION.md).
export const QUALITY_DEFAULTS = { minSharpness: 40, minMean: 45, maxGlare: 0.12 };

/** @returns {{ok:boolean, issue:null|'borrosa'|'poca_luz'|'reflejo', sharp:number, mean:number, glare:number}} */
export const assessCrop = (rgba, w, h, limits = QUALITY_DEFAULTS) => {
  const sharp = sharpness(rgba, w, h), { glare, mean } = exposure(rgba, w, h);
  const issue = mean < limits.minMean ? 'poca_luz' : glare > limits.maxGlare ? 'reflejo' : sharp < limits.minSharpness ? 'borrosa' : null;
  return { ok: !issue, issue, sharp, mean, glare };
};

/** Firma de 16×22 en gris (media por bloque) del recorte rectificado. */
export const signature = (rgba, w, h, sw = 16, sh = 22) => {
  const out = new Float32Array(sw * sh);
  for (let by = 0; by < sh; by++) for (let bx = 0; bx < sw; bx++) {
    const x0 = Math.floor((bx * w) / sw), x1 = Math.max(x0 + 1, Math.floor(((bx + 1) * w) / sw)), y0 = Math.floor((by * h) / sh), y1 = Math.max(y0 + 1, Math.floor(((by + 1) * h) / sh));
    let s = 0, c = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s += rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114; c++; }
    out[by * sw + bx] = s / c;
  }
  return out;
};

/** Diferencia media absoluta entre dos firmas (0..255). Ignora el nivel medio de luz restándolo. */
export const signatureDistance = (a, b) => {
  let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - ma - (b[i] - mb));
  return d / a.length;
};
