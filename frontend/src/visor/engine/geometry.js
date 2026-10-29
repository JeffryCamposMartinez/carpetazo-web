// Geometría pura (sin DOM): casco convexo, cuadrilátero aproximado, homografía y warp con muestreo bilineal.

/** Casco convexo (monotone chain). pts: [[x,y],...] */
export const convexHull = (pts) => {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

export const polyArea = (poly) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
};

/** Reduce un polígono convexo a 4 vértices quitando, de forma voraz, el que menos área aporta. */
export const approxQuad = (hull) => {
  const poly = hull.slice();
  while (poly.length > 4) {
    let best = -1, bestLoss = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
      const loss = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2; // triángulo a-b-c
      if (loss < bestLoss) { bestLoss = loss; best = i; }
    }
    poly.splice(best, 1);
  }
  return poly;
};

/**
 * Ajusta las 4 rectas dominantes de un contorno (RANSAC determinista) y devuelve sus 4 intersecciones,
 * o null. Resiste objetos pegados a la carta, que deforman el casco convexo.
 */
export const fitQuadRansac = (points, { iters = 220, tol = 1.4, minFrac = 0.08 } = {}) => {
  if (points.length < 40) return null;
  let seed = 12345; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length, cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  let rest = points.slice();
  const lines = [];
  for (let k = 0; k < 4; k++) {
    if (rest.length < points.length * minFrac) return null;
    let best = null;
    for (let t = 0; t < iters; t++) {
      const a = rest[(rand() * rest.length) | 0], b = rest[(rand() * rest.length) | 0], len = dist(a, b);
      if (len < 8) continue;
      const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, c = nx * a[0] + ny * a[1];
      let inl = 0;
      for (const p of rest) if (Math.abs(nx * p[0] + ny * p[1] - c) <= tol) inl++;
      if (!best || inl > best.inl) best = { nx, ny, c, inl };
    }
    if (!best || best.inl < points.length * minFrac) return null;
    // Reajuste por mínimos cuadrados con los inliers (dirección principal)
    const inl = rest.filter((p) => Math.abs(best.nx * p[0] + best.ny * p[1] - best.c) <= tol);
    const mx = inl.reduce((s, p) => s + p[0], 0) / inl.length, my = inl.reduce((s, p) => s + p[1], 0) / inl.length;
    let sxx = 0, sxy = 0, syy = 0; for (const p of inl) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); let nx = -Math.sin(th), ny = Math.cos(th);
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; } // normal hacia afuera del centro
    lines.push({ nx, ny, c: nx * mx + ny * my, ang: Math.atan2(ny, nx) });
    rest = rest.filter((p) => Math.abs(nx * p[0] + ny * p[1] - (nx * mx + ny * my)) > tol * 2.2);
  }
  lines.sort((a, b) => a.ang - b.ang);
  const quad = [];
  for (let i = 0; i < 4; i++) {
    const l1 = lines[i], l2 = lines[(i + 1) % 4], det = l1.nx * l2.ny - l1.ny * l2.nx;
    if (Math.abs(det) < 0.2) return null; // casi paralelas: no es un vértice
    quad.push([(l1.c * l2.ny - l1.ny * l2.c) / det, (l1.nx * l2.c - l1.c * l2.nx) / det]);
  }
  return orderCorners(quad);
};

/** Ordena 4 puntos como [TL, TR, BR, BL] (sentido horario en pantalla). */
export const orderCorners = (q) => {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  const byAngle = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let tl = 0, best = Infinity; // el de menor x+y es TL
  byAngle.forEach((p, i) => { const s = p[0] + p[1]; if (s < best) { best = s; tl = i; } });
  return [0, 1, 2, 3].map((k) => byAngle[(tl + k) % 4]);
};

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Resuelve el sistema lineal n×n (eliminación gaussiana con pivoteo). */
const solve = (A, b) => {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let m = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
};

/** Homografía que lleva el rectángulo destino (0,0)-(w,h) a las 4 esquinas de origen [TL,TR,BR,BL]. */
export const homographyRectToQuad = (quad, w, h) => {
  const dst = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = dst[i], [x, y] = quad[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const s = solve(A, b);
  return s && [...s, 1];
};

/** Rectifica la carta: copia en `out` (RGBA w×h) la región `quad` de `src` ({data,width,height} RGBA). */
export const warpQuad = (src, quad, w, h, out = new Uint8ClampedArray(w * h * 4)) => {
  const H = homographyRectToQuad(quad, w, h);
  if (!H) return null;
  const { data, width: sw, height: sh } = src;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = H[6] * x + H[7] * y + 1, sx = (H[0] * x + H[1] * y + H[2]) / d, sy = (H[3] * x + H[4] * y + H[5]) / d;
    const x0 = Math.max(0, Math.min(sw - 2, Math.floor(sx))), y0 = Math.max(0, Math.min(sh - 2, Math.floor(sy)));
    const fx = Math.max(0, Math.min(1, sx - x0)), fy = Math.max(0, Math.min(1, sy - y0));
    const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, o = (y * w + x) * 4;
    for (let c = 0; c < 4; c++) out[o + c] = data[i00 + c] * (1 - fx) * (1 - fy) + data[i10 + c] * fx * (1 - fy) + data[i01 + c] * (1 - fx) * fy + data[i11 + c] * fx * fy;
  }
  return out;
};

/** Gira el orden de las esquinas k·90° para probar otra orientación de la carta. */
export const rotateQuad = (quad, k) => quad.map((_, i) => quad[(i + k) % 4]);
