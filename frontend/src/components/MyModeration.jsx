import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import ReportButton from './ReportButton';

const dateLabel = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '');
const dateTimeLabel = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso)) : '');
const APPEAL_STATUS = { open: 'Apelación en revisión', accepted: 'Apelación aceptada', rejected: 'Apelación rechazada' };
const DECISION_LABELS = { hide: 'ocultamos', remove: 'retiramos' };
const REPORT_STATUS = { received: 'Recibido', resolved: 'Resuelto' };
const RESTRICTION_TEXT = {
  suspend: 'Tu cuenta está suspendida: puedes leer y apelar, pero no publicar ni escribir.',
  ban: 'Tu cuenta está cerrada por moderación: puedes leer y apelar.',
  suspend_selling: 'Tus ventas están suspendidas: tus carpetas están ocultas y no puedes publicar nuevas.',
  restrict_messages: 'Tus mensajes están restringidos: no puedes enviar mensajes por ahora.'
};

function TextForm({ label, minLength, maxLength, submitLabel, onSubmit, onCancel }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true);
    setError('');
    try { await onSubmit(text.trim()); } catch (err) { setError(err.message || 'No se pudo enviar.'); setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-2">
      <label className="block text-sm font-extrabold text-slate-700">
        {label}
        <textarea rows={4} maxLength={maxLength} value={text} onChange={(event) => setText(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
        <span className="block text-right text-xs font-semibold text-slate-400">{text.length}/{maxLength} (mínimo {minLength})</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-full border border-slate-300 px-4 text-sm font-bold text-slate-700">Cancelar</button>}
        <button type="button" disabled={busy || text.trim().length < minLength} onClick={send} className="h-10 flex-1 rounded-full bg-[#1e40af] px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Enviando…' : submitLabel}</button>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
    <h3 className="text-lg font-black text-[#1a2b4b]">{title}</h3>
    <div className="mt-3 space-y-3">{children}</div>
  </section>
);

// "Mi perfil → Moderación": medidas sobre la cuenta y el contenido, apelaciones, descargo, mis reportes y bloqueados
export default function MyModeration() {
  const [data, setData] = useState(null);
  const [mine, setMine] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [appealing, setAppealing] = useState(null); // { kind: 'sanction' | 'report', id }
  const [responding, setResponding] = useState(null);
  const [code, setCode] = useState('');
  const [order, setOrder] = useState(null);
  const [orderError, setOrderError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api.getMyModeration(), api.getMyReports(), api.getBlocks()])
      .then(([moderation, reports, blockList]) => { setData(moderation); setMine(reports.reports || []); setBlocks(blockList.blocks || []); })
      .catch((err) => setError(err.message || 'No se pudo cargar tu información de moderación.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setNotice(text); window.setTimeout(() => setNotice(''), 5000); };

  const findOrder = async (event) => {
    event.preventDefault();
    setOrder(null);
    setOrderError('');
    try { setOrder((await api.findMyOrderByCode(code.trim())).order); } catch { setOrderError('No encontramos un pedido tuyo con ese código. Solo puedes reportar pedidos de tu cuenta.'); }
  };

  if (error) return <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{error}</p>;
  if (!data) return <div className="flex justify-center py-10" role="status" aria-label="Cargando"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>;

  const restrictionsToShow = data.restrictions.filter((type) => RESTRICTION_TEXT[type]);

  return (
    <div className="space-y-6">
      {notice && <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">{notice}</p>}

      {restrictionsToShow.length > 0 && (
        <div role="alert" className="space-y-1 rounded-3xl bg-amber-50 p-5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          {restrictionsToShow.map((type) => <p key={type}>{RESTRICTION_TEXT[type]}</p>)}
        </div>
      )}

      {data.cases.length > 0 && (
        <Section title="Necesitamos tu versión">
          {data.cases.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
              <p className="font-extrabold text-[#12315f]">Caso {item.shortCode}</p>
              {item.canRespond ? (
                <>
                  <p className="mt-1 text-slate-600">Recibimos reportes sobre tus ventas. Cuéntanos qué pasó antes de que decidamos{item.responseDueAt ? `; tienes hasta el ${dateTimeLabel(item.responseDueAt)}` : ''}.</p>
                  {responding === item.id ? (
                    <TextForm label="Tu versión de los hechos" minLength={20} maxLength={2000} submitLabel="Enviar mi versión" onCancel={() => setResponding(null)} onSubmit={async (text) => { await api.respondToCase(item.id, text); setResponding(null); flash('Recibimos tu versión. La revisaremos.'); load(); }} />
                  ) : <button type="button" onClick={() => setResponding(item.id)} className="mt-2 h-10 rounded-full bg-[#1e40af] px-5 text-sm font-bold text-white">Responder</button>}
                </>
              ) : <p className="mt-1 text-slate-600">Ya enviaste tu versión. Estamos revisando el caso.</p>}
            </div>
          ))}
        </Section>
      )}

      <Section title="Medidas sobre tu cuenta">
        {data.sanctions.length === 0 ? <p className="text-sm font-semibold text-slate-500">No tienes medidas en los últimos 90 días.</p> : data.sanctions.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <p className="font-extrabold text-[#12315f]">{item.typeLabel} <span className="text-xs font-bold text-slate-400">· {dateLabel(item.createdAt)}{item.expiresAt ? ` · hasta ${dateLabel(item.expiresAt)}` : ''}</span></p>
            <p className="mt-1 text-slate-600">{item.reason}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{item.status === 'active' ? 'Vigente' : item.status === 'expired' ? 'Venció' : 'Levantada'}{item.appealStatus ? ` · ${APPEAL_STATUS[item.appealStatus]}` : ''}</p>
            {item.canAppeal && (appealing?.id === item.id
              ? <TextForm label="¿Por qué crees que fue un error?" minLength={20} maxLength={1000} submitLabel="Enviar apelación" onCancel={() => setAppealing(null)} onSubmit={async (text) => { await api.createAppeal({ sanctionId: item.id, text }); setAppealing(null); flash('Recibimos tu apelación. Una persona del equipo la revisará.'); load(); }} />
              : <button type="button" onClick={() => setAppealing({ kind: 'sanction', id: item.id })} className="mt-2 h-10 rounded-full border-2 border-[#1e40af] px-5 text-sm font-bold text-[#1e40af]">Apelar</button>)}
          </div>
        ))}
      </Section>

      <Section title="Contenido que moderamos">
        {data.actions.length === 0 ? <p className="text-sm font-semibold text-slate-500">No hemos ocultado ni retirado contenido tuyo en los últimos 90 días.</p> : data.actions.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <p className="font-extrabold text-[#12315f]">{DECISION_LABELS[item.decision] || 'moderamos'} {item.object} <span className="text-xs font-bold text-slate-400">· {dateLabel(item.decidedAt)}</span></p>
            <p className="mt-1 text-slate-600">Motivo: {item.reason}</p>
            {item.appealStatus && <p className="mt-1 text-xs font-bold text-slate-500">{APPEAL_STATUS[item.appealStatus]}</p>}
            {item.canAppeal && (appealing?.id === item.id
              ? <TextForm label="¿Por qué crees que fue un error?" minLength={20} maxLength={1000} submitLabel="Enviar apelación" onCancel={() => setAppealing(null)} onSubmit={async (text) => { await api.createAppeal({ reportId: item.id, text }); setAppealing(null); flash('Recibimos tu apelación. Una persona del equipo la revisará.'); load(); }} />
              : <button type="button" onClick={() => setAppealing({ kind: 'report', id: item.id })} className="mt-2 h-10 rounded-full border-2 border-[#1e40af] px-5 text-sm font-bold text-[#1e40af]">Apelar</button>)}
          </div>
        ))}
        <p className="text-xs font-semibold text-slate-500">Tienes 14 días desde la medida para apelar. También puedes escribirnos a carpetazo.soporte@gmail.com.</p>
      </Section>

      <Section title="Reportar un pedido">
        <p className="text-sm font-semibold text-slate-600">Si pagaste y algo salió mal (o vendiste y el comprador actuó de mala fe), ingresa el código del pedido.</p>
        <form onSubmit={findOrder} className="flex gap-2">
          <input type="text" value={code} onChange={(event) => setCode(event.target.value)} maxLength={20} placeholder="Código del pedido" aria-label="Código del pedido" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold uppercase outline-none focus:border-[#1e40af]" />
          <button type="submit" disabled={code.trim().length < 3} className="h-11 rounded-xl bg-[#12315f] px-5 text-sm font-bold text-white disabled:opacity-50">Buscar</button>
        </form>
        {orderError && <p role="alert" className="text-sm font-bold text-red-700">{orderError}</p>}
        {order && (
          <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <p className="font-extrabold text-[#12315f]">{order.code} · {order.folderName}</p>
            <p className="text-xs font-bold text-slate-500">Eres el {order.role === 'buyer' ? 'comprador' : 'vendedor'} · {dateLabel(order.createdAt)}</p>
            <div className="mt-2">
              <ReportButton targetType="order" targetId={order.id} onReported={() => flash('Recibimos tu reporte del pedido.')} className="h-10 rounded-full bg-red-600 px-5 text-sm font-bold text-white">Reportar este pedido</ReportButton>
            </div>
          </div>
        )}
      </Section>

      <Section title="Mis reportes">
        {mine.length === 0 ? <p className="text-sm font-semibold text-slate-500">Todavía no has hecho reportes.</p> : (
          <ul className="space-y-2">
            {mine.map((item) => (
              <li key={item.shortCode} className="rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200">
                <p className="font-extrabold text-[#12315f]">{item.shortCode} <span className="text-xs font-bold text-slate-400">· {dateLabel(item.createdAt)}</span></p>
                <p className="text-slate-600">Sobre {item.about}: {item.reason}</p>
                <p className="text-xs font-bold text-slate-500">{REPORT_STATUS[item.status] || item.status}{item.status === 'resolved' ? ' · Gracias, ya lo revisamos.' : ' · Lo estamos revisando.'}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Personas bloqueadas">
        {blocks.length === 0 ? <p className="text-sm font-semibold text-slate-500">No tienes personas bloqueadas. Puedes bloquear desde el chat o al reportar a alguien.</p> : (
          <ul className="space-y-2">
            {blocks.map((item) => (
              <li key={item.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200">
                <span className="min-w-0 truncate font-bold text-[#12315f]">{item.name || item.username || 'Cuenta'}{item.username ? ` (@${item.username})` : ''}</span>
                <button type="button" onClick={async () => { try { await api.unblockUser(item.userId); load(); } catch (err) { setError(err.message || 'No se pudo desbloquear.'); } }} className="h-9 shrink-0 rounded-full border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">Desbloquear</button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
