// Fuentes de los perfiles personalizables: no se descargan en todas las páginas, solo cuando un perfil las usa
// (o cuando se abre el selector de fuentes). Cada familia se pide una sola vez.
const FONT_QUERIES = {
  Inter: 'Inter:wght@400;700;900',
  Montserrat: 'Montserrat:wght@400;700;900',
  Nunito: 'Nunito:wght@400;700;900',
  Poppins: 'Poppins:wght@400;700;900',
  Rubik: 'Rubik:wght@400;700;900',
  Quicksand: 'Quicksand:wght@400;700',
  Merriweather: 'Merriweather:wght@400;700;900',
  Oswald: 'Oswald:wght@400;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;700',
  Cinzel: 'Cinzel:wght@400;700;900',
  Orbitron: 'Orbitron:wght@400;700;900',
  'Bebas Neue': 'Bebas+Neue',
  Bungee: 'Bungee',
  Audiowide: 'Audiowide',
  'Permanent Marker': 'Permanent+Marker',
  'Press Start 2P': 'Press+Start+2P',
  'Rubik Glitch': 'Rubik+Glitch',
  Unbounded: 'Unbounded:wght@400;700;900',
  'DM Serif Display': 'DM+Serif+Display'
};

const requested = new Set();

export const loadThemeFonts = (fonts) => {
  if (typeof document === 'undefined') return;
  const pending = [...new Set(fonts)].filter((font) => FONT_QUERIES[font] && !requested.has(font));
  if (pending.length === 0) return;
  pending.forEach((font) => requested.add(font));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${pending.map((font) => `family=${FONT_QUERIES[font]}`).join('&')}&display=swap`;
  document.head.appendChild(link);
};
