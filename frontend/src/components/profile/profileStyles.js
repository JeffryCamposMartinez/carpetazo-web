// Tema del perfil público: opciones del editor y estilos que se calculan a partir del tema.
import { PALETTES } from '../../config/profileThemes';
import { ALL_FONTS, FONT_NOTES, TITLE_FONTS } from './profileFonts';

export const defaultPublicTheme = {
  id: 'classic-blue',
  name: 'Azul Carpetazo',
  primary: '#1e40af',
  secondary: '#93c5fd',
  accent: '#facc15',
  surface: '#DBEAFE',
  card: '#ffffff',
  text: '#1a2b4b',
  font: 'Inter',
  bodyFont: 'Inter',
  dataFont: 'Inter',
  cardStyle: 'soft',
  backgroundStyle: 'banner',
  sideBackgroundStyle: 'solid-surface',
  avatarFrame: 'clean',
  profileLayout: 'classic',
  profileEffect: 'none',
  showcaseStyle: 'folders',
  profileDistribution: 'classic-gallery',
  showMessageButton: 'on',
  showWhatsApp: 'on',
  showInstagram: 'on',
  showFacebook: 'on',
  showYoutube: 'on'
};

export const profileThemes = [defaultPublicTheme, ...PALETTES.slice(1)];

export const fontOptions = TITLE_FONTS;

export const fontExamples = FONT_NOTES;

export const cardStyleOptions = [
  { id: 'soft', name: 'Suave', description: 'Bordes grandes y efecto vidrio.' },
  { id: 'solid', name: 'Sólido', description: 'Contenedores fuertes y definidos.' },
  { id: 'neon', name: 'Neón', description: 'Brillo/acento alrededor de tarjetas.' },
  { id: 'minimal', name: 'Minimal', description: 'Limpio, plano y elegante.' },
  { id: 'holographic', name: 'Foil', description: 'Borde iridiscente de carta brillante.' },
  { id: 'comic', name: 'Comic', description: 'Borde grueso y sombra ilustrada.' },
  { id: 'crystal', name: 'Cristal', description: 'Glassmorphism transparente.' },
  { id: 'brutalist', name: 'Brutalista', description: 'Bloques duros, crudos y raros.' },
  { id: 'sticker', name: 'Sticker', description: 'Contorno blanco de pegatina.' },
  { id: 'terminal', name: 'Terminal', description: 'Fondo oscuro y texto claro.' },
  { id: 'sunset', name: 'Atardecer', description: 'Franja cálida en el borde superior.' },
  { id: 'cosmic', name: 'Cósmico', description: 'Noche con nebulosas y estrellas.' },
  { id: 'toxic', name: 'Ácido', description: 'Borde de acento y franjas de advertencia.' },
  { id: 'paper', name: 'Papel', description: 'Suave, coleccionable y artesanal.' },
  { id: 'metal', name: 'Metal', description: 'Placa cepillada con borde plateado.' },
  { id: 'prism', name: 'Prisma', description: 'Borde con los colores de tu tema.' }
];

export const backgroundStyleOptions = [
  { id: 'banner', name: 'Banner limpio', description: 'Tu banner manda, con fondo suave.' },
  { id: 'dark-premium', name: 'Oscuro premium', description: 'Negro premium con luces de neón.' },
  { id: 'arcade', name: 'Arcade geométrico', description: 'Líneas, puntos y bloques retro.' },
  { id: 'cosmic-room', name: 'Sala cósmica', description: 'Nebulosas, brillos y profundidad.' },
  { id: 'tcg-table', name: 'Mesa TCG', description: 'Tapete de juego coleccionable.' },
  { id: 'cyber-grid', name: 'Grid cyber', description: 'Rejilla futurista tipo vitrina.' },
  { id: 'foil-rain', name: 'Lluvia foil', description: 'Destellos diagonales holográficos.' },
  { id: 'comic-burst', name: 'Explosión comic', description: 'Rayos gráficos y energía pop.' },
  { id: 'minimal-gallery', name: 'Galería minimal', description: 'Espacio claro y editorial.' },
  { id: 'mythic-forest', name: 'Bosque mítico', description: 'Verde profundo y fantasía.' },
  { id: 'lava', name: 'Lava legendaria', description: 'Oscuro con grietas ardientes.' },
  { id: 'ice', name: 'Cristal helado', description: 'Azules fríos y transparencias.' }
];

