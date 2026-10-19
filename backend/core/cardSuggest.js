// «¿Quisiste decir…?»: solo sugiere nombres de cartas reales, el más parecido a lo escrito.
const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’‘´`]/g, '');
const wordsOf = (text) => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);

// «Boss's Orders [Corbeau] - 183/217 (Foil)» → «Boss's Orders»: el nombre sin variante, número ni paréntesis
const baseName = (name) => String(name || '')
  .replace(/\s*\[[^\]]*\]/g, '')
  .replace(/\s*\([^)]*\)/g, '')
  .replace(/\s*[-–]\s*[0-9]+[a-z]?(\/[0-9]+)?\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

let entries = null; // { display, words, text, count } por cada nombre distinto

export function buildVocabulary(names) {
  const byName = new Map();
  for (const name of names) {
    const display = baseName(name);
    const words = wordsOf(display);
    if (!display || !words.length || words.length > 6) continue;
    const key = words.join(' ');
    const found = byName.get(key);
    if (found) found.count += 1;
    else byName.set(key, { display, words, text: key, count: 1 });
  }
  entries = [...byName.values()];
  return entries;
}
export const hasVocabulary = () => Boolean(entries);

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

// Devuelve un nombre de carta parecido a lo escrito, o null si lo escrito ya encuentra cartas o no hay nada suficientemente parecido
export function suggestQuery(query) {
  if (!entries) return null;
  const key = normalize(query).trim();
  if (key.length < 4 || key.length > 80) return null;
  if (cache.has(key)) return cache.get(key);

  const typed = wordsOf(query).filter((word) => !/\d/.test(word)).slice(0, 6); // los números (código de carta) no se corrigen
  let result = null;
  if (typed.length) {
    // Si cada palabra ya está en algún nombre, la búsqueda normal encuentra cartas: no hay nada que corregir
    const exists = entries.some((entry) => typed.every((word) => entry.text.includes(word)));
    if (!exists) {
      const text = typed.join(' ');
      const max = Math.min(3, Math.max(1, Math.floor(text.length * 0.3)));
      let best = null;
      for (const entry of entries) {
        // Lo escrito se compara con cada tramo de igual cantidad de palabras del nombre (el tramo del inicio es el preferido)
        for (let start = 0; start + typed.length <= entry.words.length; start += 1) {
          const d = distance(text, entry.words.slice(start, start + typed.length).join(' '), max);
          if (d > max) continue;
          const candidate = { entry, d, start, extra: entry.words.length - typed.length };
          if (!best || d < best.d || (d === best.d && (start < best.start || (start === best.start && (candidate.extra < best.extra || (candidate.extra === best.extra && entry.count > best.entry.count)))))) best = candidate;
        }
      }
      if (best && normalize(best.entry.display) !== key) result = best.entry.display;
    }
  }
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}
