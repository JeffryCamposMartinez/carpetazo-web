// Orden común para las ediciones importadas desde el catálogo local.
// TCGCSV suele asignar la fecha de importación a promociones y otros grupos
// especiales. Cuando demasiados grupos comparten un mismo día, se consideran
// "sin fecha de lanzamiento" y se muestran después de las ediciones con una
// fecha real, igual que en el catálogo de Pokémon.
export const sortCatalogGroupsNewestFirst = (groups = []) => {
  const rows = Array.isArray(groups) ? [...groups] : [];
  const perDay = new Map();

  rows.forEach((group) => {
    const value = group?.publishedOn;
    const day = value ? String(value).slice(0, 10) : '';
    if (day) perDay.set(day, (perDay.get(day) || 0) + 1);
  });

  const dayOf = (group) => {
    const value = group?.publishedOn;
    return value ? String(value).slice(0, 10) : '';
  };
  const isImportedDay = (group) => {
    const day = dayOf(group);
    return Boolean(day) && (perDay.get(day) || 0) >= 8;
  };
  const timestampOf = (group) => {
    const timestamp = Date.parse(group?.publishedOn || '');
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const idOf = (group) => Number(group?.groupId ?? group?.id ?? 0) || 0;

  return rows.sort((a, b) => {
    const importedDelta = Number(isImportedDay(a)) - Number(isImportedDay(b));
    if (importedDelta !== 0) return importedDelta;

    const dateDelta = timestampOf(b) - timestampOf(a);
    if (dateDelta !== 0) return dateDelta;

    const nameDelta = String(a?.name || '').localeCompare(String(b?.name || ''), 'es');
    if (nameDelta !== 0) return nameDelta;

    return idOf(b) - idOf(a);
  });
};
