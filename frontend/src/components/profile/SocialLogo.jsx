// Logos de redes sociales del perfil público.

export const SocialLogo = ({ type, className = 'h-4 w-4' }) => {
  if (type === 'whatsapp') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <path fill="#25D366" d="M16 3.2A12.6 12.6 0 0 0 5.1 22.1L3.7 28.8l6.8-1.8A12.6 12.6 0 1 0 16 3.2Z" />
        <path fill="#fff" d="M22.9 18.7c-.4-.2-2.2-1.1-2.5-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.7.1-1 .5-.3.4-1.3 1.3-1.3 3.1 0 1.8 1.3 3.6 1.5 3.8.2.2 2.6 4 6.3 5.6.9.4 1.6.6 2.1.8.9.3 1.7.3 2.3.2.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.2-.1-.5-.2-.9-.4Z" />
      </svg>
    );
  }

  if (type === 'instagram') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="ig-gradient" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#f58529" />
            <stop offset="0.35" stopColor="#dd2a7b" />
            <stop offset="0.7" stopColor="#8134af" />
            <stop offset="1" stopColor="#515bd4" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" x="2" y="2" rx="8" fill="url(#ig-gradient)" />
        <circle cx="16" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        <circle cx="23" cy="9" r="1.8" fill="#fff" />
      </svg>
    );
  }

  if (type === 'facebook') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#1877F2" />
        <path fill="#fff" d="M18.5 30V18.5h3.8l.6-4.5h-4.4v-2.9c0-1.3.4-2.2 2.3-2.2h2.3v-4c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 5.9V14h-3.8v4.5H14V30h4.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="28" height="20" x="2" y="6" rx="6" fill="#FF0000" />
      <path fill="#fff" d="m14 12 7 4-7 4v-8Z" />
    </svg>
  );
};
