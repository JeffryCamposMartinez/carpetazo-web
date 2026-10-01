import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

const ACTION_LABELS = {
  'decision.dismiss': 'Descartó el reporte',
  'decision.hide': 'Ocultó el contenido',
  'decision.remove': 'Quitó el contenido',
  'decision.restore': 'Restauró el contenido',
  'auto.hide': 'Ocultado automático (sistema)',
  note: 'Nota interna'
};

const dateTime = (iso) => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

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

  if (!data) return <div className="flex justify-center py-10" role="status" aria-label="Cargando auditoría"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>;

  return (
    <section aria-label="Auditoría">
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}
      {data.entries.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5">Todavía no hay acciones registradas.</p>
      ) : (
        <ul className="space-y-2">
          {data.entries.map((entry) => (
            <li key={entry.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-900/5">
              <p className="font-extrabold text-[#12315f]">{ACTION_LABELS[entry.action] || entry.action}</p>
              <p className="text-xs font-semibold text-slate-500">{entry.actor} · {dateTime(entry.createdAt)}{entry.targetType ? ` · ${entry.targetType}` : ''}</p>
              {entry.note && <p className="mt-1 whitespace-pre-line break-words text-slate-600">{entry.note}</p>}
            </li>
          ))}
        </ul>
      )}
      {data.pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-10 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-slate-300 disabled:opacity-40">Anterior</button>
          <span className="text-sm font-semibold text-slate-600">Página {page} de {data.pages}</span>
          <button type="button" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)} className="h-10 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-slate-300 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </section>
  );
}
