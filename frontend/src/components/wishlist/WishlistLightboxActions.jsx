import { useEffect, useState } from 'react';

const roundButton = 'flex h-11 w-11 items-center justify-center rounded-full transition-[background-color,transform] duration-150 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-40';
const field = 'h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-base text-white placeholder-white/50 focus:border-[#facc15] focus:outline-none focus:ring-2 focus:ring-[#facc15]/40';

// Botones bajo la carta en pantalla completa: cantidad, detalles (precio máximo y nota) y quitar de la lista
export default function WishlistLightboxActions({ item, busy, onQuantity, onSaveDetails, onRemove }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ maxPrice: '', note: '', priceVisible: false });

  // Al pasar a otra carta, los detalles vuelven a cerrarse
  useEffect(() => { setOpen(false); }, [item.id]);

  const toggle = () => {
    if (!open) setDraft({ maxPrice: item.maxPrice != null ? String(item.maxPrice) : '', note: item.note || '', priceVisible: Boolean(item.priceVisible) });
    setOpen((value) => !value);
  };
  const save = async () => { if (await onSaveDetails(item, draft)) setOpen(false); };

  return (
    <div className="w-full space-y-2.5">
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center rounded-full bg-white/10">
          <button type="button" aria-label="Quitar una copia" disabled={busy || item.quantity <= 1} onClick={() => onQuantity(item, -1)} className={`${roundButton} hover:bg-white/15`}>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">remove</span>
          </button>
          <span className="w-9 text-center text-base font-extrabold tabular-nums" aria-label={`${item.quantity} copias`}>{item.quantity}</span>
          <button type="button" aria-label="Agregar una copia" disabled={busy || item.quantity >= 99} onClick={() => onQuantity(item, 1)} className={`${roundButton} hover:bg-white/15`}>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">add</span>
          </button>
        </div>
        <button type="button" onClick={toggle} aria-expanded={open} className="h-11 rounded-full bg-white/10 px-4 text-sm font-bold transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Detalles</button>
        <button type="button" aria-label={`Quitar ${item.name} de mi lista`} disabled={busy} onClick={() => onRemove(item)} className={`${roundButton} bg-white/10 hover:bg-red-500/30`}>
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">delete</span>
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 rounded-2xl bg-white/10 p-3 text-left">
          <label className="block text-sm font-bold text-white/80">
            Precio máximo por copia (CLP)
            <input type="number" inputMode="numeric" min="0" max="100000000" value={draft.maxPrice} onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })} placeholder="Sin precio máximo" className={`${field} mt-1`} />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-white/90">
            <input type="checkbox" checked={draft.priceVisible} disabled={draft.maxPrice.trim() === ''} onChange={(event) => setDraft({ ...draft, priceVisible: event.target.checked })} className="h-5 w-5 rounded border-white/30" />
            Mostrar este precio a quien vea mi perfil
          </label>
          <label className="block text-sm font-bold text-white/80">
            Nota (opcional)
            <input type="text" maxLength={140} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="En español, edición Imperio, estado NM…" className={`${field} mt-1`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-full border border-white/30 text-sm font-bold transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Cancelar</button>
            <button type="button" disabled={busy} onClick={save} className="h-11 flex-[1.4] rounded-full bg-[#facc15] text-sm font-extrabold text-[#12315f] transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">Guardar detalles</button>
          </div>
        </div>
      )}
    </div>
  );
}
