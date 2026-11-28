import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

// Lo que puede hacer cada persona del equipo: el dueño marca casillas. Nadie del equipo ve plan, banco, ajustes, informes ni el equipo.
export const PERMISSIONS = [
  { value: 'sales', label: 'Ventas en persona', hint: 'Registra ventas en el local', icon: 'point_of_sale' },
  { value: 'pickups', label: 'Retiros en tienda', hint: 'Prepara y entrega reservas', icon: 'shopping_bag' },
  { value: 'stock', label: 'Stock y precios', hint: 'Cambia cantidades y precios', icon: 'inventory_2' },
  { value: 'folders', label: 'Editar carpetas', hint: 'Cambia el estado de las cartas y las quita', icon: 'folder_managed' }
];
export const permissionsText = (list) => (list?.length ? PERMISSIONS.filter((p) => list.includes(p.value)).map((p) => p.label).join(' · ') : 'Sin permisos');

export function PermissionChecks({ value, onChange, disabled }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {PERMISSIONS.map((p) => {
        const on = value.includes(p.value);
        return (
          <label key={p.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#1e40af] ${on ? 'border-[#1e40af] bg-blue-50' : 'border-slate-200 bg-white hover:border-[#1e40af]/40 hover:bg-blue-50/50'} ${disabled ? 'opacity-60' : ''}`}>
            <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(p.value)} className="sr-only" />
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${on ? 'bg-[#1e40af] text-white' : 'bg-slate-100 text-slate-500'}`}><SvgIcon name={on ? 'check' : p.icon} className="text-lg" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#12315f]">{p.label}</span><span className="block text-xs text-slate-600">{p.hint}</span></span>
          </label>
        );
      })}
    </div>
  );
}

function MemberRow({ member, busy, onSave, onRemove }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(member.permissions || []);
  const changed = draft.slice().sort().join() !== (member.permissions || []).slice().sort().join();
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-[#1e40af]"><SvgIcon name="person" className="text-xl" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-[#1a2b4b]">{member.name || `@${member.username}`}</span>
          <span className="block text-xs text-slate-600">{member.status === 'active' ? 'Activo' : 'Invitación pendiente'} · {permissionsText(member.permissions)}</span>
        </span>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="h-9 shrink-0 rounded-full px-3 text-xs font-bold text-[#1e40af] transition hover:bg-blue-50 active:scale-[0.97]">{open ? 'Cerrar' : 'Permisos'}</button>
        <button type="button" disabled={busy} onClick={onRemove} className="h-9 shrink-0 rounded-full px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 active:scale-[0.97] disabled:opacity-50">{member.status === 'active' ? 'Revocar' : 'Cancelar'}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <PermissionChecks value={draft} onChange={setDraft} disabled={busy} />
          <button type="button" disabled={busy || !changed || !draft.length} onClick={async () => { if (await onSave(draft)) setOpen(false); }} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1e40af] px-4 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner tone="dark" />}Guardar permisos</button>
        </div>
      )}
    </li>
  );
}

// Equipo de la tienda: invitar por usuario marcando lo que puede hacer, cambiar sus permisos y revocar.
export default function StoreTeamPanel({ showToast }) {
  const [members, setMembers] = useState(null);
  const [username, setUsername] = useState('');
  const [permissions, setPermissions] = useState(['sales', 'pickups']);
  const [busy, setBusy] = useState(null);
  useEffect(() => { api.getStoreTeam().then((r) => setMembers(r.members || [])).catch(() => setMembers([])); }, []);

  const invite = async (event) => {
    event.preventDefault();
    setBusy('invite');
    try {
      const r = await api.inviteStoreMember({ username: username.replace(/^@/, '').trim(), permissions });
      setMembers((list) => [...(list || []), { ...r.member, name: '' }]);
      setUsername('');
      showToast('Invitación enviada. La persona la acepta desde Mi tienda', 'success');
    } catch (error) { showToast(error.message || 'No se pudo invitar', 'error'); } finally { setBusy(null); }
  };
  const save = async (m, next) => {
    setBusy(m.id);
    try { const r = await api.updateStoreMember(m.id, next); setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, permissions: r.permissions } : x))); showToast('Permisos guardados', 'success'); return true; } catch (error) { showToast(error.message || 'No se pudo guardar', 'error'); return false; } finally { setBusy(null); }
  };
  const remove = async (m) => {
    setBusy(m.id);
    try { await api.removeStoreMember(m.id); setMembers((list) => list.filter((x) => x.id !== m.id)); showToast('Acceso revocado', 'success'); } catch (error) { showToast(error.message || 'No se pudo revocar', 'error'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={invite} className="rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.45)] ring-1 ring-slate-900/5">
        <h4 className="font-black text-[#1a2b4b]">Invitar a alguien</h4>
        <p className="mb-3 text-[13px] text-slate-600">Marca lo que puede hacer. Nunca ve tus datos bancarios, tu plan, ajustes, informes ni el equipo.</p>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 focus-within:border-[#1e40af] focus-within:ring-2 focus-within:ring-[#1e40af]/20">
          <span className="font-bold text-slate-400">@</span>
          <input value={username} onChange={(e) => setUsername(e.target.value.slice(0, 40))} placeholder="usuario" aria-label="Usuario de la persona" autoCapitalize="none" autoCorrect="off" className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-slate-800 outline-none focus:ring-0" />
        </div>
        <div className="mt-3"><PermissionChecks value={permissions} onChange={setPermissions} disabled={busy === 'invite'} /></div>
        <button type="submit" disabled={busy === 'invite' || username.trim().length < 3 || !permissions.length} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#1e40af] px-5 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{busy === 'invite' && <ButtonSpinner tone="dark" />}Invitar</button>
      </form>

      {!members ? <LoadingState variant="compact" label="Cargando tu equipo" /> : members.length === 0 ? (
        <p className="px-1 text-sm text-slate-600">Todavía no tienes equipo. Invita a quien atiende la caja o lleva el inventario.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.45)] ring-1 ring-slate-900/5">
          {members.map((m) => <MemberRow key={m.id} member={m} busy={busy === m.id} onSave={(next) => save(m, next)} onRemove={() => remove(m)} />)}
        </ul>
      )}
    </div>
  );
}
