// Adaptadores por juego. Cada TCG imprime identificadores distintos: no hay una expresión regular universal.
//   canonNumber(raw)  → forma canónica comparable (catálogo e impreso pasan por la misma función)
//   parseOcr(text)    → { number, setCode } leídos del texto OCR de las regiones `ocrRegions` (coordenadas 0..1 de la carta de frente)
// Los formatos están basados en el catálogo real de Carpetazo; las regiones OCR y la lectura real de cada juego
// están por verificar con fotos de cartas físicas (ver docs/COBERTURA.md).
import { fixDigits, trimZeros } from './common.js';

const LANG = new Set(['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'JP', 'JA', 'KO', 'ZH', 'SP']);
const up = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ');
const alnum = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const game = (spec) => ({
  catalogGames: [], ocrRegions: [], printed: 'verificado', limits: [],
  canonNumber: () => null, parseOcr: () => ({ number: null, setCode: null }),
  setMatches(printed, meta) { const a = alnum(printed), b = alnum(meta?.setAbbr); return a && b ? a === b : null; },
  ...spec,
});

// Pokémon: «008/102», promos «SWSH123», galerías «TG05/TG30». El set se identifica por símbolo/sigla pequeña.
const PK_PART = /^[A-Z]{0,5}\d{1,3}[A-Z]?$/;
export const pokemon = game({
  id: 'Pokemon', label: 'Pokémon', catalogGames: ['Pokemon', 'Pokemon_Japan'],
  nameRegion: { id: 'nombre', x: 0.1, y: 0.025, w: 0.56, h: 0.075 }, // el nombre va arriba a la izquierda (tras la etapa «Básico»); regiones por verificar con más fotos
  ocrRegions: [{ id: 'pie_izquierda', x: 0.02, y: 0.9, w: 0.46, h: 0.09 }, { id: 'pie_derecha', x: 0.52, y: 0.9, w: 0.46, h: 0.09 }],
  canonNumber(raw) {
    const parts = up(raw).replace(/\s/g, '').split('/');
    return parts.length <= 2 && parts.every((p) => PK_PART.test(p)) ? parts.map(trimZeros).join('/') : null;
  },
  parseOcr(text) {
    const t = up(text), digitsOf = (p) => p.replace(/^([A-Z]{0,4}?)([0-9OIS]{1,3})([A-Z]?)$/, (_, a, d, s) => a + fixDigits(d) + s);
    let number = null;
    const slash = t.match(/\b([A-Z]{0,4}[0-9OIS]{1,3}[A-Z]?)\s*[/|]\s*([A-Z]{0,4}[0-9OIS]{1,3})\b/);
    if (slash) number = this.canonNumber(`${digitsOf(slash[1])}/${digitsOf(slash[2])}`);
    if (!number) { const promo = t.match(/\b(SWSH|SM|XY|BW|HGSS|SVP|SV|MEP|DP|NP)\s?-?\s?([0-9OIS]{1,3})\b/); if (promo) number = this.canonNumber(promo[1] + fixDigits(promo[2])); }
    const setCode = (t.match(/\b([A-Z]{2,4}\d?)\b(?=[^A-Z0-9]*(?:[A-Z]{2}\b)?[^A-Z0-9]*[0-9OIS]{1,3}\s*\/)/) || [])[1];
    return { number, setCode: setCode && !LANG.has(setCode) ? setCode : null };
  },
  limits: ['La expansión se imprime como símbolo; el código de siglas solo aparece en cartas modernas.', 'Pokémon Japón comparte formato pero se indexa como juego aparte en el catálogo.'],
});

// Magic: número de coleccionista (modern: «0123/0300 R», MH3 • EN). Las cartas antiguas no imprimen número.
export const magic = game({
  id: 'Magic', label: 'Magic: The Gathering', catalogGames: ['Magic'],
  ocrRegions: [{ id: 'pie', x: 0.03, y: 0.925, w: 0.55, h: 0.07 }],
  canonNumber(raw) { const m = up(raw).replace(/\s/g, '').match(/^(\d{1,4}[A-Z★]?)(?:\/\d{1,4})?$/); return m ? trimZeros(m[1]) : null; },
  parseOcr(text) {
    const t = up(text), m = t.match(/\b([0-9OIS]{1,4}[A-Z★]?)\s*(?:\/\s*[0-9OIS]{1,4})?\s*[RUCMLS]?\b/);
    const code = (t.match(/\b([A-Z0-9]{3,4})\s*[•·*]\s*[A-Z]{2}\b/) || [])[1];
    const raw = m && fixDigits(m[1]);
    return { number: raw && !/^(19|20)\d\d$/.test(raw) ? this.canonNumber(raw) : null, setCode: code || null };
  },
  limits: ['Cartas antiguas sin número de coleccionista: solo identificables visualmente (y entre reimpresiones, con ambigüedad).', 'Varias cartas del catálogo no tienen número cargado.'],
});

// Yu-Gi-Oh!: código de set «LOB-EN001»; el catálogo puede traerlo sin idioma («BPT-001»).
const YGO_RE = /\b([A-Z0-9]{2,5})\s?-\s?([A-Z]{0,2})\s?([0-9OIS]{3,4})\b/;
export const yugioh = game({
  id: 'YuGiOh', label: 'Yu-Gi-Oh!', catalogGames: ['YuGiOh'],
  ocrRegions: [{ id: 'bajo_ilustracion', x: 0.5, y: 0.722, w: 0.47, h: 0.055 }],
  canonNumber(raw) { const m = up(raw).replace(/\s/g, '').match(/^([A-Z0-9]{2,5})-([A-Z]{0,2})(\d{1,4})$/); return m ? `${m[1]}-${trimZeros(m[3])}` : null; },
  parseOcr(text) { const m = up(text).match(YGO_RE); return { number: m ? this.canonNumber(`${m[1]}-${m[2]}${fixDigits(m[3])}`) : null, setCode: m ? m[1] : null }; },
  setMatches(printed, meta) { const n = alnum(meta?.number).match(/^([A-Z0-9]{2,5}?)(?:[A-Z]{2})?\d{1,4}$/); return printed && n ? alnum(printed) === n[1] : null; },
  limits: ['El mismo código impreso puede existir en varias rarezas (distintos productId): solo se distinguen visualmente.', 'La posición del código cambia según el marco de la carta (regiones por verificar).'],
});

// One Piece: «ST01-001», «OP05-119», «P-001». Las ilustraciones alternativas comparten número.
export const onepiece = game({
  id: 'One_Piece', label: 'One Piece Card Game', catalogGames: ['One_Piece'],
  ocrRegions: [{ id: 'pie', x: 0.45, y: 0.9, w: 0.52, h: 0.09 }],
  canonNumber(raw) {
    const m = up(raw).replace(/\s/g, '').match(/(OP|ST|EB|PRB|P)-?(\d{0,2})-(\d{3})(?!\d)/);
    return m ? `${m[1]}${m[2] ? m[2].padStart(2, '0') : ''}-${m[3]}` : null;
  },
  parseOcr(text) { const m = up(text).match(/\b(OP|ST|EB|PRB|P)\s?-?\s?([0-9OIS]{0,2})\s?-\s?([0-9OIS]{3})\b/); return { number: m ? this.canonNumber(`${m[1]}${fixDigits(m[2])}-${fixDigits(m[3])}`) : null, setCode: m ? m[1] + fixDigits(m[2]) : null }; },
  setMatches() { return null; },
  limits: ['Las versiones alternativas (alt art) comparten número: la impresión se decide por la imagen.'],
});

// Riftbound: «001/298» (con sufijo en variantes: «001a/298»), sigla de set «OGN».
export const riftbound = game({
  id: 'Riftbound', label: 'Riftbound', catalogGames: ['Riftbound'],
  ocrRegions: [{ id: 'pie', x: 0.03, y: 0.925, w: 0.6, h: 0.07 }],
  canonNumber(raw) { const m = up(raw).replace(/\s/g, '').match(/^(\d{1,3}[A-Z*★]?)\/(\d{1,3})$/); return m ? `${trimZeros(m[1])}/${trimZeros(m[2])}` : null; },
  parseOcr(text) {
    const t = up(text), m = t.match(/\b([0-9OIS]{1,3}[A-Z*★]?)\s*\/\s*([0-9OIS]{1,3})\b/), set = (t.match(/\b([A-Z]{3})\b[^A-Z0-9]{0,4}[0-9OIS]{1,3}\s*\//) || [])[1];
    return { number: m ? this.canonNumber(`${fixDigits(m[1])}/${fixDigits(m[2])}`) : null, setCode: set || null };
  },
  limits: ['Variantes (showcase, alt art, foil) comparten número base.'],
});

// Disney Lorcana: «4/P1», «137/204» + código de set «1TFC» y idioma.
export const lorcana = game({
  id: 'Disney_Lorcana', label: 'Disney Lorcana', catalogGames: ['Disney_Lorcana'],
  ocrRegions: [{ id: 'pie', x: 0.02, y: 0.925, w: 0.6, h: 0.07 }],
  canonNumber(raw) { const parts = up(raw).replace(/\s/g, '').split('/'); return parts.length === 1 && /^\d{1,3}$/.test(parts[0]) ? trimZeros(parts[0]) : parts.length === 2 && parts.every((p) => /^[A-Z]?\d{1,3}$/.test(p)) ? parts.map(trimZeros).join('/') : null; },
  parseOcr(text) {
    const t = up(text), m = t.match(/\b([0-9OIS]{1,3})\s*\/\s*([A-Z]?[0-9OIS]{1,3})\b/), set = (t.match(/\b([0-9A-Z]{3,4})\s*[·•\-\s]\s*(?:EN|FR|DE|IT|JP|ES|PT)\b/) || [])[1];
    return { number: m ? this.canonNumber(`${fixDigits(m[1])}/${m[2][0] === 'P' ? m[2] : fixDigits(m[2])}`) : null, setCode: set || null };
  },
  limits: ['El catálogo guarda el número como «4/P1» o «17/207»; el texto impreso es pequeño: el OCR puede fallar en cartas oscuras.'],
});

// Digimon: «BT1-001», «ST1-01», «EX1-001», «P-001». SIN catálogo en Carpetazo todavía.
export const digimon = game({
  id: 'Digimon', label: 'Digimon Card Game', catalogGames: ['Digimon', 'Digimon_Card_Game'],
  ocrRegions: [{ id: 'esquina', x: 0.55, y: 0.02, w: 0.43, h: 0.08 }, { id: 'pie', x: 0.5, y: 0.9, w: 0.48, h: 0.09 }],
  canonNumber(raw) { const m = up(raw).replace(/\s/g, '').match(/^(BT|ST|EX|RB|LM|P)-?(\d{0,2})-(\d{1,3})$/); return m ? `${m[1]}${m[2] ? trimZeros(m[2]) : ''}-${trimZeros(m[3])}` : null; },
  parseOcr(text) { const m = up(text).match(/\b(BT|ST|EX|RB|LM|P)\s?-?\s?([0-9OIS]{0,2})\s?-\s?([0-9OIS]{1,3})\b/); return { number: m ? this.canonNumber(`${m[1]}${fixDigits(m[2])}-${fixDigits(m[3])}`) : null, setCode: m ? m[1] + fixDigits(m[2]) : null }; },
  setMatches() { return null; },
  printed: 'sin verificar',
  limits: ['Carpetazo todavía no tiene catálogo de Digimon: sin índice visual posible.', 'Formato de número tomado de las reglas del juego, sin cartas de referencia en el repositorio.'],
});

// Mitos y Leyendas: ids propios «myl:<id>», número «INMDRAC-224» (código de edición + número). No es un catálogo TCGplayer.
export const myl = game({
  id: 'Mitos y Leyendas', label: 'Mitos y Leyendas', catalogGames: ['Mitos y Leyendas'],
  ocrRegions: [{ id: 'pie', x: 0.0, y: 0.9, w: 1, h: 0.1 }],
  canonNumber(raw) { const t = up(raw).replace(/\s/g, ''), a = t.match(/^([A-Z]{2,8})-(\d{1,3})$/), b = t.match(/^(\d{1,3})\/(\d{1,3})$/); return a ? `${a[1]}-${trimZeros(a[2])}` : b ? `${trimZeros(b[1])}/${trimZeros(b[2])}` : null; },
  parseOcr(text) {
    const t = up(text), a = t.match(/\b([A-Z]{2,8})\s?-\s?([0-9OIS]{1,3})\b/), b = t.match(/\b([0-9OIS]{1,3})\s*\/\s*([0-9OIS]{1,3})\b/);
    return { number: a ? this.canonNumber(`${a[1]}-${fixDigits(a[2])}`) : b ? this.canonNumber(`${fixDigits(b[1])}/${fixDigits(b[2])}`) : null, setCode: a ? a[1] : null };
  },
  setMatches(printed, meta) { const c = alnum(meta?.number).match(/^([A-Z]{2,8})\d{1,3}$/); return printed && c ? alnum(printed) === c[1] : null; },
  printed: 'sin verificar',
  limits: ['Se desconoce qué identificador imprimen las cartas físicas de cada edición: el OCR no está validado con cartas reales.', 'El catálogo de Mitos y Leyendas viene de otra fuente (mazos.cl) y su índice se genera con otra ruta.'],
});

export const GAMES = { Pokemon: pokemon, Magic: magic, YuGiOh: yugioh, One_Piece: onepiece, Riftbound: riftbound, Disney_Lorcana: lorcana, Digimon: digimon, 'Mitos y Leyendas': myl };
export const adapterForCatalogGame = (name) => Object.values(GAMES).find((g) => g.catalogGames.includes(name)) || null;
export const GAME_ORDER = ['Pokemon', 'Mitos y Leyendas', 'Magic', 'YuGiOh', 'One_Piece', 'Riftbound', 'Disney_Lorcana', 'Digimon'];
