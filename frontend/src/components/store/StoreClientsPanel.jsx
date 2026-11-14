import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import LiquidTabs from '../ui/LiquidTabs';

const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';
const KINDS = [{ value: 'percent', label: '% descuento' }, { value: 'fixed', label: '$ descuento' }];

function Announce({ showToast }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api.announceToFollowers(message);
      showToast(`Aviso enviado a ${r.sent} ${r.sent === 1 ? 'seguidor' : 'seguidores'}`, 'success');
      setMessage('');
    } catch (error) { showToast(error.message || 'No se pudo enviar', 'error'); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-black text-[#1a2b4b]">Avisar a tus seguidores</h4>
      <p className="mb-2 text-xs text-slate-500">Una vez al día. Les llega por correo y notificación. Al publicar un evento también les avisamos.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Llegó la nueva colección: 20% en sobres este fin de semana" className={field} />
        <button type="button" disabled={message.trim().length < 5 || busy} onClick={send} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#1e40af] px-4 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner tone="dark" />}Enviar aviso</button>
      </div>
    </section>
  );
}

function Coupons({ showToast }) {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ code: '', kind: 'percent', value: '', minTotal: '', maxUses: '', endsAt: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.getStoreCoupons().then((r) => setList(r.coupons || [])).catch(() => setList([])); }, []);
  const create = async () => {
    setBusy(true);
    try {
      const r = await api.createStoreCoupon({ ...form, value: Number(form.value), minTotal: form.minTotal === '' ? 0 : Number(form.minTotal), maxUses: form.maxUses === '' ? null : Number(form.maxUses), endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:00`).toISOString() : null, maxPerUser: 1 });
      setList((l) => [r.coupon, ...(l || [])]);
      setForm({ code: '', kind: 'percent', value: '', minTotal: '', maxUses: '', endsAt: '' });
      showToast('Cupón creado', 'success');
    } catch (error) { showToast(error.message || 'No se pudo crear', 'error'); } finally { setBusy(false); }
  };
  const toggle = async (c) => {
    try { await api.setStoreCouponActive(c.id, !c.active); setList((l) => l.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x))); } catch (error) { showToast(error.message || 'No se pudo cambiar', 'error'); }
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-black text-[#1a2b4b]">Cupones</h4>
      <p className="mb-2 text-xs text-slate-500">Valen en pedidos de tus carpetas (por mensaje, WhatsApp o retiro). Cada persona puede usarlo una vez y el descuento lo calcula Carpetazo.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) })} placeholder="CÓDIGO" aria-label="Código" className={`${field} font-bold uppercase tracking-wider`} />
        <LiquidTabs ariaLabel="Tipo de descuento" layout="inline" options={KINDS} value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} className="inline-flex rounded-xl bg-slate-100 p-1" buttonClassName="h-8 flex-1 rounded-lg px-2 text-xs font-bold" indicatorClassName="rounded-lg bg-[#1e40af]" indicatorStyle={{ top: 4, bottom: 4 }} activeTextClassName="text-white" inactiveTextClassName="text-slate-600" />
        <input type="number" min={1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.kind === 'percent' ? '10 (%)' : '2000 ($)'} aria-label="Valor" className={field} />
        <input type="number" min={0} value={form.minTotal} onChange={(e) => setForm({ ...form, minTotal: e.target.value })} placeholder="Compra mínima $ (opcional)" aria-label="Compra mínima" className={field} />
        <input type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Usos máximos (opcional)" aria-label="Usos máximos" className={field} />
        <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} aria-label="Vence el" className={field} />
      </div>
      <div className="mt-2 flex justify-end"><button type="button" disabled={busy || form.code.length < 3 || !form.value} onClick={create} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#facc15] px-4 text-sm font-black text-[#12315f] transition hover:bg-yellow-300 active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner />}Crear cupón</button></div>
      {!list ? <LoadingState variant="compact" label="Cargando cupones" /> : list.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span><span className="font-mono font-black tracking-wider text-[#12315f]">{c.code}</span> · {c.kind === 'percent' ? `${c.value}%` : formatCLP(c.value)}{c.minTotal ? ` desde ${formatCLP(c.minTotal)}` : ''} · {c.uses}{c.maxUses ? `/${c.maxUses}` : ''} usos{c.endsAt ? ` · hasta ${new Date(c.endsAt).toLocaleDateString('es-CL')}` : ''}</span>
              <button type="button" onClick={() => toggle(c)} className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold ${c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{c.active ? 'Activo' : 'Pausado'}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Demand() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.getStoreDemand().then((r) => setRows(r.demand || [])).catch(() => setRows([])); }, []);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-black text-[#1a2b4b]">Cartas más buscadas</h4>
      <p className="mb-2 text-xs text-slate-500">Cuántas personas tienen cada carta en su lista de deseos (desde 2). Nunca mostramos quiénes.</p>
      {!rows ? <LoadingState variant="compact" label="Calculando demanda" /> : !rows.length ? <p className="text-sm text-slate-500">Todavía no hay cartas con suficiente demanda.</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((d) => (
            <li key={d.tcgId} className="flex items-center gap-3 py-2">
              {d.imageUrl ? <img src={d.imageUrl} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover" /> : <span className="h-12 w-9 shrink-0 rounded bg-slate-100" />}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#1a2b4b]">{d.name}</span><span className="block text-xs text-slate-500">{d.game}{d.stock !== null ? ` · tienes ${d.stock}` : ' · no la tienes publicada'}</span></span>
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-[#1e40af]">{d.count} la buscan</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Clientes: avisos a seguidores, cupones y demanda
export default function StoreClientsPanel({ showToast }) {
  return <div className="space-y-4"><Announce showToast={showToast} /><Coupons showToast={showToast} /><Demand /></div>;
}
