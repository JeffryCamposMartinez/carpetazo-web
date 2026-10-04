// Portadas subidas a R2: el servidor guarda también una copia para celular (<nombre>_m.webp, 828 px de ancho).
// En pantallas chicas se usa esa copia; en PC, y para cualquier otra URL, la original.
const PHONE_BANNER = /\/Carpetazo\.cl\/Usuarios\/[^/]+\/banner\/[0-9a-f]{32}\.webp$/;
const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

export const bannerForScreen = (url) => (url && isPhone() && PHONE_BANNER.test(url) ? url.replace(/\.webp$/, '_m.webp') : url);
