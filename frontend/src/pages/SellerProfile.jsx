import NotFound from './NotFound';
import WishlistSection from '../components/WishlistSection';
import ReviewsSection, { Stars } from '../components/Reviews';
import { ensureExternalUrl, formatWhatsAppNumber, getInstagramHref } from '../utils/contact';
import { PALETTES } from '../utils/profileThemes';
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

const SocialLogo = ({ type, className = 'h-4 w-4' }) => {
  if (type === 'whatsapp') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <path fill="#25D366" d="M16 3.2A12.6 12.6 0 0 0 5.1 22.1L3.7 28.8l6.8-1.8A12.6 12.6 0 1 0 16 3.2Z" />
        <path fill="#fff" d="M22.9 18.7c-.4-.2-2.2-1.1-2.5-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.7.1-1 .5-.3.4-1.3 1.3-1.3 3.1 0 1.8 1.3 3.6 1.5 3.8.2.2 2.6 4 6.3 5.6.9.4 1.6.6 2.1.8.9.3 1.7.3 2.3.2.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.2-.1-.5-.2-.9-.4Z" />
      </svg>
    );
  }

  if (type === 'instagram') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="ig-gradient" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#f58529" />
            <stop offset="0.35" stopColor="#dd2a7b" />
            <stop offset="0.7" stopColor="#8134af" />
            <stop offset="1" stopColor="#515bd4" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" x="2" y="2" rx="8" fill="url(#ig-gradient)" />
        <circle cx="16" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="1.8" fill="#fff" />
      </svg>
    );
  }

  if (type === 'facebook') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#1877F2" />
        <path fill="#fff" d="M18.5 30V18.5h3.8l.6-4.5h-4.4v-2.9c0-1.3.4-2.2 2.3-2.2h2.3v-4c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 5.9V14h-3.8v4.5H14V30h4.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="28" height="20" x="2" y="6" rx="6" fill="#FF0000" />
      <path fill="#fff" d="m14 12 7 4-7 4v-8Z" />
    </svg>
  );
};

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

const profileThemes = [defaultPublicTheme, ...PALETTES.slice(1)];

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

const sideBackgroundOptions = [
    { id: 'solid-surface', name: 'Original', description: 'El fondo simple oficial.' },
  { id: 'site-wallpaper', name: 'Fondo Carpetazo', description: 'El wallpaper oficial de la página.' },
  { id: 'theme-glow', name: 'Glow del tema', description: 'Laterales con luces del color elegido.' },
  { id: 'premium-dark', name: 'Oscuro premium', description: 'Bandas negras con profundidad.' },
  { id: 'binder-shelf', name: 'Repisa TCG', description: 'Textura de álbum y colección.' },
  { id: 'pixel-room', name: 'Pixel room', description: 'Patrón gamer retro.' },
  { id: 'foil-side', name: 'Foil lateral', description: 'Brillos diagonales fuertes.' },
  { id: 'clean-fade', name: 'Degradado limpio', description: 'Minimal, sin distraer.' },
  { id: 'comic-wall', name: 'Comic wall', description: 'Puntos y explosiones pop.' }
];

const avatarFrameOptions = [
  { id: 'gradient', name: 'Degradado', description: 'Marco premium dinámico.' },
  { id: 'dark-frame', name: 'Oscuro', description: 'Marco negro con acento brillante.' },
  { id: 'neon', name: 'Neón', description: 'Glow intenso alrededor.' },
  { id: 'gold', name: 'Dorado', description: 'Coleccionista legendario.' },
  { id: 'holo', name: 'Holo', description: 'Brillo de carta foil.' },
  { id: 'pixel', name: 'Pixel', description: 'Retro gamer cuadrado.' },
  { id: 'rune', name: 'Runas', description: 'Fantasía mística.' },
  { id: 'clean', name: 'Limpio', description: 'Simple y elegante.' }
];

const profileLayoutOptions = [
  { id: 'classic', name: 'Clásico', description: 'Hero amplio y carpetas abajo.' },
  { id: 'side-showcase', name: 'Gamer', description: 'Hero + vitrina lateral.' },
  { id: 'showcase', name: 'Showcase', description: 'Todo centrado como exposición.' },
  { id: 'compact', name: 'Compacto', description: 'Más información en menos altura.' },
  { id: 'poster', name: 'Poster', description: 'Nombre grande y teatral.' }
];

const profileEffectOptions = [
  { id: 'none', name: 'Sin efecto', description: 'Máximo rendimiento.' },
  { id: 'scanlines', name: 'Scanlines', description: 'Líneas retro sobre el perfil.' },
  { id: 'particles', name: 'Partículas', description: 'Puntos luminosos flotantes.' },
  { id: 'diagonal', name: 'Franjas', description: 'Rayas de energía tipo gamer.' },
  { id: 'spotlight', name: 'Spotlight', description: 'Luces dramáticas de vitrina.' }
];

const showcaseStyleOptions = [
  { id: 'folders', name: 'Carpetas', description: 'Destaca tus carpetas públicas.' },
  { id: 'collector', name: 'Coleccionista', description: 'Badges y estadísticas primero.' },
  { id: 'seller', name: 'Vendedor', description: 'Contacto y catálogo al frente.' },
  { id: 'minimal', name: 'Minimal', description: 'Sin ruido, muy limpio.' }
];

