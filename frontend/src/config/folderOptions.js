// Opciones de una carpeta: colores (y su filtro sobre la imagen de la carpeta) y juegos.
export const FOLDER_COLORS = [
  { id: 'red', hex: '#d32f2f' },
  { id: 'blue', hex: '#1976d2' },
  { id: 'pink', hex: '#d81b60' },
  { id: 'green', hex: '#2e7d32' },
  { id: 'yellow', hex: '#fbc02d' },
  { id: 'black', hex: '#424242' }
];

export const getFolderFilter = (color) => {
  switch (color) {
    case 'blue': return 'hue-rotate(220deg) brightness(0.9)';
    case 'pink': return 'hue-rotate(320deg) brightness(1.1) saturate(0.8)';
    case 'green': return 'hue-rotate(110deg) brightness(0.85) saturate(0.9)';
    case 'yellow': return 'hue-rotate(55deg) brightness(1.2) saturate(0.9)';
    case 'black': return 'grayscale(100%) brightness(0.55) contrast(1.1)';
    case 'red':
    default: return 'none';
  }
};

export const TCG_OPTIONS = [
  ['Pokemon', 'Pokémon'],
  ['Mitos y Leyendas', 'Mitos y Leyendas'],
  ['Magic', 'Magic'],
  ['YuGiOh', 'Yu-Gi-Oh!'],
  ['OnePiece', 'One Piece'],
  ['Riftbound', 'Riftbound']
];
// Juegos con los que ya se pueden crear carpetas nuevas (los demás aparecen bloqueados)
export const AVAILABLE_TCGS = ['Pokemon', 'Mitos y Leyendas', 'OnePiece', 'Magic', 'Riftbound', 'YuGiOh'];
export const TCG_LABELS = Object.fromEntries(TCG_OPTIONS);
export const COLOR_NAMES = { red: 'rojo', blue: 'azul', pink: 'rosado', green: 'verde', yellow: 'amarillo', black: 'negro' };
