import { Link, useLocation } from 'react-router-dom';

// Subsecciones de «Cartas», pegadas debajo de la barra principal. Solo aparecen dentro de /cartas.
const ITEMS = [
  { to: '/cartas', label: 'En venta' },
  { to: '/cartas/catalogo', label: 'Catálogo' },
];

export default function SectionSubNav() {
  const path = useLocation().pathname.replace(/\/+$/, '') || '/';
  if (path !== '/cartas' && !path.startsWith('/cartas/')) return null;
  return (
    <nav aria-label="Secciones de Cartas" className="flex items-center justify-center gap-2 border-t border-white/10 bg-[#172e82] px-3 py-1.5">
      {ITEMS.map((item) => {
        const active = path === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={`flex h-9 min-w-[7rem] items-center justify-center rounded-full px-5 text-sm font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${active ? 'bg-[#facc15] text-[#12315f] shadow-[0_1px_2px_rgba(8,18,42,0.35)]' : 'text-white/90 [@media(hover:hover)]:hover:bg-white/10 [@media(hover:hover)]:hover:text-white'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
