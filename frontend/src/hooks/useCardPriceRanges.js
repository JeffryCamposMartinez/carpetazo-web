import { useEffect, useState } from 'react';
import { fetchPokemonGroups } from '../services/tcgcsvPokemon';
import { fetchCardPriceRanges, fetchUsdClpRate, usdToClp } from '../services/tcgcsvPrices';

// Mínimo, mercado y máximo de TCGplayer (en pesos) de una carta de Pokémon, por acabado.
// La edición se encuentra por su nombre (es lo que guarda la carta). Devuelve { status, ranges }:
// status 'idle' (no aplica), 'loading' o 'ready' (ranges puede venir vacío si no hay precio).
export default function useCardPriceRanges(card, language) {
  const applies = Boolean(card && /pok[eé]mon/i.test(card.tcg || '') && card.set && card.tcgId);
  const [state, setState] = useState({ status: applies ? 'loading' : 'idle', ranges: [] });
  const cardKey = applies ? `${card.tcgId}|${card.set}|${language}` : '';

  useEffect(() => {
    if (!applies) { setState({ status: 'idle', ranges: [] }); return undefined; }
    let active = true;
    setState({ status: 'loading', ranges: [] });
    const lang = /jap/i.test(language || '') ? 'ja' : 'en';
    (async () => {
      try {
        const [groups, rate] = await Promise.all([fetchPokemonGroups(lang), fetchUsdClpRate()]);
        const group = groups.find((item) => item.name === card.set);
        if (!group || !rate) { if (active) setState({ status: 'ready', ranges: [] }); return; }
        const usd = await fetchCardPriceRanges(lang === 'ja' ? 85 : 3, group.groupId, card.tcgId);
        const toClp = (value) => (value ? usdToClp(value, rate) : null);
        if (active) setState({ status: 'ready', ranges: usd.map((range) => ({ name: range.name, low: toClp(range.low), market: toClp(range.market), high: toClp(range.high) })) });
      } catch (_error) {
        if (active) setState({ status: 'ready', ranges: [] });
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  return state;
}
