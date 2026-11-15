import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import LiquidTabs from '../ui/LiquidTabs';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

export const ROLE_NAMES = { cashier: 'Caja', stock: 'Stock' };
const ROLE_HINT = { cashier: 'Ventas en persona y retiros en tienda', stock: 'Cantidades y precios de las cartas' };
const ROLES = [{ value: 'cashier', label: 'Caja' }, { value: 'stock', label: 'Stock' }];

// Equipo de la tienda: invitar por usuario con un rol, ver el estado y revocar. Nadie del equipo ve plan, banco, ajustes ni informes.
export default function StoreTeamPanel({ showToast }) {
  const [members, setMembers] = useState(null);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('cashier');
  const [busy, setBusy] = useState(null);
  useEffect(() => { api.getStoreTeam().then((r) => setMembers(r.members || [])).catch(() => setMembers([])); }, []);

  const invite = async (event) => {
    event.preventDefault();
    setBusy('invite');
    try {
      const r = await api.inviteStoreMember({ username: username.replace(/^@/, '').trim(), role });
      setMembers((list) => [...(list || []), { ...r.member, name: '' }]);
      setUsername('');
      showToast('Invitación enviada. La persona la acepta desde Mi tienda', 'success');
    } catch (error) { showToast(error.message || 'No se pudo invitar', 'error'); } finally { setBusy(null); }
  };
  const remove = async (m) => {
    setBusy(m.id);
    try { await api.removeStoreMember(m.id); setMembers((list) => list.filter((x) => x.id !== m.id)); showToast('Acceso revocado', 'success'); } catch (error) { showToast(error.message || 'No se pudo revocar', 'error'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={invite} className="rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.45)] ring-1 ring-slate-900/5">
        <h4 className="font-black text-[#1a2b4b]">Invitar a alguien</h4>
        <p className="mb-3 text-[13px] text-slate-600">{ROLE_HINT[role]}. Nunca ve tus datos bancarios, tu plan, ajustes ni informes.</p>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 focus-within:border-[#1e40af] focus-within:ring-2 focus-within:ring-[#1e40af]/20">
          <span className="font-bold text-slate-400">@</span>
          <input value={username} onChange={(e) => setUsername(e.target.value.slice(0, 40))} placeholder="usuario" aria-label="Usuario de la persona" autoCapitalize="none" autoCorrect="off" className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-slate-800 outline-none focus:ring-0" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <LiquidTabs ariaLabel="Rol" layout="inline" options={ROLES} value={role} onChange={setRole} className="flex flex-1 rounded-[14px] bg-slate-900/[0.06] p-[3px]" buttonClassName="h-9 flex-1 rounded-[11px] text-sm font-bold" indicatorClassName="rounded-[11px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12)]" indicatorStyle={{ top: 3, bottom: 3 }} activeTextClassName="text-[#12315f]" inactiveTextClassName="text-slate-600" />
          <button type="submit" disabled={busy === 'invite' || username.trim().length < 3} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#1e40af] px-4 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{busy === 'invite' && <ButtonSpinner tone="dark" />}Invitar</button>
        </div>
      </form>

      {!members ? <LoadingState variant="compact" label="Cargando tu equipo" /> : members.length === 0 ? (
        <p className="px-1 text-sm text-slate-600">Todavía no tienes equipo. Invita a quien atiende la caja o lleva el inventario.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.45)] ring-1 ring-slate-900/5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-[#1e40af]"><SvgIcon name={m.role === 'cashier' ? 'point_of_sale' : 'inventory_2'} className="text-xl" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-[#1a2b4b]">{m.name || `@${m.username}`}</span>
                <span className="block text-xs text-slate-500">{ROLE_NAMES[m.role]} · {m.status === 'active' ? 'Activo' : 'Invitación pendiente'}</span>
              </span>
              <button type="button" disabled={busy === m.id} onClick={() => remove(m)} className="h-9 shrink-0 rounded-full px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 active:scale-[0.97] disabled:opacity-50">{m.status === 'active' ? 'Revocar' : 'Cancelar'}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
