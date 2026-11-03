import { useMemo } from 'react';
import useReferencePrices from './useReferencePrices';

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Pokémon: una carta con varios acabados con precio (Normal, Reverse Holofoil…) pasa a ser una carta por acabado.
// El primero (Normal, o el más barato) es la carta de siempre y no guarda acabado; los demás llevan `finish` y no tienen imagen propia.
// `extra`: cartas fuera de la lista (la elegida) cuyas ediciones también hay que consultar.
export default function useFinishSplit(cards, game, extra = []) {
  const { variantsFor, source, byGroup, rate } = useReferencePrices(extra.length ? [...extra, ...cards] : cards, game);
  const split = useMemo(() => cards.flatMap((card) => {
    const variants = variantsFor(card);
    if (game !== 'pokemon' || !variants || variants.length < 2) return [card];
    const base = variants.find((variant) => variant.name === 'Normal') || variants[0];
    const baseProductId = String(card.baseProductId || card.tcgProductId || card.productId || card.id);
    return [base, ...variants.filter((variant) => variant !== base)].map((variant) => (variant === base
      ? { ...card, baseProductId, finish: '', finishLabel: variant.name }
      : { ...card, id: `${card.id}~${slug(variant.name)}`, baseProductId, finish: variant.name, finishLabel: variant.name, imageUrl: '', images: undefined, noImage: true }));
  }), [cards, byGroup, rate]); // eslint-disable-line react-hooks/exhaustive-deps
  return { cards: split, variantsFor, source };
}
