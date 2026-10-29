// Utilidades de texto impreso compartidas por los adaptadores. Cada juego decide su propio formato (ver games/*.js).

export const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normalizeName = (s) => stripAccents(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Confusiones típicas de OCR. Solo se aplican donde el formato exige dígitos.
const TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', S: '5', B: '8', Z: '2', G: '6' };
export const fixDigits = (s) => String(s).replace(/[OQDILSBZG|]/gi, (c) => TO_DIGIT[c.toUpperCase()] ?? c);
// Pares de caracteres que el OCR confunde: sustituirlos cuesta poco en la distancia de edición
const CONFUSABLE = new Set(['O0', '0O', 'I1', '1I', 'L1', '1L', 'S5', '5S', 'B8', '8B', 'Z2', '2Z', 'G6', '6G', 'D0', '0D', 'Q0', '0Q', 'I|', '|I', '1|', '|1']);

/** Levenshtein donde sustituir caracteres confundibles por el OCR cuesta 0.3 en vez de 1. */
export const ocrDistance = (a, b) => {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : CONFUSABLE.has(a[i - 1] + b[j - 1]) ? 0.3 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + sub);
    }
    prev = cur;
  }
  return prev[n];
};

/** Primera línea con al menos 3 letras del texto OCR, limpia (el nombre impreso de la carta). */
export const cleanOcrName = (text) => {
  const line = String(text).split(/\n/).map((l) => l.replace(/[^\p{L}' .-]+/gu, ' ').replace(/\s+/g, ' ').trim()).find((l) => (l.match(/\p{L}/gu) || []).length >= 3);
  return line || null;
};

/** Similitud 0..1 entre dos nombres ya normalizados (1 - distancia de edición relativa). */
export const nameSimilarity = (a, b) => (!a || !b ? 0 : 1 - ocrDistance(a, b) / Math.max(a.length, b.length));

/** Quita ceros a la izquierda de la parte numérica: «008» → «8»; conserva prefijo y sufijo («TG05» → «TG5»). */
export const trimZeros = (token) => String(token).toUpperCase().replace(/^([A-Z]*)0*(\d+)([A-Z★*]*)$/, (_, p, d, s) => `${p}${d}${s}`);

/**
 * Compara dos identificadores ya canónicos.
 * 'exact' (iguales) | 'partial' (coincide la parte principal, p. ej. solo el número sin el total) | 'none' | 'unknown' (falta alguno)
 */
export const compareCanon = (a, b) => {
  if (!a || !b) return 'unknown';
  if (a === b) return 'exact';
  const [a0] = a.split('/'), [b0] = b.split('/');
  return a0 === b0 && (a.includes('/') !== b.includes('/')) ? 'partial' : 'none';
};

/**
 * Corrección restringida por el catálogo: elige entre los identificadores de los candidatos visuales el que menos
 * difiere del leído. Solo corrige si la distancia es pequeña y el ganador es único; nunca inventa un identificador.
 * @returns {{value:string, distance:number}|null}
 */
export const constrainToCandidates = (read, candidates, { maxDistance = 1.0 } = {}) => {
  if (!read) return null;
  let best = null, tie = false;
  for (const c of new Set(candidates.filter(Boolean))) {
    const d = ocrDistance(read, c);
    if (!best || d < best.distance - 1e-9) { best = { value: c, distance: d }; tie = false; } else if (Math.abs(d - best.distance) < 1e-9) tie = true;
  }
  return best && !tie && best.distance <= maxDistance ? best : null;
};
