import { useCallback, useEffect, useRef, useState } from 'react';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

const ICONS = { free: 'style', enthusiast: 'local_fire_department', premium: 'workspace_premium', pro: 'diamond', store: 'storefront' };
const TONES = {
  free: 'bg-slate-100 text-slate-600',
  enthusiast: 'bg-emerald-100 text-emerald-700',
  premium: 'bg-amber-100 text-amber-700',
  pro: 'bg-violet-100 text-violet-700',
  store: 'bg-sky-100 text-sky-700'
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

// Lo que trae el plan, y cuáles son novedades respecto al plan anterior (`isNew`).
function perksOf(plan, prev) {
  const boostLabel = ['', 'Prioridad en los listados', 'Mayor prioridad en los listados'];
  const list = [
    { key: 'wishlist', on: true, isNew: !prev || prev.wishlistLists !== plan.wishlistLists || prev.wishlistItems !== plan.wishlistItems, text: `${plan.wishlistLists} ${plan.wishlistLists === 1 ? 'lista' : 'listas'} de deseos de ${plan.wishlistItems} cartas` },
    { key: 'social', on: true, isNew: !prev || prev.socialLinks !== plan.socialLinks, text: `${plan.socialLinks} ${plan.socialLinks === 1 ? 'red social' : 'redes sociales'} en tu perfil` },
    { key: 'featured', on: true, isNew: !prev || prev.featuredCards !== plan.featuredCards, text: `${plan.featuredCards} cartas destacadas` },
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

function Stat({ value, label, up }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl px-1 py-2.5 text-center ${up ? 'bg-[#fff3bf]' : 'bg-blue-50'}`}>
      <span className="text-2xl font-black leading-none text-[#12315f]">{value}</span>
      <span className="mt-1 text-[11px] font-bold leading-tight text-slate-600">{label}</span>
    </div>
  );
}

function PlanCard({ plan, prev, current, busy, testMode, cta, onChoose, focused }) {
  const active = current === plan.key;
  const disabled = busy || (cta ? cta.disabled : active);
  const label = cta ? cta.label : active ? 'Es tu plan' : testMode ? 'Probar este plan' : plan.priceClp === 0 ? 'Usar Free' : 'Elegir este plan';
  const perks = perksOf(plan, prev);
  const up = (key) => Boolean(prev) && prev[key] !== plan[key];
  return (
    <article data-plan={plan.key} className={`${focused ? '' : 'scale-[0.96] opacity-60 xl:scale-100 xl:opacity-100'} relative flex w-[84vw] max-w-[22rem] shrink-0 snap-center flex-col rounded-3xl bg-white p-5 xl:w-auto xl:max-w-none xl:shrink shadow-[0_14px_30px_-20px_rgba(18,49,95,0.55),0_2px_4px_rgba(18,49,95,0.06)] transition-[transform,box-shadow,opacity] duration-300 ${EASE} xl:p-4 2xl:p-5 [@media(hover:hover)]:xl:hover:-translate-y-1 ${active ? 'ring-4 ring-[#facc15]' : 'ring-1 ring-[#12315f]/10'}`}>
      {active && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#facc15] px-3 py-1 text-xs font-black text-[#12315f] shadow-sm">Tu plan</span>}
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TONES[plan.key]}`}><SvgIcon name={ICONS[plan.key]} translate="no" className="text-[26px]" /></span>
        <div className="min-w-0">
          <h2 className="text-xl font-black leading-tight text-[#12315f]">{plan.name}</h2>
          <p className="text-xs font-semibold leading-snug text-slate-500">{TAGLINES[plan.key]}</p>
        </div>
      </div>

      <p className="mt-4 flex items-baseline gap-1 text-[#12315f]">
        <span className="text-4xl font-black tracking-tight">{price(plan.priceClp)}</span>
        {plan.priceClp > 0 && <span className="text-sm font-bold text-slate-500">al mes</span>}
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose(plan)}
        className={`mt-4 flex min-h-12 items-center justify-center rounded-2xl px-4 text-center text-[15px] font-extrabold leading-tight shadow-[0_3px_8px_rgba(18,49,95,0.28)] transition-[background-color,transform] duration-150 ${EASE} active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 ${active ? 'bg-[#facc15] text-[#12315f] disabled:bg-[#fff3bf]' : 'bg-[#1e40af] text-white hover:bg-[#1e3a8a] disabled:bg-slate-200 disabled:text-slate-500'}`}
      >
        {busy ? <><ButtonSpinner /><span className="ml-2">Procesando…</span></> : label}
      </button>

      <div className="mt-5 flex gap-2">
        <Stat value={count(plan.folders)} label={plan.folders === null ? 'carpetas sin límite' : plan.folders === 1 ? 'carpeta' : 'carpetas'} up={up('folders')} />
        <Stat value={count(plan.uniqueCardsPerFolder)} label={plan.uniqueCardsPerFolder === null ? 'cartas sin límite' : 'cartas únicas por carpeta'} up={up('uniqueCardsPerFolder')} />
        <Stat value={count(plan.copiesPerCard)} label={plan.copiesPerCard === null ? 'copias sin límite' : 'copias por carta'} up={up('copiesPerCard')} />
      </div>

      <p className="mb-2 mt-5 text-sm font-black text-[#12315f]">{prev ? `Todo lo de ${prev.name}, más:` : 'Incluye:'}</p>
      <ul className="flex flex-1 flex-col gap-2">
        {perks.map((perk) => (
          <li key={perk.key} className={`flex items-start gap-2 text-sm leading-snug ${perk.isNew && prev ? 'font-bold text-[#12315f]' : 'font-medium text-slate-500'}`}>
            <SvgIcon name={perk.isNew && prev ? 'add_circle' : 'check_circle'} translate="no" aria-hidden="true" className={`mt-px shrink-0 text-[18px] ${perk.isNew && prev ? 'text-[#d97706]' : 'text-emerald-500'}`} />
            <span>{perk.text}</span>
          </li>
        ))}
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
    <section aria-label="Planes" className="mt-7">
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
