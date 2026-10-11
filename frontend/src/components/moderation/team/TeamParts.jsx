import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { ErrorBox, dateOnly } from '../shared';

export const RANKS = {
  4: { label: 'Propietario', tone: 'bg-[#facc15] text-[#12315f]', blurb: 'La cuenta original de Carpetazo. Está protegida: nadie puede cambiar su rol, suspenderla, cerrarla ni ocultar su contenido.' },
  3: { label: 'Administrador', tone: 'bg-[#12315f] text-white', blurb: 'Acceso total. Puede dar y quitar roles, suspender o cerrar cuentas del equipo (salvo la del propietario) y ver todos los datos.' },
  2: { label: 'Moderador', tone: 'bg-blue-100 text-[#1e40af]', blurb: 'Decide sobre reportes y aplica medidas a las personas, con límites de tiempo.' },
  1: { label: 'Soporte', tone: 'bg-slate-200 text-slate-700', blurb: 'Solo lectura: revisa reportes, casos y apelaciones.' },
  0: { label: 'Sin rol de equipo', tone: 'bg-slate-100 text-slate-600', blurb: '' }
};
export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador', help: 'Acceso total a Moderación y a los datos de las personas.' },
  { value: 'moderator', label: 'Moderador', help: 'Decide sobre reportes y aplica medidas.' },
  { value: 'support', label: 'Soporte', help: 'Solo lectura.' },
  { value: 'user', label: 'Sin rol de equipo', help: 'Deja de ser parte del equipo y pierde el acceso a Moderación.' }
];

