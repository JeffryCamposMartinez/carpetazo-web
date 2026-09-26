import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { getFolderFilter } from './Dashboard';

const getAverageRGB = (imgEl, width, height) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgEl, 0, 0, width, height);
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (let i = 0; i < data.length; i += 400) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count += 1;
    }
    return { r: Math.floor(r / count), g: Math.floor(g / count), b: Math.floor(b / count) };
  } catch {
    return { r: 26, g: 43, b: 75 };
  }
};

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / d + 2;
    if (max === b) h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
};

const getComplementaryHex = (r, g, b) => {
  let [h, s, l] = rgbToHsl(r, g, b);
  h = (h + 180) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let rp = 0; let gp = 0; let bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
};

const normalizeFolder = (folder) => ({
  ...folder,
  cardsCount: folder.cardsCount ?? folder._count?.cards ?? 0,
  color: folder.color || 'red'
});

const defaultPublicTheme = {
  id: 'classic-blue',
  name: 'Azul Carpetazo',
  primary: '#1e40af',
  secondary: '#93c5fd',
  accent: '#facc15',
  surface: '#DBEAFE',
  card: '#ffffff',
  text: '#1a2b4b',
  font: 'Inter',
  cardStyle: 'soft',
  backgroundStyle: 'banner',
  sideBackgroundStyle: 'site-wallpaper',
  avatarFrame: 'gradient',
  profileLayout: 'classic',
  profileEffect: 'none',
  showcaseStyle: 'folders'
};

const profileThemes = [
  defaultPublicTheme,
  { id: 'royal-purple', name: 'Púrpura Real', primary: '#5b21b6', secondary: '#7c3aed', accent: '#f0abfc', surface: '#2e1065', card: '#ede9fe', text: '#1e1b4b', font: 'Montserrat' },
  { id: 'emerald-market', name: 'Esmeralda', primary: '#047857', secondary: '#059669', accent: '#fbbf24', surface: '#064e3b', card: '#d1fae5', text: '#052e16', font: 'Nunito' },
  { id: 'crimson-fire', name: 'Fuego Carmesí', primary: '#991b1b', secondary: '#dc2626', accent: '#fb923c', surface: '#450a0a', card: '#fee2e2', text: '#450a0a', font: 'Oswald' },
  { id: 'midnight-gold', name: 'Medianoche Oro', primary: '#020617', secondary: '#1e293b', accent: '#facc15', surface: '#0f172a', card: '#f8fafc', text: '#020617', font: 'Merriweather' },
  { id: 'ocean-cyan', name: 'Océano', primary: '#155e75', secondary: '#0891b2', accent: '#22d3ee', surface: '#164e63', card: '#cffafe', text: '#083344', font: 'Poppins' },
  { id: 'rose-pop', name: 'Rosa Pop', primary: '#be185d', secondary: '#db2777', accent: '#f472b6', surface: '#831843', card: '#fce7f3', text: '#500724', font: 'Quicksand' },
  { id: 'amber-sun', name: 'Sol Ámbar', primary: '#92400e', secondary: '#d97706', accent: '#fb7185', surface: '#78350f', card: '#fef3c7', text: '#451a03', font: 'Rubik' },
  { id: 'slate-neon', name: 'Neón Slate', primary: '#0f172a', secondary: '#334155', accent: '#38bdf8', surface: '#020617', card: '#e2e8f0', text: '#0f172a', font: 'Space Grotesk' },
  { id: 'mythic-green', name: 'Mítico Verde', primary: '#365314', secondary: '#4d7c0f', accent: '#84cc16', surface: '#1a2e05', card: '#ecfccb', text: '#1a2e05', font: 'Cinzel' }
];

const fontOptions = ['Inter', 'Montserrat', 'Nunito', 'Poppins', 'Rubik', 'Quicksand', 'Merriweather', 'Oswald', 'Space Grotesk', 'Cinzel', 'Orbitron', 'Bebas Neue', 'Bungee', 'Audiowide', 'Permanent Marker', 'Press Start 2P', 'Rubik Glitch', 'Unbounded', 'DM Serif Display'];
const fontExamples = {
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
  'DM Serif Display': 'Editorial sofisticado'
};
const cardStyleOptions = [
  { id: 'soft', name: 'Suave', description: 'Bordes grandes y efecto vidrio.' },
  { id: 'solid', name: 'Sólido', description: 'Contenedores fuertes y definidos.' },
  { id: 'neon', name: 'Neón', description: 'Brillo/acento alrededor de tarjetas.' },
  { id: 'minimal', name: 'Minimal', description: 'Limpio, plano y elegante.' },
  { id: 'holographic', name: 'Holográfico', description: 'Brillos diagonales tipo carta foil.' },
  { id: 'comic', name: 'Comic', description: 'Borde grueso y sombra ilustrada.' },
  { id: 'crystal', name: 'Cristal', description: 'Glassmorphism transparente.' },
  { id: 'brutalist', name: 'Brutalista', description: 'Bloques duros, crudos y raros.' },
  { id: 'sticker', name: 'Sticker', description: 'Como pegatina flotante.' },
  { id: 'terminal', name: 'Terminal', description: 'Oscuro, técnico y digital.' },
  { id: 'sunset', name: 'Atardecer', description: 'Gradiente cálido abstracto.' },
  { id: 'cosmic', name: 'Cósmico', description: 'Profundo, espacial y brillante.' },
  { id: 'toxic', name: 'Tóxico', description: 'Acentos intensos y mutantes.' },
  { id: 'paper', name: 'Papel', description: 'Suave, coleccionable y artesanal.' },
  { id: 'metal', name: 'Metal', description: 'Plateado, duro y premium.' },
  { id: 'prism', name: 'Prisma', description: 'Gradiente angular multicolor.' }
];

