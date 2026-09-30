import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const STAR_PATH = 'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z';

const dateLabel = (iso) => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

// Estrellas de solo lectura; admite decimales (4,5 = cuatro y media)
export function Stars({ value = 0, size = 16, color = '#facc15', empty = '#cbd5e1', label }) {
  const percent = Math.max(0, Math.min(5, Number(value) || 0)) / 5 * 100;
  const row = (fill) => (
    <span className="flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} fill={fill} aria-hidden="true"><path d={STAR_PATH} /></svg>
      ))}
    </span>
  );
  return (
    <span className="relative inline-flex shrink-0" role="img" aria-label={label || `${Number(value).toFixed(1)} de 5 estrellas`}>
      {row(empty)}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${percent}%` }}>{row(color)}</span>
    </span>
  );
}

// Selector de 1 a 5 estrellas
export function StarPicker({ value, onChange, size = 40 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const names = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
  return (
    <div>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Calificación" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="flex h-12 w-12 items-center justify-center rounded-full transition active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <svg viewBox="0 0 24 24" width={size} height={size} fill={n <= shown ? '#facc15' : '#e2e8f0'} stroke={n <= shown ? '#d99e00' : '#cbd5e1'} strokeWidth="1"><path d={STAR_PATH} /></svg>
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-bold text-slate-600" aria-live="polite">{names[shown] || 'Toca una estrella'}</p>
    </div>
  );
}

// Formulario para calificar una compra completada. La reseña no se puede editar después.
export function ReviewModal({ pending, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sending, onClose]);

  if (!pending) return null;
  const sellerName = pending.seller?.name || pending.seller?.username || 'el vendedor';

  const submit = async (event) => {
    event.preventDefault();
    if (!rating || sending) return;
    setSending(true);
    setError('');
    try {
      await api.createReview({ orderId: pending.orderId, rating, comment: comment.trim() || undefined });
      onDone?.(pending);
    } catch (err) {
      setError(err.message || 'No se pudo enviar la reseña.');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !sending && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <h2 id="review-title" className="text-xl font-extrabold text-[#12315f]">Califica a {sellerName}</h2>
        <p className="mt-1 text-sm text-slate-500">Pedido {pending.code}{pending.folderName ? ` · ${pending.folderName}` : ''}</p>
        <div className="mt-4"><StarPicker value={rating} onChange={setRating} /></div>
        <label className="mt-3 block text-sm font-bold text-slate-600">
          Comentario (opcional)
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 300))}
            rows={4}
            placeholder="Cuenta cómo fue tu compra: estado de las cartas, trato, rapidez…"
            className="mt-1 w-full resize-none rounded-xl border border-slate-200 p-3 text-base text-slate-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
          />
          <span className="block text-right text-xs font-semibold tabular-nums text-slate-400">{comment.length}/300</span>
        </label>
        <p className="mt-1 text-xs font-semibold text-slate-500">Tu reseña será pública y no se podrá editar ni borrar después.</p>
        {error && <p className="mt-2 text-sm font-bold text-red-600" role="alert">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} disabled={sending} className="h-12 flex-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-60">Ahora no</button>
          <button type="submit" disabled={!rating || sending} className="h-12 flex-[1.4] rounded-full bg-[#12315f] text-sm font-extrabold text-white disabled:opacity-50">{sending ? 'Enviando…' : 'Publicar reseña'}</button>
        </div>
      </form>
    </div>
  );
}

// Reseñas públicas de un vendedor (perfil). Sin reseñas: solo el dueño ve una explicación.
export default function ReviewsSection({ username, isOwner = false, colors = {} }) {
  const { currentUser, appUser } = useAuth();
  const [notice, setNotice] = useState('');
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const text = colors.text || '#12315f';
  const primary = colors.primary || '#12315f';

  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    api.getSellerReviews(username, 1)
      .then((res) => { if (!cancelled && res.success) { setData(res); setItems(res.reviews || []); setPage(1); } })
      .catch(() => { /* sin reseñas visibles: el bloque no se muestra */ });
    return () => { cancelled = true; };
  }, [username]);

  if (!data) return null;
  if (data.count === 0) {
    return isOwner ? (
      <div className="rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: `${primary}55`, color: text }}>
        <p className="text-lg font-extrabold">Aún no tienes reseñas</p>
        <p className="mt-1 text-sm font-medium opacity-70">Aparecen cuando un comprador con cuenta califica un pedido que confirmaste.</p>
      </div>
    ) : null;
  }

  // Reportar: la reseña deja de mostrarse y contar hasta que se revise
  const report = async (review) => {
    if (!window.confirm('¿Reportar esta reseña? Dejará de mostrarse hasta que sea revisada.')) return;
    try {
      await api.reportReview(review.id);
      setItems((previous) => previous.filter((item) => item.id !== review.id));
      setData((previous) => (previous ? { ...previous, count: Math.max(0, previous.count - 1), average: previous.count - 1 >= 3 ? previous.average : null, showAverage: previous.count - 1 >= 3 && previous.showAverage } : previous));
      setNotice('Gracias. La reseña quedó reportada y se enviará a moderación para revisarla.');
    } catch (error) {
      setNotice(error.message || 'No se pudo reportar la reseña.');
    }
    window.setTimeout(() => setNotice(''), 4000);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.getSellerReviews(username, page + 1);
      if (res.success) { setItems((previous) => [...previous, ...(res.reviews || [])]); setPage(page + 1); }
    } catch (_error) { /* se puede reintentar */ } finally { setLoadingMore(false); }
  };

  return (
    <section className="space-y-4" aria-label="Reseñas del vendedor" style={{ color: text }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-2xl font-black leading-tight">Reseñas</h2>
        {data.showAverage ? (
          <span className="flex items-center gap-2">
            <Stars value={data.average} size={20} />
            <span className="text-lg font-extrabold tabular-nums">{data.average.toFixed(1)}</span>
            <span className="text-sm font-semibold opacity-70">· {data.count} {data.count === 1 ? 'reseña' : 'reseñas'}</span>
          </span>
        ) : (
          <span className="text-sm font-semibold opacity-70">{data.count} {data.count === 1 ? 'reseña' : 'reseñas'} · el promedio aparece desde 3 reseñas</span>
        )}
      </div>
      {notice && <p role="status" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#12315f] shadow-sm">{notice}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((review) => {
          const name = review.reviewer?.name || review.reviewer?.username || 'Comprador';
          return (
            <li key={review.id} className="rounded-2xl bg-white p-4 text-[#12315f] shadow-sm ring-1 ring-black/10">
              <div className="flex items-center gap-3">
                {review.reviewer?.photoURL ? (
                  <img src={review.reviewer.photoURL} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12315f] text-sm font-black text-white">{name[0].toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{name}</p>
                  <p className="text-xs font-semibold text-slate-500">{dateLabel(review.createdAt)}</p>
                </div>
                <Stars value={review.rating} size={16} />
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{review.comment}</p>}
              {currentUser && appUser?.username !== review.reviewer?.username && (
                <button type="button" onClick={() => report(review)} className="mt-2 text-xs font-bold text-slate-400 underline-offset-2 hover:text-red-600 hover:underline">Reportar</button>
              )}
            </li>
          );
        })}
      </ul>
      {page < data.pages && (
        <div className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="h-11 rounded-full px-6 text-sm font-extrabold ring-2 disabled:opacity-60" style={{ color: text, '--tw-ring-color': `${primary}55` }}>
            {loadingMore ? 'Cargando…' : 'Ver más reseñas'}
          </button>
        </div>
      )}
    </section>
  );
}
