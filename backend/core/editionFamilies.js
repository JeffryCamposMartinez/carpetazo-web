// Familias de ediciones que el buscador muestra como una sola (solo Mitos y Leyendas): "Coleccionista Victoriosa PB06", "PB07"…
// El filtro llega como `familia:<id>` en el lugar del groupId; aquí se convierte en los groupId reales de esa familia.
export const EDITION_FAMILY_PREFIX = 'familia:';
const FAMILY_NAMES = { 'coleccionista-victoriosa': 'coleccionista victoriosa' };

export const isEditionFamily = (value) => typeof value === 'string' && value.startsWith(EDITION_FAMILY_PREFIX);
export const isKnownEditionFamily = (value) => isEditionFamily(value) && Object.hasOwn(FAMILY_NAMES, value.slice(EDITION_FAMILY_PREFIX.length));

// groupId de todas las ediciones cuyo nombre empieza con el de la familia (cualquier número de PB: PB01, PB99, PB1000…)
export const editionFamilyGroupIds = async (prisma, categoryId, value) => {
  const prefix = FAMILY_NAMES[value.slice(EDITION_FAMILY_PREFIX.length)];
  const groups = await prisma.tcgGroup.findMany({ where: { categoryId, name: { startsWith: prefix, mode: 'insensitive' } }, select: { groupId: true } });
  return groups.map((group) => group.groupId);
};
