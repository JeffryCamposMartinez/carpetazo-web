import { useEffect, useMemo, useState } from 'react';
import { fetchCarpetazoPrices } from '../services/carpetazoPrices';
import { fetchGroupPrices, fetchUsdClpRate, usdToClp } from '../services/tcgcsvPrices';

const MYL_BATCH = 60;
const mylId = (card) => String(card.productId || card.id || card.tcgProductId || '');
const catOf = (card) => card.catId || (card.cardLanguage === 'Japanese' ? 85 : 3);

// Precio referencial en pesos de las cartas a la vista.
// Pokémon: precio de mercado de TCGplayer (TCGCSV) convertido con el dólar. Mitos y Leyendas: mediana de lo que piden los vendedores en Carpetazo.
// `variantsFor(card)` devuelve null mientras carga, [] si no hay referencia, o [{ name, clp, note? }].
// `source` dice de dónde sale el precio ('tcgplayer' | 'carpetazo').
export default function useReferencePrices(cards, game) {
  const [byGroup, setByGroup] = useState({});
  const [rate, setRate] = useState(null);
  const [myl, setMyl] = useState({});
  const pokemon = game === 'pokemon' || game === 'onepiece' || game === 'magic' || game === 'riftbound' || game === 'yugioh'; // precio de mercado de TCGplayer
  const isMyl = game === 'myl';

  useEffect(() => {
    if (!pokemon) return undefined;
    let active = true;
    fetchUsdClpRate().then((value) => { if (active) setRate(value); });
    return () => { active = false; };
  }, [pokemon]);

  // Pokémon: ediciones distintas de las cartas a la vista
  const groups = useMemo(() => {
    if (!pokemon) return [];
    const seen = new Map();
    cards.forEach((card) => { if (card.groupId) seen.set(`${catOf(card)}-${card.groupId}`, { catId: catOf(card), groupId: card.groupId }); });
    return [...seen.entries()].map(([key, value]) => ({ key, ...value }));
  }, [cards, pokemon]);
  const missingGroups = groups.filter((group) => !byGroup[group.key]).map((group) => group.key).join(',');

  useEffect(() => {
    // Las respuestas se guardan en caché por edición, así que no se cancelan al seguir buscando
    groups.filter((group) => !byGroup[group.key]).forEach((group) => {
      fetchGroupPrices(group.catId, group.groupId)
        .then((prices) => setByGroup((prev) => ({ ...prev, [group.key]: prices })))
        .catch(() => { /* sin precio: la carta se muestra igual */ });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingGroups]);

  // Mitos y Leyendas: se piden en lotes las cartas que aún no se consultaron
  const missingMyl = isMyl ? [...new Set(cards.map(mylId).filter((id) => id && !(id in myl)))] : [];
  const missingMylKey = missingMyl.join(',');
  useEffect(() => {
    if (!missingMylKey) return;
    const ids = missingMylKey.split(',');
    for (let start = 0; start < ids.length; start += MYL_BATCH) {
      const batch = ids.slice(start, start + MYL_BATCH);
      fetchCarpetazoPrices(batch)
        .then((prices) => setMyl((prev) => ({ ...prev, ...Object.fromEntries(batch.map((id) => [id, prices[id] || null])) })))
        .catch(() => setMyl((prev) => ({ ...prev, ...Object.fromEntries(batch.map((id) => [id, null])) })));
    }
  }, [missingMylKey]);

  const variantsFor = (card) => {
    if (!card) return null;
    if (isMyl) {
      const id = mylId(card);
      if (!(id in myl)) return null;
      if (!myl[id]) return [];
      return [myl[id].sales
        ? { name: 'Precio de venta', clp: myl[id].clp, note: `${myl[id].sales} ventas`, from: 'sales' }
        : { name: 'Precio publicado', clp: myl[id].clp, note: `${myl[id].sellers} vendedores`, from: 'sellers' }];
    }
    if (!pokemon || !card.groupId || !rate) return null;
    const prices = byGroup[`${catOf(card)}-${card.groupId}`];
    if (!prices) return null;
    return (prices.get(String(card.tcgProductId || card.id)) || []).map((variant) => ({ name: variant.name, clp: usdToClp(variant.usd, rate) }));
  };
  return { variantsFor, source: isMyl ? 'carpetazo' : 'tcgplayer' };
}
