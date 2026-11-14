import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import useFinishSplit from '../../hooks/useFinishSplit';
import FinishRibbon from '../ui/FinishRibbon';
import LiquidTabs from '../ui/LiquidTabs';
import SvgIcon from '../ui/SvgIcon';
import { LANG_CODE, LANG_NAME, LANG_ORDER, cardId, shownName } from './pickCard';

// «Selecciona tu carta»: hoja inferior del escáner de cartas de una carpeta. La persona elige la impresión exacta (y su idioma) de la carta reconocida.
// pick = { options, loading, lang }; onManual (opcional) muestra «Buscar manualmente».
export default function PickCardSheet({ pick, onClose, onChoose, onLang, onManual }) {
  // Pokémon: cada impresión se abre en una opción por acabado (Normal, Holofoil, Reverse Holofoil…) según los precios de TCGplayer; el resto de juegos no cambia
  const isPokemon = LANG_CODE[pick?.options?.[0]?.categoryId] !== undefined;
  const prints = useMemo(() => (isPokemon ? pick.options.map((card) => ({ ...card, id: cardId(card), tcgProductId: card.productId, catId: card.categoryId })) : []), [pick?.options, isPokemon]); // eslint-disable-line react-hooks/exhaustive-deps
  const { cards: finishes } = useFinishSplit(prints, isPokemon ? 'pokemon' : 'none');
  const options = isPokemon ? finishes : pick?.options || [];
  const pickLangs = pick ? LANG_ORDER.filter((code) => options.some((card) => LANG_CODE[card.categoryId] === code)) : [];
  const pickTabs = pickLangs.length > 1 ? [{ value: 'all', label: `Todos (${options.length})` }, ...pickLangs.map((code) => ({ value: code, label: `${LANG_NAME[code]} (${options.filter((card) => LANG_CODE[card.categoryId] === code).length})` }))] : [];
  const listRef = useRef(null);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [pick?.lang]); // al cambiar de idioma la lista vuelve arriba
  const pickShown = pick ? (pick.lang === 'all' ? options : options.filter((card) => LANG_CODE[card.categoryId] === pick.lang)) : [];
  return (
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {pick && (
            <>
              <motion.button key="pick-backdrop" type="button" aria-label="Cerrar sin agregar" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-[40] cursor-default bg-[#08122a]/70 backdrop-blur-[2px] focus:outline-none" />
              <motion.div key="pick-sheet" role="dialog" aria-modal="true" aria-labelledby="pick-title" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', duration: 0.42, bounce: 0.08 }} className="absolute inset-x-0 bottom-0 z-[41] mx-auto flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[32px] bg-[#f3f7ff] text-[#12315f] shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.65)]">
                <div className="shrink-0 border-b-4 border-[#facc15] bg-[#12315f] px-5 pb-4 pt-2.5 text-white">
                  <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/30" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id="pick-title" className="flex items-center gap-2 text-[22px] font-black leading-tight"><SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="shrink-0 text-[24px] text-[#facc15]" />Selecciona tu carta</h2>
                      <p className="mt-0.5 text-sm font-medium text-blue-100">{pick.loading ? 'Buscando todas las impresiones…' : `Toca la impresión exacta · ${pickShown.length} ${pickShown.length === 1 ? 'opción' : 'opciones'}`}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar sin agregar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                      <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[22px]" />
                    </button>
                  </div>
                </div>
                {pickTabs.length > 0 && (
                  <div className="shrink-0 px-4 pt-3">
                    <LiquidTabs
                      ariaLabel="Idioma de la carta"
                      layout="inline"
                      options={pickTabs}
                      value={pick.lang}
                      onChange={onLang}
                      className="gap-0.5 overflow-x-auto rounded-[18px] border border-blue-100 bg-white p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      buttonClassName="shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-bold"
                      indicatorClassName="rounded-xl border-b-[3px] border-[#b88f00] bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.55)]"
                      activeTextClassName="text-[#1a1400]"
                      inactiveTextClassName="text-[#12315f]/70 hover:text-[#12315f]"
                    />
                  </div>
                )}
                <ul ref={listRef} className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-4 pb-4 pt-3 sm:grid-cols-3">
                  {pickShown.map((card, index) => {
                    const best = cardId(card) === cardId(pick.options[0]) && !card.finish;
                    const code = LANG_CODE[card.categoryId];
                    // Español sin foto propia: se muestra la de la misma impresión en inglés, avisándolo
                    const standIn = !card.image && card.categoryId === 100 ? pick.options.find((other) => other.categoryId === 3 && other.productId === card.productId)?.image : null;
                    const picture = card.image || standIn;
                    return (
                      <li key={`${cardId(card)}~${card.finish || ''}`}>
                        <button type="button" onClick={() => onChoose(card)} aria-label={`Agregar ${shownName(card.name)}, ${[card.set, card.number && `número ${card.number}`, code && LANG_NAME[code], card.finishLabel].filter(Boolean).join(', ')}`} className={`group flex h-full w-full flex-col rounded-2xl border bg-white p-2 text-left shadow-[0_6px_16px_-10px_rgba(18,49,95,0.5)] transition-[transform,box-shadow,border-color] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:border-[#1e40af] [@media(hover:hover)]:hover:shadow-[0_10px_22px_-10px_rgba(30,64,175,0.55)] ${best ? 'border-[#facc15] ring-2 ring-[#facc15]/70' : 'border-blue-100'}`}>
                          <span className="relative block aspect-[63/88] w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                            {picture ? <img src={picture} alt="" loading={index < 6 ? 'eager' : 'lazy'} className={`h-full w-full object-cover ${standIn ? 'opacity-80 saturate-75' : ''}`} /> : <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-bold text-slate-400">Sin imagen</span>}
                            {standIn && <span className="absolute inset-x-0 bottom-0 bg-[#12315f]/85 px-1.5 py-1 text-center text-[10px] font-bold leading-tight text-white">Foto en inglés</span>}
                            {card.finish && <FinishRibbon finish={card.finish} />}
                            {best && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#facc15] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1a1400] shadow">Más parecida</span>}
                            {code && <span className="absolute right-1.5 top-1.5 rounded-md bg-[#12315f]/90 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white ring-1 ring-white/20">{code}</span>}
                          </span>
                          <span className="mt-2 block text-[15px] font-black leading-snug">{shownName(card.name)}</span>
                          <span className="mt-0.5 block text-[13px] font-bold leading-snug text-[#1e40af]">{card.set || 'Edición'}</span>
                          <span className="mt-0.5 block text-xs font-semibold text-slate-500">{[card.number && `#${card.number}`, card.rarity, card.finishLabel].filter(Boolean).join(' · ')}</span>
                        </button>
                      </li>
                    );
                  })}
                  {pick.loading && [0, 1].map((n) => <li key={`sk${n}`} aria-hidden="true" className="rounded-2xl border border-blue-100 bg-white p-2"><span className="block aspect-[63/88] w-full animate-pulse rounded-xl bg-blue-100/70 motion-reduce:animate-none" /><span className="mt-2 block h-4 w-3/4 animate-pulse rounded bg-blue-100/70 motion-reduce:animate-none" /><span className="mt-1.5 block h-3 w-1/2 animate-pulse rounded bg-blue-100/70 motion-reduce:animate-none" /></li>)}
                </ul>
                <div className="shrink-0 border-t border-blue-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center">
                  <p className="text-[16px] font-black">¿No ves tu carta?</p>
                  {onManual && (
                    <button type="button" onClick={onManual} className="mt-2.5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] text-[17px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(30,64,175,0.8)] transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#1a3a9c]"><SvgIcon name="search" translate="no" aria-hidden="true" className="text-[22px] text-[#facc15]" />Buscar manualmente</button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </MotionConfig>
  );
}