export const sideBackgroundOptions = [
    { id: 'solid-surface', name: 'Original', description: 'El fondo simple oficial.' },
  { id: 'site-wallpaper', name: 'Fondo Carpetazo', description: 'El wallpaper oficial de la página.' },
  { id: 'theme-glow', name: 'Luces del tema', description: 'Dos luces suaves con tus colores.' },
  { id: 'premium-dark', name: 'Oscuro premium', description: 'Bandas negras con profundidad.' },
  { id: 'binder-shelf', name: 'Hoja de carpeta', description: 'Bolsillos como una página de 9 cartas.' },
  { id: 'pixel-room', name: 'Píxeles', description: 'Rejilla retro muy suave.' },
  { id: 'foil-side', name: 'Reflejo foil', description: 'Un brillo diagonal tornasol.' },
  { id: 'clean-fade', name: 'Degradado limpio', description: 'Minimal, sin distraer.' },
  { id: 'comic-wall', name: 'Trama cómic', description: 'Puntos de imprenta en tus colores.' }
];

export const avatarFrameOptions = [
  { id: 'gradient', name: 'Degradado', description: 'Marco premium dinámico.' },
  { id: 'dark-frame', name: 'Oscuro', description: 'Marco negro con acento brillante.' },
  { id: 'neon', name: 'Neón', description: 'Glow intenso alrededor.' },
  { id: 'gold', name: 'Dorado', description: 'Coleccionista legendario.' },
  { id: 'holo', name: 'Holo', description: 'Brillo de carta foil.' },
  { id: 'pixel', name: 'Pixel', description: 'Retro gamer cuadrado.' },
  { id: 'rune', name: 'Runas', description: 'Fantasía mística.' },
  { id: 'clean', name: 'Limpio', description: 'Simple y elegante.' }
];

export const profileLayoutOptions = [
  { id: 'classic', name: 'Clásico', description: 'Banner grande y foto a un lado.' },
  { id: 'side-showcase', name: 'Gamer', description: 'Foto junto al nombre, como ficha de jugador.' },
  { id: 'showcase', name: 'Showcase', description: 'Foto y datos centrados en la tarjeta.' },
  { id: 'compact', name: 'Compacto', description: 'Banner bajo: tus carpetas aparecen antes.' },
  { id: 'poster', name: 'Póster', description: 'Nombre grande sobre tu banner.' }
];

export const profileEffectOptions = [
  { id: 'none', name: 'Sin efecto', description: 'Máximo rendimiento.' },
  { id: 'scanlines', name: 'Scanlines', description: 'Líneas retro sobre el perfil.' },
  { id: 'particles', name: 'Partículas', description: 'Puntos luminosos flotantes.' },
  { id: 'diagonal', name: 'Franjas', description: 'Rayas de energía tipo gamer.' },
  { id: 'spotlight', name: 'Spotlight', description: 'Luces dramáticas de vitrina.' }
];

export const showcaseStyleOptions = [
  { id: 'folders', name: 'Carpetas', description: 'Destaca tus carpetas públicas.' },
  { id: 'collector', name: 'Coleccionista', description: 'Badges y estadísticas primero.' },
  { id: 'seller', name: 'Vendedor', description: 'Contacto y catálogo al frente.' },
  { id: 'minimal', name: 'Minimal', description: 'Sin ruido, muy limpio.' }
];

