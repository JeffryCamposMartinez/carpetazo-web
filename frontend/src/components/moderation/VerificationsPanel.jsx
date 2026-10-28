import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import { EmptyState, ErrorBox, ListSkeleton, Pills, ROW, dateTime, relativeTime } from './shared';

const PHOTOS = [['front', 'Carnet por delante'], ['back', 'Carnet por detrás'], ['selfie', 'Rostro']];
const STATUS = [['pending', 'Pendientes'], ['approved', 'Aprobadas'], ['rejected', 'Rechazadas']];

function RequestRow({ request, onDecided, setError }) {
  const { showToast } = useToast();
  const [photos, setPhotos] = useState(null); // { front, back, selfie } con URL temporales
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [zoom, setZoom] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const pending = request.status === 'pending';

  useEffect(() => () => { if (photos) Object.values(photos).forEach((url) => URL.revokeObjectURL(url)); }, [photos]);

  const show = async () => {
    setLoadingPhotos(true);
    setError('');
    try {
      const entries = await Promise.all(PHOTOS.map(async ([kind]) => [kind, URL.createObjectURL(await api.verificationPhoto(request.id, kind))]));
      setPhotos(Object.fromEntries(entries));
    } catch (error) {
      setError(error.message || 'No se pudieron mostrar las fotos.');
    } finally {
      setLoadingPhotos(false);
    }
  };

  const decide = async (action) => {
    setBusy(action);
    setError('');
    try {
      if (action === 'approve') await api.approveVerification(request.id, reason.trim()); else await api.rejectVerification(request.id, reason.trim());
      showToast(action === 'approve' ? 'Identidad verificada: la persona ya tiene la insignia' : 'Solicitud rechazada: la persona verá el motivo', 'success');
    } catch (error) {
      setError(error.message || 'No se pudo completar la acción.');
    } finally {
      setBusy('');
      onDecided();
    }
  };

  const name = request.user?.fullName || request.user?.name || 'Sin nombre';
  return (
    <li className={`${ROW} mod-row-in p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-snug text-[#12315f]">{name}<span className="ml-2 text-sm font-semibold text-slate-500">@{request.user?.username || 'cuenta eliminada'}</span></p>
          <p className="mt-0.5 break-all text-sm text-slate-600">{request.user?.email}</p>
        </div>
        <time dateTime={request.createdAt} className="shrink-0 text-xs text-slate-500">{relativeTime(request.createdAt)}</time>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2"><dt className="font-bold text-slate-500">RUT</dt><dd className="font-black tabular-nums text-[#12315f]">{request.rut}</dd></div>
        <div className="flex gap-2"><dt className="font-bold text-slate-500">Teléfono</dt><dd className="font-black tabular-nums text-[#12315f]">{request.phone}</dd></div>
        {request.user?.createdAt && <div className="flex gap-2"><dt className="font-bold text-slate-500">Cuenta creada</dt><dd className="font-semibold text-slate-700">{dateTime(request.user.createdAt)}</dd></div>}
        {!pending && request.reviewedAt && <div className="flex gap-2"><dt className="font-bold text-slate-500">Decidida</dt><dd className="font-semibold text-slate-700">{dateTime(request.reviewedAt)}</dd></div>}
      </dl>
      {request.sameRutVerified && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">Este RUT ya está verificado en otra cuenta. Revisa con cuidado antes de aprobar.</p>}
      {request.sameRutOtherAccounts > 0 && !request.sameRutVerified && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 ring-1 ring-amber-200">Este RUT también aparece en solicitudes de {request.sameRutOtherAccounts} {request.sameRutOtherAccounts === 1 ? 'otra cuenta' : 'otras cuentas'}.</p>}
      {request.reason && <p className="mt-2 text-sm font-semibold text-slate-700">Motivo: {request.reason}</p>}

      <div className="mt-3">
        {photos ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {PHOTOS.map(([kind, label]) => (
              <figure key={kind} className="min-w-0">
                <button type="button" onClick={() => setZoom(photos[kind])} className="block w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 transition-transform duration-150 hover:ring-[#1e40af] active:scale-[0.99]" aria-label={`Ampliar: ${label}`}>
                  <img src={photos[kind]} alt={label} className="aspect-[4/3] w-full object-cover" />
                </button>
                <figcaption className="mt-1 text-center text-xs font-bold text-slate-600">{label}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <button type="button" disabled={loadingPhotos} onClick={show} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-[#1e40af] px-5 text-sm font-extrabold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-[#e8effc] active:scale-[0.97] disabled:opacity-60">
            {loadingPhotos ? <ButtonSpinner tone="dark" /> : <SvgIcon name="visibility" translate="no" aria-hidden="true" className="text-[20px]" />}Ver documentos
          </button>
        )}
        {!photos && <p className="mt-1.5 text-xs font-semibold text-slate-500">Cada vez que abres las fotos queda registrado quién las vio.</p>}
      </div>

      {pending && (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-600">Compara el RUT y el nombre del carnet con los datos de arriba, y que el rostro de la tercera foto sea el del carnet.</p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <button type="button" disabled={Boolean(busy) || !photos} onClick={() => decide('approve')} title={photos ? '' : 'Abre los documentos antes de aprobar'} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-emerald-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">{busy === 'approve' && <ButtonSpinner />}Aprobar</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => setRejecting((open) => !open)} aria-expanded={rejecting} className="h-11 rounded-full border-2 border-slate-500 px-4 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 hover:bg-slate-100 active:scale-[0.97] disabled:opacity-60">Rechazar</button>
          </div>
          {rejecting && (
            <div className="space-y-2 sm:max-w-md">
              <label className="block text-sm font-bold text-slate-700">Motivo del rechazo (la persona lo verá para corregirlo)
                <textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: La foto del carnet salió borrosa." className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-medium text-slate-900 outline-none focus:border-[#1e40af] focus:ring-4 focus:ring-[#1e40af]/15" />
              </label>
              <button type="button" disabled={Boolean(busy) || !reason.trim()} onClick={() => decide('reject')} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">{busy === 'reject' && <ButtonSpinner />}Confirmar rechazo</button>
            </div>
          )}
        </div>
      )}

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom('')}>
          <img src={zoom} alt="Foto ampliada" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" aria-label="Cerrar" onClick={() => setZoom('')} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#12315f]"><SvgIcon name="close" translate="no" className="text-[22px]" /></button>
        </div>
      )}
    </li>
  );
}

// Solicitudes de verificación de identidad: se revisan los documentos y se aprueba (la persona queda verificada) o se rechaza con un motivo
export default function VerificationsPanel() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.getVerifications(status).then(setData).catch((err) => { setData({ requests: [], total: 0 }); setError(err.message || 'No se pudieron cargar las solicitudes.'); });
  }, [status]);
  useEffect(() => { setData(null); load(); }, [load]);

  return (
    <section aria-label="Verificaciones de identidad" className="mx-auto max-w-3xl">
      <Pills label="Estado" value={status} onChange={setStatus} options={STATUS} />
      <ErrorBox>{error}</ErrorBox>
      {data === null ? <ListSkeleton rows={3} label="Cargando solicitudes" /> : data.requests.length === 0 ? (
        <EmptyState icon="verified_user" title={status === 'pending' ? 'No hay solicitudes por revisar' : 'Aquí no hay solicitudes todavía'}>{status === 'pending' ? 'Cuando alguien pida verificar su identidad, aparecerá aquí con su RUT y sus documentos.' : 'Las solicitudes decididas aparecerán en esta lista.'}</EmptyState>
      ) : (
        <>
          {data.total > data.requests.length && <p className="mb-3 text-sm font-semibold text-slate-600">Mostrando {data.requests.length} de {data.total}.</p>}
          <ul className="space-y-3">{data.requests.map((request) => <RequestRow key={request.id} request={request} onDecided={load} setError={setError} />)}</ul>
        </>
      )}
    </section>
  );
}
