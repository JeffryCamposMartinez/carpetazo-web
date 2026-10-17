// Los códigos de cartas suelen escribirse como 123/456. Cuando el usuario
// escribe o pega solo números, completa el separador después de los primeros
// tres dígitos sin modificar búsquedas por nombre ni códigos ya formateados.
export const formatCardSearchQuery = (value, previousValue = '') => {
  const nextValue = String(value ?? '');
  if (previousValue.endsWith('/') && /^\d{3}$/.test(nextValue)) return nextValue;
  if (/^\d{3,}$/.test(nextValue)) return `${nextValue.slice(0, 3)}/${nextValue.slice(3)}`;
  return nextValue;
};
