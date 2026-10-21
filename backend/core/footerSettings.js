import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, '../data/footerSettings.json');

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

let cachedSettings = null;

export async function getFooterSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedSettings = { ...DEFAULT_FOOTER_SETTINGS, ...parsed };
  } catch (_err) {
    cachedSettings = { ...DEFAULT_FOOTER_SETTINGS };
  }
  return cachedSettings;
}

export async function saveFooterSettings(data) {
  const current = await getFooterSettings();
  const updated = {
    ...current,
    tagline: typeof data.tagline === 'string' ? data.tagline.trim().slice(0, 300) : current.tagline,
    address: typeof data.address === 'string' ? data.address.trim().slice(0, 200) : current.address,
    email: typeof data.email === 'string' ? data.email.trim().slice(0, 150) : current.email,
    phone: typeof data.phone === 'string' ? data.phone.trim().slice(0, 50) : current.phone,
    facebookUrl: typeof data.facebookUrl === 'string' ? data.facebookUrl.trim().slice(0, 250) : current.facebookUrl,
    instagramUrl: typeof data.instagramUrl === 'string' ? data.instagramUrl.trim().slice(0, 250) : current.instagramUrl,
    whatsappUrl: typeof data.whatsappUrl === 'string' ? data.whatsappUrl.trim().slice(0, 250) : current.whatsappUrl,
    discordUrl: typeof data.discordUrl === 'string' ? data.discordUrl.trim().slice(0, 250) : current.discordUrl,
    twitterUrl: typeof data.twitterUrl === 'string' ? data.twitterUrl.trim().slice(0, 250) : current.twitterUrl,
    tiktokUrl: typeof data.tiktokUrl === 'string' ? data.tiktokUrl.trim().slice(0, 250) : current.tiktokUrl,
    theme: data.theme === 'light' ? 'light' : 'dark',
    copyrightText: typeof data.copyrightText === 'string' ? data.copyrightText.trim().slice(0, 200) : current.copyrightText,
    infoLinks: Array.isArray(data.infoLinks)
      ? data.infoLinks
          .filter((item) => item && typeof item.label === 'string' && typeof item.url === 'string')
          .slice(0, 10)
          .map((item) => ({
            label: item.label.trim().slice(0, 60),
            url: item.url.trim().slice(0, 200)
          }))
      : current.infoLinks,
    updatedAt: new Date().toISOString()
  };

  const tempFile = `${SETTINGS_FILE}.tmp.${Date.now()}`;
  await fs.writeFile(tempFile, JSON.stringify(updated, null, 2), 'utf-8');
  await fs.rename(tempFile, SETTINGS_FILE);
  cachedSettings = updated;
  return updated;
}
