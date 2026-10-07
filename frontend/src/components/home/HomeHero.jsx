import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadableImage from '../ui/LoadableImage';

// Contenido del primer banner del carrusel de inicio.
// Usa las mismas cartas promocionales de los banners anteriores.
const CARDS = [
  { name: 'Luffy', src: '/images/promos/luffy.webp', rotate: -9, lift: 10, scale: 0.94, z: 10, delay: 220 },
  { name: 'Charizard', src: '/images/promos/charizard.webp', rotate: 0, lift: -4, scale: 1.08, z: 20, delay: 120 },
  { name: 'The One Ring', src: '/images/promos/onering.webp', rotate: 9, lift: 10, scale: 0.94, z: 10, delay: 320 },
];

const STEPS = ['Elige una carpeta', 'Arma tu pedido', 'Cierra el trato con el vendedor'];

function Fan({ compact }) {
  const width = compact ? 'w-[25vw] max-w-[108px]' : 'w-[clamp(140px,12.5vw,190px)]';
  return (
    <div className="relative flex h-full items-end justify-center overflow-hidden px-3">
      <div className="relative flex items-end justify-center">
        {CARDS.map((card, index) => (
          <div
            key={card.name}
            className={`hero-card shrink-0 ${width} ${index > 0 ? (compact ? '-ml-[7vw]' : '-ml-[1.4vw]') : ''}`}
            style={{ zIndex: card.z, '--r': `${card.rotate}deg`, '--s': card.scale, '--y': `${card.lift}px`, animationDelay: `${card.delay}ms` }}
          >
            <div className="relative overflow-hidden rounded-xl bg-[#13306b] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.75)] ring-1 ring-white/25" style={{ aspectRatio: '63 / 88' }}>
              <LoadableImage src={card.src} alt={card.name} decoding="async" compact className="h-full w-full object-cover" />
            </div>
          </div>
        ))}
      </div>
      {/* Bolsillo de la carpeta: ocupa todo el ancho para que ninguna esquina de carta asome por debajo */}
      <div aria-hidden="true" className={`absolute inset-x-0 bottom-0 z-30 rounded-t-3xl border border-b-0 border-white/25 bg-[#12315f] ${compact ? 'h-[18%]' : 'h-[16%]'}`} />
    </div>
  );
}

export default function HomeHero({ compact = false }) {
  const { currentUser } = useAuth();
  const sellTo = currentUser ? '/dashboard' : '/bienvenida';
  const sellLabel = currentUser ? 'Ir a mis carpetas' : 'Vender mis cartas';

  return (
    <div className="relative isolate h-full w-full select-none overflow-hidden text-white">
      {/* Cuero de carpeta y costura, como el álbum */}
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-[#0B1E45] via-[#1e3a8a] to-[#1d4ed8]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-72 w-72 rounded-full bg-[#facc15]/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/4 -z-10 h-64 w-64 rounded-full bg-sky-400/30 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[url('/images/leather.png')] opacity-25 mix-blend-overlay max-sm:hidden" />
      <div aria-hidden="true" className={`pointer-events-none absolute z-40 border-2 border-dashed border-white/15 ${compact ? 'inset-2 rounded-[18px]' : 'inset-3.5 rounded-[24px]'}`} />

      {compact ? (
        <div className="flex h-full flex-col">
          <div className="px-7 pt-7">
            <h1 className="text-balance text-[clamp(1.3rem,6.2vw,1.65rem)] font-extrabold leading-[1.1] tracking-tight">
              Compra cartas TCG directo a jugadores de Chile
            </h1>
            <div className="mt-4 flex gap-2">
              <Link to="/carpetas" className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-[#ffcb05] px-5 text-[13px] font-extrabold text-[#0B1E45]">Ver carpetas</Link>
              <Link to={sellTo} className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-white/10 px-4 text-[13px] font-bold ring-1 ring-inset ring-white/30 max-[359px]:hidden">{currentUser ? 'Mis carpetas' : 'Vender cartas'}</Link>
            </div>
          </div>
          <div className="min-h-0 flex-1 pt-5"><Fan compact /></div>
        </div>
      ) : (
        <div className="grid h-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col justify-center py-9 pl-14 pr-2">
            <h1 className="max-w-[24ch] text-balance text-[clamp(1.95rem,3.1vw,3.05rem)] font-extrabold leading-[1.06] tracking-tight">
              Compra cartas TCG directo a jugadores de Chile
            </h1>
            <p className="mt-4 max-w-[46ch] text-[clamp(0.95rem,1.25vw,1.125rem)] leading-relaxed text-blue-100/85">
              Cada vendedor arma su carpeta con stock y precios al día. Tú eliges, armas el pedido y cierras el trato por el medio que el vendedor tenga disponible.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/carpetas" className="inline-flex h-12 items-center rounded-full bg-[#ffcb05] px-8 text-[15px] font-extrabold text-[#0B1E45] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none">
                Ver carpetas
              </Link>
              <Link to={sellTo} className="inline-flex h-12 items-center rounded-full bg-white/10 px-7 text-[15px] font-bold ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                {sellLabel}
              </Link>
            </div>
            <ol className="mt-7 flex gap-x-6 text-sm text-blue-100/80">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-xs font-bold tabular-nums text-[#ffcb05] ring-1 ring-white/20">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="pt-8 pr-8"><Fan /></div>
        </div>
      )}
    </div>
  );
}
