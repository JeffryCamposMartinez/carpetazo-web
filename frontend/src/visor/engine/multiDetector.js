// Detector de VARIAS cartas en una misma imagen (cartas sueltas sobre una mesa).
// Idea: lo que NO es mesa. La mesa (madera) es saturada y de un solo matiz; el borde de la carta (plata/blanco, funda) tiene poca saturación y
// la ilustración suele tener otro matiz. Se segmenta "no mesa", se rellenan huecos (zonas de la ilustración que se parecen a la madera),
// y cada componente conexo se ajusta a su rectángulo de área mínima. Todo en un fotograma reducido, sin dependencias.
// Resolución: con ≥ 180 px de lado mayor separa cartas casi pegadas (medido en las fotos de tests/fixtures/multi); a 160 px las funden en una.
import { convexHull, polyArea, orderCorners } from './geometry.js';
import { CARD_ASPECT } from './detector.js';

const rgbToHsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx / 255];
};

/** Reduce promediando bloques; devuelve RGB plano. */
const shrink = (rgba, width, height, maxDim) => {
  const f = Math.max(1, Math.floor(Math.max(width, height) / maxDim)), w = Math.floor(width / f), h = Math.floor(height / f), rgb = new Uint8Array(w * h * 3), n = f * f;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) { const i = ((y * f + dy) * width + x * f + dx) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; }
    const o = (y * w + x) * 3; rgb[o] = r / n; rgb[o + 1] = g / n; rgb[o + 2] = b / n;
  }
  return { rgb, w, h };
};

const median = (a) => { const s = Float32Array.from(a).sort(); return s[s.length >> 1]; };

const erode = (m, w, h) => { const o = new Uint8Array(m.length); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w]) o[i] = 1; } return o; };
const dilate = (m, w, h) => { const o = new Uint8Array(m.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (m[i] || (x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w])) o[i] = 1; } return o; };

/** Lo que no es fondo y queda rodeado por la carta se vuelve carta: se marca el fondo desde el borde y se invierte. */
const fillHoles = (m, w, h) => {
  const outside = new Uint8Array(m.length), st = [];
  const push = (x, y) => { const i = y * w + x; if (!m[i] && !outside[i]) { outside[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
  return Uint8Array.from(m, (v, i) => (v || !outside[i] ? 1 : 0));
};

const components = (m, w, h) => {
  const seen = new Uint8Array(m.length), out = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    const st = [s], pts = []; seen[s] = 1; let area = 0;
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0; area++;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !m[i - 1] || !m[i + 1] || !m[i - w] || !m[i + w];
      if (edge) pts.push([x, y]);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && m[j] && !seen[j]) { seen[j] = 1; st.push(j); }
    }
    out.push({ area, pts });
  }
  return out;
};

/** Rectángulo de área mínima de un casco convexo (calibres rotatorios simplificados: una orientación por arista). */
const minAreaRect = (hull) => {
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [x1, y1] = hull[i], [x2, y2] = hull[(i + 1) % hull.length], len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of hull) { const a = x * ux + y * uy, b = -x * uy + y * ux; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b; }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) best = { area, ux, uy, a0, a1, b0, b1 };
  }
  const { ux, uy, a0, a1, b0, b1 } = best, p = (a, b) => [a * ux - b * uy, a * uy + b * ux];
  return { area: best.area, corners: [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)] };
};

export const MULTI_DEFAULTS = { maxDim: 320, minAreaFrac: 0.012, maxAreaFrac: 0.95, minFill: 0.82, aspectTol: 0.1, satMin: 0.2, hueTol: 20, open: false };

/**
 * @param {Uint8ClampedArray|Uint8Array} rgba imagen RGBA
 * @returns {{cards:{corners:number[][], areaFrac:number, fill:number, aspect:number, landscape:boolean}[], wood:{h:number,s:number,v:number}|null}}
 *   `corners` normalizadas 0..1 (tl, tr, br, bl). Una carta por componente; las que se tocan se funden en un solo componente y se descartan por forma.
 */
export const detectCards = (rgba, width, height, opts = {}) => {
  const o = { ...MULTI_DEFAULTS, ...opts }, { rgb, w, h } = shrink(rgba, width, height, o.maxDim), n = w * h;
  const hs = new Float32Array(n), ss = new Float32Array(n), vs = new Float32Array(n);
  for (let i = 0; i < n; i++) { const [hh, s, v] = rgbToHsv(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]); hs[i] = hh; ss[i] = s; vs[i] = v; }
  // Mesa = matiz y saturación dominantes entre los píxeles saturados (la mediana aguanta que las cartas ocupen parte del encuadre)
  // Se mira primero el marco del encuadre (casi siempre mesa) y, si no basta, toda la imagen: con una sola carta grande la mediana global se contamina con su ilustración.
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.06)), sat = [], satAll = [];
  for (let i = 0; i < n; i++) if (ss[i] > 0.25 && vs[i] > 0.12) { satAll.push(i); const x = i % w, y = (i / w) | 0; if (x < ring || y < ring || x >= w - ring || y >= h - ring) sat.push(i); }
  const ringN = 2 * ring * (w + h - 2 * ring);
  if (sat.length < ringN * 0.3) { sat.length = 0; sat.push(...satAll); }
  if (sat.length < n * 0.05) return { cards: [], wood: null };
  const wood = { h: median(sat.map((i) => hs[i])), s: median(sat.map((i) => ss[i])), v: median(sat.map((i) => vs[i])) };
  let m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dh = Math.min(Math.abs(hs[i] - wood.h), 360 - Math.abs(hs[i] - wood.h));
    m[i] = ss[i] < o.satMin || (ss[i] >= o.satMin && dh > o.hueTol) ? 1 : 0;
  }
  if (o.open) { m = erode(m, w, h); m = dilate(m, w, h); } // quita motas de la veta
  m = dilate(m, w, h); m = erode(m, w, h); // une los bordes interrumpidos por reflejos
  m = fillHoles(m, w, h);
  const cards = [], rejected = [];
  for (const c of components(m, w, h)) {
    const frac = c.area / n; if (frac < o.minAreaFrac || frac > o.maxAreaFrac) { if (frac > 0.003) rejected.push({ why: 'area', frac, at: c.pts[0] }); continue; }
    const hull = convexHull(c.pts); if (hull.length < 3) continue;
    const rect = minAreaRect(hull), ord = orderCorners(rect.corners), side = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const wd = (side(ord[0], ord[1]) + side(ord[3], ord[2])) / 2, ht = (side(ord[0], ord[3]) + side(ord[1], ord[2])) / 2, aspect = Math.min(wd, ht) / Math.max(wd, ht);
    const fill = c.area / (rect.area || 1);
    if (fill < o.minFill || Math.abs(aspect - CARD_ASPECT) > o.aspectTol) { rejected.push({ why: 'forma', frac, fill, aspect, at: c.pts[0] }); continue; }
    cards.push({ corners: ord.map(([x, y]) => [x / w, y / h]), areaFrac: polyArea(ord) / n, fill, aspect, landscape: wd > ht });
  }
  return { cards: cards.sort((a, b) => a.corners[0][1] - b.corners[0][1] || a.corners[0][0] - b.corners[0][0]), wood, rejected };
};
