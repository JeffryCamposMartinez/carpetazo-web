import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';
import LoadingState from '../ui/LoadingState';

const DEFAULT_SETTINGS = {
  tagline: 'Compra, vende y comparte tu colección de cartas TCG en todo Chile.',
  address: '',
  email: 'contacto@carpetazo.cl',
  phone: '',
  facebookUrl: 'https://facebook.com/carpetazo.cl',
  instagramUrl: 'https://instagram.com/carpetazo.cl',
  whatsappUrl: '',
  discordUrl: '',
  twitterUrl: '',
  tiktokUrl: '',
  theme: 'dark',
  copyrightText: '',
  infoLinks: [
    { label: 'Nosotros', url: '/bienvenida' },
    { label: 'Términos y condiciones', url: '/terminos' },
    { label: 'Políticas de privacidad', url: '/privacidad' }
  ]
};

export default function FooterSettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  useEffect(() => {
    let cancelled = false;
    api.getFooterSettings()
      .then((res) => {
        if (!cancelled && res?.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...res.settings });
        }
      })
      .catch((err) => {
        console.error('Error fetching footer settings:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setStatusMessage(null);
  };

  const handleLinkChange = (index, field, value) => {
    setSettings((prev) => {
      const nextLinks = [...(prev.infoLinks || [])];
      nextLinks[index] = { ...nextLinks[index], [field]: value };
      return { ...prev, infoLinks: nextLinks };
    });
    setStatusMessage(null);
  };

  const handleAddLink = () => {
    setSettings((prev) => ({
      ...prev,
      infoLinks: [...(prev.infoLinks || []), { label: 'Nuevo enlace', url: '/' }]
    }));
  };

  const handleRemoveLink = (index) => {
    setSettings((prev) => ({
      ...prev,
      infoLinks: prev.infoLinks.filter((_, i) => i !== index)
    }));
  };

  const handleReset = () => {
    if (window.confirm('¿Deseas restablecer los valores predeterminados del pie de página?')) {
      setSettings(DEFAULT_SETTINGS);
      setStatusMessage({ type: 'info', text: 'Se restablecieron los valores en el formulario. Haz clic en "Guardar cambios" para aplicarlos.' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await api.updateFooterSettings(settings);
      if (res?.success) {
        setStatusMessage({ type: 'success', text: '¡Pie de página actualizado correctamente en todo el sitio!' });
        window.dispatchEvent(new CustomEvent('carpetazo:footer-settings-updated', { detail: res.settings }));
      } else {
        setStatusMessage({ type: 'error', text: res?.message || 'Error al guardar la configuración.' });
      }
    } catch (err) {
      console.error('Error updating footer settings:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Error de conexión al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="page" tone="light" label="Cargando configuración del pie de página…" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Encabezado */}
      <div className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#12315f] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1e40af]">view_agenda</span>
              Pie de página del sitio
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Personaliza el pie de página que ven todos los usuarios y visitantes al final de Carpetazo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="self-start sm:self-auto text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4"
          >
            Restablecer valores predeterminados
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Columna 1: Presentación y Lema */}
        <div className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#12315f] border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            Columna 1: Identidad y Lema
          </h3>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Lema / Eslogan
            </label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              placeholder="Ej: Compra, vende y comparte tu colección de cartas TCG en todo Chile."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-500">Se muestra justo debajo del logo principal de Carpetazo.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Tema visual de fondo
            </label>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="footer_theme"
                  checked={settings.theme === 'dark'}
                  onChange={() => handleChange('theme', 'dark')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Oscuro (Azul marino / Estilo Carpetazo)
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="footer_theme"
                  checked={settings.theme === 'light'}
                  onChange={() => handleChange('theme', 'light')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Claro (Blanco)
              </label>
            </div>
          </div>
        </div>

        {/* Columna 2: Contacto */}
        <div className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#12315f] border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
            Columna 2: Contacto
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <SvgIcon name="mail" className="text-sm text-slate-400" />
                Correo de contacto
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contacto@carpetazo.cl"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-500">Se abrirá la aplicación de correo al hacer clic.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <SvgIcon name="location_on" className="text-sm text-slate-400" />
                Dirección física (opcional)
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Dejar vacío si no aplica"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-500">Si se deja vacío, la dirección y su ícono no se muestran.</p>
            </div>
          </div>
        </div>

        {/* Columna 3: Enlaces de Información */}
        <div className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-base font-bold text-[#12315f] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Columna 3: Enlaces de Información
            </h3>
            <button
              type="button"
              onClick={handleAddLink}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              + Agregar enlace
            </button>
          </div>

          <div className="space-y-3">
            {(settings.infoLinks || []).map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => handleLinkChange(idx, 'label', e.target.value)}
                  placeholder="Texto del enlace"
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                  placeholder="Ruta (ej: /terminos)"
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLink(idx)}
                  title="Eliminar enlace"
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Columna 4: Redes Sociales */}
        <div className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#12315f] border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-600"></span>
            Columna 4: Redes Sociales (Síguenos)
          </h3>
          <p className="text-xs text-slate-500">Las redes con URL configurada aparecerán tanto con sus íconos en la primera columna como en la lista de enlaces de &quot;Síguenos&quot;.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Facebook (URL)
              </label>
              <input
                type="url"
                value={settings.facebookUrl}
                onChange={(e) => handleChange('facebookUrl', e.target.value)}
                placeholder="https://facebook.com/..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Instagram (URL)
              </label>
              <input
                type="url"
                value={settings.instagramUrl}
                onChange={(e) => handleChange('instagramUrl', e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                WhatsApp (URL o enlace directo)
              </label>
              <input
                type="text"
                value={settings.whatsappUrl}
                onChange={(e) => handleChange('whatsappUrl', e.target.value)}
                placeholder="https://wa.me/569..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Discord (URL de invitación)
              </label>
              <input
                type="url"
                value={settings.discordUrl}
                onChange={(e) => handleChange('discordUrl', e.target.value)}
                placeholder="https://discord.gg/..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                X / Twitter (URL)
              </label>
              <input
                type="url"
                value={settings.twitterUrl}
                onChange={(e) => handleChange('twitterUrl', e.target.value)}
                placeholder="https://x.com/..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                TikTok (URL)
              </label>
              <input
                type="url"
                value={settings.tiktokUrl}
                onChange={(e) => handleChange('tiktokUrl', e.target.value)}
                placeholder="https://tiktok.com/@..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Barra inferior: Derechos de autor */}
        <div className="rounded-2xl border border-[#dbe3f0] bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#12315f] border-b border-slate-100 pb-2">
            Derechos de autor / Copyright
          </h3>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Texto de copyright personalizado (opcional)
            </label>
            <input
              type="text"
              value={settings.copyrightText}
              onChange={(e) => handleChange('copyrightText', e.target.value)}
              placeholder={`© ${new Date().getFullYear()} Carpetazo.cl. Todos los derechos reservados.`}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Si se deja en blanco, se genera automáticamente con el año en curso.</p>
          </div>
        </div>

        {/* Feedback message */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {statusMessage.type === 'success' ? 'check_circle' : statusMessage.type === 'error' ? 'error' : 'info'}
            </span>
            {statusMessage.text}
          </div>
        )}

        {/* Botón Guardar */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="h-12 rounded-full bg-[#1e40af] px-8 text-sm font-extrabold text-white shadow-md transition-all duration-150 active:scale-[0.98] hover:bg-[#12315f] hover:shadow-lg disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Guardando cambios…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                Guardar cambios en el pie de página
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
