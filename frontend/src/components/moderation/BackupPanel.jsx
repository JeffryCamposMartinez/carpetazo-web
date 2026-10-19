import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import ConfirmModal from '../ui/ConfirmModal';

const dateLabel = (value) => new Date(value).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Respaldo de la base de datos: se genera al momento y se descarga; nada queda guardado en el servidor. Solo administradores.
export default function BackupPanel() {
  const [status, setStatus] = useState(undefined); // undefined = cargando, null = sin permiso
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', ok: false });

  const load = () => api.getBackupStatus().then((response) => setStatus(response)).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);

  const run = async () => {
    setConfirming(false);
    setBusy(true);
    setMessage({ text: '', ok: false });
    try {
      const { blob, name } = await api.downloadBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage({ text: `Respaldo descargado: ${name}. Guárdalo en un lugar seguro.`, ok: true });
      load();
    } catch (error) {
      setMessage({ text: error.message || 'No se pudo crear el respaldo.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <section aria-label="Respaldo de la base de datos" className="rounded-2xl border border-[#dbe3f0] bg-white p-5">
      <h3 className="text-lg font-extrabold text-[#12315f]">Respaldo de la base de datos</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">Descarga una copia de los datos de Carpetazo: personas, carpetas, cartas, pedidos, ventas presenciales, mensajes, planes y moderación. No incluye el catálogo de cartas, que se vuelve a cargar desde sus archivos. Se crea al momento y no queda guardada en el servidor.</p>
      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">El archivo contiene datos personales (correos, RUT, datos de pago y mensajes). Guárdalo cifrado y no lo compartas.</p>
      <p className="mt-3 text-sm text-slate-500">{status.last ? `Último respaldo: ${dateLabel(status.last.at)}${status.last.by ? ` por @${status.last.by}` : ''}.` : 'Todavía no se ha descargado ningún respaldo desde aquí.'}</p>
      <button type="button" onClick={() => setConfirming(true)} disabled={busy} className="mt-4 h-11 rounded-full bg-[#ffcb05] px-6 text-sm font-extrabold text-[#1a2b4b] shadow-sm transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-60">{busy ? 'Preparando el respaldo…' : 'Descargar respaldo'}</button>
      {busy && <p role="status" className="mt-3 text-sm font-semibold text-slate-600">Puede tardar un momento según el tamaño de la base. No cierres esta ventana.</p>}
      {message.text && <p role="status" className={`mt-3 text-sm font-semibold ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p>}
      <ConfirmModal
        isOpen={confirming}
        title="Descargar respaldo"
        message="Se descargará un archivo con datos personales de todas las cuentas. La descarga queda registrada en la auditoría."
        confirmText="Descargar"
        isDestructive={false}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