const backgroundStyleOptions = [
  { id: 'banner', name: 'Banner limpio', description: 'Tu banner manda, con fondo suave.' },
  { id: 'steam-dark', name: 'Steam oscuro', description: 'Negro premium con luces de neón.' },
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

const sideBackgroundOptions = [
  { id: 'site-wallpaper', name: 'Fondo Carpetazo', description: 'El wallpaper oficial de la página.' },
  { id: 'theme-glow', name: 'Glow del tema', description: 'Laterales con luces del color elegido.' },
  { id: 'dark-steam', name: 'Steam oscuro', description: 'Bandas negras con profundidad.' },
  { id: 'binder-shelf', name: 'Repisa TCG', description: 'Textura de álbum y colección.' },
  { id: 'pixel-room', name: 'Pixel room', description: 'Patrón gamer retro.' },
  { id: 'foil-side', name: 'Foil lateral', description: 'Brillos diagonales fuertes.' },
  { id: 'clean-fade', name: 'Degradado limpio', description: 'Minimal, sin distraer.' },
  { id: 'comic-wall', name: 'Comic wall', description: 'Puntos y explosiones pop.' }
];

const avatarFrameOptions = [
  { id: 'gradient', name: 'Degradado', description: 'Marco premium dinámico.' },
  { id: 'steam', name: 'Steam', description: 'Marco negro con acento brillante.' },
  { id: 'neon', name: 'Neón', description: 'Glow intenso alrededor.' },
  { id: 'gold', name: 'Dorado', description: 'Coleccionista legendario.' },
  { id: 'holo', name: 'Holo', description: 'Brillo de carta foil.' },
  { id: 'pixel', name: 'Pixel', description: 'Retro gamer cuadrado.' },
  { id: 'rune', name: 'Runas', description: 'Fantasía mística.' },
  { id: 'clean', name: 'Limpio', description: 'Simple y elegante.' }
];

const profileLayoutOptions = [
  { id: 'classic', name: 'Clásico', description: 'Hero amplio y carpetas abajo.' },
  { id: 'steam', name: 'Steam', description: 'Hero + vitrina lateral.' },
  { id: 'showcase', name: 'Showcase', description: 'Todo centrado como exposición.' },
  { id: 'compact', name: 'Compacto', description: 'Más información en menos altura.' },
  { id: 'poster', name: 'Poster', description: 'Nombre grande y teatral.' }
];

const profileEffectOptions = [
  { id: 'none', name: 'Sin efecto', description: 'Máximo rendimiento.' },
  { id: 'scanlines', name: 'Scanlines', description: 'Líneas retro sobre el perfil.' },
  { id: 'particles', name: 'Partículas', description: 'Puntos luminosos flotantes.' },
  { id: 'diagonal', name: 'Franjas', description: 'Rayas de energía tipo Steam.' },
  { id: 'spotlight', name: 'Spotlight', description: 'Luces dramáticas de vitrina.' }
];

const showcaseStyleOptions = [
  { id: 'folders', name: 'Carpetas', description: 'Destaca tus carpetas públicas.' },
  { id: 'collector', name: 'Coleccionista', description: 'Badges y estadísticas primero.' },
  { id: 'seller', name: 'Vendedor', description: 'Contacto y catálogo al frente.' },
  { id: 'minimal', name: 'Minimal', description: 'Sin ruido, muy limpio.' }
];

const getFontStack = (font = defaultPublicTheme.font) => {
  const safeFont = fontOptions.includes(font) ? font : defaultPublicTheme.font;
  return `'${safeFont}', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
};

const getProfileBackgroundStyle = (theme) => {
  const style = theme.backgroundStyle || defaultPublicTheme.backgroundStyle;
  const base = { backgroundColor: theme.surface };

  const backgrounds = {
    banner: { ...base },
    'steam-dark': {
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

const getSideBackgroundStyle = (theme) => {
  const style = theme.sideBackgroundStyle || defaultPublicTheme.sideBackgroundStyle;
  const styles = {
    'site-wallpaper': {
      backgroundColor: '#08204a',
      backgroundImage: "linear-gradient(90deg, rgba(6,18,42,0.2), rgba(6,18,42,0.72), rgba(6,18,42,0.2)), url('/images/background.webp')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    },
    'theme-glow': {
      backgroundColor: theme.text,
      backgroundImage: `radial-gradient(circle at 12% 20%, ${theme.primary}aa, transparent 28%), radial-gradient(circle at 88% 70%, ${theme.accent}88, transparent 26%), linear-gradient(135deg, ${theme.text}, ${theme.primary})`
    },
    'dark-steam': {
      backgroundColor: '#05070d',
      backgroundImage: `radial-gradient(circle at 18% 18%, ${theme.secondary}44, transparent 28%), linear-gradient(180deg, #111827, #020617)`
    },
    'binder-shelf': {
      backgroundColor: theme.surface,
      backgroundImage: `repeating-linear-gradient(90deg, ${theme.primary}55 0 14px, ${theme.text}66 14px 18px, transparent 18px 42px), linear-gradient(135deg, ${theme.surface}, ${theme.secondary}55)`
    },
    'pixel-room': {
      backgroundColor: theme.text,
      backgroundImage: `linear-gradient(90deg, ${theme.accent}44 2px, transparent 2px), linear-gradient(${theme.primary}44 2px, transparent 2px), linear-gradient(135deg, ${theme.text}, ${theme.primary})`,
      backgroundSize: '28px 28px, 28px 28px, 100% 100%'
    },
    'foil-side': {
      backgroundColor: theme.surface,
      backgroundImage: `repeating-linear-gradient(125deg, transparent 0 20px, ${theme.accent}55 20px 24px, transparent 24px 44px), linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.card})`
    },
    'clean-fade': {
      backgroundColor: theme.surface,
      backgroundImage: `linear-gradient(135deg, ${theme.surface}, ${theme.card}, ${theme.secondary}55)`
    },
    'comic-wall': {
      backgroundColor: theme.accent,
      backgroundImage: `radial-gradient(circle, ${theme.text}22 1px, transparent 2px), conic-gradient(from 180deg at 50% 50%, ${theme.accent}, ${theme.card}, ${theme.primary}, ${theme.accent})`,
      backgroundSize: '18px 18px, 100% 100%'
    }
  };
  return styles[style] || styles['site-wallpaper'];
};

