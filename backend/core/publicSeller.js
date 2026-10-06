// Datos públicos de un vendedor: solo campos permitidos (nunca correo, RUT, banco, rol ni firebaseUid).
import { prisma } from './db.js';
import { sanitizePublicTheme } from './validation.js';

export const PUBLIC_SELLER_SELECT = {
  id: true,
  publicRegion: true,
  publicComuna: true,
  username: true,
  name: true,
  fullName: true,
  photoURL: true,
  bio: true,
  bannerBase64: true,
  wallpaperBase64: true,
  bannerDominantColor: true,
  bannerComplementaryColor: true,
  publicTheme: true,
  facebookUrl: true,
  instagramUrl: true,
  youtubeUrl: true,
  phone: true,
  createdAt: true,
  firebaseUid: true // solo para calcular isOwner; el serializador lo elimina
};

// Promedio y cantidad de reseñas de un vendedor
const REVIEW_MIN_FOR_AVERAGE = 3; // con menos reseñas no se muestra promedio: una o dos falsas no inflan la nota
export const getReviewSummary = async (userId) => {
  const aggregate = await prisma.sellerReview.aggregate({ where: { sellerId: userId, counts: true }, _avg: { rating: true }, _count: { _all: true } });
  const count = aggregate._count._all;
  const showAverage = count >= REVIEW_MIN_FOR_AVERAGE && aggregate._avg.rating !== null;
  return { average: showAverage ? Math.round(aggregate._avg.rating * 10) / 10 : null, count, showAverage };
};

export const toPublicSeller = (user, viewerUid = null, reviewSummary = null) => {
  if (!user) return null;
  const theme = user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {};
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    fullName: user.fullName,
    photoURL: user.photoURL,
    bio: user.bio,
    bannerBase64: user.bannerBase64,
    wallpaperBase64: user.wallpaperBase64,
    bannerDominantColor: user.bannerDominantColor,
    bannerComplementaryColor: user.bannerComplementaryColor,
    // Temas guardados antes de la lista permitida: se limpian también al mostrarlos
    publicTheme: user.publicTheme && typeof user.publicTheme === 'object' ? sanitizePublicTheme(user.publicTheme) : user.publicTheme,
    facebookUrl: user.facebookUrl,
    instagramUrl: user.instagramUrl,
    youtubeUrl: user.youtubeUrl,
    // El teléfono solo sale si el vendedor dejó activo el botón de WhatsApp
    phone: theme.showWhatsApp !== 'off' ? user.phone : null,
    // Solo comuna y región (siempre públicas): las direcciones guardadas nunca salen de la base
    addresses: user.publicComuna ? [{ name: 'Mi ubicación', comuna: user.publicComuna, region: user.publicRegion || '', isDefault: true }] : [],
    createdAt: user.createdAt,
    isOwner: Boolean(viewerUid && user.firebaseUid && user.firebaseUid === viewerUid),
    reviewSummary: reviewSummary || { average: null, count: 0, showAverage: false }
  };
};
