import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../../services/pushNotifications';

function Switch({ checked, busy, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 before:absolute before:-inset-2 before:content-[''] rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 disabled:opacity-60 ${checked ? 'bg-[#1e40af]' : 'bg-slate-300'}`}
    >
      <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// Avisos de la lista de deseos: por correo y con notificaciones de este navegador
export default function WishlistAlerts() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let active = true;
    api.getNotificationSettings()
      .then(async (response) => {
        const subscription = await currentPushSubscription().catch(() => null);
        if (active) { setSettings(response.settings); setPushOn(Boolean(subscription) && typeof Notification !== 'undefined' && Notification.permission === 'granted'); }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!settings) return null;

  const toggleEmail = async (next) => {
    setBusy('email');
    try {
      const response = await api.updateNotificationSettings({ wishlistEmail: next });
      setSettings(response.settings);
      showToast(next ? 'Te avisaremos por correo' : 'Ya no recibirás avisos por correo', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo guardar', 'error');
    } finally { setBusy(''); }
  };

  const togglePush = async (next) => {
    setBusy('push');
    try {
      const response = next ? await enablePush(settings.pushPublicKey) : await disablePush();
      if (response?.settings) setSettings(response.settings);
      setPushOn(next);
      showToast(next ? 'Notificaciones activadas en este dispositivo' : 'Notificaciones desactivadas en este dispositivo', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo cambiar', 'error');
    } finally { setBusy(''); }
  };

  const sendTestEmail = async () => {
    setBusy('testEmail');
    try {
      await api.testAlertEmail();
      showToast('Te enviamos un correo de prueba. Revisa tu bandeja (y spam).', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo enviar el correo de prueba', 'error');
    } finally { setBusy(''); }
  };

  const sendTest = async () => {
    setBusy('test');
    try {
      const response = await api.testPush();
      showToast(response.delivered > 0 ? 'Te enviamos una notificación de prueba' : 'No hay dispositivos activos para avisar', response.delivered > 0 ? 'success' : 'error');
    } catch (error) {
      showToast(error.message || 'No se pudo enviar la prueba', 'error');
    } finally { setBusy(''); }
  };

  return (
    <section aria-label="Avisos de tu lista de deseos" className="rounded-2xl bg-[#eef2fa] p-3">
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#12315f]">
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px] text-[#1e40af]">notifications_active</span>
        Avísame cuando aparezcan o bajen de precio
      </p>
      <ul className="mt-2 divide-y divide-slate-200/70">
        <li className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0 text-sm font-semibold text-slate-700">Por correo</span>
          <Switch checked={settings.wishlistEmail} busy={busy === 'email'} onChange={toggleEmail} label="Avisos por correo" />
        </li>
        {settings.wishlistEmail && (
          <li className="pb-2">
            <button type="button" onClick={sendTestEmail} disabled={busy === 'testEmail'} className="min-h-9 [@media(pointer:coarse)]:min-h-11 text-xs font-bold text-[#1e40af] hover:underline focus:outline-none focus-visible:underline disabled:opacity-60">Enviarme un correo de prueba</button>
          </li>
        )}
        {settings.pushAvailable && (
          <li className="py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm font-semibold text-slate-700">Notificaciones en este dispositivo</span>
              {pushSupported()
                ? <Switch checked={pushOn} busy={busy === 'push'} onChange={togglePush} label="Notificaciones en este dispositivo" />
                : <span className="text-xs font-semibold text-slate-500">No disponible</span>}
            </div>
            {!pushSupported() && <p className="mt-1 text-xs text-slate-500">Este navegador no las admite. En iPhone, agrega Carpetazo a la pantalla de inicio para activarlas.</p>}
            {pushOn && <button type="button" onClick={sendTest} disabled={busy === 'test'} className="mt-1 min-h-9 [@media(pointer:coarse)]:min-h-11 text-xs font-bold text-[#1e40af] hover:underline focus:outline-none focus-visible:underline disabled:opacity-60">Enviarme una notificación de prueba</button>}
          </li>
        )}
      </ul>
    </section>
  );
}
