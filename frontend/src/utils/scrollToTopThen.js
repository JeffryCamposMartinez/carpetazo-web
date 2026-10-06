// Sube a la parte de arriba de la página con desplazamiento suave y, cuando llega, ejecuta `callback`
// (así el cambio de la lista se ve desde arriba y no mientras la página todavía está bajando).
const MAX_WAIT_MS = 1200;

export const scrollToTopThen = (callback) => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || window.scrollY < 8) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    callback();
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const startedAt = Date.now();
  const wait = () => {
    if (window.scrollY <= 1 || Date.now() - startedAt > MAX_WAIT_MS) callback();
    else window.setTimeout(wait, 40);
  };
  window.setTimeout(wait, 40);
};
