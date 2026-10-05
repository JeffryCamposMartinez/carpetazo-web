import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Stars } from '../components/reviews/Reviews';
import ReportsPanel from '../components/moderation/ReportsPanel';
import AuditPanel from '../components/moderation/AuditPanel';
import CasesPanel from '../components/moderation/CasesPanel';
import PeoplePanel from '../components/moderation/PeoplePanel';
import AppealsPanel from '../components/moderation/AppealsPanel';
import MetricsPanel from '../components/moderation/MetricsPanel';
import RetentionPanel from '../components/moderation/RetentionPanel';
import ModNav from '../components/moderation/ModNav';
import { EmptyState, Spinner } from '../components/moderation/shared';

// Pestañas según el rol: soporte (1) lee, moderador (2) decide, administrador (3) además ve reseñas, auditoría y herramientas
const TABS = [
  { id: 'reports', label: 'Reportes', icon: 'flag', min: 1 },
  { id: 'cases', label: 'Estafas', icon: 'security', min: 1 },
  { id: 'people', label: 'Personas y medidas', icon: 'groups', min: 1 },
  { id: 'appeals', label: 'Apelaciones', icon: 'gavel', min: 1 },
  { id: 'reviews', label: 'Reseñas marcadas', icon: 'reviews', min: 3 },
  { id: 'metrics', label: 'Métricas', icon: 'monitoring', min: 3 },
  { id: 'audit', label: 'Auditoría', icon: 'history', min: 3 },
  { id: 'tools', label: 'Herramientas', icon: 'build', min: 3 }
];
const ROLE_LABELS = { 1: 'Soporte (solo lectura)', 2: 'Moderador', 3: 'Administrador' };

// Sección de moderación (solo administradores): reseñas reportadas o sospechosas, para aprobarlas o eliminarlas.
// El servidor vuelve a comprobar que quien llama es administrador en cada acción.
const FLAG_LABELS = {
  reported: 'Reportada',
  same_connection: 'Misma conexión (pedido creado y confirmado desde el mismo lugar)'
};

const dateLabel = (iso) => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
const personLabel = (person) => (person?.username ? `${person.name || person.username} (@${person.username})` : 'Cuenta eliminada');

