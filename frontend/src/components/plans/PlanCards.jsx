import { useCallback, useEffect, useRef, useState } from 'react';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

const PLAN_MARKS = {
  free: '/images/plans/common-mark.svg',
  enthusiast: '/images/plans/enthusiast-tag.svg',
  premium: '/images/plans/premium-tag.svg',
  pro: '/images/plans/pro-tag.svg',
  store: '/images/plans/store-tag.svg'
};
const TONES = {
  free: 'bg-slate-100 text-slate-600',
  enthusiast: 'bg-emerald-100 text-emerald-700',
  premium: 'bg-sky-100 text-sky-700',
  pro: 'bg-violet-100 text-violet-700',
  store: 'bg-amber-100 text-amber-700'
};
const TAGLINES = {
  free: 'Para empezar a ordenar tus cartas',
  enthusiast: 'Cuando tu colección ya crece',
  premium: 'Para coleccionistas con muchas carpetas',
  pro: 'Para vender con más alcance',
  store: 'Para tiendas, sin límites de espacio'
};
const price = (value) => value === 0 ? 'Gratis' : `$${Number(value).toLocaleString('es-CL')}`;
const count = (value) => value === null ? '∞' : Number(value).toLocaleString('es-CL');
const EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)]';
const PERK_DETAILS = {
  wishlist: 'Crea listas para organizar las cartas que buscas y compartirlas. El límite indica cuántas listas puedes tener y cuántas cartas caben en cada una.',
  social: 'Agrega enlaces a tus redes sociales para que otras personas puedan conocerte y contactarte desde tu perfil.',
  featured: 'Elige cartas de tus carpetas públicas para destacarlas y darles mayor visibilidad en tu perfil.',
  badge: 'Muestra una insignia junto a tu perfil para identificar el plan que tienes activo.',
  banner: 'Personaliza la portada de tu perfil con un banner propio.',
  studio: 'Personaliza la apariencia de tu perfil eligiendo estilos y un fondo.',
  visits: 'Consulta el detalle de las visitas que recibe tu perfil y tus carpetas.',
  export: 'Descarga tu inventario en un archivo CSV para revisarlo en una hoja de cálculo.',
  boost: 'Tus cartas aparecen primero en las búsquedas públicas de cartas en venta: Tienda, luego Legendario y después los demás planes. Se mantiene el orden elegido dentro de cada nivel.',
  support: 'Envía consultas desde Reclamos y sugerencias. Con Legendario o Tienda quedan marcadas como prioritarias y aparecen antes en la bandeja del equipo.'
};

function comparison(current, previous) {
  if (previous === undefined) return null;
  if (current === previous || previous === null) return null;
  if (current === null) return count(previous);
  const difference = Number(current) - Number(previous);
  return difference > 0 ? count(previous) : null;
}

function UpgradeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0 text-emerald-500">
      <path d="m4 10 8-8 8 8M4 20l8-8 8 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