const profileDistributionOptions = [
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

const getFontStack = (font = defaultPublicTheme.font) => {
  const safeFont = fontOptions.includes(font) ? font : defaultPublicTheme.font;
  return `'${safeFont}', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
};

const getProfileBackgroundStyle = (theme) => {
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

const getSideBackgroundStyle = (theme) => {
  const style = theme.sideBackgroundStyle || defaultPublicTheme.sideBackgroundStyle;
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
    'theme-glow': {
      backgroundColor: theme.text,
      backgroundImage: `radial-gradient(circle at 12% 20%, ${theme.primary}aa, transparent 28%), radial-gradient(circle at 88% 70%, ${theme.accent}88, transparent 26%), linear-gradient(135deg, ${theme.text}, ${theme.primary})`
    },
    'premium-dark': {
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

const getEffectClassName = (theme) => {
  const effect = theme.profileEffect || defaultPublicTheme.profileEffect;
  if (effect === 'scanlines') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_5px)] before:mix-blend-overlay';
  if (effect === 'particles') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(circle,rgba(255,255,255,0.45)_1px,transparent_2px)] before:bg-[length:34px_34px] before:opacity-35';
  if (effect === 'diagonal') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[repeating-linear-gradient(135deg,transparent_0_34px,rgba(255,255,255,0.16)_34px_38px)] before:opacity-50';
  if (effect === 'spotlight') return 'before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.45),transparent_36%)] before:mix-blend-overlay';
  return '';
};

// La fuente del tema solo se usa en títulos; las anchas (pixel, display extendidas) se achican para que quepan en móvil
const getDisplayScale = (font) => {
  if (['Press Start 2P', 'Rubik Glitch'].includes(font)) return 0.7;
  if (['Bungee', 'Orbitron', 'Audiowide', 'Unbounded'].includes(font)) return 0.8;
  if (font === 'Bebas Neue') return 1.12;
  return 1;
};
const BODY_FONT_STACK = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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

// Opción de personalización: vista previa grande + nombre + descripción, con el mismo aviso de "seleccionada" en todo el panel
const OptionTile = ({ selected, onClick, name, description, disabled = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white p-1.5 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${selected ? 'border-[#12315f] shadow-[0_8px_22px_-10px_rgba(18,49,95,0.6)]' : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md'}`}
  >
    <span className="relative block">
      {children}
      {selected && (
        <span className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#12315f] text-white shadow-md ring-2 ring-white">
          <span translate="no" className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
        </span>
      )}
    </span>
    <span className="mt-2 block px-1.5 text-sm font-extrabold leading-tight text-[#12315f]">{name}</span>
    {description && <span className="mb-1 mt-0.5 block px-1.5 text-xs leading-snug text-slate-500">{description}</span>}
  </button>
);

// Bloque del panel: título, una línea que explica qué cambia y la cuadrícula de opciones
const PanelSection = ({ icon, title, hint, children }) => (
  <section className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
    <div className="mb-3 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#12315f] text-[#facc15]">
        <span translate="no" className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-extrabold leading-tight text-[#12315f]">{title}</h3>
        {hint && <p className="mt-0.5 text-xs leading-snug text-slate-500">{hint}</p>}
      </div>
    </div>
    {children}
  </section>
);

// Interruptor con nombre y estado escrito (no depende solo del color)
const ToggleRow = ({ enabled, onClick, label, status, children }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${enabled ? 'border-[#12315f] bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}
  >
    <span className="flex min-w-0 items-center gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${enabled ? 'bg-slate-100' : 'bg-white opacity-60'}`}>{children}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-[#12315f]">{label}</span>
        <span className="block text-xs text-slate-500">{status}</span>
      </span>
    </span>
    <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-[#12315f]' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
    </span>
  </button>
);

// Perfil en miniatura: tarjeta con foto enmarcada, nombre y botón, con los estilos reales del tema
const MiniProfile = ({ theme, avatarUrl, initial = 'V' }) => (
  <span className="absolute inset-x-3 bottom-2.5 top-5 flex items-center gap-2 overflow-hidden p-2" style={{ ...getCardStyle(theme), color: theme.text }}>
    <span className="h-9 w-9 shrink-0 rounded-[0.7rem] p-[2px] shadow" style={{ background: getAvatarFrameStyle(theme) }}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[0.55rem] bg-white text-[11px] font-black text-slate-500">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
      </span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block h-1.5 w-4/5 rounded-full" style={{ backgroundColor: theme.text }} />
      <span className="mt-1 block h-1 w-1/2 rounded-full opacity-40" style={{ backgroundColor: theme.text }} />
      <span className="mt-2 flex items-center gap-1">
        <span className="h-2.5 w-9 rounded-full" style={{ backgroundColor: theme.accent }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.primary }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.secondary }} />
      </span>
    </span>
  </span>
);

// Escena en miniatura: el fondo elegido con un perfil encima
const MiniScene = ({ theme, avatarUrl, initial, background }) => (
  <span className="relative block h-[104px] overflow-hidden rounded-xl" style={background || getProfileBackgroundStyle(theme)}>
    <MiniProfile theme={theme} avatarUrl={avatarUrl} initial={initial} />
  </span>
);

// Esquemas de estructura: se entiende de un vistazo cómo queda la parte de arriba del perfil
const wire = 'rounded-[3px]';
const LayoutWire = ({ id }) => {
  const dark = 'bg-[#12315f]';
  const soft = 'bg-slate-300';
  const gold = 'bg-[#facc15]';
  return (
    <span className="relative block h-[104px] overflow-hidden rounded-xl bg-slate-100 p-2" aria-hidden="true">
      {id === 'classic' && (
        <>
          <span className={`block h-9 ${wire} ${dark}`} />
          <span className="-mt-3 ml-2 flex items-end gap-1.5"><span className={`h-7 w-7 rounded-lg border-2 border-slate-100 ${gold}`} /><span className={`mb-1 h-2 w-14 ${wire} ${soft}`} /></span>
          <span className="mt-2 grid grid-cols-4 gap-1.5"><span className={`h-9 ${wire} bg-emerald-500`} /><span className={`h-9 ${wire} bg-emerald-500`} /><span className={`h-9 ${wire} bg-emerald-500`} /><span className={`h-9 ${wire} bg-emerald-500`} /></span>
        </>
      )}
      {id === 'side-showcase' && (
        <span className="grid h-full grid-cols-[1.7fr_1fr] gap-1.5">
          <span className="flex flex-col gap-1.5"><span className={`h-10 ${wire} ${dark}`} /><span className="grid flex-1 grid-cols-2 gap-1.5"><span className={`${wire} bg-emerald-500`} /><span className={`${wire} bg-emerald-500`} /></span></span>
          <span className="flex flex-col gap-1.5"><span className={`flex-1 ${wire} ${gold}`} /><span className={`flex-1 ${wire} ${soft}`} /></span>
        </span>
      )}
      {id === 'showcase' && (
        <span className="flex h-full flex-col items-center gap-1.5">
          <span className={`h-9 w-full ${wire} ${dark}`} />
          <span className={`-mt-6 h-9 w-9 rounded-full border-2 border-slate-100 ${gold}`} />
          <span className={`h-2 w-16 ${wire} ${soft}`} />
          <span className="grid w-full grid-cols-3 gap-1.5"><span className={`h-7 ${wire} bg-emerald-500`} /><span className={`h-7 ${wire} bg-emerald-500`} /><span className={`h-7 ${wire} bg-emerald-500`} /></span>
        </span>
      )}
      {id === 'compact' && (
        <>
          <span className={`flex h-8 items-center gap-2 px-1.5 ${wire} ${dark}`}><span className={`h-5 w-5 rounded-md ${gold}`} /><span className="h-1.5 w-12 rounded-full bg-white/70" /></span>
          <span className="mt-1.5 grid grid-cols-5 gap-1"><span className={`h-8 ${wire} bg-emerald-500`} /><span className={`h-8 ${wire} bg-emerald-500`} /><span className={`h-8 ${wire} bg-emerald-500`} /><span className={`h-8 ${wire} bg-emerald-500`} /><span className={`h-8 ${wire} bg-emerald-500`} /></span>
          <span className={`mt-1.5 block h-3 ${wire} ${soft}`} />
        </>
      )}
      {id === 'poster' && (
        <span className="flex h-full flex-col items-center justify-center gap-1.5">
          <span className={`flex h-14 w-full flex-col items-center justify-center gap-1 ${wire} ${dark}`}><span className="h-3.5 w-24 rounded-full bg-white" /><span className={`h-1.5 w-14 rounded-full ${gold}`} /></span>
          <span className="grid w-full grid-cols-3 gap-1.5"><span className={`h-6 ${wire} bg-emerald-500`} /><span className={`h-6 ${wire} bg-emerald-500`} /><span className={`h-6 ${wire} bg-emerald-500`} /></span>
        </span>
      )}
    </span>
  );
};

// Esquemas de la vitrina destacada
const ShowcaseWire = ({ id }) => {
  const soft = 'bg-slate-300';
  return (
    <span className="relative block h-[104px] overflow-hidden rounded-xl bg-slate-100 p-2.5" aria-hidden="true">
      {id === 'folders' && (
        <span className="flex h-full flex-col justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-2"><span className="h-6 w-4 rounded-[3px] bg-emerald-500" /><span className="flex-1"><span className={`block h-1.5 w-4/5 rounded-full bg-[#12315f]`} /><span className={`mt-1 block h-1 w-1/2 rounded-full ${soft}`} /></span></span>
          ))}
        </span>
      )}
      {id === 'collector' && (
        <span className="flex h-full flex-col justify-center gap-2">
          <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="flex-1 rounded-md bg-white p-1.5 shadow-sm"><span className="block h-2 w-5 rounded-full bg-[#facc15]" /><span className={`mt-1 block h-1 w-full rounded-full ${soft}`} /></span>)}</span>
          <span className="flex gap-1"><span className="h-3 w-8 rounded-full bg-[#12315f]" /><span className="h-3 w-8 rounded-full bg-[#1e40af]" /><span className="h-3 w-8 rounded-full bg-emerald-500" /></span>
        </span>
      )}
      {id === 'seller' && (
        <span className="flex h-full flex-col justify-center gap-2">
          <span className="flex items-center gap-1.5"><span className="h-5 w-14 rounded-full bg-[#facc15]" /><span className="h-5 w-5 rounded-full bg-white shadow-sm" /><span className="h-5 w-5 rounded-full bg-white shadow-sm" /></span>
          <span className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-9 rounded-[3px] bg-emerald-500" />)}</span>
        </span>
      )}
      {id === 'minimal' && (
        <span className="flex h-full flex-col items-center justify-center gap-1.5"><span className="h-1.5 w-20 rounded-full bg-[#12315f]" /><span className={`h-1 w-12 rounded-full ${soft}`} /></span>
      )}
    </span>
  );
};

