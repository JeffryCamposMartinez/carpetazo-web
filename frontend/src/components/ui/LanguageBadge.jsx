// Insignia con la abreviatura del idioma de una carta (EN, ES, JP) para ponerla sobre su imagen.
// Acepta el idioma en inglés (English), en español (Inglés) o ya abreviado, y la categoría del catálogo (100 español, 85 japonés).
const NAMES = { EN: 'Inglés', ES: 'Español', JP: 'Japonés' };
const ALIASES = { english: 'EN', inglés: 'EN', ingles: 'EN', en: 'EN', spanish: 'ES', español: 'ES', espanol: 'ES', es: 'ES', japanese: 'JP', japonés: 'JP', japones: 'JP', jp: 'JP', ja: 'JP' };

export const languageCodeOf = (language, catId) => {
  if (catId === 100) return 'ES';
  if (catId === 85) return 'JP';
  return ALIASES[String(language || '').trim().toLowerCase()] || '';
};

export default function LanguageBadge({ language, catId, className = '' }) {
  const code = languageCodeOf(language, catId);
  if (!code) return null;
  return (
    <span title={NAMES[code]} className={`rounded-lg bg-[#12315f]/90 px-2.5 py-1 text-[14px] font-black leading-none tracking-wide text-white shadow-md ring-1 ring-white/25 ${className}`}>
      <span aria-hidden="true">{code}</span>
      <span className="sr-only">Idioma: {NAMES[code]}</span>
    </span>
  );
}
