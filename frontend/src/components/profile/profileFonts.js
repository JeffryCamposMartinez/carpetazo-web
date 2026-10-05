// Tipografía del perfil público: tres funciones (títulos, contenido y cifras) con una lista curada de fuentes de Google.
// La misma lista vive en el servidor (backend/core/validation.js): un tema solo guarda fuentes de esta lista.

export const TITLE_FONTS = ['Inter', 'Montserrat', 'Nunito', 'Poppins', 'Rubik', 'Quicksand', 'Merriweather', 'Oswald', 'Space Grotesk', 'Cinzel', 'Orbitron', 'Bebas Neue', 'Bungee', 'Audiowide', 'Permanent Marker', 'Press Start 2P', 'Rubik Glitch', 'Unbounded', 'DM Serif Display', 'Fraunces', 'Sora'];
export const BODY_FONTS = ['Inter', 'DM Sans', 'Manrope', 'Figtree', 'Nunito', 'Rubik', 'Work Sans', 'Lora'];
export const DATA_FONTS = ['Inter', 'Space Grotesk', 'DM Mono', 'Manrope', 'Sora'];
export const ALL_FONTS = [...new Set([...TITLE_FONTS, ...BODY_FONTS, ...DATA_FONTS])];

export const FONT_ROLES = [
  { field: 'font', label: 'Títulos', description: 'Tu nombre y los títulos de cada sección.', fonts: TITLE_FONTS },
  { field: 'bodyFont', label: 'Contenido', description: 'Biografía, reseñas y textos largos.', fonts: BODY_FONTS },
  { field: 'dataFont', label: 'Cifras', description: 'Nivel, cantidades y estadísticas.', fonts: DATA_FONTS },
];

// Combinaciones listas: una dirección completa en un toque
export const TYPE_PAIRS = [
  { id: 'carpetazo', name: 'Carpetazo', mood: 'La del sitio: clara y directa', font: 'Inter', bodyFont: 'Inter', dataFont: 'Inter' },
  { id: 'editorial', name: 'Editorial', mood: 'Revista contemporánea', font: 'Fraunces', bodyFont: 'DM Sans', dataFont: 'DM Mono' },
  { id: 'precision', name: 'Precisión', mood: 'Tecnología y claridad', font: 'Sora', bodyFont: 'Manrope', dataFont: 'DM Mono' },
  { id: 'gallery', name: 'Galería', mood: 'Arte y coleccionismo', font: 'DM Serif Display', bodyFont: 'Figtree', dataFont: 'Space Grotesk' },
  { id: 'legend', name: 'Leyenda', mood: 'Fantasía con historia', font: 'Cinzel', bodyFont: 'Lora', dataFont: 'Inter' },
  { id: 'arena', name: 'Arena', mood: 'Fuerte, de torneo', font: 'Bebas Neue', bodyFont: 'Work Sans', dataFont: 'Space Grotesk' },
  { id: 'arcade', name: 'Arcade', mood: 'Retro de videojuego', font: 'Press Start 2P', bodyFont: 'Rubik', dataFont: 'Space Grotesk' },
  { id: 'signal', name: 'Señal', mood: 'Digital y contundente', font: 'Unbounded', bodyFont: 'Inter', dataFont: 'DM Mono' },
];

export const FONT_NOTES = {
  Inter: 'Perfil limpio y moderno',
  Montserrat: 'Vendedor destacado',
  Nunito: 'Amigable y cercano',
  Poppins: 'Colección premium',
  Rubik: 'Cartas con carácter',
  Quicksand: 'Suave y juvenil',
  Merriweather: 'Elegante y clásico',
  Oswald: 'Fuerte y directo',
  'Space Grotesk': 'Futurista y único',
  Cinzel: 'Mítico y legendario',
  Orbitron: 'Tecnología orbital',
  'Bebas Neue': 'Impacto de vitrina',
  Bungee: 'Estilo arcade urbano',
  Audiowide: 'Ciencia ficción premium',
  'Permanent Marker': 'Firma de coleccionista',
  'Press Start 2P': 'Retro videojuego',
  'Rubik Glitch': 'Error dimensional',
  Unbounded: 'Perfil experimental',
  'DM Serif Display': 'Editorial sofisticado',
  Fraunces: 'Revista con personalidad',
  Sora: 'Geométrica y precisa',
  'DM Sans': 'Lectura clara y equilibrada',
  Manrope: 'Moderna y legible',
  Figtree: 'Cercana y ordenada',
  'Work Sans': 'Sobria y firme',
  Lora: 'Lectura con calidez',
  'DM Mono': 'Cifras de precisión',
};
