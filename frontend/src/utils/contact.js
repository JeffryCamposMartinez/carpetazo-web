// Enlaces de contacto de un vendedor (WhatsApp, redes). Se usan en el perfil público y en el catálogo.

// Número chileno para WhatsApp: solo dígitos y con el 56 delante
export const formatWhatsAppNumber = (phone = '') => {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';
  return cleanPhone.startsWith('56') ? cleanPhone : `56${cleanPhone}`;
};

// Redes sociales: el botón de cada red siempre lleva a esa red. Un usuario o ruta sin "https://" se arma sobre su dominio
// (antes "sitio.com/login" se abría como https://sitio.com/login con el ícono de Facebook) y una URL de otro sitio se descarta.
const SOCIAL = {
  facebook: { base: 'https://www.facebook.com/', hosts: ['facebook.com', 'fb.com'] },
  youtube: { base: 'https://www.youtube.com/', hosts: ['youtube.com', 'youtu.be'] },
  instagram: { base: 'https://instagram.com/', hosts: ['instagram.com'] }
};
const isNetworkHost = (network, host) => SOCIAL[network].hosts.some((domain) => host === domain || host.endsWith(`.${domain}`));

export const getSocialHref = (network, value = '') => {
  const clean = String(value).trim();
  if (!clean || !SOCIAL[network]) return '';
  // Con esquema (https:, javascript:, data:…): solo vale una URL http(s) del dominio de la red
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    try {
      const url = new URL(clean);
      return /^https?:$/.test(url.protocol) && isNetworkHost(network, url.hostname.toLowerCase()) ? url.href : '';
    } catch (_error) {
      return '';
    }
  }
  // Sin esquema: "facebook.com/tienda" se completa; cualquier otra cosa es un usuario o ruta dentro de la red
  const host = clean.split('/')[0].toLowerCase();
  if (isNetworkHost(network, host)) return `https://${clean}`;
  return SOCIAL[network].base + (network === 'youtube' && clean.startsWith('@') ? clean : clean.replace(/^@/, ''));
};

export const getInstagramHref = (value = '') => getSocialHref('instagram', value);
