import { useState } from 'react';
import { api } from '../../services/api';
import { ButtonSpinner } from '../ui/LoadingState';

// Cupón de la tienda en el carrito: se revisa en el servidor (que vuelve a calcularlo al crear el pedido)
export default function CouponField({ folderId, applied, setApplied, cart, currentUser, formatCLP }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!currentUser) return <p className="mb-3 text-xs font-semibold text-slate-500">¿Tienes un cupón? Inicia sesión para usarlo.</p>;

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.checkCoupon({ folderId, code, items: cart.map((i) => ({ id: i.id, quantity: i.quantity })) });
      if (r.valid) setApplied({ code: r.code, discount: r.discount, total: r.total });
      else setError(r.message);
    } catch (e) {
      setError(e.message || 'No se pudo revisar el cupón');
    } finally { setBusy(false); }
  };

  if (applied) {
    return (
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200">
        <span className="font-bold text-emerald-800">Cupón {applied.code}: −{formatCLP(applied.discount)} · total {formatCLP(applied.total)}</span>
        <button type="button" onClick={() => { setApplied(null); setCode(''); }} className="text-xs font-bold text-emerald-900 underline">Quitar</button>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))} placeholder="Código de cupón" aria-label="Código de cupón" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-bold uppercase tracking-wider text-slate-800 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20" />
        <button type="button" disabled={code.length < 3 || busy} onClick={apply} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#12315f] px-4 text-sm font-black text-white transition hover:bg-[#1e40af] active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner tone="dark" />}Aplicar</button>
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
