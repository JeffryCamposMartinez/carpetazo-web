import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';

const SEVERITY = {
  S1: { label: 'Crítica', className: 'bg-red-600 text-white' },
  S2: { label: 'Alta', className: 'bg-orange-500 text-white' },
  S3: { label: 'Media', className: 'bg-amber-300 text-amber-950' },
  S4: { label: 'Baja', className: 'bg-slate-200 text-slate-700' }
};
const STATUS = {
  open: { label: 'Pendiente', className: 'bg-blue-100 text-blue-800' },
  actioned: { label: 'Con medida', className: 'bg-emerald-100 text-emerald-800' },
  dismissed: { label: 'Descartado', className: 'bg-slate-200 text-slate-700' }
};
const STATUS_TABS = [['open', 'Pendientes'], ['actioned', 'Con medida'], ['dismissed', 'Descartados'], ['all', 'Todos']];
const TYPE_LABELS = {
  user: 'Cuenta', profile_image: 'Foto de perfil', profile_banner: 'Banner', profile_wallpaper: 'Fondo de perfil', profile_text: 'Texto de perfil',
  folder: 'Carpeta', card: 'Carta', card_image: 'Foto de carta', review: 'Reseña', message: 'Mensaje', message_image: 'Imagen de chat', wishlist_item: 'Carta deseada'
};
const ACTIONS = {
  dismiss: { label: 'Descartar (sin infracción)', className: 'border-2 border-slate-400 text-slate-700 hover:bg-slate-50', needsNote: false },
  hide: { label: 'Ocultar', className: 'bg-amber-500 text-white hover:bg-amber-600', needsNote: true },
  remove: { label: 'Quitar', className: 'bg-red-600 text-white hover:bg-red-700', needsNote: true },
  restore: { label: 'Restaurar', className: 'bg-emerald-600 text-white hover:bg-emerald-700', needsNote: true }
};
const TIMELINE_LABELS = { 'decision.dismiss': 'Descartó', 'decision.hide': 'Ocultó', 'decision.remove': 'Quitó', 'decision.restore': 'Restauró', note: 'Nota interna', 'auto.hide': 'Ocultado automático' };

const dateTime = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');
const Badge = ({ className, children }) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${className}`}>{children}</span>;

// Las imágenes se ven difuminadas hasta que el moderador pulsa "Mostrar" (y nunca si se sospecha de un menor)
function SafeImage({ src, hardBlock }) {
  const [shown, setShown] = useState(false);
  if (hardBlock) return <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">Reporte por riesgo de menores: la imagen no se muestra aquí. No la descargues ni la compartas; escala el caso por el canal legal.</p>;
  if (!src || typeof src !== 'string') return <p className="text-sm italic text-slate-400">Sin copia de la imagen (se guardó solo su huella).</p>;
  return (
    <div className="relative inline-block max-w-full overflow-hidden rounded-xl bg-slate-100">
      <img src={src} alt="Contenido reportado" referrerPolicy="no-referrer" className={`max-h-72 max-w-full object-contain transition ${shown ? '' : 'blur-2xl'}`} />
      <button type="button" onClick={() => setShown((value) => !value)} className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-extrabold text-white">{shown ? 'Ocultar' : 'Mostrar'}</button>
    </div>
  );
}

const parseMessage = (content) => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.v === 1) return { text: parsed.text || '', image: parsed.imageUrl || parsed.imageBase64 || null };
  } catch { /* texto plano */ }
  return { text: typeof content === 'string' ? content : '', image: typeof content === 'string' && content.startsWith('data:image/') ? content : null };
};

function SnapshotView({ report }) {
  const { targetType, snapshot, reasonCode } = report;
  const minor = reasonCode.endsWith('.minor_risk');
  if (!snapshot) return null;
  const line = (label, value) => (value ? <p className="text-sm"><span className="font-bold text-slate-500">{label}:</span> <span className="break-words">{String(value)}</span></p> : null);
  if (['profile_image', 'profile_banner', 'profile_wallpaper'].includes(targetType)) return <SafeImage src={snapshot.value} hardBlock={minor} />;
  if (targetType === 'card_image') return <div className="space-y-2">{line('Carta', snapshot.name)}<SafeImage src={snapshot.imageUrl} hardBlock={minor} /></div>;
  if (targetType === 'profile_text') return <div className="space-y-1">{line('Nombre', snapshot.name)}{line('Usuario', snapshot.username)}{line('Biografía', snapshot.bio)}{line('Facebook', snapshot.facebookUrl)}{line('Instagram', snapshot.instagramUrl)}{line('YouTube', snapshot.youtubeUrl)}</div>;
  if (targetType === 'user') return <div className="space-y-1">{line('Usuario', snapshot.username)}{line('Nombre', snapshot.name)}{line('Biografía', snapshot.bio)}{line('Alta', snapshot.createdAt && dateTime(snapshot.createdAt))}</div>;
  if (targetType === 'folder') return <div className="space-y-1">{line('Nombre', snapshot.name)}{line('Descripción', snapshot.description)}{line('Juego', snapshot.tcg)}{line('Cartas', snapshot.cardCount)}{line('Dueño', snapshot.ownerUsername)}</div>;
  if (targetType === 'card') return <div className="space-y-1">{line('Carta', snapshot.name)}{line('Carpeta', snapshot.folderName)}{line('Precio', snapshot.price)}{line('Stock', snapshot.stock)}</div>;
  if (targetType === 'review') return <div className="space-y-1">{line('Calificación', `${snapshot.rating} de 5`)}{line('Comentario', snapshot.comment)}{line('Vendedor', snapshot.sellerUsername)}{line('Autor', snapshot.reviewerUsername)}</div>;
  if (targetType === 'wishlist_item') return <div className="space-y-1">{line('Carta', snapshot.name)}{line('Detalle', snapshot.detail)}{line('Nota', snapshot.note)}</div>;
  if (targetType === 'message' || targetType === 'message_image') {
    return (
      <ol className="max-h-80 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3" aria-label="Últimos mensajes de la conversación">
        {(snapshot.messages || []).map((message) => {
          const body = parseMessage(typeof message.content === 'string' ? message.content : '');
          return (
            <li key={message.id} className={`rounded-xl p-2 text-sm ${message.reported ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-white'}`}>
              <p className="text-[11px] font-bold text-slate-500">{message.from === 'reported' ? 'Persona reportada' : 'Quien reportó'} · {dateTime(message.createdAt)}{message.reported ? ' · MENSAJE REPORTADO' : ''}</p>
              {body.text && <p className="whitespace-pre-wrap break-words">{body.text}</p>}
              {body.image && <SafeImage src={body.image} hardBlock={minor} />}
            </li>
          );
        })}
      </ol>
    );
  }
  return null;
}

