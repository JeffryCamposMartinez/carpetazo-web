import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import usePageMeta from '../hooks/usePageMeta';
import { ButtonSpinner } from '../components/ui/LoadingState';
import SvgIcon from '../components/ui/SvgIcon';
import usePlan from '../hooks/usePlan';

const KIND_LABELS = { complaint: 'Reclamo', suggestion: 'Sugerencia', support: 'Soporte' };
const STATUS_LABELS = { open: 'Pendiente de revisión', corrected: 'Respondida' };
const dateTime = (value) => (value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '');
const compressFeedbackImage = async (file) => {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') throw new Error('No se pudo convertir la imagen a WebP.');
    return new File([blob], `reclamo-${Date.now()}.webp`, { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
};

export default function FeedbackPage() {
  const { currentUser } = useAuth();
  const { plan } = usePlan();
  const [form, setForm] = useState({ kind: 'suggestion', title: '', message: '' });
  const [attachments, setAttachments] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  usePageMeta({ title: 'Reclamos y sugerencias | Carpetazo', description: 'Envía un reclamo o sugerencia al equipo de Carpetazo.', path: '/sugerencias' });

  useEffect(() => {
    if (!currentUser) { setLoading(false); return undefined; }
    let cancelled = false;
    api.getMyFeedback()
      .then((response) => { if (!cancelled) setItems(response.feedback || []); })
      .catch((error) => { if (!cancelled) setNotice({ type: 'error', text: error.message || 'No se pudieron cargar tus envíos.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const attachmentUrls = [];
      for (const attachment of attachments) {
        const body = new FormData();
        body.append('image', await compressFeedbackImage(attachment.file));
        body.append('type', 'feedback');
        const uploaded = await api.uploadImage(body);
        if (!uploaded?.success || !uploaded.url) throw new Error(uploaded?.message || 'No se pudo revisar una imagen adjunta.');
        attachmentUrls.push(uploaded.url);
      }
      const response = await api.createFeedback({ ...form, attachments: attachmentUrls });
      setItems((previous) => [response.feedback, ...previous]);
      setForm({ kind: form.kind, title: '', message: '' });
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
      setAttachments([]);
      setNotice({ type: 'success', text: response.feedback.priority ? 'Consulta enviada con prioridad. El equipo la verá antes en su bandeja.' : 'Gracias. Tu mensaje quedó enviado al equipo de Carpetazo.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'No se pudo enviar. Inténtalo nuevamente.' });
    } finally {
      setSaving(false);
    }
  };

  const chooseImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const remaining = Math.max(0, 3 - attachments.length);
    const selected = [];
    let warning = '';
    for (const file of files) {
      if (!allowed.has(file.type)) { warning = 'Usa imágenes JPG, PNG, WebP o GIF.'; continue; }
      if (selected.length >= remaining) { warning = 'Puedes adjuntar hasta 3 imágenes.'; continue; }
      selected.push({ id: `${file.name}-${file.lastModified}-${selected.length}`, file, preview: URL.createObjectURL(file) });
    }
    if (selected.length) setAttachments((previous) => [...previous, ...selected]);
    setNotice(warning ? { type: 'error', text: warning } : null);
  };

  const removeImage = (id) => {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed) URL.revokeObjectURL(removed.preview);
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== id));
  };

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-xl px-3 py-8 sm:px-6">
        <section className="rounded-3xl border border-white/70 bg-white p-8 text-center shadow-xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af]"><SvgIcon name="feedback" translate="no" aria-hidden="true" className="text-[30px]" /></span>
          <h1 className="mt-4 text-2xl font-black text-[#12315f]">Reclamos y sugerencias</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">Inicia sesión para enviar un mensaje al equipo y revisar su estado.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Volver al inicio</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af]"><SvgIcon name="feedback" translate="no" aria-hidden="true" className="text-[27px]" /></span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#12315f]">Reclamos y sugerencias</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Cuéntanos qué ocurrió o qué mejorarías. El equipo revisará tu mensaje desde Moderación.</p>
            </div>
          </div>
          {form.kind === 'support' && <p className="mt-4 rounded-2xl border border-[#dbe3f0] bg-[#f3f7fd] px-4 py-3 text-sm leading-relaxed text-[#12315f]">{plan?.prioritySupport ? 'Tu plan incluye soporte prioritario: esta consulta quedará marcada y aparecerá antes en la bandeja del equipo.' : 'Tu consulta llegará al equipo de soporte. Los planes Legendario y Tienda la reciben con prioridad en su bandeja.'}</p>}

          {notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${notice.type === 'error' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>{notice.text}</p>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-[#12315f]">Tipo
              <select value={form.kind} onChange={(event) => setForm((previous) => ({ ...previous, kind: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#b9c7e0] bg-white px-3 text-sm font-semibold text-[#12315f] outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15">
                <option value="suggestion">Sugerencia</option>
                <option value="complaint">Reclamo</option>
                <option value="support">Consulta de soporte</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-[#12315f]">Asunto
              <input required minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Ej. Mejorar el buscador" className="mt-1.5 h-11 w-full rounded-xl border border-[#b9c7e0] px-3 text-sm font-semibold text-[#12315f] outline-none placeholder:text-slate-400 focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15" />
            </label>
            <label className="block text-sm font-bold text-[#12315f]">Mensaje
              <textarea required minLength={10} maxLength={3000} rows={7} value={form.message} onChange={(event) => setForm((previous) => ({ ...previous, message: event.target.value }))} placeholder="Describe la situación o la idea con el mayor detalle posible…" className="mt-1.5 w-full resize-y rounded-xl border border-[#b9c7e0] px-3 py-2.5 text-sm font-medium leading-relaxed text-[#12315f] outline-none placeholder:text-slate-400 focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15" />
            </label>
            <div>
              <span className="block text-sm font-bold text-[#12315f]">Imágenes <span className="font-medium text-slate-400">(opcional)</span></span>
              <p className="mt-1 text-xs text-slate-500">Adjunta hasta 3 imágenes, sin límite de peso para el archivo original. Se optimizan a WebP en tu navegador y luego se envían a R2 tras pasar el filtro automático.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="relative h-16 w-16 overflow-hidden rounded-xl border border-[#b9c7e0] bg-slate-50">
                    <img src={attachment.preview} alt={`Vista previa: ${attachment.file.name}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeImage(attachment.id)} aria-label={`Quitar ${attachment.file.name}`} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#12315f]/90 text-white">
                      <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[14px]" />
                    </button>
                  </div>
                ))}
                {attachments.length < 3 && (
                  <label className="inline-flex h-16 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#9eb1d0] bg-[#f6f9ff] px-3 text-sm font-bold text-[#1e40af] transition hover:bg-blue-50">
                    <SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="text-[20px]" />
                    Agregar imagen
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={chooseImages} aria-label="Adjuntar imágenes" />
                  </label>
                )}
              </div>
            </div>
            <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] px-5 text-sm font-extrabold text-white transition-[background-color,transform] hover:bg-[#12315f] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
              {saving ? <><ButtonSpinner /> Enviando…</> : <><SvgIcon name="send" translate="no" aria-hidden="true" className="text-[19px]" /> Enviar al equipo</>}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl sm:p-7" aria-label="Mis envíos">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div><h2 className="text-lg font-black text-[#12315f]">Mis envíos</h2><p className="mt-0.5 text-sm text-slate-500">Consulta el estado de tus mensajes.</p></div>
            <span className="rounded-full bg-[#e8effc] px-2.5 py-1 text-xs font-black text-[#1e40af]">{items.length}</span>
          </div>
          {loading ? <p className="py-8 text-center text-sm font-semibold text-slate-500">Cargando…</p> : items.length === 0 ? <p className="py-8 text-center text-sm font-semibold text-slate-500">Aún no has enviado reclamos ni sugerencias.</p> : (
            <ul className="mt-4 space-y-3">
              {items.map((item) => <li key={item.id} className="rounded-2xl border border-[#dbe3f0] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-wide text-[#1e40af]">{KIND_LABELS[item.kind] || item.kind}</span><span className="flex flex-wrap items-center gap-1.5">{item.priority && <span className="rounded-full bg-[#fff3bf] px-2 py-0.5 text-[11px] font-extrabold text-[#12315f]">Prioritario</span>}<span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${item.status === 'corrected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{STATUS_LABELS[item.status] || item.status}</span></span></div>
                <h3 className="mt-1.5 text-sm font-extrabold text-[#12315f]">{item.title}</h3><p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{item.message}</p>
                {item.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.attachments.map((image, index) => <a key={image.url} href={image.url} target="_blank" rel="noreferrer" title={image.reviewRequired ? 'Imagen marcada para revisión manual' : 'Ver imagen adjunta'} className="relative block h-16 w-16 overflow-hidden rounded-xl border border-[#dbe3f0]"><img src={image.url} alt={`Imagen adjunta ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />{image.reviewRequired && <span className="absolute inset-x-0 bottom-0 bg-amber-400/95 px-1 py-0.5 text-center text-[8px] font-black text-[#12315f]">Revisar</span>}</a>)}</div>}
                <p className="mt-2 text-xs font-semibold text-slate-400">Enviado el {dateTime(item.createdAt)}</p>
                {item.moderatorNote && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Respuesta del equipo: {item.moderatorNote}</p>}
              </li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
