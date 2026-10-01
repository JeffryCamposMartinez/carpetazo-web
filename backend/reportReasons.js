// Catálogo de razones de reporte (documento 20, sección 4). Lo define el servidor: el cliente solo lo consulta.
// Gravedad: S1 crítica · S2 alta · S3 media · S4 baja. Los códigos nunca se reutilizan: una razón retirada se marca deprecated.
// extra: campos adicionales que el formulario pide (texto corto); requiresComment: comentario obligatorio (mín. 20 caracteres).

const r = (code, label, severity, options = {}) => ({ code, label, severity, requiresComment: false, extra: [], ...options });
const other = (type) => r(`${type}.other`, 'Otro motivo', 'S3', { requiresComment: true });

const IMAGE_REASONS = (type) => [
  r(`${type}.minor_risk`, 'Muestra o pone en riesgo a un menor de edad', 'S1', { autoHide: true }),
  r(`${type}.sexual_explicit`, 'Contenido sexual o desnudez explícita', 'S1', { autoHide: true }),
  r(`${type}.violence_gore`, 'Violencia gráfica o contenido perturbador', 'S2'),
  r(`${type}.hate_symbols`, 'Símbolos o mensajes de odio o discriminación', 'S2'),
  r(`${type}.personal_data`, 'Muestra datos personales (RUT, dirección, teléfono, cuenta bancaria) de alguien', 'S2', { extra: [{ key: 'dato', label: 'Qué dato aparece' }] }),
  r(`${type}.illegal_item`, 'Promociona algo ilegal', 'S2'),
  r(`${type}.copyright`, 'Es una foto robada de otra persona o tienda', 'S3', { extra: [{ key: 'enlace', label: 'Enlace de la original (opcional)', optional: true }] }),
  ...(type === 'card_image' ? [r(`${type}.misleading`, 'No corresponde a lo que se ofrece o engaña', 'S3')] : []),
  r(`${type}.contact_diversion`, 'Intenta sacar la venta de la plataforma (WhatsApp, cuentas, etc.) dentro de la imagen', 'S3'),
  r(`${type}.spam_ad`, 'Publicidad o spam', 'S4'),
  other(type)
];