export const profileDistributionOptions = [
  { id: 'classic-gallery', name: 'Clásico gamer', description: 'Vitrina grande + panel lateral + carpetas.', order: ['showcase', 'stats', 'folders'], spans: { showcase: 'lg:col-span-8', stats: 'lg:col-span-4', folders: 'lg:col-span-12' } },
  { id: 'stats-first', name: 'Stats primero', description: 'Panel de datos arriba y catálogo después.', order: ['stats', 'showcase', 'folders'], spans: { stats: 'lg:col-span-4', showcase: 'lg:col-span-8', folders: 'lg:col-span-12' } },
  { id: 'folders-first', name: 'Carpetas primero', description: 'El catálogo manda sobre la vitrina.', order: ['folders', 'showcase', 'stats'], spans: { folders: 'lg:col-span-12', showcase: 'lg:col-span-8', stats: 'lg:col-span-4' } },
  { id: 'showcase-wide', name: 'Vitrina panorámica', description: 'Vitrina a todo ancho antes de todo.', order: ['showcase', 'folders', 'stats'], spans: { showcase: 'lg:col-span-12', folders: 'lg:col-span-8', stats: 'lg:col-span-4' } },
  { id: 'stats-wide', name: 'Panel panorámico', description: 'Estadísticas grandes y vitrinas abajo.', order: ['stats', 'folders', 'showcase'], spans: { stats: 'lg:col-span-12', folders: 'lg:col-span-8', showcase: 'lg:col-span-4' } },
  { id: 'magazine', name: 'Revista', description: 'Carpetas amplias con vitrina lateral.', order: ['folders', 'stats', 'showcase'], spans: { folders: 'lg:col-span-8', stats: 'lg:col-span-4', showcase: 'lg:col-span-12' } },
  { id: 'duo-top', name: 'Dúo superior', description: 'Vitrina y stats arriba, carpetas abajo.', order: ['showcase', 'stats', 'folders'], spans: { showcase: 'lg:col-span-6', stats: 'lg:col-span-6', folders: 'lg:col-span-12' } },
  { id: 'duo-bottom', name: 'Dúo inferior', description: 'Carpetas arriba, vitrina y stats abajo.', order: ['folders', 'showcase', 'stats'], spans: { folders: 'lg:col-span-12', showcase: 'lg:col-span-6', stats: 'lg:col-span-6' } },
  { id: 'sidebar-left', name: 'Sidebar izquierda', description: 'Panel de datos compacto antes de vitrinas.', order: ['stats', 'folders', 'showcase'], spans: { stats: 'lg:col-span-3', folders: 'lg:col-span-9', showcase: 'lg:col-span-12' } },
  { id: 'sidebar-right', name: 'Sidebar derecha', description: 'Catálogo con stats a la derecha.', order: ['folders', 'stats', 'showcase'], spans: { folders: 'lg:col-span-9', stats: 'lg:col-span-3', showcase: 'lg:col-span-12' } },
  { id: 'collector-grid', name: 'Grid coleccionista', description: 'Tres módulos balanceados tipo museo.', order: ['showcase', 'folders', 'stats'], spans: { showcase: 'lg:col-span-4', folders: 'lg:col-span-4', stats: 'lg:col-span-4' } },
  { id: 'market-grid', name: 'Grid vendedor', description: 'Carpetas, vitrina y panel al mismo nivel.', order: ['folders', 'showcase', 'stats'], spans: { folders: 'lg:col-span-4', showcase: 'lg:col-span-4', stats: 'lg:col-span-4' } },
  { id: 'spotlight', name: 'Spotlight', description: 'Vitrina protagonista y soporte abajo.', order: ['showcase', 'stats', 'folders'], spans: { showcase: 'lg:col-span-12', stats: 'lg:col-span-5', folders: 'lg:col-span-7' } },
  { id: 'catalog-hero', name: 'Catálogo héroe', description: 'Carpetas protagonistas con panel abajo.', order: ['folders', 'showcase', 'stats'], spans: { folders: 'lg:col-span-12', showcase: 'lg:col-span-7', stats: 'lg:col-span-5' } },
  { id: 'identity-first', name: 'Identidad primero', description: 'Panel de perfil antes de catálogo.', order: ['stats', 'folders', 'showcase'], spans: { stats: 'lg:col-span-5', folders: 'lg:col-span-7', showcase: 'lg:col-span-12' } },
  { id: 'split-catalog', name: 'Catálogo dividido', description: 'Carpetas y vitrina partidas en dos.', order: ['folders', 'showcase', 'stats'], spans: { folders: 'lg:col-span-6', showcase: 'lg:col-span-6', stats: 'lg:col-span-12' } },
  { id: 'split-stats', name: 'Stats dividido', description: 'Panel y vitrina en dos, carpetas después.', order: ['stats', 'showcase', 'folders'], spans: { stats: 'lg:col-span-6', showcase: 'lg:col-span-6', folders: 'lg:col-span-12' } },
  { id: 'minimal-flow', name: 'Flujo simple', description: 'Orden vertical limpio para perfiles sobrios.', order: ['showcase', 'stats', 'folders'], spans: { showcase: 'lg:col-span-12', stats: 'lg:col-span-12', folders: 'lg:col-span-12' } },
  { id: 'reverse-flow', name: 'Flujo inverso', description: 'Catálogo, panel y vitrina al final.', order: ['folders', 'stats', 'showcase'], spans: { folders: 'lg:col-span-12', stats: 'lg:col-span-12', showcase: 'lg:col-span-12' } },
  { id: 'compact-shop', name: 'Tienda compacta', description: 'Catálogo ancho con panel y vitrina chicos.', order: ['folders', 'stats', 'showcase'], spans: { folders: 'lg:col-span-7', stats: 'lg:col-span-3', showcase: 'lg:col-span-2' } },
  { id: 'premium-gallery', name: 'Galería premium', description: 'Vitrina y carpetas grandes con stats pequeño.', order: ['showcase', 'folders', 'stats'], spans: { showcase: 'lg:col-span-6', folders: 'lg:col-span-3', stats: 'lg:col-span-3' } },
  { id: 'trading-desk', name: 'Mesa de trade', description: 'Panel pequeño, vitrina media, catálogo grande.', order: ['stats', 'showcase', 'folders'], spans: { stats: 'lg:col-span-3', showcase: 'lg:col-span-4', folders: 'lg:col-span-5' } }
];

