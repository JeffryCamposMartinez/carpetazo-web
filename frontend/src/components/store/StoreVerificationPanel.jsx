import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

function FilePick({ label, hint, file, onFile }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 transition hover:border-[#1e40af]">
      <SvgIcon name="photo_camera" className="text-2xl text-[#1e40af]" />
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#1a2b4b]">{label}</span><span className="block truncate text-xs text-slate-500">{file ? file.name : hint}</span></span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </label>
  );
}

// «Tienda verificada»: la tienda envía la foto de su fachada (y opcionalmente un documento); Moderación decide
export default function StoreVerificationPanel({ showToast }) {
  const [state, setState] = useState(null);
  const [facade, setFacade] = useState(null);
  const [doc, setDoc] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.getStoreVerification().then(setState).catch(() => setState({ error: true })); }, []);

  const send = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('facade', facade);
      if (doc) form.append('document', doc);
      form.append('note', note);
      const r = await api.sendStoreVerification(form);
      setState((s) => ({ ...s, request: r.request }));
      showToast('Solicitud enviada. Moderación la revisará pronto', 'success');
    } catch (error) { showToast(error.message || 'No se pudo enviar', 'error'); } finally { setBusy(false); }
  };

  if (!state) return <LoadingState variant="compact" label="Cargando verificación" />;
  if (state.verified) return <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800"><SvgIcon name="verified" className="text-2xl" />Tu tienda está verificada. La insignia aparece en tu perfil.</p>;
  if (!state.available) return <p className="text-sm text-slate-600">La verificación no está disponible por ahora.</p>;
  if (state.request?.status === 'pending') return <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-[#12315f]">Tu solicitud está en revisión. Te avisaremos cuando Moderación la revise.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">Envía una foto de la fachada o la entrada de tu local donde se vea el nombre de la tienda. Puedes sumar un documento de la empresa (opcional). Las fotos se guardan cifradas y solo las ve Moderación.</p>
      {state.request?.status === 'rejected' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-black">Solicitud anterior rechazada: </span>{state.request.reason}</p>}
      <FilePick label="Foto de la fachada (obligatoria)" hint="JPG, PNG o WebP, que se lea el nombre" file={facade} onFile={setFacade} />
      <FilePick label="Documento de la empresa (opcional)" hint="Inicio de actividades, patente comercial…" file={doc} onFile={setDoc} />
      <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota para Moderación (opcional)" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20" />
      <div className="flex justify-end"><button type="button" disabled={!facade || busy} onClick={send} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1e40af] px-5 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner tone="dark" />}Enviar a revisión</button></div>
    </div>
  );
}
