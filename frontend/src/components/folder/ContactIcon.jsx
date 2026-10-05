// Íconos de contacto del vendedor en el catálogo público.

export const ContactIcon = ({ type, className = 'h-4 w-4' }) => {
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
        <rect width="28" height="28" x="2" y="2" rx="8" fill="#E1306C" />
        <path fill="#FCAF45" d="M3.8 10.5A8.5 8.5 0 0 1 10.5 3.8h11A8.5 8.5 0 0 1 28.2 10.5v1.2C23.6 8.3 16.4 8.1 3.8 17v-6.5Z" opacity="0.8" />
        <path fill="#833AB4" d="M3.8 17c7.4-4.6 17.8-5.2 24.4-1.4v5.9a8.5 8.5 0 0 1-8.5 8.5h-7.2A8.5 8.5 0 0 1 4 21.5L3.8 17Z" opacity="0.85" />
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

  if (type === 'youtube') {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <rect width="28" height="20" x="2" y="6" rx="6" fill="#FF0000" />
        <path fill="#fff" d="m14 12 7 4-7 4v-8Z" />
      </svg>
    );
  }

  return <span translate="no" className="material-symbols-outlined text-[18px]">chat</span>;
};