export default function Moderation() {
  const { currentUser } = useAuth();
  const [state, setState] = useState('checking'); // checking | denied | ok
  const [tab, setTab] = useState('reports');
  const [summary, setSummary] = useState(null);
  const [level, setLevel] = useState(0);
  const [focusUsername, setFocusUsername] = useState('');
  const [focusReportId, setFocusReportId] = useState('');
  const [sanctionReportId, setSanctionReportId] = useState('');
  const [reviews, setReviews] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [mailState, setMailState] = useState({ busy: false, text: '' });

  useEffect(() => {
    if (!currentUser) { setState('denied'); return undefined; }
    let cancelled = false;
    api.get('/admin/me')
      .then((res) => { if (!cancelled) { setLevel(res?.level || 0); setState(res?.isStaff ? 'ok' : 'denied'); } })
      .catch(() => { if (!cancelled) setState('denied'); });
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  const load = useCallback(() => {
    setError('');
    api.getModerationReviews()
      .then((res) => setReviews(res.reviews || []))
      .catch(() => { setReviews([]); setError('No se pudieron cargar los reportes.'); });
  }, []);

  useEffect(() => { if (state === 'ok' && level >= 3) load(); }, [state, level, load]);

  // Contadores del menú: se actualizan al cambiar de sección y cada minuto
  useEffect(() => {
    if (state !== 'ok') return undefined;
    let cancelled = false;
    const load = () => api.getModerationSummary().then((res) => { if (!cancelled) setSummary(res); }).catch(() => {});
    load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [state, tab]);

  const navItems = TABS.filter((item) => level >= item.min).map((item) => ({
    ...item,
    count: item.id === 'reports' ? summary?.reports : item.id === 'cases' ? summary?.cases : item.id === 'appeals' ? summary?.appeals : item.id === 'people' ? summary?.pendingBans : 0,
    alert: item.id === 'reports' && (summary?.criticalReports || 0) > 0
  }));

  const openPerson = (username, reportId) => { setFocusUsername(username); setSanctionReportId(reportId || ''); setTab('people'); };
  const openReport = (id) => { setFocusReportId(id); setTab('reports'); };

  const sendTestEmail = async () => {
    setMailState({ busy: true, text: '' });
    try {
      const res = await api.sendTestEmail();
      const reasons = { terms_not_accepted: 'la cuenta no ha aceptado los términos', not_configured: 'el envío no está configurado en el servidor', send_failed: 'el servidor de correo rechazó el envío', no_recipient: 'la cuenta no tiene correo válido' };
      setMailState({ busy: false, text: res.sent ? 'Correo enviado. Revisa tu bandeja (y spam).' : `No se envió: ${reasons[res.reason] || 'motivo desconocido'}.` });
    } catch (err) {
      setMailState({ busy: false, text: err.message || 'No se pudo enviar el correo.' });
    }
  };

  const act = async (review, action) => {
    if (action === 'delete' && !window.confirm('¿Eliminar esta reseña? No se puede deshacer y el comprador podrá volver a calificar a este vendedor.')) return;
    setBusyId(review.id);
    setError('');
    try {
      if (action === 'approve') await api.approveReview(review.id);
      else await api.deleteReview(review.id);
      setReviews((previous) => previous.filter((item) => item.id !== review.id));
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
    } finally {
      setBusyId(null);
    }
  };

  if (state === 'checking') {
    return <div className="flex flex-1 items-center justify-center py-20" role="status" aria-label="Verificando acceso"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>;
  }

  if (state === 'denied') {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="rounded-3xl bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/5">
          <h1 className="text-xl font-black text-[#12315f]">Acceso restringido</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">Esta sección es solo para el equipo de moderación.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-3 py-3 sm:px-6 sm:py-6">
      <div className="rounded-[1.4rem] border border-white/70 bg-[#DBEAFE]/95 p-3 text-slate-800 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] sm:p-4 lg:rounded-[2rem] lg:p-6">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-1 lg:mb-5">
          <h1 className="text-[1.75rem] font-extrabold leading-none tracking-tight text-[#12315f] lg:text-4xl">Moderación</h1>
          <p className="text-sm font-semibold text-slate-600">Tu rol: {ROLE_LABELS[level]}</p>
        </header>

        <div className="lg:flex lg:items-start lg:gap-6">
        <ModNav items={navItems} value={tab} onChange={setTab} />
        <div className="min-w-0 flex-1">
        {tab === 'reports' && <ReportsPanel level={level} onOpenPerson={openPerson} initialReportId={focusReportId} onInitialUsed={() => setFocusReportId('')} />}
        {tab === 'cases' && <CasesPanel level={level} onOpenPerson={openPerson} onOpenReport={openReport} />}
        {tab === 'people' && <PeoplePanel level={level} focusUsername={focusUsername} focusReportId={sanctionReportId || undefined} onFocusUsed={() => setFocusUsername('')} />}
        {tab === 'appeals' && <AppealsPanel level={level} />}
        {tab === 'metrics' && level >= 3 && <MetricsPanel />}
        {tab === 'audit' && level >= 3 && <AuditPanel />}

        {tab === 'tools' && level >= 3 && (
          <div className="mx-auto max-w-3xl space-y-4">
            <RetentionPanel />
            <section aria-label="Prueba de correo" className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              <h3 className="text-lg font-extrabold text-[#12315f]">Correo de prueba</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Envía un correo a tu propia cuenta para comprobar que los avisos llegan. Solo sale si aceptaste los términos vigentes.</p>
              <button type="button" onClick={sendTestEmail} disabled={mailState.busy} className="mt-3 h-11 rounded-full bg-[#1e40af] px-6 text-sm font-extrabold text-white disabled:opacity-60">{mailState.busy ? 'Enviando…' : 'Enviar correo de prueba'}</button>
              {mailState.text && <p role="status" className="mt-2 text-sm font-semibold text-slate-700">{mailState.text}</p>}
            </section>
          </div>
        )}

        {tab === 'reviews' && level >= 3 && (
          <section aria-label="Reseñas marcadas" className="mx-auto max-w-3xl">
            <p className="mb-3 px-1 text-sm leading-relaxed text-slate-600">Reseñas reportadas o sospechosas por la regla anterior. Aprobar la vuelve a mostrar y borra sus reportes; eliminar la borra para siempre.</p>
            {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}
            {reviews === null ? <Spinner label="Cargando reseñas" /> : reviews.length === 0 ? (
              <EmptyState title="No hay reseñas pendientes">Cuando una reseña sea reportada o parezca sospechosa, aparecerá aquí.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.id} className="relative overflow-hidden rounded-xl bg-white py-3.5 pl-5 pr-4 ring-1 ring-slate-900/5">
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${review.counts ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Stars value={review.rating} size={18} />
                        <p className="mt-1 text-xs font-bold text-slate-600">{review.counts ? 'Visible' : 'Oculta'}<span className="ml-3 font-normal text-slate-500">{FLAG_LABELS[review.flag] || review.flag}</span></p>
                      </div>
                      <time dateTime={review.createdAt} className="shrink-0 text-xs text-slate-500">{dateLabel(review.createdAt)}</time>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-bold text-slate-500">Vendedor </span>
                      {review.seller?.username ? <Link to={`/${review.seller.username}`} className="font-semibold text-[#1e40af] underline-offset-2 hover:underline">{personLabel(review.seller)}</Link> : personLabel(review.seller)}
                      <span className="ml-3 font-bold text-slate-500">Comprador </span>{personLabel(review.reviewer)}
                    </p>
                    {review.comment
                      ? <blockquote className="mt-2 whitespace-pre-line break-words rounded-lg bg-slate-50 px-3 py-2.5 text-[15px] leading-relaxed text-slate-800">{review.comment}</blockquote>
                      : <p className="mt-2 text-sm italic text-slate-400">Sin comentario</p>}
                    {review.reports?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-bold text-slate-500">{review.reports.length} {review.reports.length === 1 ? 'reporte' : 'reportes'}</p>
                        <ul className="mt-1 space-y-0.5">
                          {review.reports.map((report, index) => <li key={index} className="text-sm text-slate-600">{report.reason || 'Sin motivo'} <span className="text-xs text-slate-400">({dateLabel(report.createdAt)})</span></li>)}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                      <button type="button" disabled={busyId === review.id} onClick={() => act(review, 'approve')} className="h-11 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white disabled:opacity-50">Aprobar</button>
                      <button type="button" disabled={busyId === review.id} onClick={() => act(review, 'delete')} className="h-11 rounded-full border-2 border-red-600 px-6 text-sm font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
