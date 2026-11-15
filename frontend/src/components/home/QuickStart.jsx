import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';

// Primer bloque de la portada. Superficies planas y líneas finas, como un cuaderno de inventario de cartas:
// visitantes y quien aún no tiene carpetas ven el mismo panel azul con los 3 pasos; quien ya vende ve una franja de atajos.
const DISPLAY = "font-['Space_Grotesk',system-ui,sans-serif]";

const STEPS_GUEST = [
  { title: 'Crea tu cuenta', text: 'Con Google, en un clic. Sin formularios largos.' },
  { title: 'Arma tu carpeta', text: 'Elige el juego, escanea o busca tus cartas y ponles precio.' },
  { title: 'Comparte el enlace', text: 'Te escriben o piden por la web, y cierras el trato.' }
];
const STEPS_FIRST = [
  { title: 'Crea tu carpeta', text: 'Elige el juego y ponle un nombre.' },
  { title: 'Agrega tus cartas', text: 'Escanéalas con la cámara o búscalas por nombre.' },
  { title: 'Comparte el enlace', text: 'Te escriben o piden por la web, y cierras el trato.' }
];

function StepsPanel({ title, text, steps, action }) {
  return (
    <section aria-labelledby="quickstart-title" className="mb-4 grid overflow-hidden rounded-lg bg-[#12315f] text-white lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-between gap-8 p-6 sm:p-9">
        <div>
          <h2 id="quickstart-title" className={`${DISPLAY} max-w-[14ch] text-[2.15rem] font-bold leading-[0.98] tracking-[-0.03em] sm:text-[3rem]`}>{title}</h2>
          <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-blue-100/85">{text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{action}</div>
      </div>
      <ol className="divide-y divide-white/15 border-t border-white/15 lg:border-l lg:border-t-0">
        {steps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[2.5rem_1fr] items-start gap-3 px-6 py-4 sm:grid-cols-[3rem_1fr] sm:px-9 sm:py-6">
            <span aria-hidden="true" className={`${DISPLAY} text-[2.4rem] font-bold leading-[0.85] tabular-nums text-[#facc15] sm:text-[2.6rem]`}>{index + 1}</span>
            <span className="pt-0.5"><span className="block text-[17px] font-extrabold leading-snug">{step.title}</span><span className="mt-0.5 block text-[14px] leading-relaxed text-blue-100/80">{step.text}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const primaryBtn = 'inline-flex h-12 items-center gap-2.5 rounded-md bg-[#facc15] px-6 text-[15px] font-black text-[#12315f] transition-[transform,background-color] duration-150 hover:bg-[#fde047] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12315f]';
const textLink = 'group inline-flex items-center gap-1.5 text-[15px] font-bold text-white underline decoration-white/40 decoration-1 underline-offset-[5px] transition-colors hover:decoration-[#facc15] focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

function Cell({ to, icon, label, hint, primary = false }) {
  return (
    <Link to={to} className={`group relative flex min-w-0 items-center gap-3 px-4 py-4 transition-colors duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#12315f] sm:py-5 ${primary ? 'bg-[#facc15] text-[#12315f] hover:bg-[#fde047]' : 'bg-[#DBEAFE] text-[#12315f] hover:bg-white'}`}>
      <SvgIcon name={icon} translate="no" aria-hidden="true" className="shrink-0 text-[26px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold leading-tight">{label}</span>
        <span className="mt-0.5 hidden truncate text-[12.5px] font-semibold leading-tight text-[#12315f]/65 sm:block">{hint}</span>
      </span>
      <SvgIcon name="arrow_forward" translate="no" aria-hidden="true" className="hidden shrink-0 -translate-x-1 text-[20px] opacity-0 transition-[transform,opacity] duration-150 group-hover:translate-x-0 group-hover:opacity-100 sm:block" />
    </Link>
  );
}

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
    const openAuth = () => window.dispatchEvent(new Event('carpetazo:open-auth'));
    return (
      <StepsPanel
        title="Tus cartas, tu carpeta, tu precio."
        text="Compra y vende cartas TCG directo con jugadores de Chile, sin intermediarios y sin comisión por publicar."
        steps={STEPS_GUEST}
        action={(
          <>
            <button type="button" onClick={openAuth} className={primaryBtn}><img src="/images/logos/google.svg" alt="" className="h-5 w-5 rounded-full bg-white p-[2px]" />Crear cuenta gratis</button>
            <Link to="/carpetas" className={textLink}>Explorar carpetas<SvgIcon name="arrow_forward" translate="no" aria-hidden="true" className="text-[18px] transition-transform duration-150 group-hover:translate-x-0.5" /></Link>
          </>
        )}
      />
    );
  }

  if (count === null) return <div aria-hidden="true" className="skeleton mb-4 h-24 rounded-lg" />;

  if (count === 0) {
    return (
      <StepsPanel
        title="Tu primera carpeta, en tres pasos."
        text="Una carpeta es tu vitrina: tus cartas con stock y precio, listas para compartir."
        steps={STEPS_FIRST}
        action={<Link to="/dashboard?nueva=carpeta" className={primaryBtn}><SvgIcon name="add" translate="no" aria-hidden="true" className="text-[22px]" />Crear mi primera carpeta</Link>}
      />
    );
  }

  const name = appUser?.username || appUser?.name;
  return (
    <section aria-label="Accesos rápidos" className="mb-4 border-y-2 border-[#12315f]">
      <h2 className={`${DISPLAY} px-4 pb-2.5 pt-3.5 text-[1.35rem] font-bold leading-none tracking-[-0.02em] text-[#12315f] sm:text-2xl`}>{name ? `Hola, ${name}` : 'Hola'}</h2>
      <nav className="grid grid-cols-2 gap-px border-t border-[#12315f]/25 bg-[#12315f]/25 sm:grid-cols-4">
        <Cell to="/dashboard?nueva=carpeta" icon="add" label="Crear carpeta" hint="Empieza a vender" primary />
        <Cell to="/dashboard" icon="folder" label="Mis carpetas" hint="Tus cartas y precios" />
        <Cell to="/dashboard?tab=solicitudes" icon="inbox" label="Solicitudes" hint="Pedidos de compra" />
        <Cell to="/dashboard?tab=tienda" icon="storefront" label="Mi tienda" hint="Tu local y eventos" />
      </nav>
    </section>
  );
}
