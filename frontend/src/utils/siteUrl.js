// Enlaces para compartir: siempre con la dirección oficial (sin "www."), que es la que los programas de mensajería
// reconocen para armar la vista previa. En local se usa la dirección del equipo para poder probar.
const OFFICIAL = 'https://carpetazo.cl';

export const siteUrl = (path = '') => {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  const origin = !host || host === 'carpetazo.cl' || host.endsWith('.carpetazo.cl') ? OFFICIAL : window.location.origin;
  return origin + path;
};
