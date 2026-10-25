// Ediciones de Mitos y Leyendas que el buscador muestra juntas: "Coleccionista Victoriosa PB06", "PB07"… (hay PB01 en adelante, sin tope).
// Solo se agrupan las que empiezan con ese nombre. La opción "(todas)" viaja como `familia:<id>` y el servidor la convierte en las ediciones reales.
export const EDITION_FAMILY_PREFIX = 'familia:';
const FAMILIES = [{ id: 'coleccionista-victoriosa', label: 'Coleccionista Victoriosa', test: /^coleccionista victoriosa\b/i }];

const familyOf = (name) => FAMILIES.find((family) => family.test.test(String(name || '').trim()));

// Opciones [{ value, label }] con la opción "(todas)" justo antes de la primera edición de cada familia (si hay al menos dos)
export const withEditionFamilies = (options) => {
  const members = new Map(FAMILIES.map((family) => [family.id, options.filter((option) => familyOf(option.label)?.id === family.id).length]));
  const added = new Set();
  return options.flatMap((option) => {
    const family = familyOf(option.label);
    if (!family || members.get(family.id) < 2 || added.has(family.id)) return [option];
    added.add(family.id);
    return [{ value: EDITION_FAMILY_PREFIX + family.id, label: `${family.label} (todas)` }, option];
  });
};

// ¿La edición de la carta coincide con lo elegido? (una edición exacta o una familia "(todas)")
export const matchesEdition = (cardSet, selected) => {
  if (!selected) return true;
  if (!String(selected).startsWith(EDITION_FAMILY_PREFIX)) return cardSet === selected;
  return familyOf(cardSet)?.id === String(selected).slice(EDITION_FAMILY_PREFIX.length);
};
