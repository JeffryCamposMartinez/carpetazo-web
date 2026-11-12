// Mezcla del listado «Cartas en venta»: la prioridad del plan es una probabilidad por carta (por posición), nunca una garantía.
// Nivel 2 (Tienda) y nivel 1 (Legendario) ocupan solo una parte de las posiciones; el resto es de los demás vendedores (nivel 0).
export const SLOT_SHARE = Object.freeze({ 2: 0.4, 1: 0.2 }); // el nivel 0 siempre conserva al menos el 40 % de las posiciones

const stableChance = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // mezcla final: sin ella, posiciones consecutivas dan números parecidos
  hash ^= hash >>> 16; hash = Math.imul(hash, 2246822507); hash ^= hash >>> 13; hash = Math.imul(hash, 3266489909); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
};

// A qué nivel pertenece cada posición de la página [skip, skip+take): `counts` = cuántas cartas hay por nivel.
// Estable para una misma `seed` (la página 2 continúa a la 1 sin repetir) y distinta en cada búsqueda nueva.
// Si un nivel se agota, sus posiciones pasan a otro (primero el 0, luego Tienda y Legendario).
// Devuelve { kinds: nivel de cada posición de la página, offsets: cuántas cartas de cada nivel ya salieron antes de la página }.
export const mixSlots = (seed, skip, take, counts) => {
  const remaining = { 0: counts[0] || 0, 1: counts[1] || 0, 2: counts[2] || 0 };
  const offsets = { 0: 0, 1: 0, 2: 0 };
  const kinds = [];
  for (let index = 0; index < skip + take; index += 1) {
    const chance = stableChance(`${seed}:${index}`);
    let kind = chance < SLOT_SHARE[2] ? 2 : chance < SLOT_SHARE[2] + SLOT_SHARE[1] ? 1 : 0;
    if (!remaining[kind]) kind = [0, 2, 1].find((level) => remaining[level] > 0);
    if (kind === undefined) break;
    remaining[kind] -= 1;
    if (index < skip) offsets[kind] += 1; else kinds.push(kind);
  }
  return { kinds, offsets };
};