function ReportDetail({ id, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.getAdminReport(id).then(setData).catch((err) => setError(err.message || 'No se pudo cargar el reporte.'));
  }, [id]);
  useEffect(() => { setData(null); setAction(''); setNote(''); load(); }, [load]);

  const decide = async () => {
    const config = ACTIONS[action];
    if (!config || busy) return;
    if (config.needsNote && note.trim().length < 5) { setError('Escribe el motivo de la decisión (mínimo 5 caracteres).'); return; }
    if (action === 'remove' && !window.confirm('¿Quitar este contenido? En cartas y reseñas se borra definitivamente.')) return;
    setBusy(true);
    setError('');
    try {
      await api.decideReport(id, action, note.trim() || undefined);
      setAction('');
      setNote('');
      load();
      onChanged();
    } catch (err) {
      setError(err.message || 'No se pudo aplicar la decisión.');
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (internalNote.trim().length < 2) return;
    setBusy(true);
    try { await api.noteReport(id, internalNote.trim()); setInternalNote(''); load(); } catch (err) { setError(err.message || 'No se pudo guardar la nota.'); } finally { setBusy(false); }
  };

  const report = data?.report;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="min-w-0 truncate text-base font-black text-[#12315f]">{report ? `${report.shortCode} · ${TYPE_LABELS[report.targetType] || report.targetType}` : 'Cargando…'}</h2>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Cerrar</button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}
        {!data && !error && <div className="flex justify-center py-10" role="status" aria-label="Cargando"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>}
        {report && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SEVERITY[report.severity]?.className}>{SEVERITY[report.severity]?.label}</Badge>
              <Badge className={STATUS[report.status]?.className}>{STATUS[report.status]?.label}</Badge>
              {report.autoActioned && <Badge className="bg-purple-100 text-purple-800">Ocultado automáticamente</Badge>}
              <span className="ml-auto text-xs font-semibold text-slate-500">{dateTime(report.createdAt)}</span>
            </div>
            <p className="text-sm font-extrabold text-[#12315f]">{report.reasonLabel}</p>
            {report.comment && <p className="whitespace-pre-line break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{report.comment}</p>}
            {report.extra && Object.keys(report.extra).length > 0 && (
              <ul className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{Object.entries(report.extra).map(([key, value]) => <li key={key}><span className="font-bold text-slate-500">{key}:</span> {value}</li>)}</ul>
            )}

            <section aria-label="Contenido reportado">
              <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Contenido (copia al momento del reporte)</h3>
              <SnapshotView report={report} />
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Dueño del contenido</h3>
                {data.owner ? (
                  <>
                    <p className="mt-1 font-bold">{data.owner.username ? <Link to={`/${data.owner.username}`} className="underline-offset-2 hover:underline">{data.owner.name || data.owner.username} (@{data.owner.username})</Link> : 'Cuenta eliminada'}</p>
                    <p className="text-xs text-slate-500">Alta: {dateTime(data.owner.createdAt)}</p>
                    <p className="text-xs text-slate-500">Reportes recibidos: {Object.entries(data.ownerReports).map(([key, value]) => `${STATUS[key]?.label || key}: ${value}`).join(' · ') || 'ninguno'}</p>
                    {data.owner.moderationHidden?.length > 0 && <p className="text-xs font-bold text-amber-700">Partes retiradas: {data.owner.moderationHidden.join(', ')}</p>}
                  </>
                ) : <p className="mt-1 text-slate-500">Sin dueño registrado.</p>}
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Quien reportó (solo el equipo lo ve)</h3>
                <p className="mt-1 font-bold">{report.reporter?.username ? `${report.reporter.name || report.reporter.username} (@${report.reporter.username})` : 'Cuenta eliminada'}</p>
                {report.reporter?.createdAt && <p className="text-xs text-slate-500">Alta: {dateTime(report.reporter.createdAt)}</p>}
                <p className="text-xs text-slate-500">Reportes que hizo: {Object.entries(data.reporterReports).map(([key, value]) => `${STATUS[key]?.label || key}: ${value}`).join(' · ') || 'ninguno'}</p>
              </div>
            </section>

            {data.related.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Otros reportes sobre lo mismo ({data.related.length})</h3>
                <ul className="space-y-1">
                  {data.related.map((item) => (
                    <li key={item.shortCode} className="text-sm text-slate-600">· <Badge className={SEVERITY[item.severity]?.className}>{item.severity}</Badge> {item.reasonLabel} <span className="text-xs text-slate-400">({item.shortCode}, {STATUS[item.status]?.label}, {dateTime(item.createdAt)}{item.reporter ? `, @${item.reporter}` : ''})</span></li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Línea de tiempo</h3>
              {data.timeline.length === 0 ? <p className="text-sm italic text-slate-400">Sin acciones todavía.</p> : (
                <ol className="space-y-1.5">
                  {data.timeline.map((entry) => (
                    <li key={entry.id} className="text-sm text-slate-700"><span className="font-bold">{TIMELINE_LABELS[entry.action] || entry.action}</span> · {entry.actor} · <span className="text-xs text-slate-400">{dateTime(entry.createdAt)}</span>{entry.note && <span className="block whitespace-pre-line break-words text-slate-600">{entry.note}</span>}</li>
                  ))}
                </ol>
              )}
              <div className="mt-2 flex gap-2">
                <input type="text" maxLength={1000} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Nota interna (solo el equipo)" aria-label="Nota interna" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1e40af]" />
                <button type="button" disabled={busy || internalNote.trim().length < 2} onClick={saveNote} className="rounded-xl bg-slate-700 px-4 text-sm font-bold text-white disabled:opacity-50">Guardar</button>
              </div>
            </section>

            <section aria-label="Decisión" className="rounded-2xl border border-slate-200 p-3">
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Decisión</h3>
              {report.targetType === 'user' && <p className="mb-2 text-xs font-semibold text-slate-500">Las medidas sobre cuentas (advertencia, suspensión) llegan con la Fase B. Por ahora solo se puede descartar.</p>}
              <div className="flex flex-wrap gap-2">
                {report.allowedActions.filter((item) => report.status === 'open' ? item !== 'restore' : item === 'restore').map((item) => (
                  <button key={item} type="button" onClick={() => { setAction(item); setError(''); }} aria-pressed={action === item} className={`h-11 rounded-full px-4 text-sm font-extrabold ${ACTIONS[item].className} ${action === item ? 'ring-4 ring-blue-300' : ''}`}>{ACTIONS[item].label}</button>
                ))}
                {report.status !== 'open' && !report.allowedActions.includes('restore') && <p className="text-sm text-slate-500">Este reporte ya está resuelto.</p>}
              </div>
              {action && (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-extrabold text-slate-700">
                    Motivo de la decisión {ACTIONS[action].needsNote ? '(obligatorio)' : '(opcional)'}
                    <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
                  </label>
                  {(action === 'hide' || action === 'remove') && <p className="text-xs font-semibold text-slate-500">Se le avisará por correo a la persona (sin decir quién reportó) y podrá escribirnos para apelar.</p>}
                  <button type="button" disabled={busy} onClick={decide} className="h-11 w-full rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white disabled:opacity-50">{busy ? 'Aplicando…' : `Confirmar: ${ACTIONS[action].label}`}</button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReportsPanel() {
  const [filters, setFilters] = useState({ status: 'open', severity: '', targetType: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setError('');
    api.getAdminReports({ ...filters, page })
      .then(setList)
      .catch((err) => { setList({ reports: [], counts: {}, pages: 1 }); setError(err.message || 'No se pudo cargar la cola.'); });
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (patch) => { setPage(1); setFilters((previous) => ({ ...previous, ...patch })); };
  const counts = list?.counts || {};

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-label="Cola de reportes" className={selected ? 'hidden lg:block' : ''}>
        <div role="tablist" aria-label="Estado" className="mb-3 flex flex-wrap gap-2">
          {STATUS_TABS.map(([value, label]) => (
            <button key={value} role="tab" aria-selected={filters.status === value} type="button" onClick={() => setFilter({ status: value })} className={`h-10 rounded-full px-4 text-sm font-extrabold ${filters.status === value ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-300'}`}>
              {label}{value !== 'all' && counts[value] !== undefined ? ` (${counts[value]})` : ''}
            </button>
          ))}
        </div>
        <form className="mb-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setFilter({ q: search.trim() }); }}>
          <select aria-label="Gravedad" value={filters.severity} onChange={(event) => setFilter({ severity: event.target.value })} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
            <option value="">Toda gravedad</option>
            {Object.entries(SEVERITY).map(([key, value]) => <option key={key} value={key}>{key} · {value.label}</option>)}
          </select>
          <select aria-label="Tipo" value={filters.targetType} onChange={(event) => setFilter({ targetType: event.target.value })} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
            <option value="">Todo tipo</option>
            {Object.entries(TYPE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
          </select>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código RP-… o usuario" aria-label="Buscar" maxLength={40} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#1e40af]" />
          <button type="submit" className="h-10 rounded-xl bg-[#1e40af] px-4 text-sm font-bold text-white">Buscar</button>
        </form>
        {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}
        {list === null ? (
          <div className="flex justify-center py-10" role="status" aria-label="Cargando reportes"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>
        ) : list.reports.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5">
            <span translate="no" className="material-symbols-outlined text-5xl text-[#1e40af]/40">task_alt</span>
            <h2 className="mt-2 text-lg font-extrabold text-[#12315f]">No hay reportes aquí</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Cuando alguien reporte contenido, aparecerá en esta cola ordenado por gravedad.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.reports.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setSelected(item.id)} aria-current={selected === item.id} className={`w-full rounded-2xl bg-white p-3 text-left shadow-sm ring-1 transition hover:ring-[#1e40af] ${selected === item.id ? 'ring-2 ring-[#1e40af]' : 'ring-slate-900/5'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={SEVERITY[item.severity]?.className}>{item.severity} · {SEVERITY[item.severity]?.label}</Badge>
                    <Badge className={STATUS[item.status]?.className}>{STATUS[item.status]?.label}</Badge>
                    {item.autoActioned && <Badge className="bg-purple-100 text-purple-800">Auto</Badge>}
                    {item.openForSameTarget > 1 && <Badge className="bg-rose-100 text-rose-800">{item.openForSameTarget} reportes</Badge>}
                    <span className="ml-auto text-xs font-semibold text-slate-500">{dateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-[#12315f]">{TYPE_LABELS[item.targetType] || item.targetType}: {item.reasonLabel}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.shortCode}{item.owner?.username ? ` · @${item.owner.username}` : ''}</p>
                  {item.comment && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.comment}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {list && list.pages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-10 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-slate-300 disabled:opacity-40">Anterior</button>
            <span className="text-sm font-semibold text-slate-600">Página {page} de {list.pages}</span>
            <button type="button" disabled={page >= list.pages} onClick={() => setPage((value) => value + 1)} className="h-10 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-slate-300 disabled:opacity-40">Siguiente</button>
          </div>
        )}
      </section>

      {selected ? (
        <section aria-label="Detalle del reporte" className="max-h-[calc(100vh-140px)] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 lg:sticky lg:top-4">
          <ReportDetail id={selected} onClose={() => setSelected(null)} onChanged={load} />
        </section>
      ) : (
        <section className="hidden items-center justify-center rounded-2xl bg-white/60 p-8 text-center text-sm font-semibold text-slate-500 lg:flex">Elige un reporte para ver el detalle y decidir.</section>
      )}
    </div>
  );
}
