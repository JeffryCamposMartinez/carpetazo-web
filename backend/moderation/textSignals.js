// Señales de texto sospechoso. No bloquean nada: generan un reporte automático para que una persona lo revise.
// Son reglas simples (no inteligencia artificial): pueden fallar con jerga o textos legítimos, por eso solo suben a la cola.

const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
const PHONE = /(?:\+?56[\s-]?)?\b9[\s-]?\d{4}[\s-]?\d{4}\b/;
const BANK_ACCOUNT = /\b(?:cuenta|cta\.?|n[uú]mero de cuenta|n[°º] de cuenta)\b[^.\n]{0,40}\d{8,}/i;
const CARD_NUMBER = /\b(?:\d[ -]?){15,16}\b/;
const PAYMENT_UPFRONT = /\b(?:paga(?:r|me|s)?|transfi[eé]re(?:me|lo)?|deposita(?:r|me)?|abona(?:r|me)?)\b[^.\n]{0,40}\b(?:antes|adelantado|adelanto|primero)\b/i;
const OFF_PLATFORM = /\b(?:fuera de|sin pasar por|evit\w*|olvid\w*)\b[^.\n]{0,20}\b(?:carpetazo|la plataforma|el sitio|la p[aá]gina)\b/i;
const ADVANCE_WORDS = /\b(?:adelanto|abono previo|reserva con (?:dep[oó]sito|transferencia)|gift ?card|bitcoin|usdt|criptomoneda)\b/i;
const PHISHING = /\b(?:c[oó]digo de (?:verificaci[oó]n|seguridad)|clave (?:de|del) (?:banco|cajero)|verifica tu cuenta)\b/i;
const SHORTENER = /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd|rb\.gy|shorturl\.at|ow\.ly|tiny\.cc)\/\S+/i;
const IP_URL = /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/i;
const PUNYCODE = /\bxn--[a-z0-9-]+\./i;
const REPEATED_CHAR = /(.)\1{11,}/;

const CONTEXTS = {
  // Reseña pública sobre otra persona: no debe traer datos personales
  review: ['personal_data', 'suspicious_link', 'repeated_text'],
  // Biografía propia: los datos personales son del dueño, pero un enlace acortado o un cobro por adelantado no
  bio: ['suspicious_link', 'external_payment'],
  // Mensaje privado: teléfonos y RUT son normales al coordinar una venta; los cobros por adelantado y los enlaces raros no
  message: ['external_payment', 'suspicious_link']
};

const DETECTORS = {
  personal_data: (text) => RUT.test(text) || PHONE.test(text) || BANK_ACCOUNT.test(text) || CARD_NUMBER.test(text),
  external_payment: (text) => PAYMENT_UPFRONT.test(text) || OFF_PLATFORM.test(text) || ADVANCE_WORDS.test(text) || PHISHING.test(text),
  suspicious_link: (text) => SHORTENER.test(text) || IP_URL.test(text) || PUNYCODE.test(text),
  repeated_text: (text) => REPEATED_CHAR.test(text) || /\b(\w{3,})\b(?:\s+\1\b){5,}/i.test(text)
};

// Devuelve los códigos detectados, p. ej. ['external_payment']
export const analyzeText = (text, context) => {
  if (typeof text !== 'string' || text.length < 4 || text.length > 20000) return [];
  const wanted = CONTEXTS[context] || [];
  return wanted.filter((code) => DETECTORS[code](text));
};
