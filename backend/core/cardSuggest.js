// «¿Quisiste decir…?»: corrige cada palabra que no existe en ningún nombre de carta por la palabra más parecida (y más usada) del catálogo.
const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’‘´`]/g, '');
const wordsOf = (text) => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
const tolerance = (word) => (word.length < 4 ? 1 : word.length < 8 ? 2 : 3);

let vocabulary = null; // palabra → cantidad de cartas que la usan
let names = []; // nombres normalizados, para saber qué palabras aparecen juntas

export function buildVocabulary(names_) {
  const counts = new Map();
  for (const name of names_) for (const word of new Set(wordsOf(name))) if (word.length >= 3 && !/\d/.test(word)) counts.set(word, (counts.get(word) || 0) + 1);
  vocabulary = counts;
  names = [...new Set(names_.map((name) => normalize(name)))];
  return counts;
}
export const hasVocabulary = () => Boolean(vocabulary);

// Distancia de edición con tope: corta cuando ya superó `max`
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

const cache = new Map();

// Devuelve el texto corregido o null si todas las palabras existen (o no hay nada parecido)
export function suggestQuery(query) {
  if (!vocabulary) return null;
  const key = normalize(query).trim();
  if (key.length < 3 || key.length > 80) return null;
  if (cache.has(key)) return cache.get(key);
  let changed = false;
  const words = wordsOf(query).slice(0, 8).map((word) => {
    if (word.length < 3 || /\d/.test(word) || vocabulary.has(word)) return word;
    const max = tolerance(word);
    // Candidatos a una letra del mínimo; gana el que aparece junto a las otras palabras en algún nombre («boss orderer» → «boss orders»),
    // y si ninguno, el más cercano y más usado
    const others = wordsOf(query).filter((other) => other !== word && other.length >= 3 && !/\d/.test(other)).slice(0, 4);
    let minD = max + 1;
    const found = [];
    for (const [candidate, count] of vocabulary) {
      const d = distance(word, candidate, max);
      if (d > max) continue;
      minD = Math.min(minD, d);
      found.push({ candidate, d, count });
    }
    const pool = found.filter((entry) => entry.d <= minD + 1).sort((x, y) => y.count - x.count).slice(0, 40);
    const together = (entry) => (others.length ? names.reduce((total, name) => total + (name.includes(entry.candidate) && others.every((other) => name.includes(other)) ? 1 : 0), 0) : 0);
    let best = null;
    for (const entry of pool) {
      const co = together(entry);
      const better = !best || (co > 0) !== (best.co > 0) ? (co > 0) : entry.d !== best.d ? entry.d < best.d : Math.abs(entry.candidate.length - word.length) !== Math.abs(best.candidate.length - word.length) ? Math.abs(entry.candidate.length - word.length) < Math.abs(best.candidate.length - word.length) : entry.count > best.count;
      if (!best || better) best = { ...entry, co };
    }
    if (!best) return word;
    changed = true;
    return best.candidate;
  });
  const result = changed ? words.join(' ') : null;
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}
