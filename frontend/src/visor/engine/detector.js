// Detector geométrico de carta: bordes → relleno de huecos → mayor blob → cuadrilátero → validación.
// Pensado para fotogramas reducidos (~160 px). Devuelve esquinas normalizadas (0..1) y diagnóstico.
import { convexHull, approxQuad, orderCorners, polyArea, dist, fitQuadRansac } from './geometry.js';

export const CARD_ASPECT = 63 / 88; // 0.716, formato estándar de TCG

/** Escala RGBA a gris con `maxDim` en el lado mayor. Devuelve {data,width,height,scale}. */
export const toGray = (rgba, width, height, maxDim = 160) => {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const data = new Uint8Array(w * h), bx = width / w, by = height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(width - 1, Math.floor((x + 0.5) * bx)), sy = Math.min(height - 1, Math.floor((y + 0.5) * by)), i = (sy * width + sx) * 4;
    data[y * w + x] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }
  return { data, width: w, height: h, scale };
};

const dilate = (m, w, h) => {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) o[yy * w + xx] = 1;
    }
  }
  return o;
};

/** Magnitud del gradiente (Sobel) y su media/desviación. */
const gradientOf = ({ data, width: w, height: h }) => {
  const mag = new Float32Array(w * h); let sum = 0, sum2 = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = data[i - w + 1] + 2 * data[i + 1] + data[i + w + 1] - data[i - w - 1] - 2 * data[i - 1] - data[i + w - 1];
    const gy = data[i + w - 1] + 2 * data[i + w] + data[i + w + 1] - data[i - w - 1] - 2 * data[i - w] - data[i - w + 1];
    const m = Math.abs(gx) + Math.abs(gy); mag[i] = m; sum += m; sum2 += m * m;
  }
  const n = (w - 2) * (h - 2), mean = sum / n;
  return { mag, mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
};

/** Fracción del perímetro del cuadrilátero que cae sobre píxeles de borde (máscara ya dilatada). */
const edgeSupport = (quad, edges, w, h) => {
  let hit = 0, n = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = quad[i], [x2, y2] = quad[(i + 1) % 4], len = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(8, Math.round(len));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(x1 + ((x2 - x1) * k) / steps), y = Math.round(y1 + ((y2 - y1) * k) / steps);
      if (x < 0 || y < 0 || x >= w || y >= h) continue; // el tramo fuera del encuadre no cuenta
      n++; if (edges[y * w + x]) hit++;
    }
  }
  return n ? hit / n : 0;
};

/**
 * @param {{data:Uint8Array,width:number,height:number}} gray
 * @returns {{corners:number[][], score:number, areaFrac:number, rectangularity:number, aspect:number, landscape:boolean}|{reason:string}}
 */
