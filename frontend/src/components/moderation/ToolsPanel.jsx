import { useState } from 'react';
import { api } from '../../services/api';
import RetentionPanel from './RetentionPanel';

const REASONS = { terms_not_accepted: 'la cuenta no ha aceptado los términos', not_configured: 'el envío no está configurado en el servidor', send_failed: 'el servidor de correo rechazó el envío', no_recipient: 'la cuenta no tiene correo válido' };

// Herramientas de administración: política de retención y prueba del envío de correos
export default function ToolsPanel() {
  const [mail, setMail] = useState({ busy: false, text: '', ok: false });

  const send = async () => {
    setMail({ busy: true, text: '', ok: false });
    try {
      const res = await api.sendTestEmail();
      setMail({ busy: false, ok: Boolean(res.sent), text: res.sent ? 'Correo enviado. Revisa tu bandeja (y spam).' : `No se envió: ${REASONS[res.reason] || 'motivo desconocido'}.` });
    } catch (err) {
      setMail({ busy: false, ok: false, text: err.message || 'No se pudo enviar el correo.' });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <RetentionPanel />
      <section aria-label="Prueba de correo" className="rounded-2xl border border-[#dbe3f0] bg-white p-5">
        <h3 className="text-lg font-extrabold text-[#12315f]">Correo de prueba</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Envía un correo a tu propia cuenta para comprobar que los avisos llegan. Solo sale si aceptaste los términos vigentes.</p>
        <button type="button" onClick={send} disabled={mail.busy} className="mt-4 h-11 rounded-full bg-[#1e40af] px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#12315f] disabled:opacity-60">{mail.busy ? 'Enviando…' : 'Enviar correo de prueba'}</button>
        {mail.text && <p role="status" className={`mt-3 text-sm font-semibold ${mail.ok ? 'text-emerald-700' : 'text-slate-700'}`}>{mail.text}</p>}
      </section>
    </div>
  );
}
