const LANGUAGE_ALIASES = {
  english: 'English',
  inglés: 'English',
  ingles: 'English',
  en: 'English',
  spanish: 'Spanish',
  español: 'Spanish',
  espanol: 'Spanish',
  es: 'Spanish',
  japanese: 'Japanese',
  japonés: 'Japanese',
  japones: 'Japanese',
  ja: 'Japanese',
};

export const normalizeCardLanguage = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'English';
  return LANGUAGE_ALIASES[raw.toLowerCase()] || raw;
};

export const cardLanguageOf = (card) => normalizeCardLanguage(card?.language || card?.data?.language);
