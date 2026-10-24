import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import HomeHero from './HomeHero';
import SvgIcon from '../ui/SvgIcon';
import SocialBrandIcon from '../ui/SocialBrandIcon';
import { api } from '../../services/api';

// Cada banner dice qué se puede hacer en el sitio, con lo que existe hoy. Los paneles de la derecha son ejemplos ilustrativos de la pantalla real.
const THEMES = {
  sell: { bg: 'from-[#042f2e] via-[#0f766e] to-[#0e7490]', glow: ['bg-cyan-300/30', 'bg-[#facc15]/25'], text: 'text-teal-50/90' },
  filters: { bg: 'from-[#2e1065] via-[#6d28d9] to-[#2563eb]', glow: ['bg-fuchsia-400/30', 'bg-sky-300/25'], text: 'text-violet-100/90' },
  orders: { bg: 'from-[#7c2d12] via-[#ea580c] to-[#db2777]', glow: ['bg-[#facc15]/35', 'bg-rose-300/30'], text: 'text-orange-50/90' },
  search: { bg: 'from-[#14532d] via-[#15803d] to-[#4d7c0f]', glow: ['bg-lime-300/30', 'bg-[#facc15]/25'], text: 'text-green-50/90' },
  wish: { bg: 'from-[#881337] via-[#e11d48] to-[#f59e0b]', glow: ['bg-[#facc15]/35', 'bg-pink-300/30'], text: 'text-rose-50/90' },
  social: { bg: 'from-[#102a56] via-[#1e40af] to-[#0f766e]', glow: ['bg-sky-300/30', 'bg-[#facc15]/25'], text: 'text-blue-50/90' },
};

const money = (value) => `$${value.toLocaleString('es-CL')}`;
const SLIDE_ORDER = ['marketplace', 'social', 'feedback', 'search', 'filters', 'sell', 'orders', 'wish'];

function Panel({ children, label, className = '' }) {
  return (
    <div className={`w-full max-w-[22rem] justify-self-center rounded-xl bg-white p-4 text-[#12315f] shadow-[0_24px_40px_-18px_rgba(2,12,40,0.7)] ring-1 ring-white/60 ${className}`}>
      {children}
      <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">{label}</p>
    </div>
  );
}

// Una carta icónica por juego, guardadas en public/images/carousel (se sacaron del catálogo en R2)
const CARDS = {
  pokemon: { name: 'Charizard', set: 'Base Set', src: '/images/carousel/pokemon.webp' },
  mitos: { name: 'Rey Arturo Pendragón', set: 'Espada Sagrada', src: '/images/carousel/mitos.webp' },
  yugioh: { name: 'Dark Magician', set: 'La Leyenda del Dragón Blanco de Ojos Azules', src: '/images/carousel/yugioh.webp' },
  magic: { name: 'Black Lotus', set: 'Beta Edition', src: '/images/carousel/magic.webp' },
  onepiece: { name: 'Monkey.D.Luffy', set: 'ST-01: Starter Deck 1', src: '/images/carousel/onepiece.webp' },
  riftbound: { name: 'Jinx, Demolitionist', set: 'Origins', src: '/images/carousel/riftbound.webp' },
};

function Thumb({ card }) {
  return <img src={card.src} alt="" loading="lazy" className="h-11 w-8 shrink-0 rounded-[5px] object-cover shadow-sm ring-1 ring-black/10" />;
}

function CardRow({ card, detail, end }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Thumb card={card} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{card.name}</span><span className="block truncate text-[11px] text-slate-500">{detail}</span></span>
      {end}
    </li>
  );
}