export const getFontStack = (font = defaultPublicTheme.font) => {
  const safeFont = ALL_FONTS.includes(font) ? font : defaultPublicTheme.font;
  return `'${safeFont}', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
};

export const getProfileBackgroundStyle = (theme) => {
  const style = theme.backgroundStyle || defaultPublicTheme.backgroundStyle;
  const base = { backgroundColor: theme.surface };

  const backgrounds = {
    banner: { ...base },
    'dark-premium': {
      backgroundColor: '#05070d',
      backgroundImage: `radial-gradient(circle at 18% 12%, ${theme.primary}66, transparent 30%), radial-gradient(circle at 88% 8%, ${theme.accent}44, transparent 26%), linear-gradient(180deg, #101826, #05070d 55%, #020409)`
    },
    arcade: {
      backgroundColor: theme.surface,
      backgroundImage: `radial-gradient(circle, ${theme.accent}55 1px, transparent 2px), linear-gradient(135deg, ${theme.primary}55 0 8%, transparent 8% 42%, ${theme.secondary}55 42% 46%, transparent 46%), linear-gradient(90deg, ${theme.surface}, ${theme.primary}22)`,
      backgroundSize: '22px 22px, 100% 100%, 100% 100%'
    },
    'cosmic-room': {
      backgroundColor: '#030712',
      backgroundImage: `radial-gradient(circle at 20% 20%, ${theme.accent}99, transparent 20%), radial-gradient(circle at 80% 10%, ${theme.secondary}88, transparent 25%), radial-gradient(circle at 50% 90%, ${theme.primary}88, transparent 35%), linear-gradient(135deg, #020617, #111827)`
    },
    'tcg-table': {
      backgroundColor: theme.surface,
      backgroundImage: `linear-gradient(45deg, ${theme.primary}18 25%, transparent 25%, transparent 75%, ${theme.primary}18 75%), linear-gradient(45deg, ${theme.primary}18 25%, transparent 25%, transparent 75%, ${theme.primary}18 75%), linear-gradient(135deg, ${theme.surface}, ${theme.secondary}44)`,
      backgroundPosition: '0 0, 18px 18px, 0 0',
      backgroundSize: '36px 36px, 36px 36px, 100% 100%'
    },
    'cyber-grid': {
      backgroundColor: '#07111f',
      backgroundImage: `linear-gradient(${theme.accent}26 1px, transparent 1px), linear-gradient(90deg, ${theme.accent}26 1px, transparent 1px), radial-gradient(circle at 50% 0%, ${theme.primary}66, transparent 42%)`,
      backgroundSize: '42px 42px, 42px 42px, 100% 100%'
    },
    'foil-rain': {
      backgroundColor: theme.surface,
      backgroundImage: `repeating-linear-gradient(115deg, transparent 0 18px, ${theme.accent}33 18px 22px, transparent 22px 44px), linear-gradient(135deg, ${theme.surface}, ${theme.secondary}55, ${theme.primary}33)`
    },
    'comic-burst': {
      backgroundColor: theme.accent,
      backgroundImage: `conic-gradient(from 10deg at 50% 45%, ${theme.accent}, ${theme.card}, ${theme.primary}, ${theme.secondary}, ${theme.accent})`
    },
    'minimal-gallery': {
      backgroundColor: '#f8fafc',
      backgroundImage: `linear-gradient(180deg, #ffffff, ${theme.surface})`
    },
    'mythic-forest': {
      backgroundColor: '#08170d',
      backgroundImage: `radial-gradient(circle at 15% 20%, ${theme.accent}55, transparent 22%), linear-gradient(135deg, #08170d, ${theme.primary}, #020b05)`
    },
    lava: {
      backgroundColor: '#120506',
      backgroundImage: `radial-gradient(circle at 25% 20%, ${theme.accent}77, transparent 18%), repeating-linear-gradient(135deg, transparent 0 24px, ${theme.primary}66 24px 28px), linear-gradient(135deg, #120506, #450a0a, #020202)`
    },
    ice: {
      backgroundColor: '#e0f2fe',
      backgroundImage: `linear-gradient(135deg, #f8fafc, ${theme.secondary}88, ${theme.card}), radial-gradient(circle at 80% 15%, #ffffffaa, transparent 22%)`
    }
  };

  return backgrounds[style] || base;
};

