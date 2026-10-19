import { Link, useLocation } from 'react-router-dom';

// Acceso directo a «Mi lista de deseos», a la izquierda de la campana (mismo tamaño y estilo que ella)
export default function WishlistButton() {
  const location = useLocation();
  const active = location.pathname === '/dashboard' && new URLSearchParams(location.search).get('tab') === 'deseadas';
  return (
    <Link
      to="/dashboard?tab=deseadas"
      aria-label="Mi lista de deseos"
      aria-current={active ? 'page' : undefined}
      title="Mi lista de deseos"
      className={`group relative flex h-11 w-11 items-center justify-center rounded-full border text-white transition-[background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${active ? 'border-[#facc15]/60 bg-white/20' : 'border-white/15 bg-white/10 hover:bg-white/15'}`}
    >
      <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[24px] transition-colors duration-150 ${active ? 'text-[#facc15]' : 'group-hover:text-[#facc15]'}`} style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
    </Link>
  );
}
