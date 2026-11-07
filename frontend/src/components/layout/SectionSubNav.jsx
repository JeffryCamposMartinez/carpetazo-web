import { startTransition, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { preloadRoute } from '../../app/routePreload';
import LiquidTabs from '../ui/LiquidTabs';

// Subsecciones de «Cartas», pegadas debajo de la barra principal. Solo aparecen dentro de /cartas.
const ITEMS = [
  { value: '/cartas', href: '/cartas', label: 'En venta' },
  { value: '/cartas/catalogo', href: '/cartas/catalogo', label: 'Catálogo' },
];

export default function SectionSubNav() {
  const navigate = useNavigate();
  const path = useLocation().pathname.replace(/\/+$/, '') || '/';
  const visible = path === '/cartas' || path.startsWith('/cartas/');
  const target = useRef(null);
  useEffect(() => { target.current = null; }, [path]);
  // Las dos pantallas se descargan al entrar a Cartas: cambiar de una a otra no espera la red
  useEffect(() => { if (visible) ITEMS.forEach((item) => preloadRoute(item.value)); }, [visible]);
  if (!visible) return null;
  // Como en la barra principal: la pantalla nueva entra como transición, sin dejar la página en blanco mientras carga.
  // `target`: a dónde va la última pulsación aunque la pantalla aún no haya cambiado (dos toques seguidos no se ignoran ni se duplican)
  const go = (to) => {
    if (to === (target.current ?? path)) return;
    target.current = to;
    startTransition(() => navigate(to));
  };
  return (
    <nav aria-label="Secciones de Cartas" className="flex items-center justify-center border-t border-white/10 bg-[#172e82] px-3 py-1">
      <LiquidTabs
        navigation
        layout="inline"
        className="gap-2"
        buttonClassName="h-8 min-w-[7rem] rounded-full px-5 text-sm font-bold before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:ring-2 focus-visible:ring-[#facc15]"
        indicatorClassName="rounded-full bg-[#facc15] shadow-[0_1px_2px_rgba(8,18,42,0.35)]"
        activeTextClassName="text-[#12315f]"
        inactiveTextClassName="text-white/90 [@media(hover:hover)]:hover:bg-white/10 [@media(hover:hover)]:hover:text-white"
        value={path}
        onChange={go}
        options={ITEMS}
      />
    </nav>
  );
}