export const getSideBackgroundStyle = (theme) => {
  const style = theme.sideBackgroundStyle || defaultPublicTheme.sideBackgroundStyle;
  // Las franjas acompañan sin competir con el perfil: intensidad baja y un solo motivo por opción
  const styles = {
    'solid-surface': {
      backgroundColor: theme.surface
    },
    'site-wallpaper': {
      backgroundColor: '#08204a',
      backgroundImage: "linear-gradient(90deg, rgba(6,18,42,0.2), rgba(6,18,42,0.72), rgba(6,18,42,0.2)), url('/images/background.webp')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    },
    // Dos luces grandes y difusas del tema sobre un fondo profundo
    'theme-glow': {
      backgroundColor: theme.text,
      backgroundImage: `radial-gradient(55% 45% at 0% 18%, ${theme.primary}a6, transparent 70%), radial-gradient(45% 40% at 100% 82%, ${theme.accent}66, transparent 70%)`
    },
    'premium-dark': {
      backgroundColor: '#05070d',
      backgroundImage: `radial-gradient(50% 35% at 50% 0%, ${theme.secondary}33, transparent 70%), linear-gradient(180deg, #0f1522, #03050a)`
    },
    // Hoja de carpeta: bolsillos con proporción de carta, como una página de 9 cartas
    'binder-shelf': {
      backgroundColor: theme.text,
      backgroundImage: `linear-gradient(90deg, ${theme.text} 0 8px, transparent 8px), linear-gradient(${theme.text} 0 8px, transparent 8px), linear-gradient(160deg, ${theme.primary}80, ${theme.secondary}59)`,
      backgroundSize: '46px 64px, 46px 64px, 100% 100%'
    },
    // Rejilla de píxeles tenue
    'pixel-room': {
      backgroundColor: theme.text,
      backgroundImage: `linear-gradient(90deg, ${theme.accent}1f 1px, transparent 1px), linear-gradient(${theme.accent}1f 1px, transparent 1px), radial-gradient(70% 50% at 50% 0%, ${theme.primary}40, transparent 70%)`,
      backgroundSize: '16px 16px, 16px 16px, 100% 100%'
    },
    // Un solo reflejo diagonal, como luz sobre una carta foil
    'foil-side': {
      backgroundColor: theme.text,
      backgroundImage: `linear-gradient(115deg, transparent 22%, ${theme.secondary}38 40%, ${theme.accent}33 50%, #f0abfc26 58%, transparent 76%), repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 10px)`
    },
    'clean-fade': {
      backgroundColor: theme.surface,
      backgroundImage: `linear-gradient(180deg, ${theme.card}, ${theme.surface} 60%, ${theme.secondary}33)`
    },
    // Trama de puntos de cómic sobre el color base
    'comic-wall': {
      backgroundColor: theme.surface,
      backgroundImage: `radial-gradient(circle, ${theme.accent}b3 1.6px, transparent 2px), radial-gradient(circle, ${theme.primary}40 1.6px, transparent 2px)`,
      backgroundSize: '16px 16px, 16px 16px',
      backgroundPosition: '0 0, 8px 8px'
    }
  };
  return styles[style] || styles['site-wallpaper'];
};

export const getAvatarFrameStyle = (theme) => {
  const frame = theme.avatarFrame || defaultPublicTheme.avatarFrame;
  const frames = {
    gradient: `linear-gradient(135deg, #ffffff 0%, ${theme.accent} 42%, ${theme.primary} 100%)`,
    'dark-frame': `linear-gradient(135deg, #050505, ${theme.primary}, #050505)`,
    neon: `linear-gradient(135deg, ${theme.accent}, ${theme.secondary}, ${theme.primary})`,
    gold: 'linear-gradient(135deg, #fff7ad, #d97706, #78350f, #facc15)',
    holo: `conic-gradient(from 180deg, #fff, ${theme.accent}, ${theme.secondary}, #f0abfc, ${theme.primary}, #fff)`,
    pixel: `repeating-linear-gradient(45deg, ${theme.primary} 0 8px, ${theme.accent} 8px 16px, ${theme.text} 16px 24px)`,
    rune: `radial-gradient(circle, ${theme.accent}, ${theme.primary} 42%, #020617 70%)`,
    clean: 'linear-gradient(135deg, #ffffff, #e2e8f0)'
  };
  return frames[frame] || frames.gradient;
};

export const getEffectClassName = (theme) => {
  const effect = theme.profileEffect || defaultPublicTheme.profileEffect;
  if (effect === 'scanlines') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_5px)] before:mix-blend-overlay';
  if (effect === 'particles') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(circle,rgba(255,255,255,0.45)_1px,transparent_2px)] before:bg-[length:34px_34px] before:opacity-35';
  if (effect === 'diagonal') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[repeating-linear-gradient(135deg,transparent_0_34px,rgba(255,255,255,0.16)_34px_38px)] before:opacity-50';
  if (effect === 'spotlight') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.45),transparent_36%)] before:mix-blend-overlay';
  return '';
};

