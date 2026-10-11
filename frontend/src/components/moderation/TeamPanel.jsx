import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { EmptyState, ErrorBox, Spinner, dateOnly } from './shared';

const ROLE = {
  admin: { label: 'Administrador', tone: 'bg-[#12315f] text-white' },
  moderator: { label: 'Moderador', tone: 'bg-blue-100 text-[#1e40af]' },
  support: { label: 'Soporte', tone: 'bg-slate-200 text-slate-700' },
  user: { label: 'Usuario', tone: 'bg-slate-100 text-slate-600' }
};

// Foto de la persona (o su inicial): en grande para no equivocarse de cuenta
function Avatar({ person, size = 'h-14 w-14', text = 'text-xl' }) {
  const [failed, setFailed] = useState(false);
  const initial = (person.name || person.username || '?').charAt(0).toUpperCase();
  return person.photoURL && !failed
    ? <img src={person.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full bg-slate-100 object-cover ring-2 ring-white shadow`} />
    : <span aria-hidden="true" className={`${size} ${text} flex shrink-0 items-center justify-center rounded-full bg-[#1e40af] font-extrabold text-white ring-2 ring-white shadow`}>{initial}</span>;
}

const RoleBadge = ({ role }) => <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${(ROLE[role] || ROLE.user).tone}`}>{(ROLE[role] || ROLE.user).label}</span>;

function PersonRow({ person, action }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-xl border border-[#dbe3f0] bg-white p-3 sm:flex-nowrap sm:p-4">
      <Avatar person={person} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-[15px] font-extrabold leading-tight text-[#12315f]">{person.name || person.username}</p>
        <p className="truncate text-sm font-semibold text-[#1e40af]">@{person.username}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><RoleBadge role={person.role} /><span>En Carpetazo desde {dateOnly(person.createdAt)}{person.comuna ? ` · ${person.comuna}` : ''}</span></p>
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
    </li>
  );
}

// Doble confirmación: 1) ver con claridad a quién se elige y qué significa; 2) escribir su usuario para confirmar
function ConfirmDialog({ person, onClose, onDone }) {
  const [step, setStep] = useState(1);
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

  const matches = typed.trim().replace(/^@/, '').toLowerCase() === person.username.toLowerCase();
  const confirm = async () => {
    setBusy(true);
    setError('');
    try { await api.grantAdmin(person.id, typed.trim()); onDone(person); } catch (err) { setError(err.message || 'No se pudo dar el rol.'); setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#08122a]/70 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="grant-title" className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <p className="text-xs font-extrabold text-slate-500">Paso {step} de 2</p>
        <div className="mt-3 flex flex-col items-center text-center">
          <Avatar person={person} size="h-24 w-24" text="text-4xl" />
          <h2 id="grant-title" className="mt-3 text-xl font-extrabold text-[#12315f]">{person.name || person.username}</h2>
          <p className="text-sm font-bold text-[#1e40af]">@{person.username}</p>
          <p className="mt-1 text-xs text-slate-500">En Carpetazo desde {dateOnly(person.createdAt)}{person.comuna ? ` · ${person.comuna}` : ''}</p>
        </div>

        {step === 1 ? (
          <>
            <p className="mt-4 rounded-2xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
              <strong>Un administrador tiene acceso total.</strong> Puede ver los datos de las personas, aplicar y levantar medidas, cargar cartas al catálogo y dar roles de moderador. Dalo solo a alguien de absoluta confianza.
            </p>
            <p className="mt-3 text-center text-sm font-semibold text-slate-700">¿Es esta la persona correcta? Mira bien su foto y su usuario.</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={onClose} className="h-12 rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700 transition-transform duration-150 active:scale-[0.97]">Cancelar</button>
              <button type="button" onClick={() => setStep(2)} className="h-12 rounded-full bg-[#12315f] text-sm font-extrabold text-white transition-transform duration-150 active:scale-[0.97]">Sí, continuar</button>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="grant-confirm" className="mt-4 block text-center text-sm font-semibold text-slate-700">Para confirmar, escribe su usuario: <strong className="text-[#12315f]">@{person.username}</strong></label>
            <input id="grant-confirm" ref={inputRef} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck="false" placeholder={`@${person.username}`} className="mt-2 h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-center text-base font-bold text-[#12315f] focus:border-[#1e40af] focus:outline-none" />
            <ErrorBox>{error}</ErrorBox>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} onClick={() => { setStep(1); setTyped(''); setError(''); }} className="h-12 rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700 transition-transform duration-150 active:scale-[0.97] disabled:opacity-50">Volver</button>
              <button type="button" disabled={!matches || busy} onClick={confirm} className="h-12 rounded-full bg-red-600 text-sm font-extrabold text-white transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-40">{busy ? 'Guardando…' : 'Hacer administrador'}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// Equipo y administradores: quién del equipo hay hoy y cómo dar el rol de administrador a otra persona
export default function TeamPanel() {
  const [team, setTeam] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState('');
  const seq = useRef(0);

  const loadTeam = useCallback(() => api.getTeam().then((res) => setTeam(res.team)).catch((err) => setMessage(err.message || 'No se pudo cargar el equipo.')), []);
  useEffect(() => { loadTeam(); }, [loadTeam]);

  useEffect(() => {
    const term = query.trim().replace(/^@/, '');
    if (term.length < 2) { setResults(null); setSearching(false); return undefined; }
    const mine = ++seq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      api.searchTeamPeople(term).then((res) => { if (mine === seq.current) { setResults(res.people); setMessage(''); } }).catch((err) => { if (mine === seq.current) setMessage(err.message || 'No se pudo buscar.'); }).finally(() => { if (mine === seq.current) setSearching(false); });
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const granted = (person) => {
    setChosen(null);
    setDone(`@${person.username} ahora es administrador. Quedó anotado en la auditoría y se avisó por correo.`);
    setResults((previous) => previous?.map((row) => (row.id === person.id ? { ...row, role: 'admin' } : row)) || null);
    loadTeam();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ErrorBox>{message}</ErrorBox>
      {done && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><span translate="no" aria-hidden="true" className="material-symbols-outlined mt-px text-[20px]">check_circle</span>{done}</p>}

      <section aria-label="Dar el rol de administrador" className="rounded-2xl border border-[#dbe3f0] bg-white p-4 sm:p-5">
        <h3 className="text-lg font-extrabold text-[#12315f]">Hacer administrador a una persona</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Busca por usuario o nombre. Verás su foto para no equivocarte, y se te pedirá confirmar dos veces.</p>
        <div className="relative mt-3">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[22px] text-slate-400">search</span>
          <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setDone(''); }} placeholder="Escribe un usuario o nombre…" aria-label="Buscar personas" autoComplete="off" className="h-12 w-full rounded-full border-2 border-[#dbe3f0] bg-white pl-12 pr-4 text-base font-medium text-[#12315f] focus:border-[#1e40af] focus:outline-none" />
        </div>
        <div className="mt-3" aria-live="polite">
          {searching && !results && <Spinner label="Buscando" />}
          {results && results.length === 0 && <EmptyState icon="person_search" title="No encontramos a nadie">Revisa cómo está escrito el usuario o el nombre.</EmptyState>}
          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((person) => (
                <PersonRow key={person.id} person={person} action={person.role === 'admin'
                  ? <span className="block text-center text-xs font-bold text-slate-500 sm:text-right">Ya es administrador</span>
                  : <button type="button" onClick={() => setChosen(person)} className="h-12 w-full rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af] sm:h-11 sm:w-auto">Hacer administrador</button>} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Equipo actual">
        <h3 className="mb-2 text-lg font-extrabold text-[#12315f]">Equipo actual</h3>
        {!team ? <Spinner label="Cargando el equipo" /> : team.length === 0 ? <EmptyState icon="groups" title="Todavía no hay equipo" /> : <ul className="space-y-2">{team.map((person) => <PersonRow key={person.id} person={person} />)}</ul>}
      </section>

      {chosen && <ConfirmDialog person={chosen} onClose={() => setChosen(null)} onDone={granted} />}
    </div>
  );
}
