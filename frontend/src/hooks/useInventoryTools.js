import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { rarityRank } from '../utils/rarityRank';

export const SORT_OPTIONS = [
  { value: 'manual', label: 'Mi orden' },
  { value: 'recent', label: 'Más recientes' },
  { value: 'name', label: 'Nombre (A-Z)' },
  { value: 'priceDesc', label: 'Precio: mayor a menor' },
  { value: 'priceAsc', label: 'Precio: menor a mayor' },
  { value: 'stockAsc', label: 'Stock: menos primero' },
  { value: 'stockDesc', label: 'Stock: más primero' },
  { value: 'rarityDesc', label: 'Rareza: la más alta primero' },
  { value: 'rarityAsc', label: 'Rareza: la más baja primero' },
  { value: 'set', label: 'Edición (A-Z)' },
  { value: 'number', label: 'Número de carta' },
];

const byText = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
const SORTERS = {
  recent: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  name: byText,
  priceDesc: (a, b) => Number(b.price || 0) - Number(a.price || 0) || byText(a, b),
  priceAsc: (a, b) => Number(a.price || 0) - Number(b.price || 0) || byText(a, b),
  stockAsc: (a, b) => Number(a.stock || 0) - Number(b.stock || 0) || byText(a, b),
  stockDesc: (a, b) => Number(b.stock || 0) - Number(a.stock || 0) || byText(a, b),
  rarityDesc: (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || byText(a, b),
  rarityAsc: (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || byText(a, b),
  set: (a, b) => String(a.set || '').localeCompare(String(b.set || ''), 'es', { sensitivity: 'base' }) || byText(a, b),
  number: (a, b) => String(a.number || '').localeCompare(String(b.number || ''), 'es', { numeric: true }) || byText(a, b),
};
const QUICK = {
  noStock: (card) => Number(card.stock || 0) <= 0,
  noPrice: (card) => Number(card.price || 0) <= 0,
};
const MAX_PRICE = 100000000;

// Herramientas del inventario de la carpeta (vista cuadrícula): orden, filtros rápidos, selección con edición en bloque,
// cambios pendientes de varias cartas y ampliar una carta. El orden del álbum (manual) no se toca.
export default function useInventoryTools({ folderId, cards, setCards, filteredCatalog, showToast }) {
  const [sortKey, setSortKey] = useState('manual');
  const [quickFilter, setQuickFilter] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState(null);

  const counts = useMemo(() => ({
    noStock: cards.filter(QUICK.noStock).length,
    noPrice: cards.filter(QUICK.noPrice).length,
  }), [cards]);

  // Vista de la cuadrícula: con otro orden o con un filtro rápido no se puede arrastrar (el orden manual quedaría confuso)
  const gridCards = useMemo(() => {
    let list = quickFilter ? filteredCatalog.filter(QUICK[quickFilter]) : filteredCatalog;
    if (sortKey !== 'manual') list = [...list].sort(SORTERS[sortKey]);
    return list;
  }, [filteredCatalog, quickFilter, sortKey]);
  const dragEnabled = sortKey === 'manual' && !quickFilter && !selecting;

  // --- Cambios pendientes por carta (precio, stock o idioma escritos y sin guardar) ---
  const draftsRef = useRef({});
  const [draftCount, setDraftCount] = useState(0);
  const onDraftChange = useCallback((cardId, draft) => {
    if (draft) draftsRef.current[cardId] = draft; else delete draftsRef.current[cardId];
    setDraftCount(Object.keys(draftsRef.current).length);
  }, []);

  const applyLocal = (updates) => {
    const map = new Map(updates.map((item) => [item.id, item]));
    setCards((previous) => previous.map((card) => {
      const change = map.get(card.id);
      if (!change) return card;
      return {
        ...card,
        ...(change.price !== undefined ? { price: change.price } : {}),
        ...(change.stock !== undefined ? { stock: change.stock } : {}),
        ...(change.language ? { language: change.language, data: { ...(card.data || {}), language: change.language } } : {}),
      };
    }));
  };

  const run = async (task, failMessage) => {
    if (busy) return false;
    setBusy(true);
    try {
      await task();
      return true;
    } catch (error) {
      showToast(error.message || failMessage, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Deja el orden elegido (con TODAS las cartas de la carpeta, sin filtros) como el orden de la carpeta:
  // es el que ve el público ("Orden del vendedor") y el del álbum. Después se puede seguir ajustando arrastrando.
  const saveSortAsFolderOrder = async () => {
    if (sortKey === 'manual' || !SORTERS[sortKey]) return false;
    const ordered = [...cards].sort(SORTERS[sortKey]);
    const ok = await run(async () => {
      await api.saveFolderOrder(folderId, ordered.map((card) => card.id));
      const position = new Map(ordered.map((card, index) => [card.id, index]));
      setCards((previous) => previous.map((card) => ({ ...card, catalogOrder: position.get(card.id) ?? card.catalogOrder, data: { ...(card.data || {}), catalogOrder: position.get(card.id) ?? card.data?.catalogOrder } })));
    }, 'No se pudo guardar el orden de la carpeta.');
    if (ok) {
      setSortKey('manual');
      showToast('Orden guardado: así verán tu carpeta los compradores', 'success');
    }
    return ok;
  };

  const saveDrafts = async () => {
    const updates = Object.entries(draftsRef.current).map(([id, draft]) => ({
      id,
      price: Number(draft.price),
      stock: Number(draft.stock),
      ...(draft.language ? { language: draft.language } : {}),
    }));
    if (updates.length === 0) return false;
    const invalid = updates.some((item) => !Number.isFinite(item.price) || item.price < 0 || item.price > MAX_PRICE || !Number.isInteger(item.stock) || item.stock < 0);
    if (invalid) { showToast('Revisa el precio y el stock: deben ser números sin negativos ni decimales en el stock.', 'error'); return false; }
    return run(async () => {
      const res = await api.updateCardsBulk(folderId, updates);
      applyLocal(updates);
      draftsRef.current = {};
      setDraftCount(0);
      if (res.skipped) showToast(`${res.count} cambios guardados. ${res.skipped} carta(s) están ocultas por moderación y no se editaron.`, 'info');
      else showToast(`${updates.length} ${updates.length === 1 ? 'cambio guardado' : 'cambios guardados'}`, 'success');
    }, 'No se pudieron guardar los cambios');
  };

  // --- Selección ---
  const startSelecting = () => { setSelecting(true); setSelectedIds(new Set()); };
  const stopSelecting = () => { setSelecting(false); setSelectedIds(new Set()); };
  const toggleSelected = useCallback((cardId) => setSelectedIds((previous) => {
    const next = new Set(previous);
    if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
    return next;
  }), []);
  const selectAllVisible = () => setSelectedIds(new Set(gridCards.map((card) => card.id)));
  const clearSelected = () => setSelectedIds(new Set());

  const finishBulk = (message) => { showToast(message, 'success'); stopSelecting(); };

  const setValues = ({ price, stock }) => run(async () => {
    const updates = [...selectedIds].map((id) => ({ id, ...(price !== undefined ? { price } : {}), ...(stock !== undefined ? { stock } : {}) }));
    const res = await api.updateCardsBulk(folderId, updates);
    applyLocal(updates);
    finishBulk(res.skipped ? `${res.count} cartas actualizadas. ${res.skipped} están ocultas por moderación.` : `${res.count} ${res.count === 1 ? 'carta actualizada' : 'cartas actualizadas'}`);
  }, 'No se pudieron actualizar las cartas');

  // Sube o baja el precio de cada carta seleccionada un porcentaje, redondeado a pesos enteros
  const adjustPrices = (percent) => run(async () => {
    const updates = cards.filter((card) => selectedIds.has(card.id) && Number(card.price || 0) > 0)
      .map((card) => ({ id: card.id, price: Math.min(MAX_PRICE, Math.max(0, Math.round(Number(card.price) * (1 + percent / 100)))) }));
    if (updates.length === 0) { showToast('Ninguna de las cartas seleccionadas tiene precio.', 'info'); return; }
    const res = await api.updateCardsBulk(folderId, updates);
    applyLocal(updates);
    finishBulk(`Precio ajustado en ${res.count} ${res.count === 1 ? 'carta' : 'cartas'}`);
  }, 'No se pudo ajustar el precio');

  const removeSelected = () => run(async () => {
    const res = await api.deleteCardsBulk(folderId, [...selectedIds]);
    setCards((previous) => previous.filter((card) => !selectedIds.has(card.id)));
    finishBulk(`${res.count} ${res.count === 1 ? 'carta eliminada' : 'cartas eliminadas'}`);
  }, 'No se pudieron eliminar las cartas');

  const moveSelected = (targetFolderId, targetName) => run(async () => {
    const res = await api.moveCardsBulk(folderId, [...selectedIds], targetFolderId);
    setCards((previous) => previous.filter((card) => !selectedIds.has(card.id)));
    finishBulk(`${res.count} ${res.count === 1 ? 'carta movida' : 'cartas movidas'} a ${targetName}`);
  }, 'No se pudieron mover las cartas');

  return {
    busy, counts, dragEnabled, draftCount, gridCards, onDraftChange, previewId, quickFilter, saveDrafts, saveSortAsFolderOrder, selectedIds, selecting,
    setPreviewId, setQuickFilter, setSortKey, sortKey, startSelecting, stopSelecting, toggleSelected, selectAllVisible, clearSelected,
    setValues, adjustPrices, removeSelected, moveSelected,
  };
}