const detectBlob = (gray, { closing = 2, minArea = 0.1, maxArea = 0.97, minRect = 0.86, minSupport = 0.72 } = {}) => {
  const { data, width: w, height: h } = gray;
  const { mag, mean, std } = gradientOf(gray);
  const thr = Math.max(60, mean + 0.8 * std);
  let edges = new Uint8Array(w * h);
  for (let i = 0; i < edges.length; i++) edges[i] = mag[i] > thr ? 1 : 0;
  for (let k = 0; k < closing; k++) edges = dilate(edges, w, h);
  // Fondo = lo alcanzable desde el borde sin cruzar bordes; objeto = el resto (los contornos cerrados quedan rellenos)
  const bg = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { const i = y * w + x; if (!edges[i] && !bg[i]) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Mayor componente conexa del objeto
  const label = new Int32Array(w * h); let best = { id: 0, size: 0, pts: null }, next = 0;
  for (let s = 0; s < w * h; s++) {
    if (bg[s] || label[s]) continue;
    const id = ++next, pts = []; label[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0; pts.push(i);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !bg[j] && !label[j]) { label[j] = id; stack.push(j); }
      }
    }
    if (pts.length > best.size) best = { id, size: pts.length, pts };
  }
  if (best.size < minArea * w * h * 0.5) return { reason: 'sin_objeto' };
  const inBlob = (i) => label[i] === best.id, boundary = [];
  for (const i of best.pts) {
    const x = i % w, y = (i / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !inBlob(i - 1) || !inBlob(i + 1) || !inBlob(i - w) || !inBlob(i + w)) boundary.push([x, y]);
  }
  const hull = convexHull(boundary);
  if (hull.length < 4) return { reason: 'sin_cuadrilatero' };
  const fitted = fitQuadRansac(boundary), hullQuad = orderCorners(approxQuad(hull));
  // La recta ajustada resiste fondos pegados; se usa solo si encierra un área parecida al blob (si no, el casco)
  // Mano sosteniendo la carta: el blob incluye dedos y deja de ser un rectángulo. Si las 4 rectas ajustadas tienen respaldo de
  // bordes reales a lo largo de su perímetro, se acepta ese cuadrilátero aunque el blob no lo sea (soporta dedos tapando un borde).
  // En una escena con textura (colcha, madera) casi todo píxel es borde: el respaldo debe superar al del azar (densidad de la escena)
  let dens = 0; for (let i = 0; i < edges.length; i++) dens += edges[i]; dens /= edges.length;
  const support = fitted ? edgeSupport(fitted, edges, w, h) : 0;
  const handHeld = fitted && support >= Math.max(minSupport, Math.min(0.97, dens + 0.3)) && fitted.every(([x, y]) => x > -0.08 * w && x < 1.08 * w && y > -0.08 * h && y < 1.08 * h);
  const clean = fitted && polyArea(fitted) > best.size * 0.8 && polyArea(fitted) < best.size * 1.15;
  const quad = clean || handHeld ? fitted : hullQuad;
  const quadArea = polyArea(quad), areaFrac = quadArea / (w * h), rectangularity = clean ? best.size / quadArea : handHeld ? Math.max(minRect, support) : best.size / quadArea;
  if (areaFrac < minArea) return { reason: 'muy_pequena', areaFrac };
  if (areaFrac > maxArea) return { reason: 'ocupa_todo_el_encuadre', areaFrac };
  if (rectangularity < minRect) return { reason: 'forma_irregular', areaFrac, rectangularity };
  // Proporciones (promedio de lados opuestos); la carta puede estar en vertical u horizontal
  const wd = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2, ht = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2;
  const aspect = Math.min(wd, ht) / Math.max(wd, ht);
  if (Math.abs(aspect - CARD_ASPECT) > 0.14) return { reason: 'proporcion_no_es_carta', aspect, areaFrac };
  // Retrae las esquinas lo que se dilató para no incluir fondo en el recorte
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4, inset = closing + 0.5;
  const corners = quad.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [(x - ((x - cx) / d) * inset) / w, (y - ((y - cy) / d) * inset) / h]; });
  const aspectScore = 1 - Math.min(1, Math.abs(aspect - CARD_ASPECT) / 0.14);
  return { corners, areaFrac, rectangularity, aspect, landscape: wd > ht, score: 0.5 * Math.min(1, (rectangularity - minRect) / (1 - minRect)) + 0.5 * aspectScore };
};

// ---- Método 2: rectas dominantes (Hough) + validación de apariencia --------------------------------------------------
// Resiste fondos con textura (madera, tela): una veta no forma un cuadrilátero cuyo borde tenga SIEMPRE el mismo contraste
// interior/exterior, y el borde de una carta sí.

/** Puntúa un cuadrilátero (px): respaldo de bordes fuertes y consistencia del contraste a ambos lados del perímetro. */
export const scoreQuad = (quad, gray, strong) => {
  const { data: g, width: w, height: h } = gray, cx = quad.reduce((a, p) => a + p[0], 0) / 4, cy = quad.reduce((a, p) => a + p[1], 0) / 4;
  const at = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= w || yi >= h ? -1 : g[yi * w + xi]; };
  const band = (x, y, nx, ny, sgn) => { let t = 0; for (const d of [2, 3, 4]) { const v = at(x + sgn * nx * d, y + sgn * ny * d); if (v < 0) return -1; t += v; } return t / 3; };
  let n = 0, hit = 0, m = 0, pos = 0, neg = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = quad[i], [x2, y2] = quad[(i + 1) % 4], len = Math.hypot(x2 - x1, y2 - y1) || 1, tx = (x2 - x1) / len, ty = (y2 - y1) / len;
    let nx = ty, ny = -tx; if (((x1 + x2) / 2 - cx) * nx + ((y1 + y2) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; } // normal hacia afuera
    const steps = Math.max(10, Math.round(len));
    for (let k = 1; k < steps; k++) {
      const x = x1 + tx * len * (k / steps), y = y1 + ty * len * (k / steps), xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue; // tramo fuera del encuadre: no cuenta
      n++;
      let on = false;
      for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = xi + dx, yy = yi + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && strong[yy * w + xx]) { on = true; break; } }
      if (on) hit++;
      const inside = band(x, y, nx, ny, -1), outside = band(x, y, nx, ny, 1);
      if (inside < 0 || outside < 0) continue;
      m++; const d = inside - outside; if (d > 10) pos++; else if (d < -10) neg++;
    }
  }
  return { support: n ? hit / n : 0, consistency: m ? Math.max(pos, neg) / m : 0, n, m };
};

