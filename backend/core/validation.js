// Validación de entradas y de URLs guardadas por los usuarios (Fase 1: tipos, largos, rangos, hosts permitidos).

const getAllowedProxyImageHosts = () => {
  const hosts = new Set([
    'api.carpetazo.cl',
    'carpetazo.cl',
    'www.carpetazo.cl',
    'imagenes.carpetazo.cl',
    'images.pokemontcg.io',
    'api.pokemontcg.io',
    'tcgplayer-cdn.tcgplayer.com',
    'tor.myl.cl',
    'www.myl.cl',
    'myl.cl'
  ]);

  if (process.env.R2_PUBLIC_URL) {
    try {
      hosts.add(new URL(process.env.R2_PUBLIC_URL).hostname.toLowerCase());
    } catch (_error) {
      // La validación de salud ya reporta si la URL pública de R2 está mal configurada.
    }
  }

  return hosts;
};
export const isAllowedProxyImageUrl = (rawUrl) => {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.protocol !== 'https:') return false;
    // Solo hosts conocidos; R2 únicamente el bucket propio (ya incluido en la lista desde R2_PUBLIC_URL)
    return getAllowedProxyImageHosts().has(url.hostname.toLowerCase());
  } catch (_error) {
    return false;
  }
};
// --- Validación de nombres de usuario y URLs guardadas por los usuarios ---
const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'bienvenida', 'dashboard', 'perfil', 'carpeta', 'carpetas', 'c', 'mensajes',
  'cartas', 'vendedores', 'moderacion', 'terminos', 'privacidad', 'legal', 'login', 'logout', 'registro', 'soporte', 'ayuda', 'carpetazo', 'root', 'null', 'undefined'
]);
export const normalizeUsername = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');
// Devuelve el nombre normalizado o null si no cumple la política
export const validUsername = (value) => {
  const username = normalizeUsername(value);
  return /^[a-z0-9_]{3,20}$/.test(username) && !RESERVED_USERNAMES.has(username) ? username : null;
};

// Imágenes guardadas: solo https y hosts conocidos (R2, TCGplayer, avatares de Google)
// Bucket propio de R2 (R2_PUBLIC_URL): cualquiera puede crear un *.r2.dev, así que solo se acepta el nuestro
const ownR2Host = () => {
  try { return new URL(process.env.R2_PUBLIC_URL || '').hostname.toLowerCase(); } catch (_error) { return ''; }
};
export const isAllowedStoredImageUrl = (rawUrl) => {
  try {
    const raw = String(rawUrl || '');
    // Estas URLs se insertan en CSS (url(...)): sin espacios, paréntesis, comillas ni barras invertidas
    if (raw.length > 2000 || /[\s()'"\\<>]/.test(raw)) return false;
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return getAllowedProxyImageHosts().has(host) || (host === ownR2Host() && host !== '') || host.endsWith('.googleusercontent.com');
  } catch (_error) {
    return false;
  }
};
// Vacío/null se permite (borra la imagen); cualquier otro valor debe ser una URL permitida
export const checkImageField = (value) => value === null || value === '' || isAllowedStoredImageUrl(value);

// Redes sociales: se acepta el usuario (@nombre) o una URL https del dominio de esa red
export const SOCIAL_DOMAINS = {
  facebookUrl: ['facebook.com', 'fb.com'],
  instagramUrl: ['instagram.com'],
  youtubeUrl: ['youtube.com', 'youtu.be']
};
export const checkSocialField = (field, value) => {
  if (value === null || value === '') return true;
  const text = String(value).trim();
  if (text.length > 200) return false;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return /^[\w.@/-]+$/.test(text); // usuario o ruta sin esquema
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && SOCIAL_DOMAINS[field].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch (_error) {
    return false;
  }
};

// Validación simple de entradas: tipos y tamaños razonables
export const isShortText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const isOptionalText = (value, max) => value === undefined || value === null || (typeof value === 'string' && value.length <= max);
export const isValidPrice = (value) => value === undefined || value === null || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000000);
export const isValidStock = (value) => value === undefined || (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100000);
export const isSmallObject = (value, maxBytes = 20000) => value === undefined || value === null
  || (typeof value === 'object' && !Array.isArray(value) && JSON.stringify(value).length <= maxBytes);
export const badRequest = (res, message) => res.status(400).json({ success: false, message });

// El JSON `data` de una carta lo escribe el vendedor y el sitio lo mezcla sobre la carta al mostrarla:
// no puede pisar precio, stock, id, nombre ni imagen (la imagen retirada por moderación volvería a verse), ni traer enlaces a otros sitios
const CARD_DATA_RESERVED = ['id', 'folderId', 'name', 'tcgId', 'imageUrl', 'price', 'stock', 'moderationState', 'createdAt', 'updatedAt', 'images', 'folder', 'user'];
const isTcgplayerUrl = (value) => {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'tcgplayer.com' || host.endsWith('.tcgplayer.com'));
  } catch (_error) {
    return false;
  }
};
export const cleanCardData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const out = { ...data };
  CARD_DATA_RESERVED.forEach((key) => { delete out[key]; });
  if (out.tcgplayer !== undefined && !(out.tcgplayer && typeof out.tcgplayer === 'object' && isTcgplayerUrl(out.tcgplayer.url))) delete out.tcgplayer;
  return out;
};
export const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const hasControlChars = (text) => /[\u0000-\u001f]/.test(text);
