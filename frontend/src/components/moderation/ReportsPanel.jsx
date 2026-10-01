import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useRef } from 'react';
import { DetailHeader, DetailPane, EmptyState, FilterSheet, Pills, SEVERITY_STYLE, Spinner, relativeTime } from './shared';

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
  order: 'Pedido', folder: 'Carpeta', card: 'Carta', card_image: 'Foto de carta', review: 'Reseña', message: 'Mensaje', message_image: 'Imagen de chat', wishlist_item: 'Carta deseada'
};
const ACTIONS = {
  dismiss: { label: 'Descartar (sin infracción)', className: 'border-2 border-slate-400 text-slate-700 hover:bg-slate-50', needsNote: false },
  hide: { label: 'Ocultar', className: 'bg-amber-500 text-white hover:bg-amber-600', needsNote: true },
  remove: { label: 'Quitar', className: 'bg-red-600 text-white hover:bg-red-700', needsNote: true },
  restore: { label: 'Restaurar', className: 'bg-emerald-600 text-white hover:bg-emerald-700', needsNote: true }
};
const TIMELINE_LABELS = { 'sanction.applied': 'Medida aplicada', 'case.opened': 'Caso abierto', 'evidence.viewed': 'Vio una evidencia', 'decision.dismiss': 'Descartó', 'decision.hide': 'Ocultó', 'decision.remove': 'Quitó', 'decision.restore': 'Restauró', note: 'Nota interna', 'auto.hide': 'Ocultado automático' };

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
  if (targetType === 'order') return <div className="space-y-1">{line('Código', snapshot.code)}{line('Carpeta', snapshot.folderName)}{line('Total', snapshot.total)}{line('Estado', snapshot.status)}{line('Creado', snapshot.createdAt && dateTime(snapshot.createdAt))}{line('Actualizado', snapshot.updatedAt && dateTime(snapshot.updatedAt))}{Array.isArray(snapshot.items) && <ul className="text-sm">{snapshot.items.map((item, index) => <li key={index}>· {item.quantity || 1} × {item.name || item.id}</li>)}</ul>}</div>;
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

// Evidencias privadas: se descargan con la sesión y se muestran difuminadas hasta pulsar "Mostrar"
function EvidenceThumb({ evidence, index }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let revoked = false;
    let objectUrl = '';
    api.getEvidenceBlob(evidence.id).then((blob) => { if (revoked) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => setError(true));
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [evidence.id]);
  if (error) return <p className="text-sm italic text-red-600">No se pudo cargar la evidencia {index + 1}.</p>;
  if (!url) return <div className="h-24 w-24 animate-pulse rounded-xl bg-slate-200" />;
  return (
    <div className="relative inline-block max-w-full overflow-hidden rounded-xl bg-slate-100">
      <img src={url} alt={'Evidencia ' + (index + 1)} className={'max-h-60 max-w-full object-contain transition ' + (shown ? '' : 'blur-2xl')} />
      <button type="button" onClick={() => setShown((value) => !value)} className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-extrabold text-white">{shown ? 'Ocultar' : 'Mostrar'}</button>
    </div>
  );
}

