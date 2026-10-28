import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import VerifiedBadge from '../ui/VerifiedBadge';

const date = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : '');

// Las fotos del celular pesan varios MB: se reducen aquí (máximo 1800 px) para que suban rápido incluso con mala señal
const prepare = async (file) => {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch (_error) {
    return file;
  }
};

const PHOTOS = [
  { key: 'front', step: 2, title: 'Carnet por delante', help: 'Donde sale tu foto y tu nombre.', tips: ['Ponlo sobre una mesa, con buena luz', 'Que se vean las cuatro esquinas', 'Sin reflejos ni dedos tapando'] },
  { key: 'back', step: 3, title: 'Carnet por detrás', help: 'El lado con tu dirección y el código.', tips: ['Que se lea todo el texto', 'Sin reflejos ni dedos tapando', 'No uses fotos de pantalla ni copias'] },
  { key: 'selfie', step: 4, title: 'Foto de tu rostro', help: 'Una foto tuya, de frente y mirando a la cámara.', tips: ['Con buena luz y sin lentes de sol ni gorro', 'Solo tú en la foto', 'Que se te vea el rostro completo'], camera: true },
];

function StepTitle({ number, title, done }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${done ? 'bg-emerald-600 text-white' : 'bg-[#12315f] text-white'}`}>
        {done ? <SvgIcon name="check" translate="no" className="text-[18px]" /> : number}
      </span>
      <h3 className="text-lg font-extrabold text-[#12315f]">{title}</h3>
    </div>
  );
}

function PhotoSlot({ photo, picked, onPick, onClear, disabled }) {
  const input = useRef(null);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <StepTitle number={photo.step} title={photo.title} done={Boolean(picked)} />
      <p className="mt-1 pl-11 text-sm font-semibold text-slate-600">{photo.help}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="relative">
          <input ref={input} type="file" accept="image/*" capture={photo.camera ? 'user' : undefined} className="sr-only" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.target.value = ''; }} />
          {picked ? (
            <div className="relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
              <img src={picked.preview} alt={`Vista previa: ${photo.title}`} className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-[#12315f]/85 to-transparent p-2.5 pt-8">
                <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="h-10 flex-1 rounded-full bg-white px-3 text-sm font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-slate-100 active:scale-[0.97] disabled:opacity-60">Cambiar foto</button>
                <button type="button" disabled={disabled} onClick={onClear} aria-label={`Quitar la foto: ${photo.title}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.95] disabled:opacity-60"><SvgIcon name="close" translate="no" className="text-[20px]" /></button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1e40af]/40 bg-[#eef4ff] px-4 text-center text-[#1e40af] transition-[background-color,border-color,transform] duration-150 hover:border-[#1e40af] hover:bg-[#e3edff] active:scale-[0.99] disabled:opacity-60">
              <SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="text-[34px]" />
              <span className="text-[15px] font-extrabold">{photo.camera ? 'Tomar o subir tu foto' : 'Tomar o subir la foto'}</span>
              <span className="text-xs font-semibold text-slate-600">JPG, PNG o WebP</span>
            </button>
          )}
        </div>
        <ul className="space-y-1.5 self-center text-[13px] font-semibold text-slate-600">
          {photo.tips.map((tip) => <li key={tip} className="flex gap-2"><SvgIcon name="check_circle" translate="no" aria-hidden="true" className="mt-0.5 shrink-0 text-[16px] text-emerald-600" /><span>{tip}</span></li>)}
        </ul>
      </div>
    </div>
  );
}

