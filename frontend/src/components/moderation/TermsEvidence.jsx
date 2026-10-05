import { useState } from 'react';
import { api } from '../../services/api';
import { ErrorBox, Spinner } from './shared';

const METHOD_LABELS = { 'google.com': 'Google', password: 'Correo y contraseña' };
const dateTime = (value) => new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'medium' });
const field = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-[15px] text-slate-800 outline-none focus:border-[#1e40af]';

// Evidencia legal de aceptación de Términos y Política (solo administradores). La consulta queda en la auditoría.
// El correo y la IP solo se comparan en el servidor con las huellas guardadas: nunca se guardan en claro.
export default function TermsEvidence({ initialUsername = '' }) {
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState('');
  const [ip, setIp] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.getTermsEvidence({ username: username.trim() || undefined, email: email.trim() || undefined, ip: ip.trim() || undefined }));
    } catch (err) {
      setError(err.message || 'No se pudo consultar la evidencia.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="terms-evidence-title" className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5 xl:col-span-2">
      <h2 id="terms-evidence-title" className="text-base font-extrabold text-[#12315f]">Evidencia de aceptación de Términos</h2>
      <p className="mt-1 text-sm text-slate-600">Historial completo de aceptaciones, incluidas las anuladas y las de cuentas borradas. Busca por usuario o por correo; con una IP se indica qué aceptación se hizo desde ella. Cada consulta queda registrada en la auditoría.</p>
      <form onSubmit={search} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input type="search" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Usuario, sin la @" aria-label="Usuario" maxLength={60} className={field} />
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo" aria-label="Correo" maxLength={254} className={field} />
        <input type="text" inputMode="decimal" value={ip} onChange={(event) => setIp(event.target.value)} placeholder="IP a comprobar (opcional)" aria-label="IP a comprobar" maxLength={45} className={field} />
        <button type="submit" disabled={busy || (!username.trim() && !email.trim())} className="h-12 rounded-xl bg-[#1e40af] px-5 text-sm font-bold text-white disabled:opacity-50">Consultar</button>
      </form>
      <div className="mt-3">
        <ErrorBox>{error}</ErrorBox>
        {busy && <Spinner />}
        {result && (result.acceptances.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No hay aceptaciones registradas para esa búsqueda.</p>
        ) : (
          <ul className="space-y-2">
            {result.acceptances.map((row) => (
              <li key={row.id} className={`rounded-xl px-4 py-3 text-sm ring-1 ${row.voidedAt ? 'bg-slate-50 ring-slate-200' : 'bg-emerald-50 ring-emerald-200'}`}>
                <p className="font-bold text-[#12315f]">
                  {dateTime(row.acceptedAt)} · {row.voidedAt ? `Anulada el ${dateTime(row.voidedAt)} (la cuenta se borró y volvió)` : 'Vigente'}
                </p>
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-slate-700 sm:grid-cols-2">
                  <div><dt className="inline font-semibold text-slate-500">Cuenta: </dt><dd className="inline">@{row.username || '—'}{row.accountDeleted ? ' (borrada)' : ''}</dd></div>
                  <div><dt className="inline font-semibold text-slate-500">Versiones: </dt><dd className="inline">Términos {row.termsVersion} · Privacidad {row.privacyVersion}</dd></div>
                  <div><dt className="inline font-semibold text-slate-500">Declaró 18 años o más: </dt><dd className="inline">{row.isAdult ? 'Sí' : 'No'}</dd></div>
                  <div><dt className="inline font-semibold text-slate-500">Ingreso: </dt><dd className="inline">{METHOD_LABELS[row.method] || row.method || 'No registrado'}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline font-semibold text-slate-500">Navegador: </dt><dd className="inline break-words">{row.userAgent || 'No registrado'}</dd></div>
                  {row.emailMatches !== null && <div><dt className="inline font-semibold text-slate-500">Correo consultado: </dt><dd className="inline">{row.emailMatches ? 'Coincide' : 'No coincide'}</dd></div>}
                  {row.ipMatches !== null && <div><dt className="inline font-semibold text-slate-500">IP consultada: </dt><dd className="inline">{row.ipMatches ? 'Coincide' : 'No coincide'}</dd></div>}
                </dl>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