function ReportDetail({ id, level, onClose, onChanged, onOpenPerson }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [publicMessage, setPublicMessage] = useState('');
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
      await api.decideReport(id, action, note.trim() || undefined, publicMessage.trim() || undefined);
      setAction('');
      setNote('');
      setPublicMessage('');
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
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailHeader title={report ? (TYPE_LABELS[report.targetType] || report.targetType) : 'Cargando…'} subtitle={report ? report.shortCode : undefined} onClose={onClose} />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-10">
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}
        {!data && !error && <div className="flex justify-center py-10" role="status" aria-label="Cargando"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>}
        {report && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SEVERITY[report.severity]?.className}>{SEVERITY[report.severity]?.label}</Badge>
              <Badge className={STATUS[report.status]?.className}>{STATUS[report.status]?.label}</Badge>
              {report.autoActioned && <Badge className="bg-purple-100 text-purple-800">Ocultado automáticamente</Badge>}
              {report.automatic && <Badge className="bg-cyan-100 text-cyan-800">Detección automática</Badge>}
              {!report.automatic && report.weight < 0.5 && <Badge className="bg-amber-100 text-amber-900">Reportante con baja reputación</Badge>}
              <span className="ml-auto text-xs font-semibold text-slate-500">{dateTime(report.createdAt)}</span>
            </div>
            <p className="text-sm font-extrabold text-[#12315f]">{report.reasonLabel}</p>
            {report.comment && <p className="whitespace-pre-line break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{report.comment}</p>}
            {report.extra && Object.keys(report.extra).length > 0 && (
              <ul className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{Object.entries(report.extra).map(([key, value]) => <li key={key}><span className="font-bold text-slate-500">{key}:</span> {value}</li>)}</ul>
            )}

            {report.evidence?.length > 0 && (
              <section aria-label="Evidencias">
                <h3 className="mb-1 text-sm font-bold text-slate-500">Evidencias ({report.evidence.length})</h3>
                <div className="flex flex-wrap gap-2">{report.evidence.map((item, index) => <EvidenceThumb key={item.id} evidence={item} index={index} />)}</div>
              </section>
            )}

            <section aria-label="Contenido reportado">
              <h3 className="mb-1 text-sm font-bold text-slate-500">Contenido (copia al momento del reporte)</h3>
              <SnapshotView report={report} />
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <h3 className="text-sm font-bold text-slate-500">Dueño del contenido</h3>
                {data.owner ? (
                  <>
                    {data.owner.username && <button type="button" onClick={() => onOpenPerson(data.owner.username, report.id)} className="mt-1 text-xs font-extrabold text-blue-700 underline-offset-2 hover:underline">Ver ficha y aplicar una medida</button>}
                    <p className="mt-1 font-bold">{data.owner.username ? <Link to={`/${data.owner.username}`} className="underline-offset-2 hover:underline">{data.owner.name || data.owner.username} (@{data.owner.username})</Link> : 'Cuenta eliminada'}</p>
                    <p className="text-xs text-slate-500">Alta: {dateTime(data.owner.createdAt)}</p>
                    <p className="text-xs text-slate-500">Reportes recibidos: {Object.entries(data.ownerReports).map(([key, value]) => `${STATUS[key]?.label || key}: ${value}`).join(' · ') || 'ninguno'}</p>
                    {data.owner.moderationHidden?.length > 0 && <p className="text-xs font-bold text-amber-700">Partes retiradas: {data.owner.moderationHidden.join(', ')}</p>}
                  </>
                ) : <p className="mt-1 text-slate-500">Sin dueño registrado.</p>}
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <h3 className="text-sm font-bold text-slate-500">Quien reportó (solo el equipo lo ve)</h3>
                <p className="mt-1 font-bold">{report.reporter?.username ? `${report.reporter.name || report.reporter.username} (@${report.reporter.username})` : 'Cuenta eliminada'}</p>
                {report.reporter?.createdAt && <p className="text-xs text-slate-500">Alta: {dateTime(report.reporter.createdAt)}</p>}
                <p className="text-xs text-slate-500">Reportes que hizo: {Object.entries(data.reporterReports).map(([key, value]) => `${STATUS[key]?.label || key}: ${value}`).join(' · ') || 'ninguno'}</p>
              </div>
            </section>

            {data.related.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-bold text-slate-500">Otros reportes sobre lo mismo ({data.related.length})</h3>
                <ul className="space-y-1">
                  {data.related.map((item) => (
                    <li key={item.shortCode} className="text-sm text-slate-600">· <Badge className={SEVERITY[item.severity]?.className}>{item.severity}</Badge> {item.reasonLabel} <span className="text-xs text-slate-400">({item.shortCode}, {STATUS[item.status]?.label}, {dateTime(item.createdAt)}{item.reporter ? `, @${item.reporter}` : ''})</span></li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-sm font-bold text-slate-500">Línea de tiempo</h3>
              {data.timeline.length === 0 ? <p className="text-sm italic text-slate-400">Sin acciones todavía.</p> : (
                <ol className="space-y-1.5">
                  {data.timeline.map((entry) => (
                    <li key={entry.id} className="text-sm text-slate-700"><span className="font-bold">{TIMELINE_LABELS[entry.action] || entry.action}</span> · {entry.actor} · <span className="text-xs text-slate-400">{dateTime(entry.createdAt)}</span>{entry.note && <span className="block whitespace-pre-line break-words text-slate-600">{entry.note}</span>}</li>
                  ))}
                </ol>
              )}
              {level >= 2 && <div className="mt-2 flex gap-2">
                <input type="text" maxLength={1000} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Nota interna (solo el equipo)" aria-label="Nota interna" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1e40af]" />
                <button type="button" disabled={busy || internalNote.trim().length < 2} onClick={saveNote} className="rounded-xl bg-slate-700 px-4 text-sm font-bold text-white disabled:opacity-50">Guardar</button>
              </div>}
            </section>

            <section aria-label="Decisión" className="rounded-2xl border border-slate-200 p-3">
              <h3 className="mb-2 text-sm font-bold text-slate-500">Decisión</h3>
              {['user', 'order'].includes(report.targetType) && <p className="mb-2 text-xs font-semibold text-slate-500">Sobre cuentas y pedidos solo se descarta desde aquí. Para advertir o suspender usa "Ver ficha y aplicar una medida" o el caso de estafa.</p>}
              {level < 2 && <p className="mb-2 text-xs font-semibold text-slate-500">Tu rol es de solo lectura: no puedes decidir.</p>}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
                  {(action === 'hide' || action === 'remove') && (
                    <>
                      <label className="block text-sm font-extrabold text-slate-700">Mensaje para la persona (opcional, va en el correo)
                        <textarea rows={2} maxLength={500} value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
                      </label>
                      <p className="text-xs font-semibold text-slate-500">Se le avisará por correo (sin decir quién reportó) y podrá apelar durante 14 días.</p>
                    </>
                  )}
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

export default function ReportsPanel({ level = 1, onOpenPerson = () => {}, initialReportId = '', onInitialUsed = () => {} }) {
  const [filters, setFilters] = useState({ status: 'open', severity: '', targetType: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const usedInitial = useRef(false);
  useEffect(() => {
    if (initialReportId && !usedInitial.current) { usedInitial.current = true; setSelected(initialReportId); setFilters((previous) => ({ ...previous, status: 'all' })); onInitialUsed(); }
  }, [initialReportId, onInitialUsed]);

  const load = useCallback(() => {
    setError('');
    api.getAdminReports({ ...filters, page })
      .then(setList)
      .catch((err) => { setList({ reports: [], counts: {}, pages: 1 }); setError(err.message || 'No se pudo cargar la cola.'); });
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (patch) => { setPage(1); setFilters((previous) => ({ ...previous, ...patch })); };
  const activeFilters = [filters.severity, filters.targetType].filter(Boolean).length;
  const submitSearch = (event) => { event.preventDefault(); setFilter({ q: search.trim() }); };

  const selectClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-[#12315f] outline-none focus:border-[#1e40af] lg:h-10';
  const fields = (
    <>
      <select aria-label="Gravedad" value={filters.severity} onChange={(event) => setFilter({ severity: event.target.value })} className={selectClass}>
        <option value="">Cualquier gravedad</option>
        {Object.entries(SEVERITY).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select>
      <select aria-label="Tipo de contenido" value={filters.targetType} onChange={(event) => setFilter({ targetType: event.target.value })} className={selectClass}>
        <option value="">Cualquier contenido</option>
        {Object.entries(TYPE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
      </select>
    </>
  );

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-start xl:gap-5">
      <section aria-label="Cola de reportes" className={selected ? 'hidden xl:block' : ''}>
        <Pills label="Estado" value={filters.status} onChange={(value) => setFilter({ status: value })} options={STATUS_TABS} counts={list?.counts} />

        <form onSubmit={submitSearch} className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código RP o usuario" aria-label="Buscar reporte" maxLength={40} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-[#1e40af]" />
          </div>
          <button type="button" onClick={() => setShowFilters(true)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-[#12315f] ring-1 ring-slate-300 lg:hidden">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">tune</span>
            Filtros
            {activeFilters > 0 && <span className="rounded-full bg-[#facc15] px-1.5 text-xs font-extrabold text-[#12315f]">{activeFilters}</span>}
          </button>
          <div className="hidden w-full grid-cols-2 gap-2 lg:grid">{fields}</div>
        </form>

        <FilterSheet open={showFilters} onClose={() => setShowFilters(false)}>
          <label className="block text-sm font-bold text-slate-700">Gravedad<div className="mt-1">{fields.props.children[0]}</div></label>
          <label className="block text-sm font-bold text-slate-700">Contenido<div className="mt-1">{fields.props.children[1]}</div></label>
          {activeFilters > 0 && <button type="button" onClick={() => setFilter({ severity: '', targetType: '' })} className="h-11 w-full rounded-full border-2 border-slate-300 text-sm font-bold text-slate-700">Quitar filtros</button>}
        </FilterSheet>

        {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}
        {list === null ? <Spinner label="Cargando reportes" /> : list.reports.length === 0 ? (
          <EmptyState title={filters.status === 'open' ? 'La cola está al día' : 'No hay reportes aquí'}>
            {filters.status === 'open' ? 'Cuando alguien reporte contenido aparecerá aquí, con lo más grave primero.' : 'Prueba con otro estado o quita los filtros.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {list.reports.map((item) => {
              const severity = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.S4;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => setSelected(item.id)} aria-current={selected === item.id} className={`relative flex w-full items-start gap-3 overflow-hidden rounded-xl bg-white py-3 pl-5 pr-3 text-left transition-shadow hover:shadow-md ${selected === item.id ? 'ring-2 ring-[#1e40af]' : 'ring-1 ring-slate-900/5'}`}>
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${severity.bar}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-extrabold leading-snug text-[#12315f]">{TYPE_LABELS[item.targetType] || item.targetType}: {String(item.reasonLabel).replace(/^Detección automática:s*/, '')}</p>
                      {item.comment && <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-600">{item.comment}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className={`font-bold ${severity.text}`}>{severity.label}</span>
                        {item.owner?.username && <span>@{item.owner.username}</span>}
                        {item.status !== 'open' && <span className="font-bold">{STATUS[item.status]?.label}</span>}
                        {item.openForSameTarget > 1 && <span className="font-bold text-rose-700">{item.openForSameTarget} reportes sobre lo mismo</span>}
                        {item.automatic && <span className="font-bold text-cyan-700">Detección automática</span>}
                        {item.autoActioned && <span className="font-bold text-purple-700">Ya oculto</span>}
                        {!item.automatic && item.weight < 0.5 && <span className="font-bold text-amber-800">Baja reputación</span>}
                      </div>
                    </div>
                    <time dateTime={item.createdAt} title={dateTime(item.createdAt)} className="shrink-0 pt-0.5 text-xs text-slate-500">{relativeTime(item.createdAt)}</time>
                  </button>
                </li>
              );
            })}
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
        <DetailPane label="Detalle del reporte">
          <ReportDetail id={selected} level={level} onClose={() => setSelected(null)} onChanged={load} onOpenPerson={onOpenPerson} />
        </DetailPane>
      ) : (
        <section className="hidden items-center justify-center rounded-2xl bg-white/60 p-10 text-center text-sm font-semibold text-slate-500 xl:flex">Elige un reporte de la lista para ver el contenido y decidir.</section>
      )}
    </div>
  );
}
