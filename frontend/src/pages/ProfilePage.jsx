import React, { useEffect, useMemo, useState } from 'react';
import { deleteUser, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { chileData } from '../config/chileData';
import PasswordCard from '../components/auth/PasswordCard';
import MyModeration from '../components/moderation/MyModeration';
import { PALETTES } from '../config/profileThemes';
import { useToast } from '../components/ui/ToastProvider';
import ThemedSelect from '../components/ui/ThemedSelect';

const chileBanks = [
  'Banco de Chile - Edwards',
  'Banco Internacional',
  'Banco Estado',
  'ScotiaBank',
  'BCI',
  'Banco Do Brasil',
  'Corpbanca',
  'BICE',
  'HSBC Bank',
  'Banco Santander',
  'Banco Itau',
  'Banco Security',
  'Banco Falabella',
  'Banco Ripley',
  'Rabobank',
  'Banco Consorcio',
  'Banco Paris',
  'BBVA',
  'COOPEUCH',
  'Mercado Pago',
  'Global66',
  'Tenpo'
];

const accountTypes = ['Cuenta corriente', 'Cuenta vista', 'Cuenta de ahorro', 'Cuenta Rut'];

const profileThemes = PALETTES;

const defaultPublicTheme = profileThemes[0];

const emptyProfile = {
  fullName: '',
  displayName: '',
  username: '',
  email: '',
  photoURL: '',
  bio: '',
  phone: '',
  rut: '',
  facebookUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  publicTheme: defaultPublicTheme,
  addresses: [],
  bankDetails: { bank: '', accountType: '', accountNumber: '' }
};

const tabs = [
  { id: 'general', label: 'Perfil', icon: 'person', description: 'Tu identidad pública y cómo te ven otros usuarios.' },
  { id: 'personal', label: 'Privado', icon: 'badge', description: 'Datos privados para contacto, compras y validaciones.' },
  { id: 'addresses', label: 'Ubicación', icon: 'location_on', description: 'Tu región y comuna: se muestran en tu perfil público para que te encuentren.' },
  { id: 'payments', label: 'Pagos', icon: 'account_balance', description: 'Datos bancarios para recibir ventas.' },
  { id: 'social', label: 'Redes', icon: 'share', description: 'Enlaces visibles en tu perfil público.' },
  { id: 'security', label: 'Cuenta', icon: 'shield', description: 'Estado de sesión y acciones sensibles.' },
  { id: 'moderation', label: 'Moderación', icon: 'gavel', description: 'Medidas, apelaciones, tus reportes y personas bloqueadas.' }
];

const normalizeUsername = (value = '') => (
  String(value).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
);

const formatRut = (value = '') => {
  const cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length <= 1) return cleanRut;
  return `${cleanRut.slice(0, -1)}-${cleanRut.slice(-1)}`;
};

const validateRut = (rut = '') => {
  if (!rut) return true;
  const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 8) return false;
  const body = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number.parseInt(body[i], 10) * multiplier;
    multiplier = multiplier < 7 ? multiplier + 1 : 2;
  }
  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return dv === expectedDv;
};

const mapUserToProfile = (user = {}, currentUser = null) => ({
  ...emptyProfile,
  fullName: user.fullName || user.name || currentUser?.displayName || '',
  displayName: user.name || user.fullName || currentUser?.displayName || '',
  username: user.username || '',
  email: user.email || currentUser?.email || '',
  photoURL: user.photoURL || currentUser?.photoURL || '',
  bio: user.bio || '',
  phone: user.phone || '',
  rut: user.rut || '',
  facebookUrl: user.facebookUrl || '',
  instagramUrl: user.instagramUrl || '',
  youtubeUrl: user.youtubeUrl || '',
  publicTheme: {
    ...defaultPublicTheme,
    ...(user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {})
  },
  addresses: Array.isArray(user.addresses) ? user.addresses : [],
  bankDetails: {
    ...emptyProfile.bankDetails,
    ...(user.bankDetails && typeof user.bankDetails === 'object' ? user.bankDetails : {})
  }
});

