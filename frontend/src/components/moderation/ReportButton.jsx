import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const COMMENT_MAX = 500;
const COMMENT_MIN_REQUIRED = 20;

// Hoja de reporte: en el teléfono sube desde abajo; en pantalla grande es un cuadro centrado.
// Pasos: 1) qué pasa, 2) cuéntanos más, 3) confirmación con el código de seguimiento.
const BLOCK_SUGGESTED = ['user.harassment', 'user.threats', 'user.spam', 'message.harassment', 'message.threats', 'message.sexual', 'message.spam', 'order.harassment'];
const EVIDENCE_MAX = 3;

function ReportSheet({ targetType, targetId, blockUserId, onClose, onReported }) {
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [comment, setComment] = useState('');
  const [extra, setExtra] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [files, setFiles] = useState([]);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [blocked, setBlocked] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (targetType === 'order' ? api.getReportReasonsFor(targetType, targetId) : api.getReportReasons(targetType))
      .then((res) => { if (!cancelled) setCatalog(res); })
      .catch(() => { if (!cancelled) setLoadError('No se pudo cargar el formulario. Intenta de nuevo.'); });
    return () => { cancelled = true; };
  }, [targetType, targetId]);

  // El fondo no se desplaza, el foco entra al cuadro y Esc lo cierra
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('button:not([disabled]), textarea, input, [href]');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const reason = catalog?.reasons.find((item) => item.code === reasonCode) || null;
  const commentLength = comment.trim().length;
  const needsComment = Boolean(reason?.requiresComment);
  const extrasOk = !reason || reason.extra.every((field) => field.optional || (extra[field.key] || '').trim());
  const canSend = Boolean(reason) && !busy && (!needsComment || commentLength >= COMMENT_MIN_REQUIRED) && extrasOk;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    setError('');
    try {
      const cleanExtra = Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value));
      const res = await api.createReport({ targetType, targetId, reasonCode, comment: comment.trim() || undefined, extra: cleanExtra });
      // Evidencias: se suben una a una; si alguna falla el reporte igual quedó enviado
      if (res.allowEvidence && files.length) {
        let failed = 0;
        for (const file of files.slice(0, EVIDENCE_MAX)) {
          try { await api.uploadReportEvidence(res.reportId, file); } catch { failed += 1; }
        }
        if (failed) setEvidenceNote(`${failed === 1 ? 'No se pudo subir 1 imagen' : `No se pudieron subir ${failed} imágenes`}. El reporte sí se envió; puedes escribirnos a carpetazo.soporte@gmail.com con las capturas.`);
      }
      setResult(res);
      setStep(3);
      onReported?.(res);
    } catch (err) {
      setError(err.status === 409 ? 'Ya enviaste este reporte.' : (err.message || 'No se pudo enviar el reporte.'));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id="report-title" className="text-lg font-black text-[#12315f]">{step === 3 ? 'Recibimos tu reporte' : `Reportar ${catalog?.label || ''}`.trim()}</h2>
            {step !== 3 && <p className="mt-0.5 text-xs font-semibold text-slate-500">Tu reporte es anónimo. La persona reportada no sabrá quién fue.</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{loadError}</p>}
          {!catalog && !loadError && <div className="flex justify-center py-10" role="status" aria-label="Cargando"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>}

          {catalog && step === 1 && (
            <fieldset>
              <legend className="mb-2 text-sm font-extrabold text-slate-700">¿Qué pasa con esto?</legend>
              <div className="space-y-2">
                {catalog.reasons.map((item) => (
                  <label key={item.code} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${reasonCode === item.code ? 'border-[#1e40af] bg-blue-50 text-[#12315f]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input type="radio" name="report-reason" value={item.code} checked={reasonCode === item.code} onChange={() => { setReasonCode(item.code); setExtra({}); setError(''); }} className="mt-0.5 h-4 w-4 shrink-0 accent-[#1e40af]" />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {catalog && step === 2 && reason && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-[#12315f]">{reason.label}</p>
              {reason.extra.map((field) => (
                <label key={field.key} className="block text-sm font-extrabold text-slate-700">
                  {field.label}
                  <input type="text" maxLength={120} value={extra[field.key] || ''} onChange={(event) => setExtra((previous) => ({ ...previous, [field.key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#1e40af]" />
                </label>
              ))}
              <label className="block text-sm font-extrabold text-slate-700">
                Cuéntanos más {needsComment ? `(obligatorio, mínimo ${COMMENT_MIN_REQUIRED} caracteres)` : '(opcional)'}
                <textarea rows={4} maxLength={COMMENT_MAX} value={comment} onChange={(event) => setComment(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#1e40af]" />
                <span className="mt-1 block text-right text-xs font-semibold text-slate-400">{comment.length}/{COMMENT_MAX}</span>
              </label>
              {reason.allowEvidence && (
                <div>
                  <label className="block text-sm font-extrabold text-slate-700">
                    Capturas o comprobantes (opcional, hasta {EVIDENCE_MAX})
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).filter((file) => file.size <= 5 * 1024 * 1024).slice(0, EVIDENCE_MAX))} className="mt-1 block w-full text-sm font-medium text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-slate-700" />
                  </label>
                  <p className="mt-1 text-xs font-semibold text-slate-500">JPG, PNG o WebP de hasta 5 MB. Solo las ve el equipo de moderación.</p>
                  {files.length > 0 && <p className="mt-1 text-xs font-bold text-[#12315f]">{files.length} {files.length === 1 ? 'imagen lista' : 'imágenes listas'} para enviar</p>}
                </div>
              )}
              {targetType.startsWith('message') && <p className="text-xs font-semibold text-slate-500">Incluiremos los últimos mensajes de esta conversación en el reporte. Nadie más del equipo tiene acceso a tus chats.</p>}
              {reason.code === 'user.scam' && <p className="text-xs font-semibold text-slate-500">Si ya pagaste, junta el comprobante y el código de pedido. Entre más datos, más rápido podemos ayudarte.</p>}
              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
            </div>
          )}

          {step === 3 && result && (
            <div className="space-y-3 text-sm text-slate-700">
              <p>Gracias. Revisaremos tu reporte y tomaremos las medidas que correspondan.</p>
              <p className="rounded-2xl bg-slate-50 px-4 py-3 font-bold text-[#12315f]">Código de seguimiento: <span className="font-mono tracking-wider">{result.shortCode}</span></p>
              {result.hidden && <p className="text-xs font-semibold text-slate-500">Mientras lo revisamos, el contenido dejó de mostrarse.</p>}
              {evidenceNote && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">{evidenceNote}</p>}
              {blockUserId && BLOCK_SUGGESTED.includes(reasonCode) && (
                blocked
                  ? <p className="text-xs font-bold text-emerald-700">Listo: bloqueaste a esta persona. Puedes desbloquearla desde Mi perfil → Moderación.</p>
                  : <button type="button" onClick={async () => { try { await api.blockUser(blockUserId); setBlocked(true); } catch (err) { setError(err.message || 'No se pudo bloquear.'); } }} className="w-full rounded-xl border-2 border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Bloquear a esta persona</button>
              )}
              {error && <p role="alert" className="text-xs font-bold text-red-700">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
          {step === 1 && (
            <>
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" disabled={!reason} onClick={() => setStep(2)} className="flex-1 rounded-xl bg-[#1e40af] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Continuar</button>
            </>
          )}
          {step === 2 && (
            <>
              <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Volver</button>
              <button type="button" disabled={!canSend} onClick={submit} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Enviando…' : 'Enviar reporte'}</button>
            </>
          )}
          {step === 3 && <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-[#1e40af] px-4 py-3 text-sm font-bold text-white">Listo</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Botón "Reportar": sin sesión pide ingresar; no aparece para el dueño del contenido (el servidor igual lo rechaza)
export default function ReportButton({ targetType, targetId, blockUserId, label = 'Reportar', className = '', onReported, children }) {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);

  if (!targetId) return null;
  const start = () => {
    if (!currentUser) { window.dispatchEvent(new Event('carpetazo:open-auth')); return; }
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={start} className={className || 'text-xs font-bold text-slate-400 underline-offset-2 hover:text-red-600 hover:underline'}>
        {children || label}
      </button>
      {open && <ReportSheet targetType={targetType} targetId={targetId} blockUserId={blockUserId} onClose={() => setOpen(false)} onReported={onReported} />}
    </>
  );
}

// Menú "Reportar" de un perfil: cuenta, foto, banner, fondo o texto (solo las opciones que existen)
export function ReportMenu({ options, label = 'Reportar', buttonClassName = '', buttonStyle }) {
  const { currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => { if (!wrapperRef.current?.contains(event.target)) setMenuOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const items = options.filter((option) => option.targetId);
  if (items.length === 0) return null;

  const choose = (option) => {
    setMenuOpen(false);
    if (!currentUser) { window.dispatchEvent(new Event('carpetazo:open-auth')); return; }
    setTarget(option);
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button type="button" aria-label={label || "Reportar"} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} style={buttonStyle} className={buttonClassName || 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-500 hover:bg-black/5 hover:text-red-600'}>
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">flag</span>
        {label}
      </button>
      {menuOpen && (
        <div role="menu" className="absolute left-0 z-20 mt-1 min-w-[14rem] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
          {items.map((option) => (
            <button key={option.targetType} type="button" role="menuitem" onClick={() => choose(option)} className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#12315f]">{option.label}</button>
          ))}
        </div>
      )}
      {target && <ReportSheet targetType={target.targetType} targetId={target.targetId} blockUserId={target.blockUserId} onClose={() => setTarget(null)} />}
    </div>
  );
}
