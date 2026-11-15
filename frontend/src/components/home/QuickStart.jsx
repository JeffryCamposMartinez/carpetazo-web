import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';

const CARD = 'rounded-3xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06),0_14px_30px_-22px_rgba(26,43,75,0.55)] ring-1 ring-slate-900/5';
const EASE_OUT = [0.23, 1, 0.32, 1];
const STEPS = [
  { icon: 'create_new_folder', title: 'Crea tu carpeta', text: 'Elige el juego y ponle nombre.' },
  { icon: 'photo_camera', title: 'Agrega tus cartas', text: 'Escanéalas con la cámara o búscalas.' },
  { icon: 'share', title: 'Comparte el enlace', text: 'Te escriben y vendes.' }
];

function Tile({ to, icon, label, primary = false }) {
  return (
    <Link to={to} className="group flex min-w-0 flex-col items-center justify-start gap-1.5 rounded-2xl py-1 text-center text-[12px] font-bold leading-tight text-[#12315f] transition-transform duration-150 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
      <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] transition-colors ${primary ? 'bg-[#facc15] text-[#12315f] shadow-[0_8px_16px_-10px_rgba(202,138,4,0.9)]' : 'bg-[#eef3ff] text-[#1e40af] group-hover:bg-[#e2eaff]'}`}><SvgIcon name={icon} translate="no" aria-hidden="true" className="text-[26px]" /></span>
      <span className="line-clamp-2 w-full px-0.5">{label}</span>
    </Link>
  );
}

// Primer bloque de la portada: con sesión, atajos para vender (o los 3 pasos si aún no tiene carpetas); sin sesión, cómo empezar a vender.
// Va antes del carrusel porque el carrusel rota y el menú queda escondido tras el avatar: así nadie tiene que buscar dónde empezar.
export default function QuickStart() {
  const { currentUser, appUser } = useAuth() || {};
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!currentUser) return undefined;
    let alive = true;
    api.getMyFolders().then((r) => { if (alive) setCount((r.folders || []).length); }).catch(() => { if (alive) setCount(-1); });
    return () => { alive = false; };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } }} aria-label="Vende tus cartas" className={`${CARD} mb-4 flex items-center gap-3 p-3.5 sm:p-4`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#12315f] text-[#facc15]"><SvgIcon name="sell" translate="no" aria-hidden="true" className="text-[22px]" /></span>
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-slate-700"><span className="block font-extrabold text-[#12315f]">¿Tienes cartas para vender?</span>Arma tu carpeta gratis y compártela.</p>
        <Link to="/bienvenida" className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#facc15] px-4 text-[13px] font-black text-[#12315f] transition-transform active:scale-[0.97]">Empezar</Link>
      </motion.section>
    );
  }

  if (count === null) return <div aria-hidden="true" className="skeleton mb-4 h-[8.5rem] rounded-3xl" />;

  if (count === 0) {
    return (
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } }} aria-labelledby="quickstart-title" className="mb-4 overflow-hidden rounded-3xl bg-[#12315f] p-4 text-white shadow-[0_18px_40px_-24px_rgba(18,49,95,0.9)] sm:p-5">
        <h2 id="quickstart-title" className="text-xl font-extrabold leading-tight">Empieza a vender en 3 pasos</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5 ring-1 ring-inset ring-white/10">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#facc15] text-[#12315f]"><SvgIcon name={step.icon} translate="no" aria-hidden="true" className="text-[20px]" /><span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#12315f]">{i + 1}</span></span>
              <span className="min-w-0"><span className="block text-[14px] font-extrabold">{step.title}</span><span className="block text-[12.5px] text-blue-100/85">{step.text}</span></span>
            </li>
          ))}
        </ol>
        <Link to="/dashboard?nueva=carpeta" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] text-[15px] font-black text-[#12315f] shadow-[0_10px_22px_-12px_rgba(250,204,21,0.9)] transition-transform active:scale-[0.98]">
          <SvgIcon name="add" translate="no" aria-hidden="true" className="text-[22px]" />Crear mi primera carpeta
        </Link>
      </motion.section>
    );
  }

  const name = appUser?.username || appUser?.name;
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } }} aria-label="Accesos rápidos" className={`${CARD} mb-4 px-3 pb-3 pt-3.5 sm:p-4`}>
      <p className="mb-2.5 px-1 text-[15px] font-extrabold text-[#12315f]">{name ? `Hola, ${name}` : 'Hola'}</p>
      <nav className="grid grid-cols-4 gap-1 sm:max-w-md">
        <Tile to="/dashboard?nueva=carpeta" icon="add" label="Crear carpeta" primary />
        <Tile to="/dashboard" icon="folder" label="Mis carpetas" />
        <Tile to="/dashboard?tab=solicitudes" icon="inbox" label="Solicitudes" />
        <Tile to="/dashboard?tab=tienda" icon="storefront" label="Mi tienda" />
      </nav>
    </motion.section>
  );
}
