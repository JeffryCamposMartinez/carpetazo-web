import fs from 'fs/promises';
import { prisma } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Solo semilla de la primera lectura: lo que se guarda desde moderación vive en la base (SiteSetting)
const SEED_FILE = path.join(__dirname, '../data/footerSettings.json');
const KEY = 'footer';

export const DEFAULT_FOOTER_SETTINGS = {
  tagline: 'Compra, vende y comparte tu colección de cartas TCG en todo Chile.',
  address: '',
  email: 'contacto@carpetazo.cl',
  phone: '',
  facebookUrl: 'https://facebook.com/carpetazo.cl',
  instagramUrl: 'https://instagram.com/carpetazo.cl',
  whatsappUrl: '',
  discordUrl: '',
  twitterUrl: '',
  tiktokUrl: '',
  theme: 'dark', // 'dark' | 'light'
  copyrightText: '',
  infoLinks: [
    { label: 'Nosotros', url: '/bienvenida' },
    { label: 'Términos y condiciones', url: '/terminos' },
    { label: 'Políticas de privacidad', url: '/privacidad' }
  ]
};

export class FooterValidationError extends Error {}

// Enlaces del pie: https o ruta interna (nunca javascript:, data: ni //host). Vacío = sin enlace.
const link = (value, label, { relative = false } = {}) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const ok = text.length <= 250 && !/[\u0000-\u001F\u007F\s]/.test(text) && (/^https:\/\/[^/]/i.test(text) || (relative && /^\/(?!\/)/.test(text)));
  if (!ok) throw new FooterValidationError(`${label}: usa una dirección https://${relative ? ' o una ruta interna que empiece con /' : ''}`);
  return text;
};
const email = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text && !/^[^\s@<>"]{1,64}@[^\s@<>"]{1,100}\.[^\s@<>"]{2,}$/.test(text)) throw new FooterValidationError('Correo: formato inválido');
  return text;
};
const phone = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text && !/^[+\d\s().-]{1,50}$/.test(text)) throw new FooterValidationError('Teléfono: solo números, espacios, +, ( ) y guiones');
  return text;
};

let seed = null;
const readSeed = async () => {
  if (seed) return seed;
  try { seed = { ...DEFAULT_FOOTER_SETTINGS, ...JSON.parse(await fs.readFile(SEED_FILE, 'utf-8')) }; } catch (_err) { seed = { ...DEFAULT_FOOTER_SETTINGS }; }
  return seed;
};

export async function getFooterSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  const base = await readSeed();
  return row && row.value && typeof row.value === 'object' ? { ...base, ...row.value } : base;
}

export async function saveFooterSettings(data) {
  const current = await getFooterSettings();
  const text = (value, max, fallback) => (typeof value === 'string' ? value.trim().slice(0, max) : fallback);
  const updated = {
    ...current,
    tagline: text(data.tagline, 300, current.tagline),
    address: text(data.address, 200, current.address),
    email: data.email === undefined ? current.email : email(data.email),
    phone: data.phone === undefined ? current.phone : phone(data.phone),
    facebookUrl: data.facebookUrl === undefined ? current.facebookUrl : link(data.facebookUrl, 'Facebook'),
    instagramUrl: data.instagramUrl === undefined ? current.instagramUrl : link(data.instagramUrl, 'Instagram'),
    whatsappUrl: data.whatsappUrl === undefined ? current.whatsappUrl : link(data.whatsappUrl, 'WhatsApp'),
    discordUrl: data.discordUrl === undefined ? current.discordUrl : link(data.discordUrl, 'Discord'),
    twitterUrl: data.twitterUrl === undefined ? current.twitterUrl : link(data.twitterUrl, 'Twitter / X'),
    tiktokUrl: data.tiktokUrl === undefined ? current.tiktokUrl : link(data.tiktokUrl, 'TikTok'),
    theme: data.theme === 'light' ? 'light' : 'dark',
    copyrightText: text(data.copyrightText, 200, current.copyrightText),
    infoLinks: Array.isArray(data.infoLinks)
      ? data.infoLinks
          .filter((item) => item && typeof item.label === 'string' && typeof item.url === 'string')
          .slice(0, 10)
          .map((item) => ({ label: item.label.trim().slice(0, 60), url: link(item.url, `Enlace «${item.label.trim().slice(0, 30)}»`, { relative: true }) }))
          .filter((item) => item.label && item.url)
      : current.infoLinks,
    updatedAt: new Date().toISOString()
  };
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: updated }, update: { value: updated } });
  return updated;
}
