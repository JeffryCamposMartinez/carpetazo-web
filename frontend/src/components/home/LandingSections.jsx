import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';

const BUY_STEPS = [
  'Busca una carta o una carpeta.',
  'Agrega cartas al carrito y genera el pedido.',
  'Cierra el trato directo con el vendedor.',
];

const SELL_STEPS = [
  'Entra con tu cuenta de Google.',
  'Crea una carpeta y carga tus cartas con precio y stock.',
  'Comparte el enlace y recibe los pedidos en tu panel.',
];

// Los colores de cada función son los de los banners de la portada
const FEATURES = [
  { icon: 'auto_stories', tone: 'bg-teal-100 text-teal-700', title: 'Carpetas públicas', text: 'Cada carpeta se ve como un álbum o en cuadrícula, con el stock y el precio de cada carta.' },
  { icon: 'tune', tone: 'bg-violet-100 text-violet-700', title: 'Filtros por juego', text: 'Busca por nombre y filtra por edición. Cada juego suma sus propios filtros, como tipo, raza o coste.' },
  { icon: 'inbox', tone: 'bg-orange-100 text-orange-700', title: 'Panel de pedidos', text: 'Revisa las solicitudes de compra, confirma las ventas y consulta tu historial.' },
  { icon: 'favorite', tone: 'bg-rose-100 text-rose-700', title: 'Lista de deseos con avisos', text: 'Guarda lo que buscas con un precio máximo y te avisamos cuando aparezca o baje de precio.' },
  { icon: 'chat', tone: 'bg-blue-100 text-blue-700', title: 'Mensajes directos', text: 'Habla con compradores y vendedores sin salir de Carpetazo.' },
  { icon: 'badge', tone: 'bg-lime-100 text-lime-700', title: 'Perfil de vendedor', text: 'Un perfil público con tu descripción, tu ubicación y tus redes.' },
];

const GAMES = [
  { name: 'Pokémon', logo: '/images/logos/pokemon.webp', scale: 'scale-100' },
  { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.22]' },
  { name: 'Yu-Gi-Oh!', logo: '/images/logos/yugioh.webp', scale: 'scale-[2]' },
  { name: 'Magic', logo: '/images/logos/magic.webp', scale: 'scale-[1.4]' },
  { name: 'One Piece', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.4]' },
  { name: 'Riftbound', logo: '/images/logos/riftbound.webp', scale: 'scale-100' },
  { name: 'Lorcana', logo: '/images/logos/lorcana.svg', scale: 'scale-110' },
  { name: 'Digimon', logo: '/images/logos/digimon.svg', scale: 'scale-110' },
];

const FAN = ['pokemon', 'mitos', 'yugioh', 'magic', 'onepiece', 'riftbound'];

