import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api';
import { formatClp } from '../../../services/tcgcsvPrices';
import { cardRatio } from '../../../utils/cardShape';
import ConfirmModal from '../../ui/ConfirmModal';
import SvgIcon from '../../ui/SvgIcon';
import { SafeImage } from '../SafeImage';

const SURFACE = 'rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.35)]';
const PRESS = 'transition-[background-color,transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';
const newRequestId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(8, '0');
const dateLabel = (value) => new Date(value).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Venta presencial: se eligen las cartas vendidas en persona, se suma el total y al confirmar baja el stock de la carpeta.
export default function InPersonSale({ folderId, cards, setCards, showToast }) {
  const [query, setQuery] = useState('');
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [picked, setPicked] = useState({}); // cardId → { quantity }
  const [finalTotalInput, setFinalTotalInput] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const requestId = useRef(newRequestId()); // se conserva si el envío falla: reintentar no registra dos veces

  const loadHistory = useCallback(() => api.getInPersonSales(folderId).then((response) => setHistory(response.sales || [])).catch(() => {}), [folderId]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const available = useMemo(() => cards.filter((card) => Number(card.stock) > 0), [cards]);
  const lines = available.filter((card) => picked[card.id]?.quantity > 0);
  const units = lines.reduce((sum, card) => sum + picked[card.id].quantity, 0);
  const subtotal = lines.reduce((sum, card) => sum + picked[card.id].quantity * Number(card.price ?? 0), 0);
  const hasFinalTotal = finalTotalInput !== null;
  const finalTotal = hasFinalTotal ? Number(finalTotalInput || 0) : subtotal;
  const total = finalTotal;
  const discount = subtotal - total;
  const invalid = lines.some((card) => card.price === null || card.price === undefined || !Number.isInteger(Number(card.price)) || Number(card.price) < 0)
    || (hasFinalTotal && (finalTotalInput === '' || !Number.isInteger(finalTotal) || finalTotal < 0 || finalTotal > 100000000));
  useEffect(() => {
    if (lines.length === 0) {
      setFinalTotalInput(null);
    }
  }, [lines.length]);
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return available.filter((card) => (!onlyPicked || picked[card.id]?.quantity > 0) && (!text || `${card.name} ${card.pseudoName || ''}`.toLowerCase().includes(text)));
  }, [available, query, onlyPicked, picked]);

  const setQuantity = (card, quantity) => setPicked((previous) => {
    const next = { ...previous };
    const value = Math.max(0, Math.min(Number(card.stock), quantity));
    if (value === 0) delete next[card.id]; else next[card.id] = { ...previous[card.id], quantity: value };
    return next;
  });

  const sell = async () => {
    setSaving(true);
    try {
      const response = await api.createInPersonSale(folderId, {
        requestId: requestId.current,
        adjustment: finalTotalInput === null ? { type: 'none', value: 0 } : { type: 'fixed', value: finalTotal },
        items: lines.map((card) => ({ cardId: card.id, quantity: picked[card.id].quantity }))
      });
      if (response.stocks && Object.keys(response.stocks).length) setCards((previous) => previous.map((card) => (card.id in response.stocks ? { ...card, stock: response.stocks[card.id] } : card)));
      showToast(`Venta registrada: ${response.sale.units} ${response.sale.units === 1 ? 'carta' : 'cartas'} por ${formatClp(response.sale.total)}`, 'success');
      setPicked({});
      setQuery('');
      setOnlyPicked(false);
      setFinalTotalInput(null);
      requestId.current = newRequestId();
      loadHistory();
    } catch (error) {
      showToast(error.message || 'No se pudo registrar la venta', 'error');
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${lines.length ? 'pb-28' : ''}`}>
      <section className={`${SURFACE} flex items-center gap-2 p-2 sm:gap-3 sm:p-2.5`} title="Toca las cartas que vendiste en persona. Al confirmar se descuentan del stock de esta carpeta; no es un pedido ni cambia los precios de mercado.">
        <h2 className="sr-only">Venta presencial: toca las cartas que vendiste en persona; al confirmar se descuentan del stock de esta carpeta</h2>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffcb05] text-[#1a2b4b]"><SvgIcon name="payments" translate="no" aria-hidden="true" className="text-[22px]" /></span>
        <div className="relative min-w-0 flex-1">
          <SvgIcon name="search" translate="no" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value.slice(0, 60))} placeholder="Buscar carta…" aria-label="Buscar carta de la carpeta" className="h-10 w-full rounded-xl border-2 border-[#12315f]/15 bg-white pl-10 pr-3 text-sm font-semibold text-[#12315f] placeholder-[#12315f]/40 outline-none focus:border-[#facc15] focus:ring-2 focus:ring-[#facc15]/25" />
        </div>
        <button type="button" aria-pressed={onlyPicked} aria-label="Solo elegidas" title="Solo elegidas" onClick={() => setOnlyPicked((value) => !value)} disabled={lines.length === 0 && !onlyPicked} className={`${PRESS} flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-bold disabled:opacity-40 ${onlyPicked ? 'border-[#12315f] bg-[#12315f] text-white' : 'border-[#12315f]/15 bg-white text-[#12315f] [@media(hover:hover)]:hover:border-[#12315f]/40'}`}>
          <SvgIcon name="check_circle" translate="no" aria-hidden="true" className="text-[20px]" /><span className="hidden sm:inline">Solo elegidas</span>
        </button>
      </section>

      {lines.length === 0 && available.length > 0 && <p className="px-1 text-xs font-semibold text-slate-600">Toca las cartas que vendiste en persona; al confirmar se descuentan de tu stock.</p>}

      {available.length === 0 ? (
        <p className={`${SURFACE} p-8 text-center text-sm font-semibold text-slate-600`}>No hay cartas con stock en esta carpeta.</p>
      ) : shown.length === 0 ? (
        <p className={`${SURFACE} p-8 text-center text-sm font-semibold text-slate-600`}>Ninguna carta coincide con lo que buscas.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((card) => {
            const quantity = picked[card.id]?.quantity || 0;
            const atMax = quantity >= Number(card.stock);
            return (
              <li key={card.id} className={`flex min-w-0 flex-col rounded-2xl bg-white p-2 transition-shadow duration-200 ${quantity ? 'shadow-[0_10px_24px_-14px_rgba(30,64,175,0.55)] ring-2 ring-[#1e40af]' : 'ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06)]'}`}>
                <button type="button" onClick={() => setQuantity(card, quantity + 1)} disabled={atMax} aria-label={`Vender una ${card.name}`} className={`${PRESS} group relative block w-full overflow-hidden rounded-xl bg-slate-50 disabled:cursor-default`} style={{ aspectRatio: cardRatio(null, '63 / 88') }}>
                  <SafeImage src={card.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#12315f]/90 px-2 py-0.5 text-[11px] font-extrabold text-white">Stock {card.stock}</span>
                  {quantity > 0 && <span className="absolute right-1.5 top-1.5 flex h-8 min-w-8 items-center justify-center rounded-full bg-[#ffcb05] px-2 font-['Space_Grotesk'] text-sm font-bold text-[#1a2b4b] shadow-md">×{quantity}</span>}
                </button>
                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-extrabold leading-snug text-[#12315f]">{card.name}</p>
                <p className="text-xs font-semibold text-slate-500">{card.price !== null && card.price !== undefined ? `${formatClp(Number(card.price))} · precio publicado` : 'Sin precio publicado'}</p>
                {quantity > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-full bg-slate-100 p-0.5">
                      <button type="button" onClick={() => setQuantity(card, quantity - 1)} aria-label={`Quitar una ${card.name}`} className={`${PRESS} flex h-10 w-10 items-center justify-center rounded-full text-[#12315f] [@media(hover:hover)]:hover:bg-white`}><SvgIcon name="remove" translate="no" aria-hidden="true" className="text-[20px]" /></button>
                      <span className="text-sm font-extrabold tabular-nums text-[#12315f]" aria-live="polite">{quantity}</span>
                      <button type="button" onClick={() => setQuantity(card, quantity + 1)} disabled={atMax} aria-label={`Agregar una ${card.name}`} className={`${PRESS} flex h-10 w-10 items-center justify-center rounded-full text-[#12315f] disabled:opacity-30 [@media(hover:hover)]:hover:bg-white`}><SvgIcon name="add" translate="no" aria-hidden="true" className="text-[20px]" /></button>
                    </div>
                    <p className="rounded-xl bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-500">{formatClp(Number(card.price || 0))} por carta</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 0 && (
        <section aria-label="Ventas presenciales anteriores" className={`${SURFACE} p-4 sm:p-5`}>
          <h3 className="text-base font-extrabold text-[#1a2b4b]">Ventas presenciales de esta carpeta</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {history.map((sale) => (
              <li key={sale.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#12315f]">{sale.units} {sale.units === 1 ? 'carta' : 'cartas'}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{(sale.items || []).map((line) => `${line.quantity}× ${line.name}`).join(', ')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-['Space_Grotesk'] text-lg font-bold tabular-nums text-[#1a2b4b]">{formatClp(sale.total)}</p>
                  {sale.subtotal !== null && sale.subtotal !== undefined && sale.discountAmount !== 0 && <p className="text-xs text-slate-500">Subtotal {formatClp(sale.subtotal)} · {sale.discountAmount > 0 ? `−${formatClp(sale.discountAmount)}` : `+${formatClp(Math.abs(sale.discountAmount))}`}{sale.adjustmentType === 'percent' ? ` (${sale.adjustmentValue}%)` : ''}</p>}
                  <p className="text-xs text-slate-500">{dateLabel(sale.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lines.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pl-3 pr-[5.5rem] md:pr-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-2 rounded-2xl bg-[#1a2b4b] p-2.5 pl-4 text-white sm:gap-3 sm:p-3 sm:pl-5 shadow-[0_1px_2px_rgba(8,18,42,0.3),0_16px_32px_-12px_rgba(8,18,42,0.8)]">
            <div className="min-w-0 text-sm text-blue-200">
              <span className="tabular-nums">{units}</span> {units === 1 ? 'carta' : 'cartas'}
              <label className="group mt-1 flex w-fit cursor-text flex-col rounded-xl border-2 border-[#ffcb05] bg-[#ffcb05]/10 px-2.5 py-1.5 transition-colors hover:bg-[#ffcb05]/20 focus-within:bg-[#ffcb05]/20 focus-within:ring-2 focus-within:ring-[#ffcb05]/40">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#ffdf70]">
                  <SvgIcon name="edit" translate="no" aria-hidden="true" className="text-[14px]" /> Toca para cambiar
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-['Space_Grotesk'] text-xl font-bold text-white sm:text-2xl">$</span>
                  <input type="number" inputMode="numeric" min="0" max="100000000" step="1" value={finalTotalInput ?? String(subtotal)} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setFinalTotalInput(event.target.value)} aria-label="Subtotal editable de la venta" className="w-36 min-w-0 border-0 bg-transparent p-0 font-['Space_Grotesk'] text-xl font-bold leading-tight tabular-nums text-white outline-none sm:text-2xl" />
                </span>
              </label>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setPicked({})} aria-label="Limpiar selección" className={`${PRESS} flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-blue-100 sm:w-auto sm:px-4 [@media(hover:hover)]:hover:bg-white/10`}><SvgIcon name="close" translate="no" aria-hidden="true" className="text-[20px] sm:hidden" /><span className="hidden sm:inline">Limpiar</span></button>
              <button type="button" disabled={invalid || saving} onClick={() => setConfirming(true)} className={`${PRESS} flex h-12 items-center gap-2 rounded-full bg-[#ffcb05] px-4 text-sm font-extrabold text-[#1a2b4b] shadow-sm disabled:opacity-50 sm:px-6`}>
                <SvgIcon name="check_circle" translate="no" aria-hidden="true" className="hidden text-[20px] sm:block" /> Vender
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirming}
        title="Registrar venta"
        message={`${units} ${units === 1 ? 'carta' : 'cartas'}. Subtotal publicado: ${formatClp(subtotal)}${discount > 0 ? `. Descuento: ${formatClp(discount)}` : ''}. Total final: ${formatClp(total)}. Se descontarán del stock de esta carpeta.`}
        confirmText={saving ? 'Registrando…' : 'Confirmar venta'}
        isDestructive={false}
        onConfirm={() => { if (!saving) sell(); }}
        onCancel={() => { if (!saving) setConfirming(false); }}
      />
    </div>
  );
}