// Lo que trae el plan y qué mejora respecto al anterior.
function perksOf(plan, prev) {
  const boostLabel = ['', 'Prioridad en los listados', 'Mayor prioridad en los listados'];
  const wishlistText = prev
    ? `${plan.wishlistLists} listas de deseos de hasta ${plan.wishlistItems} cartas`
    : `${plan.wishlistLists} ${plan.wishlistLists === 1 ? 'lista' : 'listas'} de deseos de ${plan.wishlistItems} cartas`;
  const socialText = prev
    ? `${plan.socialLinks} redes sociales en tu perfil`
    : `${plan.socialLinks} ${plan.socialLinks === 1 ? 'red social' : 'redes sociales'} en tu perfil`;
  const featuredText = prev
    ? `${plan.featuredCards} cartas destacadas`
    : `${plan.featuredCards} cartas destacadas`;
  const list = [
    { key: 'wishlist', on: true, isNew: !prev || prev.wishlistLists !== plan.wishlistLists || prev.wishlistItems !== plan.wishlistItems, text: wishlistText },
    { key: 'social', on: true, isNew: !prev || prev.socialLinks !== plan.socialLinks, text: socialText },
    { key: 'featured', on: true, isNew: !prev || prev.featuredCards !== plan.featuredCards, text: featuredText },
    { key: 'badge', on: plan.key !== 'free', isNew: prev?.key === 'free', text: 'Insignia de plan en tu perfil' },
    { key: 'banner', on: plan.profileBanner, isNew: !prev?.profileBanner, text: 'Banner del perfil' },
    { key: 'studio', on: plan.profileStudio, isNew: !prev?.profileStudio, text: 'Estilos y fondo para tu perfil' },
    { key: 'visits', on: plan.visitsDetail, isNew: !prev?.visitsDetail, text: 'Detalle de tus visitas' },
    { key: 'export', on: plan.inventoryExport, isNew: !prev?.inventoryExport, text: 'Exportar tu inventario (CSV)' },
    { key: 'boost', on: plan.listingBoost > 0, isNew: (prev?.listingBoost || 0) !== plan.listingBoost, text: boostLabel[plan.listingBoost] },
    { key: 'support', on: plan.prioritySupport, isNew: !prev?.prioritySupport, text: 'Soporte prioritario' }
  ];
  return list.filter((item) => item.on);
}

function Stat({ value, label, delta }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-blue-50 px-1 py-2.5 text-center xl:min-h-[128px] xl:py-2">
      <span className="text-2xl font-black leading-none text-[#12315f] xl:text-[22px]">{value}</span>
      <span className="mt-1 text-[11px] font-bold leading-tight text-slate-600 xl:min-h-[38px] xl:text-[11px]">{label}</span>
      {delta && (
        <span className="mt-1 flex w-full flex-col items-center justify-center rounded-lg bg-[#fff3bf] px-1 py-0.5 text-center leading-tight xl:min-h-9">
          <span className="text-[10px] font-extrabold text-[#12315f]">Plan anterior</span>
          <span className="text-[12px] font-black tabular-nums text-[#1e40af]">{delta}</span>
        </span>
      )}
      {!delta && <span aria-hidden="true" className="hidden xl:mt-1 xl:block xl:min-h-9 xl:w-full" />}
    </div>
  );
}