const PANEL_TABS = [
  ['theme', 'Colores', 'palette'],
  ['font', 'Letra', 'text_fields'],
  ['cards', 'Tarjetas', 'dashboard_customize'],
  ['scene', 'Escena', 'wallpaper'],
  ['layout', 'Orden', 'view_quilt'],
  ['social', 'Redes', 'share'],
];

// Color de texto legible sobre un fondo (blanco u oscuro según su luminosidad)
const readableOn = (hex = '#000000') => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(value)) return '#ffffff';
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b1b33' : '#ffffff';
};

const themeKey = (theme) => JSON.stringify(Object.keys(theme || {}).sort().map((key) => [key, theme[key]]));


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
  const [savedThemeJson, setSavedThemeJson] = useState('');

  // El servidor indica si quien mira es el dueño (ya no se publica el identificador interno)
  const isOwner = Boolean(seller?.isOwner ?? (currentUser?.uid && seller?.firebaseUid === currentUser.uid));
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
  const profileLevel = Math.max(1, Math.round((folders.length * 2) + (totalCards / 12) + 1));
  const spotlightFolders = folders.slice(0, 3);
  const showProfileShowcase = folders.length > 0 && publicTheme.showcaseStyle !== 'minimal';
  const themeDirty = savedThemeJson !== '' && themeKey(publicTheme) !== savedThemeJson;
  const isSideShowcaseLayout = publicTheme.profileLayout === 'side-showcase';
  const isPosterLayout = publicTheme.profileLayout === 'poster';
  const isCompactLayout = publicTheme.profileLayout === 'compact';
  const displayScale = getDisplayScale(publicTheme.font);
  // Nombre: crece con la pantalla, acotado entre móvil y escritorio (más grande en el diseño póster)
  const displayNameSize = `clamp(${(1.7 * displayScale).toFixed(2)}rem, ${(1.05 * displayScale).toFixed(2)}rem + ${(2.4 * displayScale).toFixed(2)}vw, ${((isPosterLayout ? 3.6 : 2.9) * displayScale).toFixed(2)}rem)`;
  const selectedDistribution = profileDistributionOptions.find(option => option.id === publicTheme.profileDistribution) || profileDistributionOptions[0];
  const getDistributionOrder = (moduleName) => {
    const index = selectedDistribution.order.indexOf(moduleName);
    return index === -1 ? 99 : index + 1;
  };
  const getDistributionSpan = (moduleName) => selectedDistribution.spans?.[moduleName] || 'lg:col-span-12';
  const isNarrowStatsPanel = ['compact-shop', 'premium-gallery', 'trading-desk', 'sidebar-left', 'sidebar-right'].includes(selectedDistribution.id);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: publicTheme } }));
    return () => {
      window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: null } }));
    };
  }, [publicTheme]);

  useEffect(() => {
    if (!themePanelOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setThemePanelOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [themePanelOpen]);

  const loadSeller = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await api.getUserProfile(sellerUsername);
      const user = result.user;
      setSeller(user);
      setSavedThemeJson(themeKey({ ...defaultPublicTheme, ...(user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {}) }));
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

  useEffect(() => {
    document.body.classList.add('public-profile-active');
    
    const originalBodyBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = publicTheme.surface || '#1a2b4b';

    let metaThemeColor = document.querySelector("meta[name=theme-color]");
    let originalMetaColor = '';
    if (metaThemeColor) {
      originalMetaColor = metaThemeColor.getAttribute("content");
      metaThemeColor.setAttribute("content", publicTheme.primary || '#1a2b4b');
    } else {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = "theme-color";
      metaThemeColor.content = publicTheme.primary || '#1a2b4b';
      document.head.appendChild(metaThemeColor);
    }

    if (seller?.wallpaperBase64) {
      document.documentElement.style.setProperty('--seller-bg', `url(${seller.wallpaperBase64})`);
      document.documentElement.style.setProperty('--seller-overlay', 'transparent');
    } else {
      document.documentElement.style.removeProperty('--seller-bg');
      document.documentElement.style.removeProperty('--seller-overlay');
    }
    
    return () => {
      document.body.classList.remove('public-profile-active');
      document.documentElement.style.removeProperty('--seller-bg');
      document.documentElement.style.removeProperty('--seller-overlay');
      document.body.style.backgroundColor = originalBodyBg;
      
      if (metaThemeColor) {
        if (originalMetaColor) {
          metaThemeColor.setAttribute("content", originalMetaColor);
        } else {
          metaThemeColor.remove();
        }
      }
    };
  }, [seller?.wallpaperBase64, publicTheme.surface, publicTheme.primary]);

  const compressImage = (file, type) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
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
        }, 'image/webp', 1);
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
          : type === 'wallpaper'
            ? { wallpaperBase64: response.url }
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
      setSavedThemeJson(themeKey({ ...defaultPublicTheme, ...theme }));
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

  const applyThemePalette = (theme) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: {
        ...publicTheme,
        id: theme.id,
        name: theme.name,
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        surface: theme.surface,
        card: theme.card,
        text: theme.text
      }
    }));
  };

  const resetPublicTheme = () => {
    setSeller(prev => ({
      ...prev,
      publicTheme: defaultPublicTheme
    }));
  };

  const saveCurrentTheme = () => handleThemeChange({
    ...publicTheme,
    id: publicTheme.id === 'custom' ? 'custom' : publicTheme.id,
    name: publicTheme.id === 'custom' ? 'Tema personalizado' : publicTheme.name
  });

  const contactSeller = () => {
    if (!currentUser) return navigate('/bienvenida');
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

  const getSocialEnabled = (field) => publicTheme[field] !== 'off';
  const messageButtonEnabled = getSocialEnabled('showMessageButton');
  const showMessageButton = !isOwner && messageButtonEnabled;
  const socialLinks = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      field: 'showWhatsApp',
      available: Boolean(seller?.phone),
      href: seller?.phone ? `https://wa.me/${formatWhatsAppNumber(seller.phone)}` : ''
    },
    {
      id: 'instagram',
      label: 'Instagram',
      field: 'showInstagram',
      available: Boolean(seller?.instagramUrl),
      href: seller?.instagramUrl ? getInstagramHref(seller.instagramUrl) : ''
    },
    {
      id: 'facebook',
      label: 'Facebook',
      field: 'showFacebook',
      available: Boolean(seller?.facebookUrl),
      href: seller?.facebookUrl ? ensureExternalUrl(seller.facebookUrl) : ''
    },
    {
      id: 'youtube',
      label: 'YouTube',
      field: 'showYoutube',
      available: Boolean(seller?.youtubeUrl),
      href: seller?.youtubeUrl ? ensureExternalUrl(seller.youtubeUrl) : ''
    }
  ];

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#DBEAFE]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-[#1e40af]" />
      </div>
    );
  }

  if (errorMsg) {
    return <NotFound />;
  }

  const heroActions = [
    ...(showMessageButton ? [{ id: 'message', label: 'Enviar mensaje' }] : []),
    ...socialLinks.filter((social) => social.available && getSocialEnabled(social.field)),
  ];
  const ownerButtonClass = 'inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-bold text-[#12315f] shadow-md ring-1 ring-black/5 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]';
  const folderCountLabel = `${folders.length} ${folders.length === 1 ? 'carpeta' : 'carpetas'}`;
  const cardCountLabel = `${totalCards.toLocaleString('es-CL')} ${totalCards === 1 ? 'carta' : 'cartas'}`;
  const textMuted = { color: publicTheme.text, opacity: 0.7 };

  return (
    <div
      className="min-h-screen [&_h1]:[font-family:var(--seller-font)] [&_section_h2]:[font-family:var(--seller-font)] [&_section_h2]:[font-size:var(--seller-h2)]"
      style={{ fontFamily: BODY_FONT_STACK, '--seller-font': getFontStack(publicTheme.font), '--seller-h2': `${(1.45 * displayScale).toFixed(2)}rem` }}
    >
      <div className="mx-auto w-full max-w-[1470px] xl:px-4 2xl:px-6" style={getSideBackgroundStyle(publicTheme)}>
      <div className={`relative min-h-screen w-full overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.22)] ${getEffectClassName(publicTheme)}`} style={getProfileBackgroundStyle(publicTheme)}>

      {/* Presentación */}
      <section className="relative overflow-visible" style={{ backgroundColor: publicTheme.card }}>
        {seller?.bannerBase64 ? (
          <div className="absolute inset-x-0 top-0 h-[250px] bg-cover bg-center sm:h-[320px] md:inset-0 md:h-auto" style={{ backgroundImage: `url(${seller.bannerBase64})` }} />
        ) : (
          <div className="absolute inset-x-0 top-0 h-[250px] sm:h-[320px] md:inset-0 md:h-auto" style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary}, ${publicTheme.secondary})` }} />
        )}
        <div className="absolute inset-x-0 top-0 h-[250px] bg-gradient-to-b from-black/25 via-transparent to-black/30 sm:h-[320px] md:inset-0 md:h-auto md:bg-gradient-to-t md:from-black/30 md:via-transparent md:to-black/10" />

        {savingImage && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70" role="status" aria-label="Subiendo imagen">
            <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-[#1e40af]" />
          </div>
        )}

        {isOwner && (
          <div className="absolute right-3 top-3 z-30 flex flex-wrap justify-end gap-2 sm:right-4 sm:top-4">
            <button type="button" onClick={() => setThemePanelOpen((prev) => !prev)} aria-expanded={themePanelOpen} className={ownerButtonClass}>
              <span translate="no" className="material-symbols-outlined text-[19px]">palette</span>
              <span className="hidden sm:inline">Personalizar</span>
              <span className="sm:hidden">Estilo</span>
            </button>
            <label className={`${ownerButtonClass} cursor-pointer`} title="Imagen de fondo de tu presentación">
              <span translate="no" className="material-symbols-outlined text-[19px]">panorama</span>
              <span className="hidden sm:inline">Banner</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'banner')} aria-label="Cambiar banner" />
            </label>
            <label className={`${ownerButtonClass} cursor-pointer`} title="Imagen de fondo de toda la página">
              <span translate="no" className="material-symbols-outlined text-[19px]">wallpaper</span>
              <span className="hidden sm:inline">Fondo de página</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'wallpaper')} aria-label="Cambiar fondo de página" />
            </label>
          </div>
        )}

        <div className={`relative z-10 mx-auto flex w-full max-w-[1220px] flex-col justify-end gap-5 px-4 pb-6 pt-[150px] sm:px-6 sm:pt-[220px] md:flex-row md:items-end md:px-8 ${isCompactLayout ? 'md:py-8' : 'md:py-12'} ${isPosterLayout ? 'md:items-center' : ''}`}>
          <div className="relative z-20 h-28 w-28 shrink-0 sm:h-36 sm:w-36 md:h-40 md:w-40">
            {/* Nivel como la gema de coste de una carta */}
            <div
              className="absolute -right-3 -top-3 z-20 flex h-12 w-12 flex-col items-center justify-center rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-4 md:h-14 md:w-14"
              style={{ backgroundColor: publicTheme.accent, color: readableOn(publicTheme.accent), '--tw-ring-color': publicTheme.card }}
              title={`Nivel ${profileLevel} del perfil`}
              aria-label={`Nivel ${profileLevel}`}
              role="img"
            >
              <span className="text-[9px] font-bold leading-none opacity-80" aria-hidden="true">nivel</span>
              <span className="font-black leading-none tabular-nums" style={{ fontFamily: 'var(--seller-font)', fontSize: `${(1.15 * Math.max(displayScale, 0.75)).toFixed(2)}rem` }} aria-hidden="true">{profileLevel}</span>
            </div>
            <div className="h-full w-full rounded-[2.2rem] p-[5px] shadow-[0_18px_44px_rgba(0,0,0,0.4)]" style={{ background: getAvatarFrameStyle(publicTheme) }}>
              <div className="h-full w-full overflow-hidden rounded-[1.9rem] bg-white ring-2 ring-white/90">
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
              <label className="absolute inset-x-4 bottom-2 z-10 flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full bg-black/70 text-xs font-bold text-white shadow-lg ring-1 ring-white/30 transition hover:bg-black/85">
                <span translate="no" className="material-symbols-outlined text-[15px]">photo_camera</span>
                Cambiar foto
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'avatar')} aria-label="Cambiar foto de perfil" />
              </label>
            )}
          </div>

          <div className={`relative min-w-0 flex-1 p-4 ring-1 sm:p-5 md:p-6 ${isPosterLayout ? 'md:text-center' : ''}`} style={getCardStyle(publicTheme)}>
            <div className={`flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between ${isPosterLayout ? 'lg:flex-col lg:items-center' : ''}`}>
              <div className="min-w-0">
                <h1 className="break-words font-black leading-[1.05]" style={{ color: publicTheme.text, fontSize: displayNameSize }}>
                  {displayName}
                  {/* Pegado a la última palabra del nombre, aunque ocupe varias líneas */}
                  <span translate="no" className="material-symbols-outlined ml-1.5 align-[-0.12em] text-[22px] leading-none" style={{ color: publicTheme.primary, fontVariationSettings: "'FILL' 1" }} title="Vendedor verificado" aria-label="Vendedor verificado">verified</span>
                </h1>
                <p className="mt-1.5 text-[15px] font-bold leading-snug" style={{ color: publicTheme.primary }}>@{seller?.username}</p>
                {seller?.fullName && <p className="text-sm font-medium leading-snug" style={textMuted}>{seller.fullName}</p>}

                {/* Datos del vendedor en fichas cortas: se leen de un vistazo y se acomodan en varias líneas en móvil */}
                <ul className={`mt-3 flex flex-wrap gap-1.5 ${isPosterLayout ? 'md:justify-center' : ''}`} aria-label="Datos del vendedor">
                  {[
                    { icon: 'folder_open', label: folderCountLabel },
                    { icon: 'style', label: cardCountLabel },
                    ...(primaryAddress ? [{ icon: 'location_on', label: [primaryAddress.comuna, primaryAddress.region].filter(Boolean).join(', ') || primaryAddress.name }] : [])
                  ].map((chip) => (
                    <li key={chip.icon} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold tabular-nums" style={{ backgroundColor: `${publicTheme.primary}14`, color: publicTheme.text, boxShadow: `inset 0 0 0 1px ${publicTheme.primary}2e` }}>
                      <span translate="no" className="material-symbols-outlined shrink-0 text-[17px]" style={{ color: publicTheme.primary }} aria-hidden="true">{chip.icon}</span>
                      <span className="truncate">{chip.label}</span>
                    </li>
                  ))}
                  {seller?.reviewSummary && (
                    <li>
                      <a href="#resenas" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold tabular-nums transition hover:brightness-95 focus:outline-none focus-visible:ring-2" style={{ backgroundColor: seller.reviewSummary.count > 0 ? '#fef3c7' : `${publicTheme.primary}14`, color: seller.reviewSummary.count > 0 ? '#713f12' : publicTheme.text, boxShadow: `inset 0 0 0 1px ${seller.reviewSummary.count > 0 ? '#f59e0b55' : `${publicTheme.primary}2e`}` }}>
                        {seller.reviewSummary.showAverage
                          ? <><Stars value={seller.reviewSummary.average} size={14} />{seller.reviewSummary.average.toFixed(1)}<span className="font-semibold opacity-75">({seller.reviewSummary.count})</span></>
                          : seller.reviewSummary.count > 0
                            ? <><span translate="no" className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1", color: '#d97706' }} aria-hidden="true">star</span>{seller.reviewSummary.count} {seller.reviewSummary.count === 1 ? 'reseña' : 'reseñas'}</>
                            : <><span translate="no" className="material-symbols-outlined text-[17px]" style={{ color: publicTheme.primary }} aria-hidden="true">star</span>Sin reseñas todavía</>}
                      </a>
                    </li>
                  )}
                </ul>
              </div>

              {heroActions.length > 0 && (
                <div className="flex items-center gap-2">
                  {heroActions.map((action) => action.id === 'message' ? (
                    <button
                      key="message"
                      type="button"
                      onClick={contactSeller}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold shadow-md transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:flex-none"
                      style={{ backgroundColor: publicTheme.accent, color: readableOn(publicTheme.accent) }}
                    >
                      <span translate="no" className="material-symbols-outlined text-[20px]">chat</span>
                      Enviar mensaje
                    </button>
                  ) : (
                    <a
                      key={action.id}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={action.label}
                      title={action.label}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
                    >
                      <SocialLogo type={action.id} className="h-6 w-6" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              {isEditingBio ? (
                <div className="space-y-3">
                  <textarea value={tempBio} onChange={(event) => setTempBio(event.target.value)} maxLength={500} aria-label="Biografía" className="min-h-24 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none focus:ring-4" style={{ backgroundColor: publicTheme.card, borderColor: `${publicTheme.primary}55`, color: publicTheme.text }} placeholder="Cuéntale a la comunidad quién eres y qué coleccionas" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditingBio(false)} className="h-10 rounded-full px-4 text-sm font-bold text-slate-600 hover:bg-black/5">Cancelar</button>
                    <button onClick={handleSaveBio} disabled={savingBio} className="h-10 rounded-full px-5 text-sm font-extrabold disabled:opacity-60" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>{savingBio ? 'Guardando…' : 'Guardar biografía'}</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className={`min-h-6 max-w-[65ch] flex-1 whitespace-pre-line break-words border-l-4 pl-3 text-[15px] font-medium leading-relaxed ${isPosterLayout ? 'md:mx-auto md:text-left' : ''}`} style={{ borderColor: `${publicTheme.primary}66`, color: publicTheme.text, opacity: seller?.bio ? 0.85 : 0.6 }}>
                    {seller?.bio ? seller.bio : isOwner ? 'Aún no escribes tu biografía.' : 'Este vendedor aún no escribe su biografía.'}
                  </p>
                  {isOwner && (
                    <button onClick={() => { setTempBio(seller?.bio || ''); setIsEditingBio(true); }} aria-label="Editar biografía" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5" style={{ color: publicTheme.primary }}>
                      <span translate="no" className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Módulos: el orden y el ancho salen de la distribución elegida */}
      <main className="relative z-10 mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
          {showProfileShowcase && (
            <section className={`min-w-0 border p-5 ring-1 ${getDistributionSpan('showcase')}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: getDistributionOrder('showcase') }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black leading-tight md:text-2xl" style={{ color: publicTheme.text }}>
                  {publicTheme.showcaseStyle === 'seller' ? 'Catálogo destacado' : publicTheme.showcaseStyle === 'collector' ? 'Colección destacada' : 'Carpetas favoritas'}
                </h2>
                <span className="text-sm font-bold tabular-nums" style={textMuted}>{spotlightFolders.length} de {folders.length}</span>
              </div>
              <ul className="divide-y" style={{ borderColor: `${publicTheme.primary}22` }}>
                {spotlightFolders.map((folder) => (
                  <li key={folder.id} style={{ borderColor: `${publicTheme.primary}22` }}>
                    <Link to={`/c/${folder.id}`} className="group flex items-center gap-3 py-3 focus:outline-none focus-visible:ring-2" style={{ color: publicTheme.text }}>
                      <span className="h-14 w-11 shrink-0 rounded-md bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat shadow-md" style={{ filter: getFolderFilter(folder.color) }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-extrabold">{folder.name}</span>
                        <span className="block truncate text-sm font-medium" style={textMuted}>{folder.tcg} · {folder.cardsCount} {folder.cardsCount === 1 ? 'carta' : 'cartas'}</span>
                      </span>
                      <span translate="no" className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ color: publicTheme.primary }}>arrow_forward</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showProfileShowcase && (
            <section className={`min-w-0 border p-5 ring-1 ${getDistributionSpan('stats')}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.accent}55`, order: getDistributionOrder('stats') }}>
              <h2 className="text-xl font-black leading-tight md:text-2xl" style={{ color: publicTheme.text }}>Resumen</h2>
              <dl className="mt-3 divide-y" style={{ borderColor: `${publicTheme.primary}22` }}>
                {[
                  ['Carpetas públicas', folders.length, 'auto_stories'],
                  ['Cartas mostradas', totalCards.toLocaleString('es-CL'), 'style'],
                  ['Nivel del perfil', profileLevel, 'military_tech'],
                ].map(([label, value, icon]) => (
                  <div key={label} className="flex items-center gap-3 py-3" style={{ borderColor: `${publicTheme.primary}22` }}>
                    <span translate="no" className="material-symbols-outlined shrink-0 text-[24px]" style={{ color: publicTheme.primary }}>{icon}</span>
                    <dt className="min-w-0 flex-1 text-sm font-semibold" style={textMuted}>{label}</dt>
                    <dd className="text-xl font-black tabular-nums" style={{ color: publicTheme.text }}>{value}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-1 text-sm" style={{ color: publicTheme.text }}>
                <summary className="cursor-pointer py-2 font-bold" style={{ color: publicTheme.primary }}>¿Cómo se calcula el nivel?</summary>
                <ul className="list-disc space-y-1 pl-5 pb-1 font-medium" style={textMuted}>
                  <li>+2 niveles por cada carpeta pública.</li>
                  <li>+1 nivel por cada 12 cartas subidas.</li>
                  <li>Todos empiezan en el nivel 1.</li>
                </ul>
              </details>
            </section>
          )}

          <section className={`min-w-0 space-y-5 ${getDistributionSpan('folders')}`} style={{ order: getDistributionOrder('folders') }}>
            <div className="flex items-center justify-between gap-3 p-4 ring-1 md:px-5" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33` }}>
              <div className="min-w-0">
                <h2 className="text-2xl font-black leading-tight" style={{ color: publicTheme.text }}>Carpetas públicas</h2>
                <p className="text-sm font-medium" style={textMuted}>Catálogos publicados por este vendedor.</p>
              </div>
              <span className="shrink-0 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>{folders.length}</span>
            </div>

            {folders.length === 0 ? (
              <div className="border border-dashed p-10 text-center" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}55` }}>
                <span translate="no" className="material-symbols-outlined text-5xl" style={{ color: `${publicTheme.primary}99` }}>inventory_2</span>
                <p className="mt-3 text-lg font-extrabold" style={{ color: publicTheme.text }}>Aún no hay carpetas públicas</p>
                <p className="mt-1 text-sm font-medium" style={textMuted}>{isOwner ? 'Crea una carpeta en tu panel y márcala como pública para que aparezca aquí.' : 'Cuando publique una carpeta, la verás aquí.'}</p>
                {isOwner && <Link to="/dashboard" className="mt-4 inline-flex h-11 items-center rounded-full px-6 text-sm font-extrabold" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>Ir a mis carpetas</Link>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {folders.map((folder) => (
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
          </section>

          {getSocialEnabled('showWishlist') && seller?.username && (
            <section className="min-w-0 border p-5 ring-1 empty:hidden lg:col-span-12" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: 99 }}>
              <WishlistSection
                username={seller.username}
                seller={{ id: seller.id, name: displayName, avatar: avatarUrl }}
                isOwner={isOwner}
                variant="profile"
                colors={{ primary: publicTheme.primary, accent: publicTheme.accent, text: publicTheme.text }}
              />
            </section>
          )}
          {seller?.username && (
            <section id="resenas" className="min-w-0 scroll-mt-32 border p-5 ring-1 lg:col-span-12" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: 98 }}>
              <ReviewsSection username={seller.username} isOwner={isOwner} colors={{ primary: publicTheme.primary, text: publicTheme.text }} />
            </section>
          )}
        </div>
      </main>
      </div>
      </div>

      {isOwner && themePanelOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 sm:bg-black/20" onClick={() => setThemePanelOpen(false)} aria-hidden="true" />
          <aside
            role="dialog"
            aria-label="Personalizar perfil"
            className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[82vh] flex-col rounded-t-3xl bg-[#F4F6FA] text-[#12315f] shadow-[0_-12px_40px_rgba(0,0,0,0.3)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl sm:shadow-[-12px_0_40px_rgba(0,0,0,0.25)]"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
          >
            <div className="rounded-t-3xl bg-[#12315f] px-4 pb-4 pt-4 text-white sm:rounded-tl-3xl sm:rounded-tr-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black leading-tight">Personalizar perfil</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-blue-100" aria-live="polite">
                    <span className={`h-2 w-2 rounded-full ${savingTheme ? 'bg-slate-300' : themeDirty ? 'bg-[#facc15]' : 'bg-emerald-400'}`} />
                    {savingTheme ? 'Guardando…' : themeDirty ? 'Cambios sin guardar' : 'Todo guardado'}
                  </p>
                </div>
                <button type="button" onClick={() => setThemePanelOpen(false)} aria-label="Cerrar panel" className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-blue-100 hover:bg-white/10">
                  <span translate="no" className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={resetPublicTheme} disabled={savingTheme} className="h-10 flex-1 rounded-full border border-white/30 px-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">Restablecer</button>
                <button type="button" onClick={saveCurrentTheme} disabled={savingTheme || !themeDirty} className="h-10 flex-[1.4] rounded-full bg-[#facc15] px-5 text-sm font-extrabold text-[#12315f] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40">Guardar cambios</button>
              </div>
            </div>

            <div role="tablist" aria-label="Qué personalizar" className="grid grid-cols-6 border-b border-slate-200 bg-white">
              {PANEL_TABS.map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={themePanelTab === id}
                  onClick={() => setThemePanelTab(id)}
                  className={`flex flex-col items-center gap-0.5 border-b-[3px] px-0.5 pb-2 pt-2.5 text-[11px] font-bold transition ${themePanelTab === id ? 'border-[#facc15] text-[#12315f]' : 'border-transparent text-slate-500 hover:text-[#12315f]'}`}
                >
                  <span translate="no" className="material-symbols-outlined text-[22px]" style={themePanelTab === id ? { fontVariationSettings: "'FILL' 1" } : undefined}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
              {themePanelTab === 'theme' && (
                <>
                  <PanelSection icon="palette" title="Paletas" hint="Elige una paleta lista. Después puedes ajustar cada color.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {profileThemes.map((theme) => (
                        <OptionTile key={theme.id} selected={publicTheme.id === theme.id} disabled={savingTheme} onClick={() => applyThemePalette(theme)} name={theme.name}>
                          <span className="relative block h-[84px] overflow-hidden rounded-xl" style={{ backgroundColor: theme.surface }}>
                            <span className="absolute inset-x-0 top-0 h-10" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} />
                            <span className="absolute inset-x-2.5 bottom-2 top-5 rounded-lg p-2 shadow-md" style={{ backgroundColor: theme.card }}>
                              <span className="block h-1.5 w-2/3 rounded-full" style={{ backgroundColor: theme.text }} />
                              <span className="mt-1.5 block h-2.5 w-10 rounded-full" style={{ backgroundColor: theme.accent }} />
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="colorize" title="Colores a tu medida" hint="Toca un color para cambiarlo. Se ve al instante en tu perfil.">
                    <div className="grid grid-cols-2 gap-2">
                      {[['primary', 'Principal'], ['secondary', 'Secundario'], ['accent', 'Acento'], ['surface', 'Fondo'], ['card', 'Contenedor'], ['text', 'Texto']].map(([field, label]) => {
                        const value = publicTheme[field] || defaultPublicTheme[field];
                        return (
                          <label key={field} className="relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-2 transition hover:border-slate-400 focus-within:ring-2 focus-within:ring-[#1e40af]">
                            <span className="h-11 w-11 shrink-0 rounded-xl shadow-inner ring-1 ring-black/10" style={{ backgroundColor: value }} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-extrabold text-[#12315f]">{label}</span>
                              <span className="block text-xs font-semibold uppercase tabular-nums text-slate-500">{value}</span>
                            </span>
                            <input type="color" value={value} onChange={(event) => handleThemeFieldChange(field, event.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                          </label>
                        );
                      })}
                    </div>
                  </PanelSection>
                </>
              )}

              {themePanelTab === 'font' && (
                <PanelSection icon="text_fields" title="Tipografía" hint="Cómo se leen tu nombre, tu biografía y tus carpetas.">
                  <div className="grid grid-cols-2 gap-2.5">
                    {fontOptions.map((font) => (
                      <OptionTile key={font} selected={publicTheme.font === font} onClick={() => handleThemeFieldChange('font', font)} name={font}>
                        <span className="flex h-[84px] flex-col justify-center rounded-xl bg-slate-50 px-3" style={{ fontFamily: getFontStack(font) }}>
                          <span className="text-[34px] font-bold leading-none text-[#12315f]">Aa</span>
                          <span className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-tight text-slate-500">{fontExamples[font]}</span>
                        </span>
                      </OptionTile>
                    ))}
                  </div>
                </PanelSection>
              )}

              {themePanelTab === 'cards' && (
                <PanelSection icon="dashboard_customize" title="Estilo de las tarjetas" hint="Cambia el aspecto de la presentación, la vitrina y los demás módulos.">
                  <div className="grid grid-cols-2 gap-2.5">
                    {cardStyleOptions.map((option) => (
                      <OptionTile key={option.id} selected={publicTheme.cardStyle === option.id} onClick={() => handleThemeFieldChange('cardStyle', option.id)} name={option.name} description={option.description}>
                        <MiniScene theme={{ ...publicTheme, cardStyle: option.id }} avatarUrl={avatarUrl} initial={displayName[0]?.toUpperCase()} />
                      </OptionTile>
                    ))}
                  </div>
                </PanelSection>
              )}

              {themePanelTab === 'scene' && (
                <>
                  <PanelSection icon="wallpaper" title="Fondo del perfil" hint="El escenario detrás de tu presentación, tu vitrina y tus carpetas.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {backgroundStyleOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.backgroundStyle === option.id} onClick={() => handleThemeFieldChange('backgroundStyle', option.id)} name={option.name} description={option.description}>
                          <MiniScene theme={{ ...publicTheme, backgroundStyle: option.id }} avatarUrl={avatarUrl} initial={displayName[0]?.toUpperCase()} />
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="view_sidebar" title="Franjas laterales" hint="Lo que se ve a la izquierda y a la derecha en pantallas anchas.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {sideBackgroundOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.sideBackgroundStyle === option.id} onClick={() => handleThemeFieldChange('sideBackgroundStyle', option.id)} name={option.name} description={option.description}>
                          <span className="relative block h-[84px] overflow-hidden rounded-xl" style={getSideBackgroundStyle({ ...publicTheme, sideBackgroundStyle: option.id })}>
                            <span className="absolute inset-y-2 left-[24%] right-[24%] rounded-lg bg-white/90 p-2 shadow-lg">
                              <span className="block h-1.5 w-3/4 rounded-full bg-[#12315f]" />
                              <span className="mt-1.5 block h-1 w-1/2 rounded-full bg-slate-300" />
                              <span className="mt-2 grid grid-cols-2 gap-1"><span className="h-5 rounded-[3px] bg-emerald-500" /><span className="h-5 rounded-[3px] bg-emerald-500" /></span>
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="account_circle" title="Marco de la foto" hint="El borde que rodea tu foto de perfil. Aquí ves tu foto real.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {avatarFrameOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.avatarFrame === option.id} onClick={() => handleThemeFieldChange('avatarFrame', option.id)} name={option.name} description={option.description}>
                          <span className="flex h-[92px] items-center justify-center rounded-xl bg-slate-100">
                            <span className="h-[68px] w-[68px] rounded-[1.3rem] p-[4px] shadow-lg" style={{ background: getAvatarFrameStyle({ ...publicTheme, avatarFrame: option.id }) }}>
                              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.05rem] bg-white text-lg font-black text-slate-500 ring-2 ring-white/90">
                                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
                              </span>
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="web_asset" title="Presentación" hint="Cómo se arma la parte de arriba de tu perfil.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {profileLayoutOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.profileLayout === option.id} onClick={() => handleThemeFieldChange('profileLayout', option.id)} name={option.name} description={option.description}>
                          <LayoutWire id={option.id} />
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="blur_on" title="Efecto" hint="Una capa visual sobre todo el perfil. «Sin efecto» es lo más liviano.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {profileEffectOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.profileEffect === option.id} onClick={() => handleThemeFieldChange('profileEffect', option.id)} name={option.name} description={option.description}>
                          <span className={`relative block h-[84px] overflow-hidden rounded-xl bg-[#0f172a] ${getEffectClassName({ ...publicTheme, profileEffect: option.id })}`}>
                            <span className="absolute inset-x-3 bottom-2.5 top-4 z-[2] flex items-center gap-2 rounded-lg bg-white/90 p-2 shadow-lg">
                              <span className="h-7 w-7 shrink-0 rounded-lg bg-[#facc15]" />
                              <span className="flex-1"><span className="block h-1.5 w-4/5 rounded-full bg-[#12315f]" /><span className="mt-1 block h-1 w-1/2 rounded-full bg-slate-300" /></span>
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="trophy" title="Vitrina" hint="El módulo destacado que aparece bajo tu presentación.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {showcaseStyleOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.showcaseStyle === option.id} onClick={() => handleThemeFieldChange('showcaseStyle', option.id)} name={option.name} description={option.description}>
                          <ShowcaseWire id={option.id} />
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                </>
              )}

              {themePanelTab === 'layout' && (
                <PanelSection icon="view_quilt" title="Orden de los módulos" hint="Dónde van la vitrina, el resumen y las carpetas, y cuánto espacio ocupa cada uno en pantallas anchas.">
                  <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#1e40af]" />Vitrina</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#facc15]" />Resumen</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" />Carpetas</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {profileDistributionOptions.map((option) => (
                      <OptionTile key={option.id} selected={publicTheme.profileDistribution === option.id} onClick={() => handleThemeFieldChange('profileDistribution', option.id)} name={option.name} description={option.description}>
                        <span className="grid h-[84px] auto-rows-fr grid-cols-12 gap-1 rounded-xl bg-slate-100 p-1.5" aria-hidden="true">
                          {option.order.map((moduleName) => {
                            const span = (option.spans?.[moduleName] || 'lg:col-span-12').replace('lg:col-span-', '');
                            return <span key={moduleName} className={`rounded-md ${moduleName === 'showcase' ? 'bg-[#1e40af]' : moduleName === 'stats' ? 'bg-[#facc15]' : 'bg-emerald-500'}`} style={{ gridColumn: `span ${span} / span ${span}` }} />;
                          })}
                        </span>
                      </OptionTile>
                    ))}
                  </div>
                </PanelSection>
              )}

              {themePanelTab === 'social' && (
                <PanelSection icon="share" title="Redes y contacto" hint="Elige cuáles botones se muestran en tu perfil público. Las redes solo aparecen si ya cargaste el dato en tu cuenta.">
                  <div className="space-y-2.5">
                    <ToggleRow enabled={messageButtonEnabled} onClick={() => handleThemeFieldChange('showMessageButton', messageButtonEnabled ? 'off' : 'on')} label="Mensaje privado" status={messageButtonEnabled ? 'Visible en tu perfil' : 'Oculto en tu perfil'}>
                      <span translate="no" className="material-symbols-outlined text-[24px] text-[#12315f]">chat</span>
                    </ToggleRow>
                    <ToggleRow enabled={getSocialEnabled('showWishlist')} onClick={() => handleThemeFieldChange('showWishlist', getSocialEnabled('showWishlist') ? 'off' : 'on')} label="Lista de cartas deseadas" status={getSocialEnabled('showWishlist') ? 'Visible en tu perfil y en tus carpetas' : 'Oculta para los demás'}>
                      <span translate="no" className="material-symbols-outlined text-[24px] text-[#12315f]">favorite</span>
                    </ToggleRow>
                    {socialLinks.map((social) => {
                      const enabled = getSocialEnabled(social.field);
                      return (
                        <ToggleRow key={social.id} enabled={enabled} onClick={() => handleThemeFieldChange(social.field, enabled ? 'off' : 'on')} label={social.label} status={social.available ? (enabled ? 'Visible en tu perfil' : 'Oculto en tu perfil') : 'Falta el dato en tu cuenta'}>
                          <SocialLogo type={social.id} className="h-6 w-6" />
                        </ToggleRow>
                      );
                    })}
                  </div>
                </PanelSection>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
