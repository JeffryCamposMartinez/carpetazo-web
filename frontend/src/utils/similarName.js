// Coincidencia aproximada de nombres de carta: sin tildes ni mayúsculas, y tolera hasta tres letras mal escritas ("lucaro" encuentra "Lucario").
const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const wordsOf = (text) => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);

// Distancia de edición entre dos palabras; corta en cuanto supera `max`
const distance = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
};

// Cada palabra buscada debe parecerse a alguna del nombre: igual, comienzo de palabra o con pocas letras distintas (solo desde 3 letras)
export const isSimilarName = (name, query) => {
  const wanted = wordsOf(query);
  if (!wanted.length) return false;
  const have = wordsOf(name);
  return wanted.every((word) => have.some((candidate) => {
    if (candidate === word || candidate.startsWith(word)) return true;
    if (word.length < 3) return false;
    const allowed = word.length >= 8 ? 3 : word.length >= 5 ? 2 : 1;
    return distance(word, candidate, allowed) <= allowed;
  }));
};