// La fuente del tema solo se usa en títulos; las anchas (pixel, display extendidas) se achican para que quepan en móvil
export const getDisplayScale = (font) => {
  if (['Press Start 2P', 'Rubik Glitch'].includes(font)) return 0.7;
  if (['Bungee', 'Orbitron', 'Audiowide', 'Unbounded'].includes(font)) return 0.8;
  if (font === 'Bebas Neue') return 1.12;
  return 1;
};

export const BODY_FONT_STACK = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Estilos con superficie oscura: el texto pasa a claro y el color principal al acento, para que todo se lea
export const DARK_CARD_STYLES = {
  terminal: { card: '#0b1512', text: '#dcf5e7' },
  cosmic: { card: '#0e1128', text: '#e8eaff' }
};

export const resolveSurfaceTheme = (theme) => {
  const dark = DARK_CARD_STYLES[theme.cardStyle];
  return dark ? { ...theme, ...dark, primary: theme.accent } : theme;
};

// Borde con degradado: el cuerpo de la tarjeta queda liso (se lee bien) y el brillo vive solo en el contorno
export const gradientEdge = (fill, edge, width = '2px') => ({
  borderStyle: 'solid',
  borderWidth: width,
  borderColor: 'transparent',
  background: `linear-gradient(${fill}, ${fill}) padding-box, ${edge} border-box`
});

