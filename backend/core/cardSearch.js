// Acotar candidatos en SQL antes de comparar nombres; sin extensiones de PostgreSQL.
const words = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
const tolerance = (word) => word.length < 4 ? 0 : word.length < 8 ? 1 : 2;

export function searchFragments(query) {
  const word = words(query).sort((a, b) => b.length - a.length)[0];
  if (!word || !tolerance(word)) return [];
  const count = tolerance(word) + 1;
  return Array.from({ length: count }, (_, index) => word.slice(Math.floor(index * word.length / count), Math.floor((index + 1) * word.length / count)));
}

function closeWord(a, b) {
  if (b.startsWith(a)) return true;
  const limit = tolerance(a);
  if (!limit || Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = row;
  }
  return previous[b.length] <= limit;
}

export function similarCardName(name, query) {
  const wanted = words(query);
  const available = words(name);
  return wanted.length > 0 && wanted.every((word) => available.some((candidate) => closeWord(word, candidate)));
}
