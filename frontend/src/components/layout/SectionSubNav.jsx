import { startTransition, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { preloadRoute } from '../../app/routePreload';

// Subsecciones de «Cartas», pegadas debajo de la barra principal. Solo aparecen dentro de /cartas.
const ITEMS = [
  { to: '/cartas', label: 'En venta' },
  { to: '/cartas/catalogo', label: 'Catálogo' },
];

export default function SectionSubNav() {
  const navigate = useNavigate();
  const path = useLocation().pathname.replace(/\/+$/, '') || '/';
  const visible = path === '/cartas' || path.startsWith('/cartas/');
  const target = useRef(null);
  useEffect(() => { target.current = null; }, [path]);
  // Las dos pantallas se descargan al entrar a Cartas: cambiar de una a otra no espera la red
  useEffect(() => { if (visible) ITEMS.forEach((item) => preloadRoute(item.to)); }, [visible]);
  if (!visible) return null;
  // Como en la barra principal: la pantalla nueva entra como transición, sin dejar la página en blanco mientras carga
  // `target`: a dónde va la última pulsación aunque la pantalla aún no haya cambiado (dos toques seguidos no se ignoran ni se duplican)
  const go = (event, to) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (to === (target.current ?? path)) return;
    target.current = to;
    startTransition(() => navigate(to));
  };
  return (
    <nav aria-label="Secciones de Cartas" className="flex items-center justify-center gap-2 border-t border-white/10 bg-[#172e82] px-3 py-1">
      {ITEMS.map((item) => {
        const active = path === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={(event) => go(event, item.to)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex h-8 min-w-[7rem] items-center justify-center rounded-full px-5 text-sm font-bold transition-[background-color,transform] duration-150 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${active ? 'bg-[#facc15] text-[#12315f] shadow-[0_1px_2px_rgba(8,18,42,0.35)]' : 'text-white/90 [@media(hover:hover)]:hover:bg-white/10 [@media(hover:hover)]:hover:text-white'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