// Verificación de identidad: la persona envía su RUT, teléfono, el carnet por ambos lados y una foto de su rostro; Moderación decide.
// Quien queda aprobado aparece como verificado en toda la web.
export default function IdentityVerification({ initialRut = '', initialPhone = '', formatRut, isRutValid, isPhoneValid }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState(null); // null = cargando
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [rut, setRut] = useState(initialRut || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [picked, setPicked] = useState({});
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => api.getVerification().then((res) => { setStatus(res); setLoadError(''); }).catch((error) => { setStatus({ available: false }); setLoadError(error.message || 'No se pudo cargar tu verificación.'); });
  useEffect(() => { load(); }, []);
  useEffect(() => { setRut((current) => current || initialRut || ''); setPhone((current) => current || initialPhone || ''); }, [initialRut, initialPhone]);
  useEffect(() => () => Object.values(picked).forEach((item) => URL.revokeObjectURL(item.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const rutOk = Boolean(rut.trim()) && isRutValid(rut);
  const phoneOk = Boolean(phone.trim()) && isPhoneValid(phone);
  const missing = useMemo(() => [
    !rutOk && 'tu RUT',
    !phoneOk && 'tu teléfono',
    !picked.front && 'el carnet por delante',
    !picked.back && 'el carnet por detrás',
    !picked.selfie && 'la foto de tu rostro',
    !consent && 'aceptar el tratamiento de tus datos',
  ].filter(Boolean), [rutOk, phoneOk, picked, consent]);

  const pick = async (key, file) => {
    const ready = await prepare(file);
    setPicked((current) => {
      if (current[key]) URL.revokeObjectURL(current[key].preview);
      return { ...current, [key]: { file: ready, preview: URL.createObjectURL(ready) } };
    });
  };
  const clear = (key) => setPicked((current) => {
    if (current[key]) URL.revokeObjectURL(current[key].preview);
    const { [key]: _removed, ...rest } = current;
    return rest;
  });

  const submit = async (event) => {
    event.preventDefault();
    if (missing.length || sending) return;
    setSending(true);
    setFormError('');
    try {
      const form = new FormData();
      form.append('rut', rut.trim());
      form.append('phone', phone.trim());
      for (const key of ['front', 'back', 'selfie']) form.append(key, picked[key].file, `${key}.jpg`);
      await api.submitVerification(form);
      Object.values(picked).forEach((item) => URL.revokeObjectURL(item.preview));
      setPicked({});
      setConsent(false);
      setEditing(false);
      await load();
      showToast('Solicitud enviada. Te avisaremos cuando la revisemos.', 'success');
    } catch (error) {
      setFormError(error.message || 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  if (status === null) return <div className="h-40 animate-pulse rounded-3xl bg-slate-100" role="status" aria-label="Cargando tu verificación" />;

  const request = status.request;
  const showForm = status.available !== false && !status.verified && request?.status !== 'pending' && (!request || request.status !== 'rejected' || editing);

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      {status.verified ? (
        <div className="flex items-start gap-4 rounded-3xl bg-gradient-to-br from-[#12315f] to-[#1e40af] p-5 text-white shadow-lg sm:p-6">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]"><SvgIcon name="verified_user" translate="no" className="text-[30px]" /></span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-xl font-black">Tu identidad está verificada <VerifiedBadge size={22} color="#facc15" /></h3>
            <p className="mt-1 text-sm font-semibold text-blue-100">Moderación revisó tus documentos{status.verifiedAt ? ` el ${date(status.verifiedAt)}` : ''}. La insignia de verificado ya se ve en tu perfil, tus carpetas, tus ofertas y tus mensajes.</p>
            <p className="mt-2 text-sm font-semibold text-blue-100">Tu RUT y tu teléfono quedaron bloqueados. Si necesitas corregirlos, escríbenos desde Sugerencias.</p>
          </div>
        </div>
      ) : request?.status === 'pending' ? (
        <div className="flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6" role="status">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]"><SvgIcon name="schedule" translate="no" className="text-[26px]" /></span>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[#12315f]">Estamos revisando tu solicitud</h3>
            <p className="mt-1 text-sm font-semibold text-slate-700">La enviaste el {date(request.createdAt)}. Una persona del equipo de Moderación revisa tus documentos; suele tardar pocos días. Te avisaremos por mensaje y por correo apenas haya respuesta.</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">No tienes que hacer nada más.</p>
          </div>
        </div>
      ) : request?.status === 'rejected' ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-6" role="alert">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><SvgIcon name="warning" translate="no" className="text-[26px]" /></span>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-red-900">No pudimos verificar tu identidad</h3>
              {request.reason && <p className="mt-1 text-sm font-bold text-red-900">Motivo: {request.reason}</p>}
              <p className="mt-1 text-sm font-semibold text-red-900/80">Puedes corregirlo y enviar la solicitud otra vez.</p>
              {!editing && <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.97]">Corregir y enviar de nuevo</button>}
            </div>
          </div>
        </div>
      ) : status.available === false ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700" role="status">
          {loadError || 'La verificación de identidad no está disponible por ahora. Vuelve a intentarlo más tarde.'}
        </div>
      ) : (
        <div className="rounded-3xl bg-gradient-to-br from-[#12315f] to-[#1e40af] p-5 text-white shadow-lg sm:p-6">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]"><SvgIcon name="verified_user" translate="no" className="text-[30px]" /></span>
            <div className="min-w-0">
              <h3 className="text-xl font-black">Verifica tu identidad y gana confianza</h3>
              <p className="mt-1 text-sm font-semibold text-blue-100">Quien compra prefiere a quien muestra la cara. Con la insignia de verificado, tu perfil, tus carpetas y tus ofertas destacan y se sienten más seguras.</p>
            </div>
          </div>
        </div>
      )}

      {/* Cómo funciona */}
      {!status.verified && status.available !== false && (
        <ol className="grid gap-3 sm:grid-cols-3" aria-label="Cómo funciona">
          {[['1', 'Envías tus datos', 'RUT, teléfono, el carnet por los dos lados y una foto de tu rostro.'], ['2', 'Lo revisamos', 'Moderación compara tus fotos con tus datos. Suele tardar pocos días.'], ['3', 'Recibes la insignia', 'Te avisamos y apareces como verificado en toda la web.']].map(([number, title, text], index) => (
            <li key={number} className={`rounded-2xl border bg-white p-4 shadow-sm ${(request?.status === 'pending' ? index === 1 : index === 0) ? 'border-[#1e40af] ring-2 ring-[#1e40af]/15' : 'border-slate-200'}`}>
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#facc15] text-sm font-black text-[#12315f]">{number}</span>
              <p className="mt-2 text-[15px] font-extrabold text-[#12315f]">{title}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
      )}

      {/* Formulario */}
      {showForm && (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <StepTitle number="1" title="Tus datos" done={rutOk && phoneOk} />
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wide text-slate-500">RUT</span>
                <input value={rut} onChange={(event) => setRut(formatRut(event.target.value))} placeholder="12345678-9" autoComplete="off" autoCapitalize="characters" inputMode="text" aria-invalid={Boolean(rut) && !rutOk} className={`h-12 w-full rounded-xl border bg-white px-4 text-base font-bold text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/15 ${rut && !rutOk ? 'border-red-500' : 'border-slate-300'}`} />
                <span className={`mt-1 block text-xs font-semibold ${rut && !rutOk ? 'text-red-700' : 'text-slate-500'}`}>{rut && !rutOk ? 'El RUT no es válido. Revisa el número y el dígito verificador.' : 'Tal como aparece en tu carnet.'}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-extrabold uppercase tracking-wide text-slate-500">Teléfono</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+56 9 1234 5678" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(phone) && !phoneOk} className={`h-12 w-full rounded-xl border bg-white px-4 text-base font-bold text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/15 ${phone && !phoneOk ? 'border-red-500' : 'border-slate-300'}`} />
                <span className={`mt-1 block text-xs font-semibold ${phone && !phoneOk ? 'text-red-700' : 'text-slate-500'}`}>{phone && !phoneOk ? 'Usa solo números, con + o espacios. Ej.: +56 9 1234 5678.' : 'Un número donde podamos contactarte.'}</span>
              </label>
            </div>
          </div>

          {PHOTOS.map((photo) => <PhotoSlot key={photo.key} photo={photo} picked={picked[photo.key]} onPick={(file) => pick(photo.key, file)} onClear={() => clear(photo.key)} disabled={sending} />)}

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <SvgIcon name="lock" translate="no" aria-hidden="true" className="mt-0.5 shrink-0 text-[22px] text-[#1e40af]" />
              <div className="text-sm font-semibold text-[#1a2b4b]">
                <p className="font-extrabold">Tus fotos están protegidas</p>
                <p className="mt-1">Se guardan cifradas y solo las ve el equipo de Moderación para revisar tu solicitud. Nunca se muestran en tu perfil ni a otros usuarios, y las usamos únicamente para verificar tu identidad.</p>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#1e40af]" />
              <span className="text-sm font-bold text-[#12315f]">Acepto que Carpetazo guarde mi RUT, mi teléfono y estas fotos para verificar mi identidad.</span>
            </label>
          </div>

          {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800 ring-1 ring-red-200">{formError}</p>}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            {missing.length > 0
              ? <p className="mb-3 text-sm font-semibold text-slate-600"><span className="font-extrabold text-[#12315f]">Para enviar te falta:</span> {missing.join(', ')}.</p>
              : <p className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-700"><SvgIcon name="check_circle" translate="no" aria-hidden="true" className="text-[20px]" />Todo listo para enviar.</p>}
            <button type="submit" disabled={missing.length > 0 || sending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] px-8 text-base font-extrabold text-white shadow-md transition-[background-color,transform,opacity] duration-150 hover:bg-[#12315f] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {sending && <ButtonSpinner />}{sending ? 'Enviando tus documentos…' : 'Enviar solicitud de verificación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
