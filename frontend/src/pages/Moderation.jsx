import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Stars } from '../components/Reviews';

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
  const [reviews, setReviews] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) { setState('denied'); return undefined; }
    let cancelled = false;
    api.get('/admin/me')
      .then((res) => { if (!cancelled) setState(res?.isAdmin ? 'ok' : 'denied'); })
      .catch(() => { if (!cancelled) setState('denied'); });
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  const load = useCallback(() => {
    setError('');
    api.getModerationReviews()
      .then((res) => setReviews(res.reviews || []))
      .catch(() => { setReviews([]); setError('No se pudieron cargar los reportes.'); });
  }, []);

  useEffect(() => { if (state === 'ok') load(); }, [state, load]);

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
          <p className="mt-2 text-sm font-semibold text-slate-600">Esta sección es solo para administradores.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-3 sm:px-6 sm:py-6">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-4 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem] md:p-8">
        <header className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Moderación</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">Reseñas reportadas o sospechosas. Aprobar la vuelve a mostrar y borra sus reportes; eliminar la borra definitivamente.</p>
        </header>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{error}</p>}

        {reviews === null ? (
          <div className="flex justify-center py-10" role="status" aria-label="Cargando reportes"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>
        ) : reviews.length === 0 ? (
          <section aria-label="Reportes de reseñas" className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5">
            <span translate="no" className="material-symbols-outlined text-5xl text-[#1e40af]/40">task_alt</span>
            <h2 className="mt-2 text-lg font-extrabold text-[#12315f]">No hay nada pendiente</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Cuando alguien reporte una reseña, o una parezca sospechosa, aparecerá aquí.</p>
          </section>
        ) : (
          <ul className="space-y-3" aria-label="Reportes de reseñas">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl bg-white p-4 text-[#12315f] shadow-sm ring-1 ring-slate-900/5 md:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={review.rating} size={18} />
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${review.counts ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                    {review.counts ? 'Visible' : 'Oculta'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{FLAG_LABELS[review.flag] || review.flag}</span>
                  <span className="ml-auto text-xs font-semibold text-slate-500">{dateLabel(review.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold">
                  <span className="text-slate-500">Vendedor:</span>{' '}
                  {review.seller?.username ? <Link to={`/${review.seller.username}`} className="underline-offset-2 hover:underline">{personLabel(review.seller)}</Link> : personLabel(review.seller)}
                  <span className="text-slate-500"> · Comprador:</span> {personLabel(review.reviewer)}
                </p>
                {review.comment
                  ? <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{review.comment}</p>
                  : <p className="mt-2 text-sm italic text-slate-400">Sin comentario</p>}
                {review.reports?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{review.reports.length} {review.reports.length === 1 ? 'reporte' : 'reportes'}</p>
                    <ul className="mt-1 space-y-1">
                      {review.reports.map((report, index) => (
                        <li key={index} className="text-sm text-slate-600">· {report.reason || 'Sin motivo'} <span className="text-xs text-slate-400">({dateLabel(report.createdAt)})</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button type="button" disabled={busyId === review.id} onClick={() => act(review, 'approve')} className="h-11 flex-1 rounded-full bg-[#12315f] px-4 text-sm font-extrabold text-white disabled:opacity-50 sm:flex-none">Aprobar</button>
                  <button type="button" disabled={busyId === review.id} onClick={() => act(review, 'delete')} className="h-11 flex-1 rounded-full border-2 border-red-600 px-4 text-sm font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:flex-none">Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