function PlanCard({ plan, prev, current, busy, testMode, cta, onChoose, focused }) {
  const [expandedPerk, setExpandedPerk] = useState(null);
  const active = current === plan.key;
  const disabled = busy || (cta ? cta.disabled : active);
  const label = cta ? cta.label : active ? 'Es tu plan' : testMode ? 'Probar este plan' : plan.priceClp === 0 ? 'Usar Común' : 'Elegir este plan';
  const perks = perksOf(plan, prev);
  return (
    <article data-plan={plan.key} className={`${focused ? '' : 'scale-[0.96] opacity-60 xl:scale-100 xl:opacity-100'} relative flex w-[84vw] max-w-[22rem] shrink-0 snap-center flex-col rounded-3xl bg-white p-5 xl:w-auto xl:max-w-none xl:shrink shadow-[0_14px_30px_-20px_rgba(18,49,95,0.55),0_2px_4px_rgba(18,49,95,0.06)] transition-[transform,box-shadow,opacity] duration-300 ${EASE} xl:p-3.5 2xl:p-4 [@media(hover:hover)]:xl:hover:-translate-y-1 ${active ? 'ring-4 ring-[#facc15]' : 'ring-1 ring-[#12315f]/10'}`}>
      {active && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#facc15] px-3 py-1 text-xs font-black text-[#12315f] shadow-sm">Tu plan</span>}
      <div className="flex items-center gap-3 xl:min-h-[56px] xl:gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black leading-tight text-[#12315f] xl:text-lg">{plan.name}</h2>
          <p className="text-xs font-semibold leading-snug text-slate-500 xl:text-[11px]">{TAGLINES[plan.key]}</p>
        </div>
        <span className={`ml-auto flex size-12 shrink-0 items-center justify-center rounded-2xl ${TONES[plan.key]}`}>
          <img src={PLAN_MARKS[plan.key]} alt="" aria-hidden="true" className="size-14 max-w-none object-contain" />
        </span>
      </div>

      <p className="mt-4 flex items-baseline gap-1 text-[#12315f] xl:mt-2 xl:min-h-[48px]">
        <span className="text-4xl font-black tracking-tight xl:text-3xl 2xl:text-4xl">{price(plan.priceClp)}</span>
        {plan.priceClp > 0 && <span className="text-sm font-bold text-slate-500">al mes</span>}
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose(plan)}
        className={`mt-3 flex min-h-12 items-center justify-center rounded-2xl px-4 text-center text-[15px] font-extrabold leading-tight shadow-[0_3px_8px_rgba(18,49,95,0.28)] transition-[background-color,transform,box-shadow] duration-200 ${EASE} [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:shadow-[0_8px_16px_rgba(18,49,95,0.32)] active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 disabled:hover:translate-y-0 disabled:hover:scale-100 xl:min-h-10 xl:text-sm ${active ? 'bg-[#facc15] text-[#12315f] disabled:bg-[#facc15]' : 'bg-[#1e40af] text-white hover:bg-[#1e3a8a] disabled:bg-slate-200 disabled:text-slate-500'}`}
      >
        {busy ? <><ButtonSpinner /><span className="ml-2">Procesando…</span></> : label}
      </button>

      <div className="mt-3 flex items-stretch gap-2 xl:mt-2">
        <Stat value={count(plan.folders)} label={plan.folders === null ? 'carpetas en total' : plan.folders === 1 ? 'carpeta en total' : 'carpetas en total'} delta={comparison(plan.folders, prev?.folders)} />
        <Stat value={count(plan.uniqueCardsPerFolder)} label="cartas únicas por carpeta" delta={comparison(plan.uniqueCardsPerFolder, prev?.uniqueCardsPerFolder)} />
        <Stat value={count(plan.copiesPerCard)} label="copias por carta" delta={comparison(plan.copiesPerCard, prev?.copiesPerCard)} />
      </div>

      <p className="mb-1.5 mt-4 flex items-center text-sm font-black text-[#12315f] xl:mt-2 xl:min-h-10 xl:text-sm">{prev ? `Mejoras frente a ${prev.name}` : 'Incluye:'}</p>
      <ul className="flex flex-1 flex-col gap-1 xl:gap-0.5">
        {perks.map((perk) => {
          const isExpanded = expandedPerk === perk.key;
          const detailId = `plan-${plan.key}-perk-${perk.key}`;
          return (
            <li key={perk.key} className="rounded-xl">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailId}
                onClick={() => setExpandedPerk(isExpanded ? null : perk.key)}
                className={`flex min-h-9 w-full items-start gap-1.5 rounded-lg px-1 py-1 text-left text-sm leading-snug transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] xl:min-h-7 xl:py-0.5 xl:text-[13px] xl:leading-snug ${isExpanded ? 'bg-blue-50 text-[#12315f] ring-1 ring-inset ring-[#1e40af]/25' : ''} ${perk.isNew && prev ? 'font-bold text-[#12315f]' : 'font-medium text-slate-500'}`}
              >
                {perk.isNew && prev ? <UpgradeMark /> : <SvgIcon name="check_circle" translate="no" aria-hidden="true" className="mt-px shrink-0 text-[18px] text-emerald-500 xl:text-[16px]" />}
                <span className="min-w-0 flex-1">{perk.text}</span>
                <SvgIcon name="expand_more" translate="no" aria-hidden="true" className={`mt-px shrink-0 text-[20px] text-[#12315f] transition-transform duration-300 motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              <div
                id={detailId}
                aria-hidden={!isExpanded}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="mx-2 mb-1 mt-0.5 rounded-xl border-l-4 border-[#facc15] bg-[#fff8dc] px-3 py-2.5 text-sm font-semibold leading-relaxed text-[#12315f] shadow-sm">
                  {PERK_DETAILS[perk.key]}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

// Planes en tarjetas amables. En pantallas anchas se ven los cinco juntos; en las demás se desliza de lado (con imán) y el selector de arriba sigue al dedo.
export default function PlanCards({ plans, current, focus, onFocus, busyKey, testMode, ctaFor, onChoose }) {
  const focusKey = plans.some((item) => item.key === focus) ? focus : plans[0]?.key;
  const trackRef = useRef(null);
  const frameRef = useRef(0);
  const guideUntilRef = useRef(0);
  const [swiped, setSwiped] = useState(false);

  const centerOn = useCallback((key, behavior) => {
    const track = trackRef.current;
    const card = track?.querySelector(`[data-plan="${key}"]`);
    if (!track || !card || track.scrollWidth <= track.clientWidth) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior });
  }, []);

  const centeredKey = () => {
    const track = trackRef.current;
    if (!track) return null;
    const middle = track.scrollLeft + track.clientWidth / 2;
    let best = null;
    let bestGap = Infinity;
    track.querySelectorAll('[data-plan]').forEach((card) => {
      const gap = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
      if (gap < bestGap) { bestGap = gap; best = card.dataset.plan; }
    });
    return best;
  };

  // Si el plan destacado cambia por otra razón que tu dedo (cargan los datos o la sesión), la fila se centra en él sin animación
  useEffect(() => {
    if (!plans.length || Date.now() < guideUntilRef.current) return;
    if (centeredKey() !== focusKey) centerOn(focusKey, 'instant');
  }, [plans.length, focusKey, centerOn]);

  const onScroll = () => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      if (Date.now() < guideUntilRef.current) return; // mientras el selector guía el movimiento, no lo contradice
      const best = centeredKey();
      if (best && best !== focusKey) onFocus(best);
    });
  };

  const pick = (key) => {
    guideUntilRef.current = Date.now() + 600;
    onFocus(key);
    centerOn(key, 'smooth');
  };

  return (
    <section aria-label="Planes" className="mt-7 xl:mt-4">
      <div role="tablist" aria-label="Elige un plan" className="mx-auto mb-2 grid max-w-xl grid-cols-5 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#12315f]/10 xl:hidden">
        {plans.map((plan) => {
          const on = plan.key === focusKey;
          return (
            <button
              key={plan.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(plan.key)}
              className={`flex min-w-0 flex-col items-center rounded-xl px-0.5 py-2 transition-[background-color,color,transform] duration-200 ${EASE} active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${on ? 'bg-[#12315f] text-white' : 'text-[#12315f] hover:bg-blue-50'}`}
            >
              <span className="max-w-full truncate text-[11px] font-black sm:text-sm">{plan.name}</span>
              <span className={`text-[11px] font-bold tabular-nums sm:text-xs ${on ? 'text-[#facc15]' : 'text-slate-500'}`}>{price(plan.priceClp)}</span>
            </button>
          );
        })}
      </div>

      <p aria-hidden="true" className={`mb-3 flex items-center justify-center gap-1 text-xs font-extrabold text-[#12315f]/70 transition-opacity duration-300 xl:hidden ${swiped ? 'opacity-0' : 'opacity-100'}`}>
        <SvgIcon name="chevron_left" translate="no" className="plans-nudge-left text-[18px]" />
        Desliza para ver los planes
        <SvgIcon name="chevron_right" translate="no" className="plans-nudge-right text-[18px]" />
      </p>

      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={() => setSwiped(true)}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[8vw] pb-4 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-7 sm:px-[calc(50%-11rem)] xl:mx-0 xl:grid xl:snap-none xl:grid-cols-5 xl:items-stretch xl:gap-3 xl:overflow-visible xl:px-0 xl:pb-0 2xl:gap-4"
      >
        {plans.map((plan, index) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            prev={plans[index - 1]}
            current={current}
            busy={busyKey === plan.key}
            testMode={testMode}
            cta={ctaFor(plan)}
            onChoose={onChoose}
            focused={plan.key === focusKey}
          />
        ))}
      </div>
    </section>
  );
}