// Foto de la persona (o su inicial): en grande para no equivocarse de cuenta
export function Avatar({ person, size = 'h-14 w-14', text = 'text-xl' }) {
  const [failed, setFailed] = useState(false);
  const initial = (person.name || person.username || '?').charAt(0).toUpperCase();
  return person.photoURL && !failed
    ? <img src={person.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full bg-slate-100 object-cover ring-2 ring-white shadow`} />
    : <span aria-hidden="true" className={`${size} ${text} flex shrink-0 items-center justify-center rounded-full bg-[#1e40af] font-extrabold text-white ring-2 ring-white shadow`}>{initial}</span>;
}

export const RankBadge = ({ person }) => {
  const rank = RANKS[person.isOwner ? 4 : { admin: 3, moderator: 2, support: 1 }[person.role] ?? 0];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${rank.tone}`}>
      {person.isOwner && <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[14px]">verified_user</span>}
      {rank.label}
    </span>
  );
};

export const RestrictionBadge = ({ restriction }) => (restriction ? (
  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold text-red-800">
    <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[14px]">block</span>
    {restriction.type === 'ban' ? 'Cuenta cerrada' : restriction.until ? `Suspendida hasta ${dateOnly(restriction.until)}` : 'Suspendida'}
  </span>
) : null);

export const since = (person) => `En Carpetazo desde ${dateOnly(person.createdAt)}${person.comuna ? ` · ${person.comuna}` : ''}`;

// Acciones sobre una persona del equipo. Cada una pide dos pasos: 1) elegir y ver a quién; 2) escribir su usuario para confirmar.
export const ACTIONS = {
  role: { title: 'Cambiar rol', tone: 'bg-[#12315f]', confirm: 'Cambiar rol', icon: 'badge' },
  suspend: { title: 'Suspender cuenta', tone: 'bg-amber-600', confirm: 'Suspender', icon: 'pause_circle' },
  close: { title: 'Cerrar cuenta', tone: 'bg-red-600', confirm: 'Cerrar cuenta', icon: 'block' },
  restore: { title: 'Restaurar cuenta', tone: 'bg-emerald-600', confirm: 'Restaurar', icon: 'restore' }
};

export function ActionDialog({ person, action, initialRole = '', onClose, onRun }) {
  const meta = ACTIONS[action];
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(initialRole);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  useBodyScrollLock();

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  useEffect(() => { if (step === 2) inputRef.current?.focus(); }, [step]);

  const needsReason = action !== 'role';
  const reasonOk = !needsReason || reason.trim().length >= 5;
  const formOk = action === 'role' ? Boolean(role) : reasonOk;
  const matches = typed.trim().replace(/^@/, '').toLowerCase() === person.username.toLowerCase();
  const roleLabel = ROLE_OPTIONS.find((option) => option.value === role)?.label;
  const summary = action === 'role' ? `Rol: ${RANKS[person.isOwner ? 4 : { admin: 3, moderator: 2, support: 1 }[person.role] ?? 0].label} → ${roleLabel}`
    : action === 'suspend' ? `Suspensión ${days === 'none' ? 'hasta nuevo aviso' : `por ${days} días`}: ${reason.trim()}`
      : action === 'close' ? `Cierre de la cuenta: ${reason.trim()}` : `Restauración: ${reason.trim()}`;

  const run = async () => {
    setBusy(true);
    setError('');
    try { await onRun({ role, reason: reason.trim(), days: days === 'none' ? null : Number(days), confirmUsername: typed.trim() }); } catch (err) { setError(err.message || 'No se pudo completar.'); setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#08122a]/70 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="action-title" className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <p className="text-xs font-extrabold text-slate-500">{meta.title} · Paso {step} de 2</p>
        <div className="mt-3 flex flex-col items-center text-center">
          <Avatar person={person} size="h-24 w-24" text="text-4xl" />
          <h2 id="action-title" className="mt-3 text-xl font-extrabold text-[#12315f]">{person.name || person.username}</h2>
          <p className="text-sm font-bold text-[#1e40af]">@{person.username}</p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500"><RankBadge person={person} /><RestrictionBadge restriction={person.restriction} /></p>
          <p className="mt-1 text-xs text-slate-500">{since(person)}</p>
        </div>

        {step === 1 ? (
          <>
            {action === 'role' && (
              <fieldset className="mt-4 space-y-2">
                <legend className="mb-1 text-sm font-extrabold text-[#12315f]">¿Qué rol tendrá?</legend>
                {ROLE_OPTIONS.filter((option) => option.value !== person.role).map((option) => (
                  <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${role === option.value ? 'border-[#1e40af] bg-[#f3f7ff]' : 'border-[#dbe3f0]'}`}>
                    <input type="radio" name="role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} className="mt-1 h-4 w-4 accent-[#1e40af]" />
                    <span><span className="block text-sm font-extrabold text-[#12315f]">{option.label}</span><span className="block text-xs text-slate-600">{option.help}</span></span>
                  </label>
                ))}
                {role === 'admin' && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200"><strong>Un administrador tiene acceso total.</strong> Puede ver los datos de las personas y suspender o cerrar cuentas del equipo. Dalo solo a alguien de absoluta confianza.</p>}
                {person.role === 'admin' && role && role !== 'admin' && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">Perderá el acceso de administrador de inmediato.</p>}
              </fieldset>
            )}
            {action === 'suspend' && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-extrabold text-[#12315f]">Duración
                  <select value={days} onChange={(event) => setDays(event.target.value)} className="mt-1 h-12 w-full rounded-xl border-2 border-[#dbe3f0] bg-white px-3 text-base font-semibold text-[#12315f]">
                    <option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="none">Hasta nuevo aviso</option>
                  </select>
                </label>
                <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">Pierde el acceso a Moderación y no puede escribir en la plataforma; su perfil y sus carpetas se pausan.</p>
              </div>
            )}
            {action === 'close' && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-900 ring-1 ring-red-200"><strong>Es la medida más grave.</strong> La cuenta queda cerrada y sin rol de equipo. Si se restaura, el rol hay que darlo de nuevo a propósito.</p>}
            {needsReason && (
              <label className="mt-3 block text-sm font-extrabold text-[#12315f]">{action === 'restore' ? 'Motivo de la restauración' : 'Motivo (queda en la auditoría)'}
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={action === 'restore' ? 500 : 300} placeholder="Mínimo 5 caracteres" className="mt-1 w-full rounded-xl border-2 border-[#dbe3f0] p-3 text-base font-medium text-[#12315f] focus:border-[#1e40af] focus:outline-none" />
              </label>
            )}
            <p className="mt-3 text-center text-sm font-semibold text-slate-700">¿Es esta la persona correcta? Mira bien su foto y su usuario.</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={onClose} className="h-12 rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700 transition-transform duration-150 active:scale-[0.97]">Cancelar</button>
              <button type="button" disabled={!formOk} onClick={() => setStep(2)} className="h-12 rounded-full bg-[#12315f] text-sm font-extrabold text-white transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-40">Continuar</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-center text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{summary}</p>
            <label htmlFor="action-confirm" className="mt-3 block text-center text-sm font-semibold text-slate-700">Para confirmar, escribe su usuario: <strong className="text-[#12315f]">@{person.username}</strong></label>
            <input id="action-confirm" ref={inputRef} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck="false" placeholder={`@${person.username}`} className="mt-2 h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-center text-base font-bold text-[#12315f] focus:border-[#1e40af] focus:outline-none" />
            <ErrorBox>{error}</ErrorBox>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} onClick={() => { setStep(1); setTyped(''); setError(''); }} className="h-12 rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700 transition-transform duration-150 active:scale-[0.97] disabled:opacity-50">Volver</button>
              <button type="button" disabled={!matches || busy} onClick={run} className={`h-12 rounded-full ${meta.tone} text-sm font-extrabold text-white transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-40`}>{busy ? 'Guardando…' : meta.confirm}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