const houghLines = (pts, w, h, { step = 3, maxLines = 14, minVotes = 12 } = {}) => {
  const nT = Math.round(180 / step), diag = Math.hypot(w, h), off = Math.ceil(diag), nR = 2 * off + 1, acc = new Uint16Array(nT * nR);
  const cs = Array.from({ length: nT }, (_, t) => Math.cos((t * step * Math.PI) / 180)), sn = Array.from({ length: nT }, (_, t) => Math.sin((t * step * Math.PI) / 180));
  for (const [x, y] of pts) for (let t = 0; t < nT; t++) acc[t * nR + Math.round(x * cs[t] + y * sn[t]) + off]++;
  const cells = [];
  for (let i = 0; i < acc.length; i++) if (acc[i] >= minVotes) cells.push(i);
  cells.sort((a, b) => acc[b] - acc[a]);
  const chosen = [];
  for (const c of cells) {
    const t = (c / nR) | 0, rho = (c % nR) - off;
    if (chosen.some((l) => Math.min(Math.abs(l.t - t), nT - Math.abs(l.t - t)) <= 2 && Math.abs(l.rho - rho) <= 5)) continue;
    chosen.push({ t, rho }); if (chosen.length >= maxLines) break;
  }
  // Refinado: mínimos cuadrados con los puntos cercanos a cada recta
  return chosen.map(({ t, rho }) => {
    const inl = pts.filter(([x, y]) => Math.abs(x * cs[t] + y * sn[t] - rho) <= 1.6);
    if (inl.length < 6) return { nx: cs[t], ny: sn[t], c: rho };
    const mx = inl.reduce((a, p) => a + p[0], 0) / inl.length, my = inl.reduce((a, p) => a + p[1], 0) / inl.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of inl) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), nx = -Math.sin(th), ny = Math.cos(th);
    return { nx, ny, c: nx * mx + ny * my };
  });
};

const meet = (a, b) => { const det = a.nx * b.ny - a.ny * b.nx; return Math.abs(det) < 0.05 ? null : [(a.c * b.ny - a.ny * b.c) / det, (a.nx * b.c - a.c * b.nx) / det]; };
const angBetween = (a, b) => { const d = Math.abs(Math.atan2(a.nx * b.ny - a.ny * b.nx, a.nx * b.nx + a.ny * b.ny)); return Math.min(d, Math.PI - d); };
export const strongMask = (gray) => {
  const { width: w, height: h } = gray, { mag, mean, std } = gradientOf(gray), thr = Math.max(80, mean + 1.4 * std), strong = new Uint8Array(w * h), pts = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (mag[y * w + x] > thr) { strong[y * w + x] = 1; pts.push([x, y]); }
  return { strong, pts };
};

/**
 * Un cuadrilátero hallado más ancho que una carta (p. ej. sin el borde superior, que casi no contrasta con la mesa) se alarga hasta la
 * proporción de carta repartiendo la diferencia entre arriba y abajo donde el borde nuevo sea más fuerte. Si no hay borde, no se toca.
 */
