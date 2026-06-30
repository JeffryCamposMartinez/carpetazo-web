import { useLocation } from 'react-router-dom';

export default function Footer() {
  const location = useLocation();
  if (location.pathname === '/mensajes') return null;

  return (
    <footer className="w-full bg-[#0a1120] text-white/70 py-6 mt-auto flex flex-col items-center justify-center gap-2 border-t border-white/5 relative z-10">
      <div className="flex items-center gap-2 hover:text-white transition-colors duration-300">
        <span className="material-symbols-outlined text-[18px]">mail</span>
        <a href="mailto:carpetazoco@gmail.com" className="text-sm font-medium">carpetazoco@gmail.com</a>
      </div>
      <p className="text-xs font-medium tracking-wide text-center">
        &copy; {new Date().getFullYear()} Carpetazo.cl. Todos los derechos reservados.
      </p>
    </footer>
  );
}
