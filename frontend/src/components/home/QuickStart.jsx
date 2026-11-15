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

function Tile({ to, icon, label, hint, primary = false }) {
  return (
    <Link to={to} className={`group relative flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-[20px] px-1.5 pb-3 pt-3.5 text-center transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] active:scale-[0.96] sm:px-3 sm:pb-4 sm:pt-5 sm:hover:-translate-y-1 ${primary ? 'bg-[#facc15] text-[#12315f] shadow-[0_14px_26px_-12px_rgba(250,204,21,0.85)] sm:hover:shadow-[0_20px_32px_-12px_rgba(250,204,21,0.95)]' : 'bg-white/[0.08] text-white ring-1 ring-inset ring-white/15 hover:bg-white/[0.14] sm:hover:ring-[#facc15]/60'}`}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110 sm:h-14 sm:w-14 ${primary ? 'bg-[#12315f] text-[#facc15]' : 'bg-white text-[#1e40af] shadow-[0_6px_12px_-6px_rgba(0,0,0,0.5)]'}`}><SvgIcon name={icon} translate="no" aria-hidden="true" className="text-[24px] sm:text-[28px]" /></span>
      <span className="text-[12.5px] font-extrabold leading-tight sm:text-[14px]">{label}</span>
      <span className={`hidden text-[11.5px] font-semibold leading-tight sm:block ${primary ? 'text-[#12315f]/75' : 'text-blue-100/70'}`}>{hint}</span>
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
  const photo = appUser?.photoURL || currentUser.photoURL;
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } }} aria-label="Accesos rápidos" className="relative isolate mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2550] via-[#12315f] to-[#1e40af] px-3 pb-3 pt-4 text-white shadow-[0_22px_44px_-26px_rgba(18,49,95,0.95)] ring-1 ring-white/10 sm:px-6 sm:pb-5 sm:pt-5">
      {/* Resplandor amarillo y trazo de carta: decoran sin competir con los botones */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-44 w-44 rounded-full bg-[#facc15]/25 blur-3xl" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-8 -z-10 h-32 w-32 rounded-full bg-[#60a5fa]/25 blur-3xl" />
      <div className="mb-3.5 flex items-center gap-3 px-1 sm:justify-center">
        {photo ? <img src={photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#facc15]" /> : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-base font-black text-[#12315f]">{(name || 'U')[0].toUpperCase()}</span>}
        <div className="min-w-0 sm:text-left">
          <p className="truncate text-[17px] font-extrabold leading-tight sm:text-lg">{name ? `Hola, ${name}` : 'Hola'}</p>
          <p className="text-[13px] font-semibold text-blue-100/80">¿Qué quieres hacer hoy?</p>
        </div>
      </div>
      <nav className="mx-auto grid max-w-3xl grid-cols-4 gap-2 sm:gap-4">
        <Tile to="/dashboard?nueva=carpeta" icon="add" label="Crear carpeta" hint="Empieza a vender" primary />
        <Tile to="/dashboard" icon="folder" label="Mis carpetas" hint="Tus cartas y precios" />
        <Tile to="/dashboard?tab=solicitudes" icon="inbox" label="Solicitudes" hint="Pedidos de compra" />
        <Tile to="/dashboard?tab=tienda" icon="storefront" label="Mi tienda" hint="Tu local y eventos" />
      </nav>
    </motion.section>
  );
}