const extendToCard = (q, mag, w, h, towardTop = false) => {
  const [tl, tr, br, bl] = q, len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wd = (len(tl, tr) + len(bl, br)) / 2, ht = (len(tl, bl) + len(tr, br)) / 2, need = wd / CARD_ASPECT - ht;
  if (!(need > 0.06 * ht)) return q; // ya es (casi) una carta de pie
  const up = (a, b) => { const d = len(a, b) || 1; return [(a[0] - b[0]) / d, (a[1] - b[1]) / d]; }, uL = up(tl, bl), uR = up(tr, br);
  const strength = (p1, p2) => { let t = 0, n = 0; const steps = Math.max(10, Math.round(len(p1, p2))); for (let k = 0; k <= steps; k++) { const x = Math.round(p1[0] + ((p2[0] - p1[0]) * k) / steps), y = Math.round(p1[1] + ((p2[1] - p1[1]) * k) / steps); if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return -1; let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m = Math.max(m, mag[(y + dy) * w + x + dx]); t += m; n++; } return n ? t / n : 0; };
  const ref = towardTop ? 0 : (strength(tl, bl) + strength(tr, br)) / 2;
  let best = null;
  if (!towardTop) for (const a of [0, 0.25, 0.5, 0.75, 1]) { // a = parte que se extiende por arriba
    const T = need * a, B = need * (1 - a), ntl = [tl[0] + uL[0] * T, tl[1] + uL[1] * T], ntr = [tr[0] + uR[0] * T, tr[1] + uR[1] * T], nbl = [bl[0] - uL[0] * B, bl[1] - uL[1] * B], nbr = [br[0] - uR[0] * B, br[1] - uR[1] * B];
    const sT = a > 0 ? strength(ntl, ntr) : null, sB = a < 1 ? strength(nbl, nbr) : null;
    if ((sT !== null && sT < 0) || (sB !== null && sB < 0)) continue; // el borde nuevo saldría del encuadre
    const score = (sT ?? 0) * a + (sB ?? 0) * (1 - a);
    if (!best || score > best.score) best = { score, quad: [ntl, ntr, nbr, nbl] };
  }
  if (best && best.score >= 0.35 * ref) return best.quad;
  if (!towardTop) return q;
  const m = Math.hypot(uL[0] + uR[0], uL[1] + uR[1]) || 1, ux = (uL[0] + uR[0]) / m, uy = (uL[1] + uR[1]) / m; // dirección media de los lados: una sola, para que el borde nuevo no tiemble con cada lado
  // Sin borde visible no se sabe qué parte de la carta falta: la carta se muestra centrada, así que falta la parte que queda hacia el borde del encuadre
  const down = (tl[1] + bl[1]) / 2 < h / 2, k = down ? -need : need, from = down ? [bl, br] : [tl, tr];
  const t = from.map(([x, y]) => [x + ux * k, y + uy * k]);
  return t.every(([x, y]) => x > -0.1 * w && x < 1.1 * w && y > -0.1 * h && y < 1.1 * h) ? (down ? [tl, tr, t[1], t[0]] : [t[0], t[1], br, bl]) : q;
};

