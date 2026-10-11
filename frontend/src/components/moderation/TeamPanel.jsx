import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { EmptyState, ErrorBox, Pills, Spinner, relativeTime } from './shared';
import { ACTIONS, ActionDialog, Avatar, RANKS, RankBadge, RestrictionBadge, since } from './team/TeamParts';

const ACTION_TEXT = {
  'role.admin_granted': 'dio el rol de administrador a',
  'role.admin_revoked': 'quitó el rol de administrador a',
  'role.changed': 'cambió el rol de',
  'team.suspended': 'suspendió la cuenta de',
  'team.closed': 'cerró la cuenta de',
  'team.restored': 'restauró la cuenta de'
};
const ACTION_ICON = { 'role.admin_granted': 'shield_person', 'role.admin_revoked': 'remove_moderator', 'role.changed': 'badge', 'team.suspended': 'pause_circle', 'team.closed': 'block', 'team.restored': 'restore' };
const PLURAL = { 3: 'Administradores', 2: 'Moderadores' };
const TABS = [['hierarchy', 'Jerarquía'], ['add', 'Agregar o buscar'], ['history', 'Historial']];

function MemberCard({ person, me, onAction }) {
  const mine = person.id === me?.id;
  const mayManage = !person.isOwner && !mine && (me?.rank || 0) >= person.rank;
  return (
    <li className={`rounded-2xl border bg-white p-4 ${person.isOwner ? 'border-[#facc15] shadow-[0_0_0_1px_#facc15]' : 'border-[#dbe3f0]'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:flex-nowrap">
        <Avatar person={person} size="h-16 w-16" text="text-2xl" />
        <div className="min-w-0 flex-1 basis-44">
          <p className="break-words text-base font-extrabold leading-tight text-[#12315f]">{person.name || person.username}{mine && <span className="ml-2 text-xs font-bold text-slate-500">(tú)</span>}</p>
          <p className="truncate text-sm font-semibold text-[#1e40af]">@{person.username}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5"><RankBadge person={person} /><RestrictionBadge restriction={person.restriction} />{person.fixedByConfig && <span title="Su rol viene de la configuración del servidor" className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">Fijado por configuración</span>}</p>
          <p className="mt-1 text-xs text-slate-500">{since(person)} · {person.actions30d} {person.actions30d === 1 ? 'acción' : 'acciones'} en 30 días{person.lastActionAt ? ` · última ${relativeTime(person.lastActionAt)}` : ''}</p>
        </div>
        {mayManage && <button type="button" onClick={() => onAction(person)} className="h-11 w-full shrink-0 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af] sm:w-auto">Gestionar</button>}
      </div>
      {person.isOwner && <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#fffbeb] p-3 text-xs leading-relaxed text-amber-900"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">lock</span>Cuenta original de Carpetazo. Está protegida: nadie puede cambiar su rol, suspenderla, cerrarla ni ocultar su contenido.</p>}
    </li>
  );
}

// Menú de lo que se puede hacer con una persona, según su estado
function ManageSheet({ person, onClose, onChoose }) {
  const isStaff = person.rank > 0;
  const restricted = Boolean(person.restriction);
  const options = [
    { action: 'role', label: isStaff ? 'Cambiar rol' : 'Dar un rol de equipo', help: isStaff ? 'Subirla o bajarla de nivel, o quitarle el rol.' : 'Hacerla administradora, moderadora o de soporte.' },
    ...(isStaff && !restricted ? [{ action: 'suspend', label: 'Suspender cuenta', help: 'Pierde el acceso al equipo y a escribir, por un tiempo.' }, { action: 'close', label: 'Cerrar cuenta', help: 'La medida más grave. Queda sin rol de equipo.', danger: true }] : []),
    ...(restricted ? [{ action: 'restore', label: 'Restaurar cuenta', help: 'Levanta la suspensión o el cierre.' }] : [])
  ];
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#08122a]/60 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Gestionar a ${person.name || person.username}`} className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3"><Avatar person={person} /><div className="min-w-0"><p className="truncate text-lg font-extrabold text-[#12315f]">{person.name || person.username}</p><p className="truncate text-sm font-bold text-[#1e40af]">@{person.username}</p><p className="mt-1 flex flex-wrap gap-1.5"><RankBadge person={person} /><RestrictionBadge restriction={person.restriction} /></p></div></div>
        {person.fixedByConfig && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">Su rol de administrador viene de la configuración del servidor: se puede suspender, pero para quitarle el rol o cerrarla hay que sacar su correo de <strong>ADMIN_EMAILS</strong>.</p>}
        <ul className="mt-4 space-y-2">
          {options.map((option) => (
            <li key={option.action}>
              <button type="button" onClick={() => onChoose(option.action)} className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${option.danger ? 'border-red-200 hover:bg-red-50' : 'border-[#dbe3f0] hover:bg-[#f3f7ff]'}`}>
                <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[24px] ${option.danger ? 'text-red-600' : 'text-[#1e40af]'}`}>{ACTIONS[option.action].icon}</span>
                <span className="min-w-0"><span className={`block text-sm font-extrabold ${option.danger ? 'text-red-700' : 'text-[#12315f]'}`}>{option.label}</span><span className="block text-xs text-slate-600">{option.help}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className="mt-4 h-12 w-full rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700">Cerrar</button>
      </div>
    </div>
  );
}

// Equipo y administradores: jerarquía, gestión de cada integrante, búsqueda de personas e historial de cambios
export default function TeamPanel() {
  const [tab, setTab] = useState('hierarchy');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [managing, setManaging] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState('');
  const seq = useRef(0);

  const load = useCallback(() => api.getTeam().then(setData).catch((err) => setMessage(err.message || 'No se pudo cargar el equipo.')), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'history') api.getTeamHistory().then((res) => setHistory(res.events)).catch((err) => setMessage(err.message || 'No se pudo cargar el historial.')); }, [tab, done]);

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

  const run = async (values) => {
    const { person, action } = dialog;
    if (action === 'role') await api.setTeamRole(person.id, values.role, values.confirmUsername);
    else if (action === 'suspend') await api.suspendTeamMember(person.id, { reason: values.reason, days: values.days, confirmUsername: values.confirmUsername });
    else if (action === 'close') await api.closeTeamMember(person.id, { reason: values.reason, confirmUsername: values.confirmUsername });
    else await api.restoreTeamMember(person.id, { note: values.reason, confirmUsername: values.confirmUsername });
    setDialog(null);
    setDone(`Listo: ${ACTIONS[action].title.toLowerCase()} para @${person.username}. Quedó en la auditoría y se avisó por correo.`);
    load();
    if (results) setResults(null);
  };

  const groups = data ? [4, 3, 2, 1].map((rank) => ({ rank, members: data.team.filter((member) => member.rank === rank) })).filter((group) => group.members.length) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Pills options={TABS} value={tab} onChange={(value) => { setTab(value); setDone(''); }} label="Secciones del equipo" />
      <ErrorBox>{message}</ErrorBox>
      {done && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><span translate="no" aria-hidden="true" className="material-symbols-outlined mt-px text-[20px]">check_circle</span>{done}</p>}

      {tab === 'hierarchy' && (!data ? <Spinner label="Cargando el equipo" /> : (
        <>
          <p className="text-sm leading-relaxed text-slate-600">Tu nivel: <strong className="text-[#12315f]">{RANKS[data.me?.rank ?? 0].label}</strong>. Los administradores pueden gestionar a todo el equipo, incluidos otros administradores, salvo la cuenta del propietario.</p>
          {groups.map((group) => (
            <section key={group.rank} aria-label={RANKS[group.rank].label}>
              <div className="mb-2"><h3 className="text-lg font-extrabold text-[#12315f]">{group.members.length > 1 ? (PLURAL[group.rank] || RANKS[group.rank].label) : RANKS[group.rank].label} <span className="text-sm font-bold text-slate-500">({group.members.length})</span></h3><p className="text-xs text-slate-500">{RANKS[group.rank].blurb}</p></div>
              <ul className="space-y-2.5">{group.members.map((member) => <MemberCard key={member.id} person={member} me={data.me} onAction={setManaging} />)}</ul>
            </section>
          ))}
        </>
      ))}

      {tab === 'add' && (
        <section aria-label="Buscar personas" className="rounded-2xl border border-[#dbe3f0] bg-white p-4 sm:p-5">
          <h3 className="text-lg font-extrabold text-[#12315f]">Buscar una persona</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">Busca por usuario o nombre. Verás su foto para no equivocarte. Desde aquí puedes darle un rol de equipo o, si su cuenta está suspendida o cerrada, restaurarla.</p>
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
                  <li key={person.id} className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-xl border border-[#dbe3f0] bg-white p-3 sm:flex-nowrap sm:p-4">
                    <Avatar person={person} />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="break-words text-[15px] font-extrabold leading-tight text-[#12315f]">{person.name || person.username}</p>
                      <p className="truncate text-sm font-semibold text-[#1e40af]">@{person.username}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5"><RankBadge person={person} /><RestrictionBadge restriction={person.restriction} /></p>
                      <p className="mt-1 text-xs text-slate-500">{since(person)}</p>
                    </div>
                    <div className="w-full sm:w-auto sm:shrink-0">
                      {person.isOwner ? <span className="block text-center text-xs font-bold text-amber-800">Cuenta protegida</span>
                        : person.id === data?.me?.id ? <span className="block text-center text-xs font-bold text-slate-500">Eres tú</span>
                          : <button type="button" onClick={() => setManaging(person)} className="h-12 w-full rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af] sm:h-11 sm:w-auto">Gestionar</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'history' && (!history ? <Spinner label="Cargando el historial" /> : history.length === 0 ? (
        <EmptyState icon="history" title="Todavía no hay cambios">Cada cambio de rol, suspensión, cierre o restauración del equipo quedará aquí.</EmptyState>
      ) : (
        <ol className="space-y-2" aria-label="Historial del equipo">
          {history.map((event) => (
            <li key={event.id} className="rounded-xl border border-[#dbe3f0] bg-white p-3.5">
              <div className="flex items-start gap-3">
                <span translate="no" aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[22px] text-[#1e40af]">{ACTION_ICON[event.action] || 'history'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-700"><strong className="text-[#12315f]">@{event.actor?.username || 'el sistema'}</strong> {ACTION_TEXT[event.action] || 'hizo un cambio en'} <strong className="text-[#12315f]">@{event.target?.username || 'una cuenta'}</strong></p>
                  {event.note && <p className="mt-1 break-words text-xs text-slate-500">{event.note}</p>}
                </div>
                <time dateTime={event.at} className="shrink-0 pt-0.5 text-xs text-slate-500">{relativeTime(event.at)}</time>
              </div>
            </li>
          ))}
        </ol>
      ))}

      {managing && !dialog && <ManageSheet person={managing} onClose={() => setManaging(null)} onChoose={(action) => { setDialog({ person: managing, action }); setManaging(null); }} />}
      {dialog && <ActionDialog person={dialog.person} action={dialog.action} onClose={() => setDialog(null)} onRun={run} />}
    </div>
  );
}
