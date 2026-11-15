import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';

const CARD = 'rounded-3xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06),0_14px_30px_-22px_rgba(26,43,75,0.55)] ring-1 ring-slate-900/5';
const EASE_OUT = [0.23, 1, 0.32, 1];
const PERKS = [
  { icon: 'shopping_bag', title: 'Compra directo', text: 'Elige y arma tu pedido' },
  { icon: 'sell', title: 'Vende gratis', text: 'Tu carpeta, tus precios' },
  { icon: 'chat', title: 'Habla con vendedores', text: 'Cierra el trato por chat' }
];
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
  // El número de carpetas de la última visita se usa de inmediato: nunca se muestra un hueco mientras se consulta.
  // Si aún no se conoce, aparece la tarjeta de atajos (que ya incluye «Crear carpeta») y se cambia solo si resulta que no tiene carpetas.
  const [count, setCount] = useState(() => { try { const saved = Number(sessionStorage.getItem('carpetazo:folders-count')); return Number.isFinite(saved) && sessionStorage.getItem('carpetazo:folders-count') !== null ? saved : null; } catch (_error) { return null; } });
  useEffect(() => {
    if (!currentUser) return undefined;
    let alive = true;
    api.getMyFolders().then((r) => {
      const n = (r.folders || []).length;
      try { sessionStorage.setItem('carpetazo:folders-count', String(n)); } catch (_error) { /* sin almacenamiento */ }
      if (alive) setCount(n);
    }).catch(() => { /* se queda con los atajos */ });
    return () => { alive = false; };
  }, [currentUser]);

  if (!currentUser) {
    const openAuth = () => window.dispatchEvent(new Event('carpetazo:open-auth'));
    return (
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } }} aria-labelledby="welcome-title" className="relative isolate mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2550] via-[#12315f] to-[#1e40af] p-5 text-white shadow-[0_22px_44px_-26px_rgba(18,49,95,0.95)] ring-1 ring-white/10 sm:px-8 sm:py-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-48 w-48 rounded-full bg-[#facc15]/25 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 left-1/3 -z-10 h-36 w-36 rounded-full bg-[#60a5fa]/25 blur-3xl" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <h2 id="welcome-title" className="text-[1.6rem] font-extrabold leading-[1.1] sm:text-[2rem]">Bienvenido a Carpetazo</h2>
            <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-blue-100/90 sm:text-base">Compra y vende cartas TCG directo con jugadores de Chile. Crea tu cuenta gratis y arma tu primera carpeta en minutos.</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
              {PERKS.map((perk) => (
                <li key={perk.title} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.08] px-3 py-2.5 ring-1 ring-inset ring-white/15">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#facc15] text-[#12315f]"><SvgIcon name={perk.icon} translate="no" aria-hidden="true" className="text-[20px]" /></span>
                  <span className="min-w-0 text-[13px] font-bold leading-tight">{perk.title}<span className="block text-[12px] font-medium text-blue-100/75">{perk.text}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:w-60 lg:flex-col">
            <button type="button" onClick={openAuth} className="inline-flex h-12 items-center justify-center sm:flex-1 lg:flex-none gap-2.5 rounded-full bg-[#facc15] px-6 text-[15px] font-black text-[#12315f] shadow-[0_14px_26px_-12px_rgba(250,204,21,0.9)] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <img src="/images/logos/google.svg" alt="" className="h-5 w-5 rounded-full bg-white p-[2px]" />Crear cuenta gratis
            </button>
            <Link to="/carpetas" className="inline-flex h-12 items-center justify-center sm:flex-1 lg:flex-none rounded-full bg-white/10 px-6 text-[15px] font-bold ring-1 ring-inset ring-white/30 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Explorar carpetas</Link>
          </div>
        </div>
      </motion.section>
    );
  }

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