const detectByLines = (gray, { minArea = 0.08, maxArea = 0.95 } = {}) => {
  const { width: w, height: h } = gray, { strong, pts } = strongMask(gray), lines = houghLines(pts, w, h), found = [], all = [], L = lines.length, gmag = gradientOf(gray).mag;
  const ok = ([x, y]) => x > -0.12 * w && x < 1.12 * w && y > -0.12 * h && y < 1.12 * h;
  for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) for (let k = j + 1; k < L; k++) for (let l = k + 1; l < L; l++) {
    const q = [lines[i], lines[j], lines[k], lines[l]];
    for (const [a, b, c, d] of [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]]) { // (a,b) y (c,d) = parejas de lados opuestos
      if (angBetween(q[a], q[b]) > 0.52 || angBetween(q[c], q[d]) > 0.52 || angBetween(q[a], q[c]) < 0.6) continue;
      const v = [meet(q[a], q[c]), meet(q[c], q[b]), meet(q[b], q[d]), meet(q[d], q[a])];
      if (v.some((p) => !p || !ok(p))) continue;
      const ord = orderCorners(v), area = polyArea(ord);
      if (Math.abs(area - polyArea(v)) > 1e-3 * area) continue; // cruzado: no es un cuadrilátero simple
      const areaFrac = area / (w * h);
      if (areaFrac < minArea || areaFrac > maxArea) continue;
      const wd = (dist(ord[0], ord[1]) + dist(ord[3], ord[2])) / 2, ht = (dist(ord[0], ord[3]) + dist(ord[1], ord[2])) / 2, aspect = Math.min(wd, ht) / Math.max(wd, ht);
      if (Math.abs(aspect - CARD_ASPECT) > 0.1) continue;
      const sc = scoreQuad(ord, gray, strong);
      if (sc.support < 0.4 || sc.consistency < 0.55) continue;
      const cand = { quad: ord, areaFrac, aspect, landscape: wd > ht, ...sc, score: 0.4 * sc.support + 0.6 * sc.consistency };
      all.push(cand);
      if (sc.support >= 0.5 && sc.consistency >= 0.8) found.push(cand);
    }
  }
  if (!found.length) return null;
  const top = Math.max(...found.map((f) => f.score));
  let best = found.filter((f) => f.score >= top - 0.07).sort((a, b) => b.areaFrac - a.areaFrac)[0]; // con puntuación pareja, el borde EXTERIOR
  // Una carta tiene rectángulos internos muy contrastados (caja de texto, ilustración): si hay un cuadrilátero mayor que contiene al elegido
  // y también tiene borde coherente (aunque más tenue, p. ej. marco oscuro sobre madera), el borde de la carta es ese.
  const bb = (q) => [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1])), Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1]))];
  const [bx0, by0, bx1, by1] = bb(best.quad);
  const outer = all.filter((c) => { const [x0, y0, x1, y1] = bb(c.quad); return c.areaFrac >= best.areaFrac * 1.2 && x0 <= bx0 + 2 && y0 <= by0 + 2 && x1 >= bx1 - 2 && y1 >= by1 - 2 && c.score >= best.score - 0.25 && !c.landscape; }).sort((a, b) => b.areaFrac - a.areaFrac)[0];
  if (outer) best = outer;
  if (!best.landscape) { const ext = extendToCard(best.quad, gmag, w, h); if (ext !== best.quad) { best = { ...best, quad: ext, areaFrac: polyArea(ext) / (w * h) }; best.aspect = Math.min(dist(ext[0], ext[1]), dist(ext[0], ext[3])) / Math.max(dist(ext[0], ext[1]), dist(ext[0], ext[3])); } }
  return { corners: best.quad.map(([x, y]) => [x / w, y / h]), areaFrac: best.areaFrac, rectangularity: best.support, aspect: best.aspect, landscape: best.landscape, score: best.score, via: 'lineas', consistency: best.consistency };
};

/** Detector: contorno por bordes y rectas dominantes; se acepta solo lo que valide la apariencia del borde. */
export const detectCard = (gray, opts = {}) => {
  const out = detectRaw(gray, opts);
  if (!out.corners || opts.debug) return out;
  // Un recuadro más ancho que alto (wd > ht) es casi siempre la mitad inferior de una carta de pie (el borde de arriba contrasta poco con la mesa)
  const { width: w, height: h } = gray, q = out.corners.map(([x, y]) => [x * w, y * h]), ext = out.landscape ? extendToCard(q, null, w, h, true) : q;
  return ext === q ? out : { ...out, corners: ext.map(([x, y]) => [x / w, y / h]), areaFrac: polyArea(ext) / (w * h), landscape: false, via: out.via + '+ext' };
};

const detectRaw = (gray, opts = {}) => {
  const blob = detectBlob(gray, opts), lines = detectByLines(gray, opts);
  let blobOk = null;
  if (blob.corners) {
    const { width: w, height: h } = gray, sc = scoreQuad(blob.corners.map(([x, y]) => [x * w, y * h]), gray, strongMask(gray).strong);
    // El contorno solo vale si su borde tiene contraste consistente (una veta de madera no lo tiene)
    if (sc.consistency >= 0.8) blobOk = { ...blob, via: 'contorno', consistency: sc.consistency };
  }
  if (opts.debug) return { blob, blobOk, lines, blobScore: blob.corners && scoreQuad(blob.corners.map(([x, y]) => [x * gray.width, y * gray.height]), gray, strongMask(gray).strong) };
  if (blobOk && lines) { // dos candidatos válidos: el mayor es el borde exterior de la carta (el menor suele ser su marco o su caja de texto)
    const big = blobOk.areaFrac >= lines.areaFrac ? blobOk : lines, small = big === blobOk ? lines : blobOk;
    return big.areaFrac > small.areaFrac * 1.15 ? big : blobOk.consistency >= lines.consistency - 0.02 ? blobOk : lines;
  }
  return blobOk || lines || (blob.corners ? { reason: 'borde_sin_contraste_consistente' } : blob);
};