// Aparece una vez al entrar en pantalla; `--d` escalona a los hermanos
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!('IntersectionObserver' in window)) { node.setAttribute('data-in', ''); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { node.setAttribute('data-in', ''); observer.disconnect(); }
    }, { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const delay = (index) => ({ '--d': `${index * 70}ms` });
const SECTION = 'px-4 py-14 md:px-12 md:py-20';
const H2 = 'max-w-[24ch] text-balance text-3xl font-extrabold tracking-tight md:text-4xl';

function Steps({ title, icon, steps, dark }) {
  return (
    <div className={`rounded-3xl p-6 md:p-8 ${dark ? 'bg-[#12315f] text-white shadow-[0_24px_40px_-24px_rgba(18,49,95,0.8)]' : 'bg-white shadow-[0_20px_36px_-26px_rgba(18,49,95,0.5)] ring-1 ring-[#12315f]/10'}`}>
      <h3 className="flex items-center gap-3 text-xl font-extrabold">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${dark ? 'bg-[#facc15] text-[#12315f]' : 'bg-[#12315f] text-[#facc15]'}`}><SvgIcon name={icon} translate="no" className="text-[24px]" /></span>
        {title}
      </h3>
      <ol className="relative mt-6 space-y-5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-0.5 before:rounded-full before:bg-current before:opacity-15 before:content-['']">
        {steps.map((step, index) => (
          <li key={step} style={delay(index)} className="lp-reveal relative flex items-start gap-4">
            <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums ${dark ? 'bg-[#facc15] text-[#12315f]' : 'bg-[#1e40af] text-white'}`}>{index + 1}</span>
            <span className={`pt-1 text-base leading-relaxed ${dark ? 'text-blue-50' : 'text-slate-700'}`}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HowItWorks() {
  const ref = useReveal();
  return (
    <section ref={ref} className={`lp-group bg-blue-100 ${SECTION}`}>
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className={`${H2} text-[#12315f]`}>Cómo funciona</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
          <Steps title="Si quieres comprar" icon="shopping_cart" steps={BUY_STEPS} />
          <Steps title="Si quieres vender" icon="storefront" steps={SELL_STEPS} dark />
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className={`bg-white ${SECTION}`}>
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className={`${H2} text-[#12315f]`}>Lo que puedes hacer en Carpetazo</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-2xl bg-[#F4F8FF] p-5 ring-1 ring-[#12315f]/8 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_18px_30px_-20px_rgba(18,49,95,0.5)]">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${feature.tone}`}><SvgIcon name={feature.icon} translate="no" className="text-[26px]" /></span>
              <h3 className="mt-4 text-lg font-extrabold text-[#12315f]">{feature.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{feature.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Games() {
  return (
    <section className={`bg-[#F4F8FF] ${SECTION}`}>
      <div className="mx-auto w-full max-w-[1200px]">
        <h2 className={`${H2} text-[#12315f]`}>Ocho juegos, un solo lugar</h2>
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-slate-600">Busca y carga cartas de estos juegos, cada uno con su catálogo. Toca uno para ver sus carpetas.</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-8">
          {GAMES.map((game) => (
            <li key={game.name}>
              <Link to={`/carpetas?tcg=${encodeURIComponent(game.name)}`} className="group flex h-full flex-col items-center gap-2 rounded-2xl bg-white px-3 pb-3.5 pt-4 shadow-[0_1px_2px_rgba(18,49,95,0.06),0_12px_24px_-18px_rgba(18,49,95,0.45)] ring-1 ring-[#12315f]/8 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] active:scale-[0.97] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_18px_30px_-16px_rgba(18,49,95,0.5)]">
                <span className="flex h-16 w-full items-center justify-center overflow-hidden"><img src={game.logo} alt={game.name} loading="lazy" className={`max-h-full max-w-[80%] object-contain ${game.scale}`} /></span>
                <span className="text-xs font-bold text-[#12315f]/70 transition-colors group-hover:text-[#1e40af]">Ver carpetas</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const money = (value) => `$${Number(value).toLocaleString('es-CL')}`;

export function PlansTeaser() {
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api.getPlans().then((res) => { if (!cancelled) setPlans(res.plans || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const free = plans.find((plan) => plan.key === 'free');
  const cheapest = plans.filter((plan) => plan.priceClp > 0).sort((a, b) => a.priceClp - b.priceClp)[0];
  return (
    <section className={`bg-[#fff7d1] ${SECTION}`}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-12">
        <div>
          <h2 className={`${H2} text-[#12315f]`}>Gratis para empezar, planes para crecer</h2>
          <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-slate-700">
            {free ? `Con el plan Free tienes ${free.folders} ${free.folders === 1 ? 'carpeta' : 'carpetas'} de hasta ${free.uniqueCardsPerFolder} cartas únicas.` : 'Empiezas sin pagar nada.'}
            {cheapest ? ` Cuando tu colección crezca, los planes parten desde ${money(cheapest.priceClp)} al mes.` : ' Cuando tu colección crezca, puedes elegir un plan con más espacio.'}
          </p>
        </div>
        <Link to="/planes" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-[#12315f] px-7 text-[15px] font-extrabold text-white transition-[transform,background-color] duration-150 hover:bg-[#1e40af] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] active:scale-[0.97]">Ver los planes</Link>
      </div>
    </section>
  );
}

export function FinalCta({ primaryCta }) {
  return (
    <section className={`relative overflow-hidden bg-gradient-to-br from-[#0B1E45] via-[#12315f] to-[#1e40af] text-white ${SECTION}`}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#facc15]/20 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 className="max-w-[22ch] text-balance text-3xl font-extrabold tracking-tight md:text-5xl">Publica tu primera carpeta</h2>
          <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-blue-100 md:text-lg">Es gratis. Con tu cuenta de Google puedes cargar tus cartas y compartir el enlace hoy mismo.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {primaryCta}
            <Link to="/carpetas" className="inline-flex h-12 items-center justify-center rounded-full border-2 border-white/40 px-7 text-[15px] font-bold text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
              Explorar carpetas
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="relative mx-auto hidden h-72 w-full max-w-md md:block">
          {FAN.map((name, index) => {
            const turn = (index - (FAN.length - 1) / 2) * 11;
            return (
              <img
                key={name}
                src={`/images/carousel/${name}.webp`}
                alt=""
                loading="lazy"
                style={{ left: `${index * 14.5}%`, transform: `rotate(${turn}deg) translateY(${Math.abs(turn) * 0.9}px)`, zIndex: index }}
                className="absolute top-2 w-[34%] rounded-xl shadow-[0_18px_28px_-10px_rgba(0,0,0,0.6)] ring-2 ring-white/80 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)]:hover:brightness-110"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
