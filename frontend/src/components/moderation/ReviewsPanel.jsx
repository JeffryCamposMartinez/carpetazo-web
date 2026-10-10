import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Stars } from '../reviews/Reviews';
import { Dot, EmptyState, ErrorBox, ListSkeleton, ROW, dateOnly } from './shared';

const FLAG_LABELS = {
  reported: 'Reportada',
  same_connection: 'Misma conexión (pedido creado y confirmado desde el mismo lugar)'
};
const personLabel = (person) => (person?.username ? `${person.name || person.username} (@${person.username})` : 'Cuenta eliminada');

// Reseñas reportadas o sospechosas, para aprobarlas o eliminarlas (solo administradores; el servidor lo vuelve a comprobar en cada acción)
export default function ReviewsPanel() {
  const [reviews, setReviews] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.getModerationReviews()
      .then((res) => setReviews(res.reviews || []))
      .catch(() => { setReviews([]); setError('No se pudieron cargar los reportes.'); });
  }, []);
  useEffect(() => { load(); }, [load]);

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

  return (
    <section aria-label="Reseñas marcadas" className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm leading-relaxed text-slate-600">Reseñas reportadas o sospechosas por la regla anterior. Aprobar la vuelve a mostrar y borra sus reportes; eliminar la borra para siempre.</p>
      <ErrorBox>{error}</ErrorBox>
      {reviews === null ? <ListSkeleton rows={3} label="Cargando reseñas" /> : reviews.length === 0 ? (
        <EmptyState icon="reviews" title="No hay reseñas pendientes">Cuando una reseña sea reportada o parezca sospechosa, aparecerá aquí.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review, index) => (
            <li key={review.id} style={{ '--i': index }} className={`${ROW} mod-row-in p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Dot tone={review.counts ? 'bg-amber-400' : 'bg-slate-300'} className="!mt-[5px]" />
                  <div>
                    <Stars value={review.rating} size={18} />
                    <p className="mt-1 text-xs font-bold text-slate-700">{review.counts ? 'Visible' : 'Oculta'}<span className="ml-3 font-medium text-slate-500">{FLAG_LABELS[review.flag] || review.flag}</span></p>
                  </div>
                </div>
                <time dateTime={review.createdAt} className="shrink-0 text-xs tabular-nums text-slate-500">{dateOnly(review.createdAt)}</time>
              </div>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-bold text-slate-500">Vendedor </span>
                {review.seller?.username ? <Link to={`/${review.seller.username}`} className="font-semibold text-[#1e40af] underline-offset-2 hover:underline">{personLabel(review.seller)}</Link> : personLabel(review.seller)}
                <span className="ml-3 font-bold text-slate-500">Comprador </span>{personLabel(review.reviewer)}
              </p>
              {review.comment
                ? <blockquote className="mt-2 whitespace-pre-line break-words rounded-lg bg-[#f3f6fc] px-3 py-2.5 text-[15px] leading-relaxed text-slate-800">{review.comment}</blockquote>
                : <p className="mt-2 text-sm italic text-slate-500">Sin comentario</p>}
              {review.reports?.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-bold text-slate-600">{review.reports.length} {review.reports.length === 1 ? 'reporte' : 'reportes'}</p>
                  <ul className="mt-1 space-y-0.5">
                    {review.reports.map((report, at) => <li key={at} className="text-sm text-slate-600">{report.reason || 'Sin motivo'} <span className="text-xs text-slate-500">({dateOnly(report.createdAt)})</span></li>)}
                  </ul>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
                <button type="button" disabled={busyId === review.id} onClick={() => act(review, 'approve')} className="h-11 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af] disabled:opacity-50">Aprobar</button>
                <button type="button" disabled={busyId === review.id} onClick={() => act(review, 'delete')} className="h-11 rounded-full border-2 border-red-600 px-6 text-sm font-extrabold text-red-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-red-50 disabled:opacity-50">Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