export const REPORT_TARGETS = {
  user: { label: 'este usuario', reasons: [
    r('user.scam', 'Intentó estafarme o es una estafa', 'S1', { requiresComment: true, extra: [{ key: 'codigoPedido', label: 'Código de pedido (si existe)', optional: true }, { key: 'monto', label: 'Monto involucrado (si existe)', optional: true }] }),
    r('user.threats', 'Me amenaza o me intimida', 'S1'),
    r('user.impersonation', 'Se hace pasar por otra persona, tienda o por Carpetazo', 'S2', { extra: [{ key: 'suplanta', label: 'A quién suplanta' }] }),
    r('user.harassment', 'Me acosa o me insulta', 'S2'),
    r('user.hate', 'Discrimina o promueve odio', 'S2'),
    r('user.underage', 'Parece ser menor de edad', 'S2'),
    r('user.fake_account', 'Cuenta falsa, duplicada o creada para manipular (reseñas, pedidos)', 'S3'),
    r('user.spam', 'Spam o publicidad', 'S4'),
    other('user')
  ] },
  profile_image: { label: 'esta foto de perfil', reasons: IMAGE_REASONS('profile_image') },
  profile_banner: { label: 'este banner', reasons: IMAGE_REASONS('profile_banner') },
  profile_wallpaper: { label: 'este fondo de perfil', reasons: IMAGE_REASONS('profile_wallpaper') },
  profile_text: { label: 'el texto de este perfil', reasons: [
    r('profile_text.offensive', 'Lenguaje ofensivo, sexual o discriminatorio', 'S2', { extra: [{ key: 'campo', label: 'Dónde (nombre, usuario o biografía)' }] }),
    r('profile_text.personal_data', 'Publica datos personales de otra persona', 'S2'),
    r('profile_text.misleading_link', 'Enlace engañoso, peligroso o de phishing', 'S2'),
    r('profile_text.impersonation', 'Nombre o usuario que suplanta a otro', 'S2', { extra: [{ key: 'suplanta', label: 'A quién suplanta' }] }),
    r('profile_text.spam', 'Spam o publicidad', 'S4'),
    other('profile_text')
  ] },
  folder: { label: 'esta carpeta', reasons: [
    r('folder.counterfeit', 'Vende cartas falsificadas o réplicas como originales', 'S2'),
    r('folder.offensive_text', 'Nombre o descripción ofensiva, sexual o discriminatoria', 'S2'),
    r('folder.illegal', 'Ofrece algo ilegal', 'S2'),
    r('folder.misleading_prices', 'Precios o stock engañosos (señuelo)', 'S3'),
    r('folder.spam', 'Spam o carpeta duplicada para inflar visitas', 'S4'),
    other('folder')
  ] },
  card: { label: 'esta carta', reasons: [
    r('card.counterfeit', 'Parece falsa o una réplica vendida como original', 'S2'),
    r('card.offensive_text', 'Nombre u observaciones ofensivas', 'S2'),
    r('card.wrong_info', 'El nombre, edición o estado no corresponde a la carta real', 'S3'),
    r('card.price_abuse', 'Precio abusivo o engañoso (error evidente o señuelo)', 'S3'),
    r('card.fake_stock', 'Stock falso (la carta no existe o no está disponible)', 'S3'),
    r('card.photo_stolen', 'La foto es de otro vendedor o de internet, no de la carta real', 'S3'),
    other('card')
  ] },
  card_image: { label: 'esta foto de carta', reasons: IMAGE_REASONS('card_image') },
  review: { label: 'esta reseña', reasons: [
    r('review.personal_data', 'Publica datos personales', 'S2'),
    r('review.offensive', 'Lenguaje ofensivo, insultos o discriminación', 'S2'),
    r('review.fake', 'Es falsa: el comprador no compró o es del mismo vendedor', 'S3'),
    r('review.retaliation', 'Es una represalia o campaña de mala fe', 'S3'),
    r('review.wrong_seller', 'No corresponde a este vendedor', 'S4'),
    r('review.spam', 'Spam o publicidad', 'S4'),
    other('review')
  ] },
  message: { label: 'este mensaje', reasons: [
    r('message.scam_phishing', 'Estafa, phishing o me pide pagar fuera de Carpetazo o a una cuenta rara', 'S1'),
    r('message.threats', 'Amenazas o intimidación', 'S1'),
    r('message.sexual', 'Contenido sexual no deseado', 'S1'),
    r('message.harassment', 'Acoso o insultos repetidos', 'S2'),
    r('message.personal_data', 'Me pide o difunde datos personales', 'S2'),
    r('message.spam', 'Spam o publicidad', 'S4'),
    other('message')
  ] },
  message_image: { label: 'esta imagen del chat', reasons: IMAGE_REASONS('message_image') },
  wishlist_item: { label: 'esta carta deseada', reasons: [
    r('wishlist_item.offensive', 'Nota ofensiva o inapropiada', 'S2'),
    r('wishlist_item.spam', 'Spam o publicidad', 'S4'),
    other('wishlist_item')
  ] }
};
// Los reportes de pedido y de estafa con caso (documento 20, secciones 4.8 y 9) llegan en la Fase B.

export const SEVERITY_ORDER = { S1: 0, S2: 1, S3: 2, S4: 3 };
export const REPORT_TARGET_TYPES = Object.keys(REPORT_TARGETS);

export const findReason = (targetType, code) => REPORT_TARGETS[targetType]?.reasons.find((reason) => reason.code === code) || null;

// Lo que ve el cliente: sin lógica interna
export const publicReasons = (targetType) => (REPORT_TARGETS[targetType]?.reasons || []).map((reason) => ({
  code: reason.code,
  label: reason.label,
  requiresComment: reason.requiresComment,
  extra: reason.extra
}));

// Qué parte del perfil o de la carta oculta cada tipo de imagen o texto
export const HIDE_EFFECT = {
  profile_image: 'photo',
  profile_banner: 'banner',
  profile_wallpaper: 'wallpaper',
  profile_text: 'text'
};