const getAvatarFrameStyle = (theme) => {
  const frame = theme.avatarFrame || defaultPublicTheme.avatarFrame;
  const frames = {
    gradient: `linear-gradient(135deg, #ffffff 0%, ${theme.accent} 42%, ${theme.primary} 100%)`,
    steam: `linear-gradient(135deg, #050505, ${theme.primary}, #050505)`,
    neon: `linear-gradient(135deg, ${theme.accent}, ${theme.secondary}, ${theme.primary})`,
    gold: 'linear-gradient(135deg, #fff7ad, #d97706, #78350f, #facc15)',
    holo: `conic-gradient(from 180deg, #fff, ${theme.accent}, ${theme.secondary}, #f0abfc, ${theme.primary}, #fff)`,
    pixel: `repeating-linear-gradient(45deg, ${theme.primary} 0 8px, ${theme.accent} 8px 16px, ${theme.text} 16px 24px)`,
    rune: `radial-gradient(circle, ${theme.accent}, ${theme.primary} 42%, #020617 70%)`,
    clean: 'linear-gradient(135deg, #ffffff, #e2e8f0)'
  };
  return frames[frame] || frames.gradient;
};

const getEffectClassName = (theme) => {
  const effect = theme.profileEffect || defaultPublicTheme.profileEffect;
  if (effect === 'scanlines') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_5px)] before:mix-blend-overlay';
  if (effect === 'particles') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(circle,rgba(255,255,255,0.45)_1px,transparent_2px)] before:bg-[length:34px_34px] before:opacity-35';
  if (effect === 'diagonal') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[repeating-linear-gradient(135deg,transparent_0_34px,rgba(255,255,255,0.16)_34px_38px)] before:opacity-50';
  if (effect === 'spotlight') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.45),transparent_36%)] before:mix-blend-overlay';
  return '';
};

const getDisplayFontClass = (font, isPosterLayout = false) => {
  if (['Press Start 2P', 'Rubik Glitch'].includes(font)) {
    return isPosterLayout ? 'text-[2rem] sm:text-4xl md:text-5xl' : 'text-[1.55rem] sm:text-3xl md:text-4xl';
  }
  if (['Bungee', 'Bebas Neue', 'Orbitron', 'Audiowide', 'Unbounded'].includes(font)) {
    return isPosterLayout ? 'text-[2.25rem] sm:text-5xl md:text-6xl' : 'text-[1.75rem] sm:text-4xl md:text-[2.9rem]';
  }
  return isPosterLayout ? 'text-[2.5rem] sm:text-6xl md:text-7xl' : 'text-[1.9rem] sm:text-4xl md:text-5xl';
};

const getCardStyle = (theme) => {
  const style = theme.cardStyle || defaultPublicTheme.cardStyle;
  const common = { backgroundColor: `${theme.card}e8` };

  if (style === 'solid') {
    return {
      ...common,
      backgroundColor: theme.card,
      borderRadius: '1.25rem',
      boxShadow: `0 18px 45px ${theme.text}24`,
      borderColor: `${theme.primary}66`
    };
  }

  if (style === 'neon') {
    return {
      ...common,
      borderRadius: '2rem',
      boxShadow: `0 0 0 1px ${theme.accent}88, 0 0 32px ${theme.accent}55, 0 22px 60px ${theme.primary}35`,
      borderColor: `${theme.accent}88`
    };
  }

  if (style === 'minimal') {
    return {
      ...common,
      backgroundColor: theme.card,
      borderRadius: '0.9rem',
      boxShadow: 'none',
      borderColor: `${theme.text}18`
    };
  }

  if (style === 'holographic') {
    return {
      borderRadius: '2rem',
      backgroundImage: `linear-gradient(135deg, ${theme.card}ee, ${theme.secondary}55 32%, ${theme.accent}66 48%, ${theme.card}ee 68%), linear-gradient(45deg, transparent, rgba(255,255,255,0.55), transparent)`,
      boxShadow: `0 22px 70px ${theme.primary}33`,
      borderColor: `${theme.accent}99`
    };
  }

  if (style === 'comic') {
    return {
      backgroundColor: theme.card,
      borderRadius: '1.3rem',
      boxShadow: `8px 8px 0 ${theme.text}, 0 18px 35px ${theme.primary}30`,
      borderColor: theme.text,
      borderWidth: '3px'
    };
  }

  if (style === 'crystal') {
    return {
      backgroundColor: `${theme.card}9c`,
      borderRadius: '2.4rem',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 28px 70px ${theme.text}2c`,
      borderColor: 'rgba(255,255,255,0.65)',
      backdropFilter: 'blur(18px) saturate(1.25)'
    };
  }

  if (style === 'brutalist') {
    return {
      backgroundColor: theme.card,
      borderRadius: '0.15rem',
      boxShadow: `12px 12px 0 ${theme.accent}`,
      borderColor: theme.text,
      borderWidth: '4px'
    };
  }

  if (style === 'sticker') {
    return {
      backgroundColor: theme.card,
      borderRadius: '2.25rem 1rem 2.25rem 1rem',
      boxShadow: `0 0 0 5px #fff, 0 20px 45px ${theme.text}33`,
      borderColor: `${theme.primary}33`,
      transform: 'rotate(-0.45deg)'
    };
  }

  if (style === 'terminal') {
    return {
      backgroundColor: '#07110f',
      borderRadius: '1rem',
      boxShadow: `0 0 0 1px ${theme.accent}99, inset 0 0 30px ${theme.primary}30`,
      borderColor: `${theme.accent}99`,
      color: '#d9ffe5'
    };
  }

  if (style === 'sunset') {
    return {
      borderRadius: '2rem',
      backgroundImage: `linear-gradient(135deg, ${theme.accent}cc, ${theme.primary}dd 48%, ${theme.secondary}dd)`,
      boxShadow: `0 22px 55px ${theme.accent}40`,
      borderColor: 'rgba(255,255,255,0.35)'
    };
  }

  if (style === 'cosmic') {
    return {
      borderRadius: '2rem',
      backgroundImage: `radial-gradient(circle at 20% 10%, ${theme.accent}88, transparent 26%), radial-gradient(circle at 80% 0%, ${theme.secondary}66, transparent 28%), linear-gradient(135deg, #050816, ${theme.primary})`,
      boxShadow: `0 0 42px ${theme.secondary}55, 0 28px 70px #0008`,
      borderColor: `${theme.secondary}88`
    };
  }

  if (style === 'toxic') {
    return {
      borderRadius: '1.6rem',
      backgroundImage: `linear-gradient(135deg, ${theme.card}, ${theme.accent}77), repeating-linear-gradient(45deg, transparent 0 10px, ${theme.primary}22 10px 20px)`,
      boxShadow: `0 0 0 2px ${theme.accent}, 0 18px 60px ${theme.accent}66`,
      borderColor: theme.accent
    };
  }

  if (style === 'paper') {
    return {
      backgroundColor: theme.card,
      borderRadius: '1.1rem',
      backgroundImage: 'linear-gradient(0deg, rgba(255,255,255,0.45), rgba(0,0,0,0.025))',
      boxShadow: `0 14px 30px ${theme.text}18`,
      borderColor: `${theme.text}22`
    };
  }

  if (style === 'metal') {
    return {
      borderRadius: '1.4rem',
      backgroundImage: `linear-gradient(135deg, #ffffff, ${theme.card}, #94a3b8, ${theme.card}, #ffffff)`,
      boxShadow: `inset 0 1px 0 #fff, 0 22px 50px ${theme.text}30`,
      borderColor: '#cbd5e1'
    };
  }

  if (style === 'prism') {
    return {
      borderRadius: '2rem',
      backgroundImage: `conic-gradient(from 180deg at 50% 50%, ${theme.primary}, ${theme.secondary}, ${theme.accent}, ${theme.card}, ${theme.primary})`,
      boxShadow: `0 24px 60px ${theme.primary}40`,
      borderColor: 'rgba(255,255,255,0.5)'
    };
  }

  return {
    ...common,
    borderRadius: '2rem',
    boxShadow: `0 24px 70px ${theme.text}24`,
    borderColor: 'rgba(255,255,255,0.4)'
  };
};