export const getCardStyle = (theme) => {
  const style = theme.cardStyle || defaultPublicTheme.cardStyle;
  const common = { backgroundColor: `${theme.card}e8` };

  if (style === 'solid') {
    return { ...common, backgroundColor: theme.card, borderRadius: '1.25rem', boxShadow: `0 18px 45px ${theme.text}24`, borderColor: `${theme.primary}66` };
  }

  if (style === 'neon') {
    return { ...common, borderRadius: '1.75rem', boxShadow: `0 0 0 1px ${theme.accent}88, 0 0 28px ${theme.accent}44, 0 22px 60px ${theme.primary}30`, borderColor: `${theme.accent}88` };
  }

  if (style === 'minimal') {
    return { ...common, backgroundColor: theme.card, borderRadius: '0.9rem', boxShadow: 'none', borderColor: `${theme.text}18` };
  }

  // Foil: contorno iridiscente como el borde de una carta brillante y un reflejo tenue arriba
  if (style === 'holographic') {
    return {
      ...gradientEdge(theme.card, `conic-gradient(from 210deg, #f0abfc, #93c5fd, #a7f3d0, #fde68a, ${theme.accent}, #f0abfc)`, '2.5px'),
      background: `linear-gradient(115deg, transparent 0 38%, rgba(255,255,255,0.4) 46%, transparent 54%) padding-box, linear-gradient(${theme.card}, ${theme.card}) padding-box, conic-gradient(from 210deg, #f0abfc, #93c5fd, #a7f3d0, #fde68a, ${theme.accent}, #f0abfc) border-box`,
      borderRadius: '1.5rem',
      boxShadow: `0 20px 50px ${theme.primary}2e`
    };
  }

  if (style === 'comic') {
    return { backgroundColor: theme.card, borderRadius: '1.3rem', boxShadow: `6px 6px 0 ${theme.text}`, borderColor: theme.text, borderWidth: '3px' };
  }

  if (style === 'crystal') {
    return { backgroundColor: `${theme.card}b8`, borderRadius: '2rem', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 24px 60px ${theme.text}26`, borderColor: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px) saturate(1.2)' };
  }

  if (style === 'brutalist') {
    return { backgroundColor: theme.card, borderRadius: '0.15rem', boxShadow: `8px 8px 0 ${theme.accent}`, borderColor: theme.text, borderWidth: '3px' };
  }

  // Sticker: contorno blanco troquelado y sombra de pegatina despegada (sin girar el contenido)
  if (style === 'sticker') {
    return { backgroundColor: theme.card, borderRadius: '1.6rem', boxShadow: `0 0 0 4px #ffffff, 0 0 0 5px ${theme.text}1f, 0 16px 32px ${theme.text}2b`, borderColor: 'transparent' };
  }

  // Terminal: superficie oscura con líneas de monitor muy suaves; el texto ya viene claro (resolveSurfaceTheme)
  if (style === 'terminal') {
    return {
      backgroundColor: theme.card,
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
      borderRadius: '0.85rem',
      boxShadow: `0 0 0 1px ${theme.accent}59, 0 18px 40px rgba(0,0,0,0.45)`,
      borderColor: `${theme.accent}59`
    };
  }

  // Atardecer: franja cálida en el borde superior y un tinte leve que se desvanece
  if (style === 'sunset') {
    return {
      backgroundColor: theme.card,
      backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.primary}, ${theme.secondary}), linear-gradient(180deg, ${theme.accent}1f, transparent 45%)`,
      backgroundSize: '100% 6px, 100% 100%',
      backgroundRepeat: 'no-repeat',
      borderRadius: '1.4rem',
      boxShadow: `0 18px 44px ${theme.accent}33`,
      borderColor: `${theme.accent}40`
    };
  }

  // Cósmico: superficie nocturna con dos nebulosas suaves y algunas estrellas; el texto ya viene claro
  if (style === 'cosmic') {
    return {
      backgroundColor: theme.card,
      backgroundImage: `radial-gradient(1px 1px at 18% 28%, #ffffffcc, transparent), radial-gradient(1px 1px at 72% 64%, #ffffffaa, transparent), radial-gradient(1.5px 1.5px at 88% 18%, #ffffffbb, transparent), radial-gradient(120% 80% at 100% 0%, ${theme.secondary}3d, transparent 60%), radial-gradient(90% 70% at 0% 100%, ${theme.accent}24, transparent 60%)`,
      borderRadius: '1.6rem',
      boxShadow: `0 0 0 1px ${theme.secondary}55, 0 24px 60px rgba(0,0,0,0.45)`,
      borderColor: `${theme.secondary}55`
    };
  }

  // Ácido: borde de acento con franjas de advertencia solo en la esquina
  if (style === 'toxic') {
    return {
      backgroundColor: theme.card,
      backgroundImage: `repeating-linear-gradient(-45deg, ${theme.accent}40 0 6px, transparent 6px 12px)`,
      backgroundSize: '72px 72px',
      backgroundPosition: 'top right',
      backgroundRepeat: 'no-repeat',
      borderRadius: '1.1rem',
      boxShadow: `0 0 0 2px ${theme.accent}, 0 14px 36px ${theme.accent}33`,
      borderColor: theme.accent
    };
  }

  if (style === 'paper') {
    return { backgroundColor: theme.card, borderRadius: '1.1rem', backgroundImage: 'linear-gradient(0deg, rgba(255,255,255,0.45), rgba(0,0,0,0.025))', boxShadow: `0 14px 30px ${theme.text}18`, borderColor: `${theme.text}22` };
  }

  // Metal: placa cepillada clara con contorno plateado
  if (style === 'metal') {
    return {
      ...gradientEdge('#f1f4f8', 'linear-gradient(135deg, #ffffff, #94a3b8 30%, #e2e8f0 55%, #64748b 80%, #f8fafc)', '2.5px'),
      background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 4px) padding-box, linear-gradient(180deg, #fafbfc, #e9edf2) padding-box, linear-gradient(135deg, #ffffff, #94a3b8 30%, #e2e8f0 55%, #64748b 80%, #f8fafc) border-box',
      borderRadius: '1.25rem',
      boxShadow: `inset 0 1px 0 #ffffff, 0 18px 40px ${theme.text}26`
    };
  }

  // Prisma: contorno con los tres colores del tema; el contenido sobre fondo liso
  if (style === 'prism') {
    return {
      ...gradientEdge(theme.card, `conic-gradient(from 140deg, ${theme.primary}, ${theme.secondary}, ${theme.accent}, ${theme.primary})`, '3px'),
      borderRadius: '1.5rem',
      boxShadow: `0 20px 50px ${theme.primary}33`
    };
  }

  return { ...common, borderRadius: '2rem', boxShadow: `0 24px 70px ${theme.text}24`, borderColor: 'rgba(255,255,255,0.4)' };
};

export const PANEL_TABS = [
  ['theme', 'Colores', 'palette'],
  ['font', 'Letra', 'text_fields'],
  ['cards', 'Tarjetas', 'dashboard_customize'],
  ['scene', 'Escena', 'wallpaper'],
  ['layout', 'Orden', 'view_quilt'],
  ['social', 'Redes', 'share'],
];

export const themeKey = (theme) => JSON.stringify(Object.keys(theme || {}).sort().map((key) => [key, theme[key]]));