function SellPanel() {
  const rows = [[CARDS.pokemon, 1, 38000], [CARDS.yugioh, 2, 6000], [CARDS.mitos, 3, 2500]];
  return (
    <Panel label="Ejemplo de una carpeta" className="max-w-[24rem] rotate-1 rounded-[1.5rem] border-t-4 border-[#facc15]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-black">Mi carpeta</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#facc15] px-2.5 py-1 text-[11px] font-extrabold"><SvgIcon name="link" translate="no" className="text-[14px]" />Compartir</span>
      </div>
      <ul className="divide-y divide-blue-50">
        {rows.map(([card, stock, price]) => (
          <CardRow key={card.name} card={card} detail={card.set} end={<><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black">x{stock}</span><span className="w-16 text-right text-[13px] font-black tabular-nums">{money(price)}</span></>} />
        ))}
      </ul>
    </Panel>
  );
}

function FiltersPanel() {
  const chips = [['Edición', true], ['Idioma', true], ['Tipo', false], ['Raza', false], ['Coste', false]];
  return (
    <Panel label="Ejemplo de búsqueda y filtros" className="max-w-[21rem] rotate-2 rounded-[1.75rem] ring-2 ring-violet-200/80">
      <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[13px] font-semibold text-[#12315f]/70"><SvgIcon name="search" translate="no" className="text-[18px] text-[#1e40af]" />Buscar carta…</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map(([label, on]) => (
          <span key={label} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold ${on ? 'bg-[#1e40af] text-white' : 'bg-white text-[#1e40af] ring-1 ring-blue-200'}`}>{label}<SvgIcon name={on ? 'check' : 'expand_more'} translate="no" className="text-[14px]" /></span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[CARDS.riftbound, CARDS.onepiece, CARDS.magic].map((card) => <img key={card.name} src={card.src} alt="" loading="lazy" className="aspect-[5/7] w-full rounded-md object-contain shadow-sm ring-1 ring-black/10" />)}
      </div>
    </Panel>
  );
}

function OrdersPanel() {
  const rows = [[CARDS.yugioh, 2, 6000], [CARDS.riftbound, 1, 3500]];
  return (
    <div className="w-full max-w-[23rem] justify-self-center overflow-hidden rounded-2xl bg-white text-[#12315f] shadow-[0_24px_40px_-18px_rgba(2,12,40,0.7)] ring-1 ring-white/60">
      <div className="flex items-center justify-between bg-[#12315f] px-4 py-3 text-white"><span className="flex items-center gap-2 text-sm font-black"><SvgIcon name="shopping_cart" translate="no" className="text-[19px] text-[#facc15]" />Pedido listo</span><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-500/20">GENERADO</span></div>
      <div className="p-4">
        <ul className="divide-y divide-blue-50">{rows.map(([card, qty, price]) => <CardRow key={card.name} card={card} detail={`${qty} × ${money(price)}`} end={<span className="text-[13px] font-black tabular-nums">{money(qty * price)}</span>} />)}</ul>
        <div className="mt-1 flex items-center justify-between border-t-2 border-[#12315f]/10 pt-2.5"><span className="text-sm font-black">Total</span><span className="text-lg font-black tabular-nums">{money(rows.reduce((sum, [, qty, price]) => sum + qty * price, 0))}</span></div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-[#1e40af]/30 bg-blue-50 px-3 py-2 text-xs font-bold"><SvgIcon name="confirmation_number" translate="no" className="text-[17px] text-[#1e40af]" /><span>Código listo para enviar al vendedor</span></div>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-center text-[11px] font-semibold text-slate-400">Ejemplo de un pedido</p>
    </div>
  );
}

function SearchPanel() {
  const rows = [[CARDS.magic, 3, 120000], [CARDS.yugioh, 5, 6000], [CARDS.mitos, 2, 2500]];
  return (
    <Panel label="Ejemplo de una búsqueda en Cartas" className="max-w-[22rem] -rotate-3 rounded-[1.5rem] border-b-4 border-emerald-500/40">
      <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[13px] font-semibold text-[#12315f]/70"><SvgIcon name="search" translate="no" className="text-[18px] text-[#1e40af]" />Buscar en todas las carpetas…</div>
      <ul className="mt-2 divide-y divide-blue-50">
        {rows.map(([card, sellers, price]) => (
          <CardRow key={card.name} card={card} detail={`${sellers} ${sellers === 1 ? 'vendedor' : 'vendedores'} · desde ${money(price)}`} end={<SvgIcon name="chevron_right" translate="no" className="text-[18px] text-slate-400" />} />
        ))}
      </ul>
    </Panel>
  );
}

function WishPanel() {
  const rows = [[CARDS.magic, '$120.000', false], [CARDS.onepiece, '$4.000', false], [CARDS.riftbound, '$3.500', true]];
  return (
    <Panel label="Ejemplo de una lista de deseos" className="max-w-[21rem] rotate-2 rounded-[1.5rem] border border-rose-100">
      <div className="mb-2 flex items-center gap-2 text-sm font-black"><SvgIcon name="favorite" translate="no" className="text-[18px] text-rose-500" />Mi lista de deseos</div>
      <ul className="divide-y divide-blue-50">
        {rows.map(([card, max, hit]) => (
          <CardRow key={card.name} card={card} detail={`Precio máximo ${max}`} end={hit ? <span className="rounded-full bg-[#facc15] px-2 py-0.5 text-[11px] font-black">¡A la venta!</span> : null} />
        ))}
      </ul>
    </Panel>
  );
}

function SocialPanel({ items = [] }) {
  return (
    <Panel label="Redes oficiales de Carpetazo">
      <div className="mb-3 flex justify-center">
        <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" loading="lazy" className="h-20 w-auto max-w-[220px] object-contain" />
      </div>
      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <li key={item.name}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-[#12315f] transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><SocialBrandIcon network={item.name} className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 break-words">{item.name}</span>
                <SvgIcon name="open_in_new" translate="no" aria-hidden="true" className="ml-auto shrink-0 text-[14px] text-slate-400" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl bg-blue-50 px-4 py-5 text-center text-sm font-semibold text-slate-500">Próximamente en redes sociales.</div>
      )}
    </Panel>
  );
}

function FeedbackArtwork() {
  return (
    <div className="relative mx-auto flex h-[92px] w-full max-w-[330px] items-center justify-center md:h-[245px] md:max-w-[430px]" aria-hidden="true">
      <div className="absolute left-4 top-1 w-[68%] -rotate-3 rounded-xl bg-white p-2.5 text-[#12315f] shadow-xl ring-1 ring-white/70 md:left-3 md:top-8 md:rotate-[-6deg] md:rounded-2xl md:p-5">
        <div className="flex items-center gap-2 text-[11px] font-extrabold md:text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff4bf] text-[#12315f] md:h-10 md:w-10"><SvgIcon name="lightbulb" translate="no" className="text-[18px] md:text-[24px]" /></span>Una idea para Carpetazo</div>
        <div className="mt-2 space-y-1.5 md:mt-3 md:space-y-2"><span className="block h-1.5 w-[90%] rounded-full bg-blue-100 md:h-2" /><span className="block h-1.5 w-[72%] rounded-full bg-blue-100 md:h-2" /><span className="block h-1.5 w-[54%] rounded-full bg-blue-100 md:h-2" /></div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#e9f8ef] px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 md:mt-3 md:px-2.5 md:py-1 md:text-xs"><SvgIcon name="check_circle" translate="no" className="text-[13px]" />Recibida</div>
      </div>
      <div className="absolute bottom-0 right-2 flex h-10 w-10 rotate-6 items-center justify-center rounded-xl bg-[#facc15] text-[#12315f] shadow-lg ring-4 ring-white/20 md:bottom-5 md:right-4 md:h-16 md:w-16 md:rounded-3xl"><SvgIcon name="forum" translate="no" className="text-[23px] md:text-[35px]" /></div>
    </div>
  );
}

function FeedbackSlide() {
  return (
    <div className="relative isolate flex h-full w-full flex-col justify-center gap-1 overflow-hidden bg-gradient-to-br from-[#12315f] via-[#1e40af] to-[#147d78] px-5 py-3 text-left text-white md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-8 md:px-12 md:py-7 lg:px-16">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full bg-[#facc15]/20 blur-3xl" />
      <div className="order-1 md:order-1">
        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#facc15] ring-1 ring-white/15 md:mb-3 md:text-xs"><SvgIcon name="campaign" translate="no" className="text-[15px]" />Carpetazo mejora contigo</span>
        <h2 className="max-w-[22ch] text-balance text-[clamp(1.35rem,5.6vw,1.75rem)] font-extrabold leading-[1.08] tracking-tight md:text-[clamp(1.95rem,3.1vw,3rem)]">¿Tienes una idea para la web?</h2>
        <p className="mt-1.5 max-w-[48ch] text-[12px] leading-relaxed text-blue-50/90 md:mt-4 md:text-[clamp(0.95rem,1.25vw,1.125rem)]">Cuéntanos qué función te gustaría ver, qué mejorarías o si encontraste algo que debamos corregir. Leemos tus comentarios.</p>
        <Link to="/sugerencias" className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-[#facc15] px-5 text-sm font-extrabold text-[#12315f] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:mt-5 md:h-12 md:px-7 md:text-[15px]"><SvgIcon name="feedback" translate="no" className="text-[18px]" />Enviar sugerencia</Link>
      </div>
      <div className="order-2 md:order-2"><FeedbackArtwork /></div>
    </div>
  );
}

function MobileArtwork({ theme, items = [] }) {
  const imageClass = 'h-[76px] w-[55px] shrink-0 rounded-md bg-[#0B1E45] object-contain shadow-lg ring-2 ring-white/80';
  if (theme === 'sell') return (
    <div className="flex h-[82px] items-center justify-center overflow-hidden" aria-hidden="true">
      {[CARDS.pokemon, CARDS.yugioh, CARDS.mitos].map((card, index) => <img key={card.name} src={card.src} alt="" loading="lazy" className={`${imageClass} ${index === 0 ? 'translate-x-3 rotate-[-13deg]' : index === 1 ? 'z-10 -translate-y-1' : '-translate-x-3 rotate-[13deg]'}`} />)}
      <span className="ml-3 rounded-full bg-white/15 px-3 py-2 text-xs font-extrabold text-white ring-1 ring-white/30">Precio · stock · pedidos</span>
    </div>
  );
  if (theme === 'filters') return (
    <div className="mx-auto w-full max-w-[290px] rounded-xl bg-white/12 p-2.5 ring-1 ring-white/25" aria-hidden="true">
      <div className="mb-2 flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#12315f]/65"><SvgIcon name="search" translate="no" className="text-base text-[#1e40af]" />Nombre de carta…</div>
      <div className="flex items-center justify-center gap-2">{[CARDS.riftbound, CARDS.onepiece, CARDS.magic].map((card) => <img key={card.name} src={card.src} alt="" loading="lazy" className="h-[63px] w-[45px] shrink-0 rounded-sm bg-[#0B1E45] object-contain ring-1 ring-white/70" />)}<span className="rounded-full bg-[#facc15] px-2 py-1 text-[10px] font-black text-[#12315f]">+ filtros</span></div>
    </div>
  );
  if (theme === 'orders') return (
    <div className="mx-auto flex w-full max-w-[290px] items-center justify-between rounded-xl bg-white px-3 py-2 text-[#12315f] shadow-lg" aria-hidden="true">
      <div className="flex -space-x-2">{[CARDS.yugioh, CARDS.riftbound, CARDS.pokemon].map((card) => <img key={card.name} src={card.src} alt="" loading="lazy" className="h-[58px] w-[42px] rounded-sm bg-[#0B1E45] object-contain ring-2 ring-white" />)}</div>
      <div className="pl-3 text-right"><span className="block text-[10px] font-bold text-slate-500">PEDIDO ARMADO</span><span className="block text-sm font-black">$9.500</span><span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><SvgIcon name="check_circle" translate="no" className="text-sm" />Listo para enviar</span></div>
    </div>
  );
  if (theme === 'search') return (
    <div className="flex h-[82px] items-center justify-center gap-3" aria-hidden="true">
      <img src={CARDS.magic.src} alt="" loading="lazy" className="h-[76px] w-[55px] rotate-[-7deg] rounded-md bg-[#0B1E45] object-contain shadow-lg ring-2 ring-white/80" />
      <div className="rounded-xl bg-white px-4 py-2 text-[#12315f] shadow-lg"><span className="block text-[10px] font-bold text-slate-500">DISPONIBLE EN</span><span className="block text-lg font-black">3 carpetas</span></div>
      <img src={CARDS.yugioh.src} alt="" loading="lazy" className="h-[64px] w-[46px] rotate-[8deg] rounded-md bg-[#0B1E45] object-contain shadow-lg ring-2 ring-white/80" />
    </div>
  );
  if (theme === 'wish') return (
    <div className="flex h-[82px] items-center justify-center gap-2.5" aria-hidden="true">
      {[CARDS.onepiece, CARDS.mitos, CARDS.riftbound].map((card, index) => <div key={card.name} className={`relative ${index === 1 ? '-translate-y-1' : ''}`}><img src={card.src} alt="" loading="lazy" className="h-[73px] w-[52px] rounded-md bg-[#0B1E45] object-contain shadow-lg ring-2 ring-white/80" />{index === 1 && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow"><SvgIcon name="favorite" translate="no" className="text-[17px]" /></span>}</div>)}
      <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-extrabold ring-1 ring-white/30">Aviso de precio</span>
    </div>
  );
  return (
    <div className="flex h-[112px] items-center justify-center gap-2.5" aria-hidden="true">
      <div className="flex h-[98px] w-[116px] flex-col items-center justify-center rounded-2xl bg-white/10 p-2 ring-1 ring-white/30 shadow-[0_12px_28px_-16px_rgba(0,0,0,0.7)]">
        <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" loading="lazy" className="h-[82px] w-[96px] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]" />
      </div>
    </div>
  );
}

const VISUALS = { sell: SellPanel, filters: FiltersPanel, orders: OrdersPanel, search: SearchPanel, wish: WishPanel, social: SocialPanel };

function InfoSlide({ theme, title, text, points, cta, to, secondary, socialItems = [] }) {
  const { bg, glow: [glow, glow2], text: tone } = THEMES[theme];
  const Visual = VISUALS[theme];
  const reverse = theme === 'search' || theme === 'orders';
  const centeredSocial = theme === 'social';
  const mobileArtworkFirst = theme === 'search' || theme === 'sell';
  return (
    <div className={`relative isolate flex h-full w-full select-none flex-col justify-center gap-2.5 overflow-hidden bg-gradient-to-br ${bg} px-5 py-4 text-left text-white md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10 md:px-12 md:py-7 lg:px-16`}>
      <div aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full blur-3xl ${glow}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-64 w-64 rounded-full blur-3xl ${glow2}`} />
      <div className={`md:hidden ${mobileArtworkFirst ? 'order-1' : 'order-2'} ${theme === 'orders' ? 'mx-auto w-full max-w-[310px]' : ''}`}><MobileArtwork theme={theme} items={socialItems} /></div>
      <div className={`${mobileArtworkFirst ? 'order-2' : 'order-1'} ${reverse ? 'md:order-2' : 'md:order-1'} ${centeredSocial ? 'text-center md:text-left' : ''}`}>
        <h2 className={`max-w-[22ch] text-balance text-[clamp(1.35rem,5.6vw,1.75rem)] font-extrabold leading-[1.08] tracking-tight md:text-[clamp(1.95rem,3.1vw,3rem)] ${centeredSocial ? 'mx-auto md:mx-0' : ''}`}>{title}</h2>
        <p className={`mt-2 max-w-[48ch] text-[12px] leading-relaxed ${tone} md:mt-4 md:text-[clamp(0.95rem,1.25vw,1.125rem)] ${centeredSocial ? 'mx-auto md:mx-0' : ''}`}>{text}</p>
        <div className={`mt-3 flex flex-wrap items-center gap-2.5 md:mt-5 ${centeredSocial ? 'justify-center md:justify-start' : ''}`}>
          <Link to={to} className="inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#0B1E45] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:h-12 md:px-7 md:text-[15px]">{cta}</Link>
          {secondary && <Link to={secondary.to} className="inline-flex h-11 items-center rounded-full bg-white/10 px-5 text-sm font-bold ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:h-12 md:px-6 md:text-[15px]">{secondary.label}</Link>}
        </div>
        <ul className={`mt-5 hidden flex-wrap gap-x-5 gap-y-2 text-sm font-semibold ${tone} md:flex`}>
          {points.map(({ icon, label }) => (
            <li key={label} className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#facc15]/20 text-[#facc15]"><SvgIcon name={icon} translate="no" className="text-[16px]" /></span>{label}</li>
          ))}
        </ul>
        {theme === 'social' && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2 md:hidden">
            {socialItems.map((item) => (
              <li key={item.name}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 min-w-[132px] items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-xs font-extrabold text-white ring-1 ring-inset ring-white/35 shadow-sm transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                  <SocialBrandIcon network={item.name} className="h-[16px] w-[16px]" />{item.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`hidden md:block ${reverse ? 'md:order-1' : 'md:order-2'} ${theme === 'orders' ? 'md:scale-[1.03]' : ''}`}><Visual items={socialItems} /></div>
    </div>
  );
}

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [socialItems, setSocialItems] = useState([]);
  const { currentUser } = useAuth();
  const sellTo = currentUser ? '/dashboard' : '/bienvenida';

  useEffect(() => {
    let cancelled = false;
    api.getFooterSettings().then((response) => {
      if (cancelled || !response?.settings) return;
      const configured = [
        ['Facebook', 'facebookUrl'],
        ['Instagram', 'instagramUrl'],
        ['WhatsApp', 'whatsappUrl'],
        ['Discord', 'discordUrl'],
        ['X / Twitter', 'twitterUrl'],
        ['TikTok', 'tiktokUrl'],
      ].flatMap(([name, field]) => {
        const url = String(response.settings[field] || '').trim();
        if (!url) return [];
        try {
          const parsed = new URL(url);
          if (!['https:', 'http:'].includes(parsed.protocol)) return [];
        } catch { return []; }
        return [{ name, url }];
      });
      setSocialItems(configured);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // El gesto se guarda en una referencia: así no se vuelve a renderizar el carrusel en cada movimiento del dedo o del mouse
  const gesture = useRef({ startX: null, endX: null, dragging: false });
  const minSwipeDistance = 50;

  const settleGesture = () => {
    const { startX, endX } = gesture.current;
    gesture.current = { startX: null, endX: null, dragging: false };
    if (startX === null || endX === null) return;
    const distance = startX - endX;
    if (distance > minSwipeDistance) setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    else if (distance < -minSwipeDistance) setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const onTouchStart = (e) => { gesture.current = { startX: e.targetTouches[0].clientX, endX: null, dragging: true }; };
  const onTouchMove = (e) => { if (gesture.current.dragging) gesture.current.endX = e.targetTouches[0].clientX; };
  const onTouchEnd = () => settleGesture();
  const onMouseDown = (e) => { gesture.current = { startX: e.clientX, endX: null, dragging: true }; };
  const onMouseMove = (e) => { if (gesture.current.dragging) gesture.current.endX = e.clientX; };
  const onMouseUp = () => { if (gesture.current.dragging) settleGesture(); };
  const onMouseLeave = () => { gesture.current = { startX: null, endX: null, dragging: false }; };

  const slides = [
    {
      id: 'marketplace',
      mobileContent: <HomeHero compact />,
      desktopContent: <HomeHero />,
    },
    {
      id: 'sell',
      content: (
        <InfoSlide
          theme="sell"
          title="Vende tus cartas con una carpeta pública"
          text="Empieza gratis con una carpeta. Carga tus cartas con precio y stock, comparte el enlace y recibe los pedidos en tu panel. Cuando crezcas, un plan te da más carpetas y cartas."
          points={[
            { icon: 'sell', label: 'Precio y stock por carta' },
            { icon: 'link', label: 'Un enlace para compartir' },
            { icon: 'workspace_premium', label: 'Planes desde $990 al mes' },
          ]}
          cta={currentUser ? 'Ir a mis carpetas' : 'Crear mi carpeta'}
          to={sellTo}
          secondary={{ label: 'Ver planes', to: '/planes' }}
        />
      ),
    },
    {
      id: 'filters',
      content: (
        <InfoSlide
          theme="filters"
          title="Encuentra la carta exacta en cualquier juego"
          text="Dentro de cada carpeta busca por nombre y filtra por edición. Cada juego suma sus propios filtros, como tipo, raza o coste, y los puedes combinar."
          points={[
            { icon: 'search', label: 'Búsqueda por nombre' },
            { icon: 'tune', label: 'Filtros propios de cada juego' },
          ]}
          cta="Ver carpetas"
          to="/carpetas"
        />
      ),
    },
    {
      id: 'orders',
      content: (
        <InfoSlide
          theme="orders"
          title="Arma tu pedido y ciérralo con el vendedor"
          text="Agrega cartas al carrito y genera el pedido. El vendedor recibe el detalle con el total y un código, y coordinan pago y envío por el medio que él tenga disponible."
          points={[
            { icon: 'receipt_long', label: 'Pedido con total y código' },
            { icon: 'forum', label: 'Contacto directo con el vendedor' },
          ]}
          cta="Ver carpetas"
          to="/carpetas"
        />
      ),
    },
    {
      id: 'search',
      content: (
        <InfoSlide
          theme="search"
          title="Busca una carta y mira quién la vende"
          text="En Cartas escribes el nombre y ves en qué carpetas está, con el precio de cada vendedor. Entras a la que más te convenga."
          points={[
            { icon: 'search', label: 'Todas las carpetas a la vez' },
            { icon: 'sell', label: 'Precio de cada vendedor' },
          ]}
          cta="Buscar cartas"
          to="/cartas"
        />
      ),
    },
    {
      id: 'wish',
      content: (
        <InfoSlide
          theme="wish"
          title="Guarda lo que buscas y entérate cuando aparezca"
          text="Arma tu lista de deseos con el precio máximo que pagarías. Si una de esas cartas sale a la venta o baja de precio, te avisamos."
          points={[
            { icon: 'favorite', label: 'Lista con precio máximo' },
            { icon: 'notifications_active', label: 'Aviso por correo y en el navegador' },
          ]}
          cta={currentUser ? 'Ir a mi lista' : 'Crear mi cuenta'}
          to={currentUser ? '/dashboard?tab=deseadas' : '/bienvenida'}
        />
      ),
    },
    {
      id: 'social',
      content: (
        <InfoSlide
          theme="social"
          title="Síguenos en redes sociales"
          text="Conéctate con Carpetazo para enterarte de novedades, cartas y noticias de la comunidad."
          points={[
            { icon: 'campaign', label: 'Novedades de Carpetazo' },
            { icon: 'groups', label: 'Contenido para coleccionistas' },
          ]}
          cta="Ver carpetas"
          to="/carpetas"
          socialItems={socialItems}
        />
      ),
    },
    { id: 'feedback', content: <FeedbackSlide /> },
  ].sort((a, b) => SLIDE_ORDER.indexOf(a.id) - SLIDE_ORDER.indexOf(b.id));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 10227);
    return () => clearInterval(timer);
  }, [slides.length, currentSlide]);

  return (
    <div className="w-full max-w-[1280px] mb-6 flex flex-col items-center">
      <div
        className="w-full relative overflow-hidden rounded-lg h-[390px] min-[420px]:h-[410px] sm:h-[clamp(360px,46vh,470px)] select-none cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="flex h-full transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="w-full h-full flex-shrink-0 relative bg-[#0B1E45]" aria-hidden={slides[currentSlide].id !== slide.id} inert={slides[currentSlide].id !== slide.id}>
              {slide.content ? slide.content : (
                <>
                  <div className="block md:hidden h-full w-full">{slide.mobileContent}</div>
                  <div className="hidden md:flex h-full w-full">{slide.desktopContent}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div key={`progress-${currentSlide}`} aria-hidden="true" className="mt-5 h-[6px] w-full overflow-hidden rounded-full bg-[#12315f]/15">
        <div className="h-full w-full origin-left rounded-full bg-[#facc15] animate-carousel-progress" />
      </div>
      <div className="flex gap-3 justify-center mt-3">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={() => setCurrentSlide(idx)}
            className={`relative h-2 rounded-full transition-all duration-300 after:absolute after:-inset-x-1.5 after:-inset-y-4 after:content-[''] ${
              currentSlide === idx ? 'bg-[#12315f] w-8' : 'bg-slate-300 hover:bg-slate-400 w-3'
            }`}
            aria-label={`Ir al banner ${idx + 1}`}
            aria-current={currentSlide === idx}
          />
        ))}
      </div>
    </div>
  );
}