export default function SellerProfile() {
  const { sellerUsername } = useParams();
  const { currentUser, refreshAppUser } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [themePanelTab, setThemePanelTab] = useState('theme');
  const [savingTheme, setSavingTheme] = useState(false);

  const isOwner = currentUser?.uid && seller?.firebaseUid === currentUser.uid;
  const displayName = seller?.name || seller?.fullName || seller?.username || 'Vendedor Anónimo';
  const avatarUrl = seller?.photoURL;
  const publicTheme = useMemo(() => ({
    ...defaultPublicTheme,
    ...(seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {})
  }), [seller?.publicTheme]);
  const primaryAddress = useMemo(() => (
    seller?.addresses?.find(address => address.isDefault) || seller?.addresses?.[0] || null
  ), [seller?.addresses]);
  const totalCards = useMemo(() => folders.reduce((total, folder) => total + (Number(folder.cardsCount) || 0), 0), [folders]);
  const profileLevel = Math.max(1, Math.min(99, Math.round((folders.length * 4) + (totalCards / 12) + 1)));
  const spotlightFolders = folders.slice(0, 3);
  const showSteamShowcase = folders.length > 0 && publicTheme.showcaseStyle !== 'minimal';
  const isSteamLayout = publicTheme.profileLayout === 'steam';
  const isPosterLayout = publicTheme.profileLayout === 'poster';
  const isCompactLayout = publicTheme.profileLayout === 'compact';
  const displayNameSizeClass = getDisplayFontClass(publicTheme.font, isPosterLayout);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: publicTheme } }));
    return () => {
      window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: null } }));
    };
  }, [publicTheme]);

  const loadSeller = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await api.getUserProfile(sellerUsername);
      const user = result.user;
      setSeller(user);
      setFolders((user.folders || []).map(normalizeFolder));
    } catch (error) {
      console.error('Error loading public seller profile:', error);
      setErrorMsg('El vendedor no existe o el perfil no está disponible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (sellerUsername) loadSeller();
  }, [sellerUsername]);

  const compressImage = (file, type) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = type === 'banner' ? 1920 : 420;
        const maxHeight = type === 'banner' ? 600 : 420;
        let { width, height } = img;
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const rgb = type === 'banner' ? getAverageRGB(img, width, height) : null;
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('No se pudo preparar la imagen.'));
            return;
          }

          resolve({
            file: new File([blob], `${type}-${Date.now()}.webp`, { type: blob.type || 'image/webp' }),
            dominantColor: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null,
            complementaryColor: rgb ? getComplementaryHex(rgb.r, rgb.g, rgb.b) : null
          });
        }, 'image/webp', type === 'banner' ? 0.72 : 0.7);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;
    if (!file.type.startsWith('image/')) return alert('Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return alert('La imagen es demasiado grande. Máximo 10MB.');

    setSavingImage(true);
    try {
      const processedImage = await compressImage(file, type);

      const formData = new FormData();
      formData.append('image', processedImage.file);
      formData.append('type', type);

      const response = await api.uploadImage(formData);
      if (response.success) {
        const payload = type === 'banner'
          ? {
            bannerBase64: response.url,
            bannerDominantColor: response.dominantColor || processedImage.dominantColor,
            bannerComplementaryColor: response.complementaryColor || processedImage.complementaryColor
          }
          : { photoURL: response.url };

        setSeller(prev => ({ ...prev, ...payload }));
        if (type === 'avatar') {
          try {
            await updateFirebaseProfile(currentUser, { photoURL: response.url });
          } catch (error) {
            console.warn('Firebase photo update skipped:', error);
          }
          await refreshAppUser?.();
        }
      } else {
        alert(response.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      alert(error?.message || 'No se pudo guardar la imagen.');
    } finally {
      event.target.value = '';
      setSavingImage(false);
    }
  };

  const handleSaveBio = async () => {
    if (!isOwner) return;
    setSavingBio(true);
    try {
      const response = await api.updateProfile({ bio: tempBio });
      setSeller(prev => ({ ...prev, ...(response.user || {}), bio: tempBio }));
      setIsEditingBio(false);
    } catch (error) {
      console.error('Error saving bio:', error);
      alert('No se pudo guardar la biografía.');
    } finally {
      setSavingBio(false);
    }
  };

  const handleThemeChange = async (theme) => {
    if (!isOwner) return;
    setSeller(prev => ({ ...prev, publicTheme: theme }));
    setSavingTheme(true);
    try {
      const response = await api.updateProfile({ publicTheme: theme });
      setSeller(prev => ({ ...prev, ...(response.user || {}), publicTheme: theme }));
    } catch (error) {
      console.error('Error saving public theme:', error);
      alert('No se pudo guardar el tema.');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleThemeFieldChange = (field, value) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: {
        ...publicTheme,
        id: 'custom',
        name: 'Tema personalizado',
        [field]: value
      }
    }));
  };

  const previewPublicTheme = (theme) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: theme
    }));
  };

  const saveCurrentTheme = () => handleThemeChange({
    ...publicTheme,
    id: publicTheme.id === 'custom' ? 'custom' : publicTheme.id,
    name: publicTheme.id === 'custom' ? 'Tema personalizado' : publicTheme.name
  });

  const contactSeller = () => {
    if (!currentUser) return navigate('/login');
    navigate('/mensajes', {
      state: {
        startChatWith: {
          id: seller.id,
          name: displayName,
          avatar: avatarUrl
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#DBEAFE]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-[#1e40af]" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-[#DBEAFE] p-6 text-center">
        <span translate="no" className="material-symbols-outlined mb-4 text-6xl text-red-500">error</span>
        <h2 className="max-w-md text-2xl font-black text-[#1a2b4b]">{errorMsg}</h2>
        <Link to="/" className="mt-6 rounded-xl bg-[#1e40af] px-6 py-3 font-black text-white shadow-md">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: getFontStack(publicTheme.font) }}>
      <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16" style={getSideBackgroundStyle(publicTheme)}>
      <div className={`relative min-h-screen w-full overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.22)] ${getEffectClassName(publicTheme)}`} style={getProfileBackgroundStyle(publicTheme)}>
      <section className="relative overflow-visible shadow-sm" style={{ backgroundColor: publicTheme.card }}>
        {seller?.bannerBase64 ? (
          <div className="absolute inset-x-0 top-0 h-[270px] bg-cover bg-center sm:h-[340px] md:inset-0 md:h-auto" style={{ backgroundImage: `url(${seller.bannerBase64})` }} />
        ) : (
          <div className="absolute inset-x-0 top-0 h-[270px] bg-gradient-to-br sm:h-[340px] md:inset-0 md:h-auto" style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary}, ${publicTheme.secondary})` }} />
        )}
        <div className={`absolute inset-x-0 top-0 h-[270px] sm:h-[340px] md:inset-0 md:h-auto ${seller?.bannerBase64 ? 'bg-gradient-to-b from-black/20 via-transparent to-black/35 md:bg-gradient-to-t md:from-black/25 md:via-transparent md:to-black/10' : 'bg-white/30 md:bg-white/75 md:backdrop-blur-[2px]'}`} />

        {savingImage && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
            <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-[#1e40af]" />
          </div>
        )}

        {isOwner && (
          <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setThemePanelOpen(prev => !prev)} className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white shadow-lg ring-1 ring-white/25 backdrop-blur hover:bg-black/60 sm:rounded-2xl sm:bg-white/90 sm:text-[#1a2b4b] sm:ring-white/80 sm:hover:bg-white sm:text-sm">
                <span translate="no" className="material-symbols-outlined text-[18px]">palette</span>
                <span className="hidden sm:inline">Personalizar</span>
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white shadow-lg ring-1 ring-white/25 backdrop-blur hover:bg-black/60 sm:rounded-2xl sm:bg-white/90 sm:text-[#1a2b4b] sm:ring-white/80 sm:hover:bg-white sm:text-sm">
                <span translate="no" className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                <span className="hidden sm:inline">Cambiar fondo</span>
                <input type="file" accept="image/*" className="hidden" onChange={event => handleImageUpload(event, 'banner')} />
              </label>
            </div>

            {themePanelOpen && (
              <div className="relative z-[35] w-[min(380px,calc(100vw-1.5rem))] rounded-[1.5rem] p-3 text-left shadow-2xl ring-1 ring-white/80 backdrop-blur" style={{ backgroundColor: `${publicTheme.card}f2`, color: publicTheme.text, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">Tema público</p>
                    <p className="text-xs font-bold opacity-70">{savingTheme ? 'Guardando...' : 'Edita y guarda cuando termines'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={saveCurrentTheme} disabled={savingTheme} className="rounded-full px-3 py-1.5 text-xs font-black text-white shadow-lg disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: publicTheme.primary }}>
                      {savingTheme ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => setThemePanelOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                      <span translate="no" className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 rounded-2xl bg-black/5 p-1">
                  {[
                    ['theme', 'Tema', 'palette'],
                    ['font', 'Tipografía', 'text_fields'],
                    ['cards', 'Tarjetas', 'dashboard_customize'],
                    ['scene', 'Escena', 'auto_awesome']
                  ].map(([id, label, icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setThemePanelTab(id)}
                      className={`flex flex-col items-center justify-center rounded-xl px-1.5 py-2 text-[9px] font-black leading-none transition sm:text-[10px] ${themePanelTab === id ? 'bg-white shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                      style={themePanelTab === id ? { color: publicTheme.primary } : undefined}
                    >
                      <span translate="no" className="material-symbols-outlined text-[18px]">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {themePanelTab === 'theme' && (
                  <div className="mt-3 max-h-[58vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
                    <div className="grid grid-cols-2 gap-2">
                      {profileThemes.map(theme => {
                        const selected = publicTheme.id === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            disabled={savingTheme}
                            onClick={() => previewPublicTheme(theme)}
                            className={`overflow-hidden rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 ${selected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200'}`}
                            style={{ backgroundColor: theme.card || '#ffffff' }}
                          >
                            <div className="h-10 rounded-xl" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
                              <div className="flex h-full items-end justify-end p-1.5">
                                <span className="h-4 w-4 rounded-full ring-2 ring-white/70" style={{ backgroundColor: theme.accent }} />
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="truncate text-[11px] font-black" style={{ color: theme.text }}>{theme.name}</span>
                              {selected && <span translate="no" className="material-symbols-outlined text-[16px]" style={{ color: theme.primary }}>check_circle</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-black/10 pt-3">
                      {[
                        ['primary', 'Principal'],
                        ['secondary', 'Secundario'],
                        ['accent', 'Acento'],
                        ['surface', 'Fondo'],
                        ['card', 'Contenedor'],
                        ['text', 'Texto']
                      ].map(([field, label]) => (
                        <label key={field} className="rounded-2xl border border-black/10 bg-white/55 p-2 text-[10px] font-black uppercase tracking-wide">
                          <span className="mb-1 block truncate opacity-70">{label}</span>
                          <input type="color" value={publicTheme[field] || defaultPublicTheme[field]} onChange={event => handleThemeFieldChange(field, event.target.value)} className="h-9 w-full cursor-pointer rounded-xl border-0 bg-transparent p-0" />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {themePanelTab === 'font' && (
                  <div className="mt-3 max-h-[58vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
                    <p className="text-xs font-bold opacity-70">Elige cómo se leen tu nombre, biografía y carpetas.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {fontOptions.map(font => (
                        <button
                          key={font}
                          type="button"
                          onClick={() => handleThemeFieldChange('font', font)}
                          className={`rounded-2xl border bg-white/70 px-3 py-3 text-left transition hover:-translate-y-0.5 ${publicTheme.font === font ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}
                          style={{ fontFamily: getFontStack(font), color: publicTheme.text }}
                        >
                          <span className="flex items-center justify-between gap-2 text-sm font-black">
                            {font}
                            {publicTheme.font === font && <span translate="no" className="material-symbols-outlined text-[16px]" style={{ color: publicTheme.primary }}>check_circle</span>}
                          </span>
                          <span className="mt-1 block text-[15px] font-bold leading-tight">{fontExamples[font]}</span>
                          <span className="mt-1 block text-[10px] font-black uppercase tracking-wide opacity-50">Así se verá en tu perfil</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {themePanelTab === 'cards' && (
                  <div className="mt-3 max-h-[58vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
                    <p className="text-xs font-bold opacity-70">Galería de contenedores: cada estilo cambia tarjetas, vitrinas y módulos.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {cardStyleOptions.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleThemeFieldChange('cardStyle', option.id)}
                          className={`overflow-hidden rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 ${publicTheme.cardStyle === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}
                          style={{ ...getCardStyle({ ...publicTheme, cardStyle: option.id }), color: publicTheme.text }}
                        >
                          <span className="relative mb-2 block h-16 overflow-hidden rounded-xl border border-white/45 bg-black/5">
                            <span className="absolute left-2 top-2 h-5 w-12 rounded-lg" style={{ backgroundColor: publicTheme.primary }} />
                            <span className="absolute bottom-2 left-2 h-2 w-16 rounded-full bg-white/65" />
                            <span className="absolute bottom-5 left-2 h-2 w-10 rounded-full bg-white/45" />
                            <span className="absolute right-2 top-2 h-10 w-7 rounded-lg shadow-lg" style={{ background: `linear-gradient(135deg, ${publicTheme.accent}, ${publicTheme.secondary})` }} />
                            <span className="absolute -right-5 -top-6 h-14 w-14 rounded-full bg-white/25 blur-sm" />
                          </span>
                          <span className="flex items-center justify-between gap-2 text-sm font-black">
                            {option.name}
                            {publicTheme.cardStyle === option.id && <span translate="no" className="material-symbols-outlined text-[16px]" style={{ color: publicTheme.primary }}>check_circle</span>}
                          </span>
                          <span className="mt-1 block text-[10px] font-bold leading-tight opacity-65">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {themePanelTab === 'scene' && (
                  <div className="mt-3 max-h-[58vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-70">Fondo del perfil</p>
                      <div className="grid grid-cols-2 gap-2">
                        {backgroundStyleOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleThemeFieldChange('backgroundStyle', option.id)}
                            className={`overflow-hidden rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 ${publicTheme.backgroundStyle === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}
                            style={{ color: publicTheme.text }}
                          >
                            <div className="h-12 rounded-xl" style={getProfileBackgroundStyle({ ...publicTheme, backgroundStyle: option.id })} />
                            <span className="mt-2 block text-xs font-black">{option.name}</span>
                            <span className="block text-[10px] font-bold opacity-60">{option.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-70">Barras laterales</p>
                      <div className="grid grid-cols-2 gap-2">
                        {sideBackgroundOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleThemeFieldChange('sideBackgroundStyle', option.id)}
                            className={`overflow-hidden rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 ${publicTheme.sideBackgroundStyle === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}
                            style={{ color: publicTheme.text }}
                          >
                            <div className="h-12 rounded-xl" style={getSideBackgroundStyle({ ...publicTheme, sideBackgroundStyle: option.id })} />
                            <span className="mt-2 block text-xs font-black">{option.name}</span>
                            <span className="block text-[10px] font-bold opacity-60">{option.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-70">Marco de avatar</p>
                      <div className="grid grid-cols-2 gap-2">
                        {avatarFrameOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleThemeFieldChange('avatarFrame', option.id)}
                            className={`rounded-2xl border bg-white/60 p-3 text-left transition hover:-translate-y-0.5 ${publicTheme.avatarFrame === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}
                            style={{ color: publicTheme.text }}
                          >
                            <span className="mb-2 block h-10 w-10 rounded-2xl shadow-lg" style={{ background: getAvatarFrameStyle({ ...publicTheme, avatarFrame: option.id }) }} />
                            <span className="block text-xs font-black">{option.name}</span>
                            <span className="block text-[10px] font-bold opacity-60">{option.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-70">Layout y efecto</p>
                      <div className="grid grid-cols-2 gap-2">
                        {profileLayoutOptions.map(option => (
                          <button key={option.id} type="button" onClick={() => handleThemeFieldChange('profileLayout', option.id)} className={`rounded-2xl border bg-white/60 p-3 text-left transition hover:-translate-y-0.5 ${publicTheme.profileLayout === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}>
                            <span className="block text-xs font-black">{option.name}</span>
                            <span className="block text-[10px] font-bold opacity-60">{option.description}</span>
                          </button>
                        ))}
                        {profileEffectOptions.map(option => (
                          <button key={option.id} type="button" onClick={() => handleThemeFieldChange('profileEffect', option.id)} className={`rounded-2xl border bg-white/60 p-3 text-left transition hover:-translate-y-0.5 ${publicTheme.profileEffect === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}>
                            <span className="block text-xs font-black">{option.name}</span>
                            <span className="block text-[10px] font-bold opacity-60">{option.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-70">Vitrina</p>
                      <div className="grid grid-cols-2 gap-2">
                        {showcaseStyleOptions.map(option => (
                          <button key={option.id} type="button" onClick={() => handleThemeFieldChange('showcaseStyle', option.id)} className={`rounded-2xl border bg-white/60 p-3 text-left transition hover:-translate-y-0.5 ${publicTheme.showcaseStyle === option.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-black/10'}`}>
                            <span className="block text-xs font-black">{option.name}</span>
                            <span className="block text-[10px] font-bold opacity-60">{option.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className={`relative z-10 mx-auto flex w-full max-w-[1300px] flex-col justify-end gap-4 px-4 pb-6 pt-[185px] sm:px-6 sm:pt-[260px] md:min-h-0 md:flex-row md:items-end md:gap-5 md:px-10 ${isCompactLayout ? 'min-h-[380px] sm:min-h-[460px] md:py-8' : 'min-h-[430px] sm:min-h-[520px] md:py-12'} ${isPosterLayout ? 'md:items-center' : ''}`}>
          <div className="relative z-20 -mb-10 ml-3 h-32 w-32 shrink-0 sm:ml-5 sm:h-36 sm:w-36 md:mb-0 md:ml-0 md:h-44 md:w-44">
            <div className="absolute -inset-3 rounded-[2.7rem] opacity-70 blur-2xl" style={{ background: `linear-gradient(135deg, ${publicTheme.primary}, ${publicTheme.accent}, ${publicTheme.secondary})` }} />
            <div className="relative h-full w-full rounded-[2.35rem] p-[5px] shadow-[0_24px_60px_rgba(0,0,0,0.42)]" style={{ background: getAvatarFrameStyle(publicTheme) }}>
              <div className="h-full w-full overflow-hidden rounded-[2rem] bg-white ring-2 ring-white/90">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white" style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary})` }}>
                    {displayName[0]?.toUpperCase() || 'V'}
                  </div>
                )}
              </div>
            </div>
            {isOwner && (
              <label className="absolute inset-x-5 bottom-2 z-10 flex cursor-pointer items-center justify-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-center text-[11px] font-black text-white shadow-lg ring-1 ring-white/30 backdrop-blur transition hover:bg-black/85">
                <span translate="no" className="material-symbols-outlined text-[14px]">photo_camera</span>
                <span>Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={event => handleImageUpload(event, 'avatar')} />
              </label>
            )}
          </div>

          <div className={`min-w-0 flex-1 p-4 pt-12 ring-1 backdrop-blur-sm sm:p-5 sm:pt-14 md:p-6 md:pt-6 md:backdrop-blur ${isPosterLayout ? 'md:text-center' : ''}`} style={getCardStyle(publicTheme)}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className={`break-words font-black leading-[0.95] ${displayNameSizeClass}`} style={{ color: publicTheme.text }}>{displayName}</h1>
                  <span translate="no" className="material-symbols-outlined" style={{ color: publicTheme.primary, fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <p className="mt-1 text-sm font-black text-slate-500">@{seller?.username || seller?.firebaseUid}</p>
                {seller?.fullName && <p className="mt-1 text-sm font-semibold text-slate-600">{seller.fullName}</p>}
                <div className={`mt-3 flex flex-wrap gap-2 ${isPosterLayout ? 'justify-center lg:justify-start' : ''}`}>
                  {[
                    ['Nivel', profileLevel],
                    ['Carpetas', folders.length],
                    ['Cartas', totalCards],
                    ['Estilo', publicTheme.showcaseStyle]
                  ].map(([label, value]) => (
                    <span key={label} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ring-1" style={{ backgroundColor: `${publicTheme.primary}18`, borderColor: `${publicTheme.primary}55`, color: publicTheme.text }}>
                      <span className="opacity-60">{label}</span>
                      {value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {!isOwner && (
                  <button onClick={contactSeller} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:brightness-90" style={{ backgroundColor: publicTheme.primary }}>
                    <span translate="no" className="material-symbols-outlined text-[18px]">chat</span>
                    Mensaje
                  </button>
                )}
                {seller?.phone && (
                  <a href={`https://wa.me/${seller.phone.replace(/[^0-9]/g, '').startsWith('56') ? seller.phone.replace(/[^0-9]/g, '') : `56${seller.phone.replace(/[^0-9]/g, '')}`}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-black ring-1" style={{ backgroundColor: `${publicTheme.secondary}33`, color: publicTheme.text, borderColor: publicTheme.secondary }}>WhatsApp</a>
                )}
                {seller?.instagramUrl && (
                  <a href={`https://instagram.com/${seller.instagramUrl.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-black ring-1" style={{ backgroundColor: `${publicTheme.accent}22`, color: publicTheme.text, borderColor: publicTheme.accent }}>Instagram</a>
                )}
              </div>
            </div>

            <div className="mt-5">
              {isEditingBio ? (
                <div className="space-y-3">
                  <textarea value={tempBio} onChange={event => setTempBio(event.target.value)} className="min-h-24 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:ring-4" style={{ backgroundColor: publicTheme.card, borderColor: `${publicTheme.primary}33`, color: publicTheme.text }} placeholder="Cuéntale a la comunidad sobre ti..." />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditingBio(false)} className="rounded-xl px-4 py-2 text-sm font-black text-slate-500 hover:bg-slate-100">Cancelar</button>
                    <button onClick={handleSaveBio} disabled={savingBio} className="rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60" style={{ backgroundColor: publicTheme.primary }}>{savingBio ? 'Guardando...' : 'Guardar'}</button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-start gap-2">
                  <p className="min-h-6 flex-1 border-l-4 pl-3 text-sm font-semibold italic leading-relaxed text-slate-600 line-clamp-4 md:line-clamp-none md:text-base" style={{ borderColor: `${publicTheme.primary}55` }}>
                    {seller?.bio ? `"${seller.bio}"` : isOwner ? 'Aún no has escrito una biografía.' : 'Este vendedor aún no tiene biografía.'}
                  </p>
                  {isOwner && (
                    <button onClick={() => { setTempBio(seller?.bio || ''); setIsEditingBio(true); }} className="rounded-full p-2 text-slate-400 hover:bg-blue-50 hover:text-[#1e40af]">
                      <span translate="no" className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {primaryAddress && (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ring-1" style={{ backgroundColor: `${publicTheme.secondary}26`, color: publicTheme.text, borderColor: `${publicTheme.secondary}66` }}>
                <span translate="no" className="material-symbols-outlined text-[16px]">location_on</span>
                <span className="truncate">{[primaryAddress.name, primaryAddress.comuna, primaryAddress.region].filter(Boolean).join(' · ')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        {showSteamShowcase && (
          <div className={`mb-5 grid gap-4 sm:mb-6 ${isSteamLayout ? 'lg:grid-cols-[1.5fr_0.85fr]' : 'lg:grid-cols-3'}`}>
            <div className={`border p-4 ring-1 ${isSteamLayout ? 'lg:col-span-1' : 'lg:col-span-2'}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33` }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: publicTheme.primary }}>Vitrina pública</p>
                  <h2 className="text-2xl font-black leading-tight" style={{ color: publicTheme.text }}>
                    {publicTheme.showcaseStyle === 'seller' ? 'Catálogo destacado del vendedor' : publicTheme.showcaseStyle === 'collector' ? 'Colección destacada' : 'Carpetas favoritas'}
                  </h2>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: publicTheme.primary }}>{folders.length}</span>
              </div>

              <div className={`grid gap-3 ${publicTheme.showcaseStyle === 'collector' ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                {spotlightFolders.map(folder => (
                  <Link key={folder.id} to={`/c/${folder.id}`} className="group overflow-hidden rounded-2xl border bg-black/5 p-3 transition hover:-translate-y-1 hover:shadow-xl" style={{ borderColor: `${publicTheme.primary}26` }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-14 w-11 shrink-0 rounded-lg bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat shadow-md" style={{ filter: getFolderFilter(folder.color) }} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black" style={{ color: publicTheme.text }}>{folder.name}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{folder.tcg}</p>
                        </div>
                      </div>
                      <span className="rounded-full px-2 py-1 text-[11px] font-black text-white" style={{ backgroundColor: publicTheme.primary }}>{folder.cardsCount}</span>
                    </div>
                    {publicTheme.showcaseStyle === 'seller' && (
                      <p className="mt-3 text-xs font-bold text-slate-500">Disponible para compradores desde este perfil público.</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            <div className="border p-4 ring-1" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.accent}44` }}>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: publicTheme.primary }}>Panel estilo Steam</p>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-1">
                {[
                  ['Nivel de perfil', profileLevel, 'military_tech'],
                  ['Carpetas públicas', folders.length, 'auto_stories'],
                  ['Cartas mostradas', totalCards, 'style'],
                  ['Marco', avatarFrameOptions.find(option => option.id === publicTheme.avatarFrame)?.name || 'Personalizado', 'account_box']
                ].map(([label, value, icon]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border bg-black/5 p-3" style={{ borderColor: `${publicTheme.primary}22` }}>
                    <span translate="no" className="material-symbols-outlined rounded-xl p-2 text-[20px]" style={{ backgroundColor: `${publicTheme.accent}24`, color: publicTheme.primary }}>{icon}</span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="text-lg font-black leading-tight" style={{ color: publicTheme.text }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mb-5 flex items-center justify-between p-4 ring-1 sm:mb-6 sm:border-b sm:bg-transparent sm:p-0 sm:pb-4 sm:shadow-none sm:ring-0" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}20` }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${publicTheme.primary}18` }}>
              <span translate="no" className="material-symbols-outlined" style={{ color: publicTheme.primary }}>auto_stories</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black leading-tight sm:text-2xl" style={{ color: publicTheme.text }}>Carpetas públicas</h2>
              <p className="text-xs font-semibold text-slate-500 sm:text-sm">Catálogos publicados por este vendedor.</p>
            </div>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: publicTheme.primary }}>{folders.length}</span>
        </div>

        {folders.length === 0 ? (
          <div className="border border-dashed p-10 text-center" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}44` }}>
            <span translate="no" className="material-symbols-outlined text-6xl" style={{ color: `${publicTheme.primary}88` }}>inventory_2</span>
            <p className="mt-3 text-lg font-black text-slate-500">Este vendedor aún no tiene carpetas públicas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {folders.map(folder => (
              <Link to={`/c/${folder.id}`} key={folder.id} className="@container group relative mx-auto flex aspect-[32/37] w-full max-w-[320px] cursor-pointer flex-col transition-transform duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat drop-shadow-lg transition-all group-hover:drop-shadow-2xl" style={{ filter: getFolderFilter(folder.color) }} />
                <div className="relative z-10 flex h-full w-full flex-col justify-between pb-[15%] pl-[18%] pr-[16%] pt-[5%]">
                  <div>
                    <div className="flex justify-end">
                      <div className="flex items-center gap-[1.5cqi] rounded-[3cqi] bg-black/30 px-[3cqi] py-[1.5cqi] text-[4.5cqi] font-bold text-white shadow-sm">
                        <span translate="no" className="material-symbols-outlined text-[5cqi]">style</span>
                        {folder.cardsCount}
                      </div>
                    </div>
                    <h3 className="mt-[2cqi] line-clamp-3 w-full break-words text-[11cqi] font-extrabold leading-tight text-white drop-shadow-md" title={folder.name}>{folder.name}</h3>
                  </div>
                  <span className="w-fit rounded-[2cqi] border border-white/60 px-[3cqi] py-[1cqi] text-[3.5cqi] font-bold uppercase tracking-wider text-white drop-shadow-sm">{folder.tcg}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      </div>
      </div>
    </div>
  );
}
