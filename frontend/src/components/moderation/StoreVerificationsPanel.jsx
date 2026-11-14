import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import { EmptyState, ErrorBox, ListSkeleton, Pills, ROW, relativeTime } from './shared';

const STATUS = [['pending', 'Pendientes'], ['approved', 'Aprobadas'], ['rejected', 'Rechazadas']];

function Row({ request, onDecided, setError }) {
  const { showToast } = useToast();
  const [photos, setPhotos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => () => { if (photos) Object.values(photos).forEach((u) => URL.revokeObjectURL(u)); }, [photos]);
  const show = async () => {
    setLoading(true);
    try {
      const kinds = request.hasDocument ? ['facade', 'document'] : ['facade'];
      setPhotos(Object.fromEntries(await Promise.all(kinds.map(async (k) => [k, URL.createObjectURL(await api.storeVerificationPhoto(request.id, k))]))));
    } catch { setError('No se pudieron mostrar las fotos.'); } finally { setLoading(false); }
  };
  const decide = async (approve) => {
    setBusy(approve ? 'approve' : 'reject');
    try {
      if (approve) await api.approveStoreVerification(request.id, reason.trim()); else await api.rejectStoreVerification(request.id, reason.trim());
      showToast(approve ? 'Tienda verificada' : 'Solicitud rechazada', 'success');
    } catch (error) { setError(error.message || 'No se pudo completar la acción.'); } finally { setBusy(''); onDecided(); }
  };
  return (
    <li className={`${ROW} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-extrabold text-[#12315f]">{request.user.name} <span className="text-sm font-semibold text-slate-500">@{request.user.username}</span></p>
        <time className="text-xs text-slate-500">{relativeTime(request.createdAt)}</time>
      </div>
      <p className="text-sm text-slate-600">{request.user.address || 'Sin dirección'}{request.user.comuna ? `, ${request.user.comuna}` : ''}</p>
      {request.note && <p className="mt-1 text-sm text-slate-700">Nota: {request.note}</p>}
      {request.reason && <p className="mt-1 text-sm font-semibold text-slate-700">Motivo: {request.reason}</p>}
      <div className="mt-3">
        {photos ? (
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(photos).map(([k, url]) => <figure key={k}><img src={url} alt={k === 'facade' ? 'Fachada' : 'Documento'} className="aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-slate-200" /><figcaption className="mt-1 text-center text-xs font-bold text-slate-600">{k === 'facade' ? 'Fachada' : 'Documento'}</figcaption></figure>)}</div>
        ) : (
          <button type="button" disabled={loading} onClick={show} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-[#1e40af] px-5 text-sm font-extrabold text-[#1e40af] transition hover:bg-[#e8effc] active:scale-[0.97] disabled:opacity-60">{loading ? <ButtonSpinner tone="dark" /> : <SvgIcon name="visibility" className="text-[20px]" />}Ver fotos</button>
        )}
      </div>
      {request.status === 'pending' && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <p className="text-sm text-slate-600">Revisa que se lea el nombre de la tienda y que coincida con la dirección publicada.</p>
          <textarea rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (obligatorio para rechazar)" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#1e40af] focus:outline-none" />
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <button type="button" disabled={Boolean(busy) || !photos} onClick={() => decide(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-50">{busy === 'approve' && <ButtonSpinner />}Aprobar</button>
            <button type="button" disabled={Boolean(busy) || !reason.trim()} onClick={() => decide(false)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#12315f] text-sm font-extrabold text-white transition hover:bg-[#1e40af] disabled:opacity-50">{busy === 'reject' && <ButtonSpinner />}Rechazar</button>
          </div>
        </div>
      )}
    </li>
  );
}

// Cola de «Tienda verificada»: fachada (y documento) de tiendas con plan Tienda
export default function StoreVerificationsPanel() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { api.getStoreVerifications(status).then(setData).catch((e) => { setData({ requests: [] }); setError(e.message || 'No se pudieron cargar.'); }); }, [status]);
  useEffect(() => { setData(null); load(); }, [load]);
  return (
    <section aria-label="Verificaciones de tiendas" className="mx-auto mt-8 max-w-3xl">
      <h2 className="mb-2 text-lg font-extrabold text-[#12315f]">Tiendas por verificar</h2>
      <Pills label="Estado" value={status} onChange={setStatus} options={STATUS} />
      <ErrorBox>{error}</ErrorBox>
      {data === null ? <ListSkeleton rows={2} label="Cargando tiendas" /> : data.requests.length === 0 ? (
        <EmptyState icon="storefront" title={status === 'pending' ? 'No hay tiendas por revisar' : 'Aquí no hay solicitudes'}>Cuando una tienda pida la insignia, aparecerá aquí con la foto de su fachada.</EmptyState>
      ) : <ul className="space-y-3">{data.requests.map((r) => <Row key={r.id} request={r} onDecided={load} setError={setError} />)}</ul>}
    </section>
  );
}
