// Enlaces de contacto de un vendedor (WhatsApp, redes). Se usan en el perfil público y en el catálogo.

// Número chileno para WhatsApp: solo dígitos y con el 56 delante
export const formatWhatsAppNumber = (phone = '') => {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!cleanPhone) return '';
  return cleanPhone.startsWith('56') ? cleanPhone : `56${cleanPhone}`;
};

export const ensureExternalUrl = (url = '') => {
  const cleanUrl = String(url).trim();
  if (!cleanUrl) return '';
  return /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl.replace(/^@/, '')}`;
};

export const getInstagramHref = (value = '') => {
  const cleanValue = String(value).trim();
  if (!cleanValue) return '';
  if (/^https?:\/\//i.test(cleanValue)) return cleanValue;
  return `https://instagram.com/${cleanValue.replace('@', '')}`;
};
