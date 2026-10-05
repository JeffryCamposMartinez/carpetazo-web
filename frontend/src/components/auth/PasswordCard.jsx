import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const MIN_LENGTH = 8;

// Contraseña opcional para una cuenta que ingresa con Google: sirve con el mismo correo de Google (no es una cuenta aparte)
export default function PasswordCard() {
  const { currentUser, hasGoogleLogin, hasPasswordLogin, setAccountPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }

  if (!currentUser) return null;

  const cardClass = 'rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200';

  // Cuentas antiguas que ingresan solo con correo y contraseña: se cambia desde "¿La olvidaste?" al ingresar
  if (!hasGoogleLogin) {
    return (
      <div className={cardClass}>
        <h3 className="text-lg font-black text-[#1a2b4b]">Contraseña</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Tu cuenta ingresa con correo y contraseña. Para cambiar la contraseña, cierra sesión y usa «¿La olvidaste?» al ingresar.
        </p>
      </div>
    );
  }

  const errorText = (error) => {
    switch (error?.code) {
      case 'auth/weak-password': return `La contraseña es muy débil. Usa al menos ${MIN_LENGTH} caracteres.`;
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request': return 'Cancelaste la confirmación con Google. Intenta de nuevo.';
      case 'auth/popup-blocked': return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta de nuevo.';
      case 'auth/provider-already-linked': return 'Esta cuenta ya tiene una contraseña. Usa «Cambiar contraseña».';
      case 'auth/credential-already-in-use':
      case 'auth/email-already-in-use': return 'Ese correo ya tiene una contraseña en otra cuenta. Escríbenos para ayudarte.';
      default: return 'No pudimos guardar la contraseña. Intenta de nuevo.';
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < MIN_LENGTH) return setMessage({ type: 'error', text: `Usa al menos ${MIN_LENGTH} caracteres.` });
    if (password.length > 128) return setMessage({ type: 'error', text: 'La contraseña es demasiado larga (máximo 128 caracteres).' });
    if (password !== confirm) return setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
    setBusy(true);
    try {
      const had = hasPasswordLogin;
      await setAccountPassword(password);
      setPassword('');
      setConfirm('');
      setMessage({ type: 'ok', text: had ? 'Listo, cambiaste tu contraseña.' : `Listo. Ahora también puedes ingresar con ${currentUser.email} y tu contraseña.` });
    } catch (error) {
      console.error('Error al guardar la contraseña:', error);
      setMessage({ type: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70';

  return (
    <form onSubmit={submit} className={cardClass} noValidate>
      <h3 className="text-lg font-black text-[#1a2b4b]">{hasPasswordLogin ? 'Cambiar contraseña' : 'Crear una contraseña'}</h3>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        {hasPasswordLogin
          ? <>Ya puedes ingresar con <b>{currentUser.email}</b> y tu contraseña, además de con Google.</>
          : <>Es opcional. Con ella podrás ingresar con <b>{currentUser.email}</b> y tu contraseña, además de con Google. Funciona solo con ese correo de Google.</>}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-[#12315f]">
          {hasPasswordLogin ? 'Nueva contraseña' : 'Contraseña'}
          <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-bold text-[#12315f]">
          Repite la contraseña
          <input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} />
        </label>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">Mínimo {MIN_LENGTH} caracteres. Por seguridad, Google puede pedirte confirmar que eres tú.</p>

      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message.text}</p>
      )}

      <button type="submit" disabled={busy || !password || !confirm} className="mt-4 h-12 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? 'Guardando…' : hasPasswordLogin ? 'Cambiar contraseña' : 'Crear contraseña'}
      </button>
    </form>
  );
}
