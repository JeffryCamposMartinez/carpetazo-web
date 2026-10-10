import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { Dot, EmptyState, ErrorBox, ROW, Spinner, relativeTime } from './shared';

// Cada acción tiene un nombre claro y un color de franja según qué tipo de decisión fue
const ACTIONS = {
  'decision.dismiss': { label: 'Descartó el reporte', tone: 'bg-slate-400' },
  'decision.hide': { label: 'Ocultó el contenido', tone: 'bg-amber-500' },
  'decision.remove': { label: 'Quitó el contenido', tone: 'bg-red-600' },
  'decision.restore': { label: 'Restauró el contenido', tone: 'bg-emerald-600' },
  'decision.sanction': { label: 'Aplicó una medida', tone: 'bg-red-600' },
  'auto.hide': { label: 'Ocultado automáticamente', tone: 'bg-purple-500' },
  'scan.blocked': { label: 'Imagen rechazada por el escaneo', tone: 'bg-purple-500' },
  'phash.blocked': { label: 'Imagen rechazada por huella prohibida', tone: 'bg-purple-500' },
  'phash.banned': { label: 'Huella de imagen prohibida', tone: 'bg-purple-500' },
  'retention.run': { label: 'Limpieza automática de datos', tone: 'bg-slate-300' },
  'sanction.applied': { label: 'Medida aplicada', tone: 'bg-red-600' },
  'sanction.requested': { label: 'Cierre de cuenta solicitado', tone: 'bg-red-600' },
  'sanction.approved': { label: 'Cierre de cuenta aprobado', tone: 'bg-red-600' },
  'sanction.revoked': { label: 'Medida levantada', tone: 'bg-emerald-600' },
  'sanction.expired': { label: 'Medida vencida', tone: 'bg-slate-300' },
  'appeal.created': { label: 'Apelación recibida', tone: 'bg-[#1e40af]' },
  'appeal.accepted': { label: 'Apelación aceptada', tone: 'bg-emerald-600' },
  'appeal.rejected': { label: 'Apelación rechazada', tone: 'bg-slate-500' },
  'case.opened': { label: 'Caso de estafa abierto', tone: 'bg-rose-500' },
  'case.exported': { label: 'Informe de caso exportado', tone: 'bg-[#12315f]' },
  'evidence.viewed': { label: 'Vio una evidencia', tone: 'bg-slate-400' },
  'role.changed': { label: 'Cambió un rol del equipo', tone: 'bg-[#12315f]' },
  note: { label: 'Nota interna', tone: 'bg-slate-400' }
};

const dayLabel = (iso) => {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (day.toDateString() === today.toDateString()) return 'Hoy';
  if (day.toDateString() === yesterday.toDateString()) return 'Ayer';
  return new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(day);
};
const clock = (iso) => new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// Registro de todas las acciones de moderación: solo se agrega, nunca se edita
export default function AuditPanel() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api.getModerationAudit(page)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) { setData({ entries: [], pages: 1 }); setError(err.message || 'No se pudo cargar la auditoría.'); } });
    return () => { cancelled = true; };
  }, [page]);

  // Las entradas se agrupan por día: en un registro importa cuándo pasó, no la fecha repetida en cada línea
  const groups = useMemo(() => {
    const map = new Map();
    for (const entry of data?.entries || []) {
      const key = dayLabel(entry.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    return [...map.entries()];
  }, [data]);

  if (!data) return <Spinner label="Cargando auditoría" />;

  return (
    <section aria-label="Auditoría" className="mx-auto max-w-3xl">
      <p className="mb-3 px-1 text-sm text-slate-600">Todo lo que se decide en moderación queda aquí, con quién lo hizo. No se puede editar ni borrar.</p>
      <ErrorBox>{error}</ErrorBox>
      {data.entries.length === 0 ? (
        <EmptyState icon="history" title="Todavía no hay acciones">Cuando alguien decida un reporte o aplique una medida, quedará registrado en esta lista.</EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, entries]) => (
            <div key={day}>
              <h2 className="mb-2 px-1 text-sm font-bold capitalize text-slate-500">{day}</h2>
              <ul className="space-y-2">
                {entries.map((entry) => {
                  const action = ACTIONS[entry.action] || { label: entry.action, tone: 'bg-slate-300' };
                  return (
                    <li key={entry.id} className={`${ROW} p-3.5`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 items-start gap-2.5 text-[15px] font-extrabold leading-snug text-[#12315f]"><Dot tone={action.tone} className="!mt-[6px]" />{action.label}</p>
                        <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString('es-CL')} className="shrink-0 pt-0.5 text-xs text-slate-500">{clock(entry.createdAt)}</time>
                      </div>
                      {entry.note && <p className="mt-1 whitespace-pre-line break-words text-sm leading-snug text-slate-600">{entry.note}</p>}
                      <p className="mt-1.5 text-xs text-slate-500"><span className="font-bold text-slate-600">{entry.actor}</span>{entry.targetType ? <span className="ml-3">sobre {entry.targetType}</span> : null}<span className="ml-3">{relativeTime(entry.createdAt)}</span></p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-11 rounded-full bg-white px-5 text-sm font-bold text-[#12315f] ring-1 ring-slate-300 disabled:opacity-40">Anterior</button>
          <span className="text-sm font-semibold text-slate-600">Página {page} de {data.pages}</span>
          <button type="button" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)} className="h-11 rounded-full bg-white px-5 text-sm font-bold text-[#12315f] ring-1 ring-slate-300 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </section>
  );
}