const compactProfilePayload = (profile) => ({
  fullName: profile.fullName?.trim() || null,
  name: profile.displayName?.trim() || profile.fullName?.trim() || null,
  username: normalizeUsername(profile.username),
  photoURL: profile.photoURL || null,
  bio: profile.bio?.trim() || null,
  phone: profile.phone?.trim() || null,
  rut: profile.rut?.trim() || null,
  facebookUrl: profile.facebookUrl?.trim() || null,
  instagramUrl: profile.instagramUrl?.trim() || null,
  youtubeUrl: profile.youtubeUrl?.trim() || null,
  publicTheme: profile.publicTheme || defaultPublicTheme,
  addresses: profile.addresses || [],
  bankDetails: profile.bankDetails || {}
});

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-2 block text-xs font-semibold text-slate-400">{hint}</span>}
  </label>
);

const TextInput = ({ className = '', ...props }) => (
  <input
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-[#1e40af] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
  />
);

const SelectInput = ({ children, className = '', ...props }) => (
  <select
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-[#1e40af] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`}
  >
    {children}
  </select>
);

const ActionButton = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-[#1e40af] text-white hover:bg-[#1d4ed8] disabled:bg-slate-300',
    secondary: 'bg-white text-[#1e40af] ring-1 ring-blue-100 hover:bg-blue-50 disabled:text-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-200'
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:shadow-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const ProfilePage = () => {
  const { showToast } = useToast();
  const { currentUser, appUser, refreshAppUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [profileData, setProfileData] = useState(emptyProfile);
  const [originalUsername, setOriginalUsername] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [usernameState, setUsernameState] = useState({ checking: false, available: null, message: '' });
  const [locationForm, setLocationForm] = useState(() => ({ region: profileData.addresses?.[0]?.region || '', comuna: profileData.addresses?.[0]?.comuna || '' }));
  // La ubicación guardada llega junto con el perfil (y cambia si se recarga)
  useEffect(() => {
    setLocationForm({ region: profileData.addresses?.[0]?.region || '', comuna: profileData.addresses?.[0]?.comuna || '' });
  }, [profileData.addresses]);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const rutIsValid = validateRut(profileData.rut);
  const publicUrl = profileData.username ? `${window.location.origin}/${profileData.username}` : '';
  const selectedTab = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const availableComunas = useMemo(() => (
    chileData.find(region => region.region === locationForm.region)?.comunas || []
  ), [locationForm.region]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const loadProfile = async () => {
    if (!currentUser) return;
    setLoadingProfile(true);
    setProfileError('');
    try {
      let response;
      try {
        response = await api.getMe();
      } catch (error) {
        if (String(error.message || '').includes('404')) {
          response = await api.syncUser({
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
            username: normalizeUsername(currentUser.displayName || currentUser.email?.split('@')[0] || currentUser.uid),
            photoURL: currentUser.photoURL || ''
          });
        } else {
          throw error;
        }
      }
      const mapped = mapUserToProfile(response.user || {}, currentUser);
      setProfileData(mapped);
      setOriginalUsername(mapped.username);
      setUsernameState({ checking: false, available: true, message: '' });
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfileError('No pudimos cargar tu perfil. Revisa la conexión e intenta nuevamente.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [currentUser]);

  useEffect(() => {
    const username = normalizeUsername(profileData.username);
    if (!username) {
      setUsernameState({ checking: false, available: null, message: '' });
      return undefined;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setUsernameState({ checking: false, available: false, message: 'Usa 3 a 20 caracteres: letras, números o _.' });
      return undefined;
    }
    if (username === originalUsername) {
      setUsernameState({ checking: false, available: true, message: 'Es tu usuario actual.' });
      return undefined;
    }
    setUsernameState({ checking: true, available: null, message: 'Verificando disponibilidad...' });
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.checkUsername(username);
        setUsernameState({
          checking: false,
          available: Boolean(result.available),
          message: result.available ? 'Usuario disponible.' : 'Ese usuario ya está en uso.'
        });
      } catch (error) {
        setUsernameState({ checking: false, available: false, message: error.message || 'No se pudo verificar el usuario.' });
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [profileData.username, originalUsername]);

  const updateProfileField = (field, value) => setProfileData(prev => ({ ...prev, [field]: value }));
  const updateBankField = (field, value) => setProfileData(prev => ({ ...prev, bankDetails: { ...(prev.bankDetails || {}), [field]: value } }));

  const persistProfile = async (payload, successMessage, key = 'profile') => {
    setSavingKey(key);
    try {
      const response = await api.updateProfile(payload);
      if (response.success && response.user) {
        const mapped = mapUserToProfile(response.user, currentUser);
        setProfileData(mapped);
        setOriginalUsername(mapped.username);
        await refreshAppUser?.();
      }
      showFeedback('success', successMessage);
      return true;
    } catch (error) {
      console.error('Error saving profile:', error);
      showFeedback('error', error.message || 'No se pudo guardar. Intenta nuevamente.');
      return false;
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveProfile = async (section = 'profile') => {
    if (!rutIsValid) return showFeedback('error', 'El RUT ingresado no es válido.');
    if (usernameState.available === false || usernameState.checking) return showFeedback('error', 'Revisa el nombre de usuario antes de guardar.');
    const payload = compactProfilePayload(profileData);
    const ok = await persistProfile(payload, 'Perfil actualizado correctamente.', section);
    if (ok) {
      try {
        await updateFirebaseProfile(currentUser, { displayName: payload.name || undefined, photoURL: payload.photoURL || undefined });
        await refreshAppUser?.();
      } catch (error) {
        console.warn('Firebase profile update skipped:', error);
      }
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showFeedback('error', 'Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return showFeedback('error', 'La imagen debe pesar menos de 10 MB.');
    
    showFeedback('info', 'Subiendo foto...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', 'avatar');

      const response = await api.uploadImage(formData);
      if (response.success) {
        const nextPhotoURL = response.url;
        setProfileData(prev => ({ ...prev, photoURL: nextPhotoURL }));
        try {
          await updateFirebaseProfile(currentUser, { photoURL: nextPhotoURL });
        } catch (error) {
          console.warn('Firebase photo update skipped:', error);
        }
        await refreshAppUser?.();
        showFeedback('success', 'Foto actualizada correctamente.');
      } else {
        showFeedback('error', response.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      showFeedback('error', 'No se pudo subir la foto.');
    }
  };

  // Solo región y comuna: nunca se pide la dirección exacta
  const saveLocation = async (event) => {
    event.preventDefault();
    if (!locationForm.region || !locationForm.comuna) {
      showFeedback('error', 'Elige tu región y tu comuna.');
      return;
    }
    await persistProfile({ addresses: [{ id: 'ubicacion', name: 'Mi ubicación', region: locationForm.region, comuna: locationForm.comuna, isDefault: true }] }, 'Ubicación guardada.', 'addresses');
  };

  const clearLocation = async () => {
    const ok = await persistProfile({ addresses: [] }, 'Ubicación eliminada.', 'addresses');
    if (ok) setLocationForm({ region: '', comuna: '' });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.toLowerCase() !== 'eliminar') return;
    setSavingKey('delete-account');
    try {
      await api.deleteProfile();
      let accessDeleted = true;
      try {
        await deleteUser(currentUser);
      } catch (error) {
        // Firebase exige haber iniciado sesión hace poco para borrar el acceso; los datos ya se eliminaron
        accessDeleted = false;
        console.warn('Firebase account deletion needs reauth or failed:', error);
      }
      if (!accessDeleted) {
        await logout().catch(() => {});
        showToast('Tus datos personales fueron eliminados. Tu acceso (Google o correo) sigue existiendo: si vuelves a entrar, empezarás con una cuenta vacía.', { type: 'info', duration: 10000 });
      }
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      showFeedback('error', error.message || 'No se pudo eliminar la cuenta.');
    } finally {
      setSavingKey('');
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-100">
          <span translate="no" className="material-symbols-outlined text-5xl text-[#1e40af]">lock</span>
          <h1 className="mt-4 text-2xl font-black text-[#1a2b4b]">Inicia sesión para ver tu perfil</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Esta sección usa tu sesión para cargar y guardar datos de forma segura.</p>
          <Link to="/bienvenida" className="mt-5 inline-flex h-12 items-center rounded-full bg-[#facc15] px-7 text-[15px] font-extrabold text-[#12315f] shadow-sm transition-transform duration-150 active:scale-[0.97]">Iniciar sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] overflow-hidden px-3 py-4 sm:px-5 lg:px-8">
      {feedback && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-black shadow-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-red-50 text-red-700 ring-1 ring-red-100'}`}>
          {feedback.message}
        </div>
      )}
      {profileError && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{profileError}</div>}
      {appUser?.moderationHidden?.length > 0 && (
        <div role="status" className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          Moderación revisó o retiró {appUser.moderationHidden.map((part) => ({ photo: 'tu foto de perfil', banner: 'tu banner', wallpaper: 'tu fondo de perfil', text: 'el texto de tu perfil' })[part] || part).join(', ')} por incumplir las normas. Puedes subir otro contenido. Si crees que fue un error, escríbenos a carpetazo.soporte@gmail.com.
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[290px_1fr] lg:gap-5">
        <aside className="min-w-0 space-y-3 lg:space-y-4">
          <div className="hidden rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-blue-100 lg:block">
            <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-[2rem] bg-slate-100 ring-4 ring-white">
              {profileData.photoURL ? <img src={profileData.photoURL} alt="Avatar" className="h-full w-full object-cover" /> : <span translate="no" className="material-symbols-outlined flex h-full w-full items-center justify-center text-6xl text-slate-300">person</span>}
              <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-black/60 py-2 text-center text-xs font-black text-white backdrop-blur transition hover:bg-black/70">
                Cambiar foto
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
            <div className="mt-4 text-center">
              <p className="truncate text-lg font-black text-[#1a2b4b]">{profileData.displayName || 'Usuario'}</p>
              <p className="truncate text-sm font-bold text-slate-500">@{profileData.username || 'sin_usuario'}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-400">{profileData.email || currentUser.email}</p>
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => publicUrl && window.open(publicUrl, '_blank', 'noopener,noreferrer')} disabled={!publicUrl} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-[#1e40af] ring-1 ring-blue-100 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                <span translate="no" className="material-symbols-outlined text-[18px]">storefront</span>
                Ver perfil público
              </button>
              <button type="button" onClick={loadProfile} disabled={loadingProfile} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <span translate="no" className="material-symbols-outlined text-[18px]">refresh</span>
                Recargar
              </button>
            </div>
          </div>

          <nav className="flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-blue-100 lg:flex-col lg:overflow-visible lg:rounded-[1.75rem]">
            {tabs.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex min-w-[92px] items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-black transition sm:min-w-[110px] sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3 sm:text-xs lg:min-w-0 lg:justify-start lg:text-sm ${activeTab === tab.id ? 'bg-[#1e40af] text-white shadow-md' : 'text-slate-500 hover:bg-blue-50 hover:text-[#1e40af]'}`}>
                <span translate="no" className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-blue-100 sm:p-6 lg:rounded-[1.75rem] lg:p-8">
          {loadingProfile ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <span translate="no" className="material-symbols-outlined animate-spin text-5xl text-[#1e40af]">sync</span>
              <h2 className="mt-4 text-xl font-black text-[#1a2b4b]">Cargando tu perfil</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">Leyendo datos desde la base de datos.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 border-b border-slate-100 pb-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1e40af]">{selectedTab.label}</p>
                <h2 className="mt-1 break-words text-xl font-black leading-tight text-[#1a2b4b] sm:text-3xl">{selectedTab.description}</h2>
              </div>

              {activeTab === 'general' && (
                <section className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nombre completo"><TextInput value={profileData.fullName} onChange={e => updateProfileField('fullName', e.target.value)} placeholder="Ej. Jeffry Campos" /></Field>
                    <Field label="Nombre visible"><TextInput value={profileData.displayName} onChange={e => updateProfileField('displayName', e.target.value)} placeholder="Nombre público" /></Field>
                    <Field label="Usuario público" hint={usernameState.message}>
                      <div className="relative">
                        <TextInput value={profileData.username} onChange={e => updateProfileField('username', normalizeUsername(e.target.value))} placeholder="mi_usuario" className={usernameState.available === false ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : usernameState.available ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100' : ''} />
                        <span translate="no" className={`material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[20px] ${usernameState.checking ? 'animate-spin text-slate-400' : usernameState.available === false ? 'text-red-500' : usernameState.available ? 'text-emerald-500' : 'text-slate-300'}`}>{usernameState.checking ? 'sync' : usernameState.available === false ? 'cancel' : usernameState.available ? 'check_circle' : 'alternate_email'}</span>
                      </div>
                    </Field>
                    <Field label="Correo de acceso" hint="El correo viene desde tu autenticación y no se edita aquí."><TextInput value={profileData.email || currentUser.email || ''} disabled /></Field>
                  </div>
                  <Field label="Biografía">
                    <textarea value={profileData.bio} onChange={e => updateProfileField('bio', e.target.value.slice(0, 500))} placeholder="Cuéntale a la comunidad qué coleccionas, vendes o buscas..." className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-[#1e40af] focus:ring-4 focus:ring-blue-100" />
                  </Field>
                  <div className="flex justify-end"><ActionButton onClick={() => handleSaveProfile('general')} disabled={Boolean(savingKey) || usernameState.checking || usernameState.available === false}>{savingKey === 'general' ? 'Guardando...' : 'Guardar perfil'}</ActionButton></div>
                </section>
              )}

              {activeTab === 'personal' && (
                <section className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="RUT" hint={!rutIsValid ? 'El RUT ingresado no es válido.' : 'Dato privado, solo para operaciones internas.'}><TextInput value={profileData.rut} onChange={e => updateProfileField('rut', formatRut(e.target.value))} placeholder="12345678-9" className={!rutIsValid ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''} /></Field>
                    <Field label="Teléfono"><TextInput value={profileData.phone} onChange={e => updateProfileField('phone', e.target.value)} placeholder="+56 9 1234 5678" /></Field>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-[#1a2b4b] ring-1 ring-blue-100">Estos datos no se muestran públicamente. Se guardan asociados solamente a tu usuario autenticado.</div>
                  <div className="flex justify-end"><ActionButton onClick={() => handleSaveProfile('personal')} disabled={Boolean(savingKey) || !rutIsValid}>{savingKey === 'personal' ? 'Guardando...' : 'Guardar datos privados'}</ActionButton></div>
                </section>
              )}

              {activeTab === 'addresses' && (
                <form onSubmit={saveLocation} className="space-y-5">
                  <div>
                    <h3 className="text-lg font-black text-[#1a2b4b]">Tu ubicación</h3>
                    <p className="text-sm font-semibold text-slate-500">Solo pedimos región y comuna, no tu dirección exacta. Se muestran en tu perfil público, en tus carpetas y en la lista de vendedores, y permiten que los compradores te encuentren por comuna.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Región"><ThemedSelect value={locationForm.region} onChange={value => setLocationForm({ region: value, comuna: '' })} options={chileData.map(item => ({ value: item.region, label: item.region }))} placeholder="Selecciona región" icon="map" ariaLabel="Región" /></Field>
                    <Field label="Comuna"><ThemedSelect value={locationForm.comuna} onChange={value => setLocationForm(prev => ({ ...prev, comuna: value }))} options={availableComunas.map(comuna => ({ value: comuna, label: comuna }))} placeholder={locationForm.region ? 'Selecciona comuna' : 'Primero elige la región'} searchable searchPlaceholder="Escribe tu comuna…" icon="location_on" ariaLabel="Comuna" disabled={!locationForm.region} /></Field>
                  </div>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    {profileData.addresses.length > 0 && <ActionButton type="button" variant="secondary" onClick={clearLocation} disabled={savingKey === 'addresses'}>Quitar mi ubicación</ActionButton>}
                    <ActionButton type="submit" disabled={savingKey === 'addresses'}>{savingKey === 'addresses' ? 'Guardando…' : 'Guardar ubicación'}</ActionButton>
                  </div>
                </form>
              )}

              {activeTab === 'payments' && (
                <section className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Banco"><SelectInput value={profileData.bankDetails?.bank || ''} onChange={e => updateBankField('bank', e.target.value)}><option value="">Selecciona banco</option>{chileBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}</SelectInput></Field>
                    <Field label="Tipo de cuenta"><SelectInput value={profileData.bankDetails?.accountType || ''} onChange={e => updateBankField('accountType', e.target.value)}><option value="">Selecciona tipo</option>{accountTypes.map(type => <option key={type} value={type}>{type}</option>)}</SelectInput></Field>
                    <Field label="Número de cuenta"><TextInput value={profileData.bankDetails?.accountNumber || ''} onChange={e => updateBankField('accountNumber', e.target.value)} placeholder="000000000" /></Field>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <input
                      type="checkbox"
                      checked={profileData.publicTheme?.shareBankInOrders === 'on'}
                      onChange={e => updateProfileField('publicTheme', { ...(profileData.publicTheme || {}), shareBankInOrders: e.target.checked ? 'on' : 'off' })}
                      className="mt-1 h-5 w-5 rounded border-slate-300 text-[#1e40af] focus:ring-[#1e40af]"
                    />
                    <span>
                      <span className="block text-sm font-black text-slate-800">Enviar estos datos automáticamente en los pedidos</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-500">Si lo activas, cada pedido que llegue por WhatsApp o por mensaje incluirá tu nombre, RUT, banco y número de cuenta. Si no, el comprador te los pedirá y tú se los entregas cuando quieras. Por defecto está desactivado.</span>
                    </span>
                  </label>
                  <div className="flex justify-end"><ActionButton onClick={() => handleSaveProfile('payments')} disabled={Boolean(savingKey)}>{savingKey === 'payments' ? 'Guardando...' : 'Guardar datos bancarios'}</ActionButton></div>
                </section>
              )}

              {activeTab === 'social' && (
                <section className="space-y-5">
                  {[['facebookUrl', 'Facebook', 'facebook.com/'], ['instagramUrl', 'Instagram', 'instagram.com/'], ['youtubeUrl', 'YouTube', 'youtube.com/']].map(([field, label, prefix]) => (
                    <Field key={field} label={label}><div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-[#1e40af] focus-within:ring-4 focus-within:ring-blue-100"><span className="flex items-center bg-slate-50 px-4 text-sm font-black text-slate-400">{prefix}</span><input value={profileData[field] || ''} onChange={e => updateProfileField(field, e.target.value)} className="min-w-0 flex-1 px-4 py-3 text-sm font-bold text-slate-800 outline-none" placeholder="tu_usuario" /></div></Field>
                  ))}
                  <div className="flex justify-end"><ActionButton onClick={() => handleSaveProfile('social')} disabled={Boolean(savingKey)}>{savingKey === 'social' ? 'Guardando...' : 'Guardar redes'}</ActionButton></div>
                </section>
              )}

              {activeTab === 'moderation' && <MyModeration />}

              {activeTab === 'security' && (
                <section className="space-y-6">
                  <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"><h3 className="text-lg font-black text-[#1a2b4b]">Sesión actual</h3><p className="mt-2 text-sm font-semibold text-slate-500">ID Firebase: <span className="break-all font-mono text-xs">{currentUser.uid}</span></p><p className="mt-1 text-sm font-semibold text-slate-500">Correo: {currentUser.email}</p></div>
                  <PasswordCard />
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-5"><h3 className="text-lg font-black text-red-700">Zona de peligro</h3><p className="mt-2 text-sm font-semibold text-red-600">Esto elimina tus datos personales (nombre, correo, RUT, teléfono, direcciones, datos bancarios, lista de deseos y tus mensajes), deja tus carpetas privadas y no se puede deshacer. Para confirmar escribe <b>eliminar</b>.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><TextInput value={deleteConfirmationText} onChange={e => setDeleteConfirmationText(e.target.value)} placeholder="eliminar" className="border-red-200 focus:border-red-500 focus:ring-red-100" /><ActionButton variant="danger" onClick={handleDeleteAccount} disabled={deleteConfirmationText.toLowerCase() !== 'eliminar' || savingKey === 'delete-account'}>{savingKey === 'delete-account' ? 'Eliminando...' : 'Eliminar cuenta'}</ActionButton></div></div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

    </div>
  );
};

export default ProfilePage;
