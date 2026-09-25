import React, { useEffect, useMemo, useState } from 'react';
import { deleteUser, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { chileData } from '../utils/chileData';

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

const profileThemes = [
  { id: 'classic-blue', name: 'Azul Carpetazo', primary: '#1e40af', secondary: '#93c5fd', accent: '#facc15', surface: '#DBEAFE', card: '#ffffff', text: '#1a2b4b', font: 'Inter' },
  { id: 'royal-purple', name: 'Púrpura Real', primary: '#5b21b6', secondary: '#7c3aed', accent: '#f0abfc', surface: '#2e1065', card: '#ede9fe', text: '#1e1b4b', font: 'Montserrat' },
  { id: 'emerald-market', name: 'Esmeralda', primary: '#047857', secondary: '#059669', accent: '#fbbf24', surface: '#064e3b', card: '#d1fae5', text: '#052e16', font: 'Nunito' },
  { id: 'crimson-fire', name: 'Fuego Carmesí', primary: '#991b1b', secondary: '#dc2626', accent: '#fb923c', surface: '#450a0a', card: '#fee2e2', text: '#450a0a', font: 'Oswald' },
  { id: 'midnight-gold', name: 'Medianoche Oro', primary: '#020617', secondary: '#1e293b', accent: '#facc15', surface: '#0f172a', card: '#f8fafc', text: '#020617', font: 'Merriweather' },
  { id: 'ocean-cyan', name: 'Océano', primary: '#155e75', secondary: '#0891b2', accent: '#22d3ee', surface: '#164e63', card: '#cffafe', text: '#083344', font: 'Poppins' },
  { id: 'rose-pop', name: 'Rosa Pop', primary: '#be185d', secondary: '#db2777', accent: '#f472b6', surface: '#831843', card: '#fce7f3', text: '#500724', font: 'Quicksand' },
  { id: 'amber-sun', name: 'Sol Ámbar', primary: '#92400e', secondary: '#d97706', accent: '#fb7185', surface: '#78350f', card: '#fef3c7', text: '#451a03', font: 'Rubik' },
  { id: 'slate-neon', name: 'Neón Slate', primary: '#0f172a', secondary: '#334155', accent: '#38bdf8', surface: '#020617', card: '#e2e8f0', text: '#0f172a', font: 'Space Grotesk' },
  { id: 'mythic-green', name: 'Mítico Verde', primary: '#365314', secondary: '#4d7c0f', accent: '#84cc16', surface: '#1a2e05', card: '#ecfccb', text: '#1a2e05', font: 'Cinzel' }
];

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
  { id: 'style', label: 'Estilo', icon: 'palette', description: 'Personaliza colores y presencia de tu perfil público.' },
  { id: 'personal', label: 'Privado', icon: 'badge', description: 'Datos privados para contacto, compras y validaciones.' },
  { id: 'addresses', label: 'Direcciones', icon: 'location_on', description: 'Lugares donde puedes recibir pedidos.' },
  { id: 'payments', label: 'Pagos', icon: 'account_balance', description: 'Datos bancarios para recibir ventas.' },
  { id: 'social', label: 'Redes', icon: 'share', description: 'Enlaces visibles en tu perfil público.' },
  { id: 'security', label: 'Cuenta', icon: 'shield', description: 'Estado de sesión y acciones sensibles.' }
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
  const { currentUser, refreshAppUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [profileData, setProfileData] = useState(emptyProfile);
  const [originalUsername, setOriginalUsername] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [usernameState, setUsernameState] = useState({ checking: false, available: null, message: '' });
  const [addressModal, setAddressModal] = useState({ open: false, index: null });
  const [addressForm, setAddressForm] = useState({ name: '', region: '', comuna: '', street: '', number: '', floor: '', depto: '', reference: '' });
  const [deleteAddressIndex, setDeleteAddressIndex] = useState(null);
  const [defaultAddressIndex, setDefaultAddressIndex] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const rutIsValid = validateRut(profileData.rut);
  const publicUrl = profileData.username ? `${window.location.origin}/${profileData.username}` : '';
  const selectedTab = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const availableComunas = useMemo(() => (
    chileData.find(region => region.region === addressForm.region)?.comunas || []
  ), [addressForm.region]);

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

  const openAddressModal = (index = null) => {
    const address = index === null ? {} : profileData.addresses[index] || {};
    setAddressForm({
      name: address.name || '',
      region: address.region || '',
      comuna: address.comuna || '',
      street: address.street || '',
      number: address.number || '',
      floor: address.floor || '',
      depto: address.depto || '',
      reference: address.reference || ''
    });
    setAddressModal({ open: true, index });
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    if (!addressForm.region || !addressForm.comuna || !addressForm.street || !addressForm.number) {
      return showFeedback('error', 'Completa región, comuna, calle y número.');
    }
    const nextAddresses = [...(profileData.addresses || [])];
    const nextAddress = { ...addressForm, isDefault: addressModal.index === null ? nextAddresses.length === 0 : Boolean(nextAddresses[addressModal.index]?.isDefault) };
    if (addressModal.index === null) nextAddresses.push(nextAddress);
    else nextAddresses[addressModal.index] = nextAddress;
    const ok = await persistProfile({ addresses: nextAddresses }, 'Dirección guardada.', 'addresses');
    if (ok) setAddressModal({ open: false, index: null });
  };

  const confirmDeleteAddress = async () => {
    const nextAddresses = [...(profileData.addresses || [])];
    const removed = nextAddresses[deleteAddressIndex];
    nextAddresses.splice(deleteAddressIndex, 1);
    if (removed?.isDefault && nextAddresses.length > 0) nextAddresses[0].isDefault = true;
    const ok = await persistProfile({ addresses: nextAddresses }, 'Dirección eliminada.', 'addresses');
    if (ok) setDeleteAddressIndex(null);
  };

  const confirmDefaultAddress = async () => {
    const nextAddresses = (profileData.addresses || []).map((address, index) => ({ ...address, isDefault: index === defaultAddressIndex }));
    const ok = await persistProfile({ addresses: nextAddresses }, 'Dirección principal actualizada.', 'addresses');
    if (ok) setDefaultAddressIndex(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.toLowerCase() !== 'eliminar') return;
    setSavingKey('delete-account');
    try {
      await api.deleteProfile();
      try {
        await deleteUser(currentUser);
      } catch (error) {
        console.warn('Firebase account deletion needs reauth or failed:', error);
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
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] overflow-hidden px-3 py-4 sm:px-5 lg:px-8">
      <div className="mb-4 overflow-hidden rounded-[1.5rem] bg-[#102a56] text-white shadow-xl sm:rounded-[2rem]">
        <div className="grid gap-4 p-4 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-4 ring-white/10 sm:h-24 sm:w-24 sm:rounded-3xl">
              {profileData.photoURL ? <img src={profileData.photoURL} alt="Avatar" className="h-full w-full object-cover" /> : <span translate="no" className="material-symbols-outlined flex h-full w-full items-center justify-center text-5xl text-white/50">person</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Mi Perfil</p>
              <h1 className="truncate text-xl font-black sm:text-4xl">{profileData.displayName || profileData.fullName || 'Usuario'}</h1>
              <p className="mt-1 truncate text-sm font-semibold text-blue-100">{profileData.email || currentUser.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <ActionButton variant="secondary" className="px-3 py-2 text-xs bg-white/10 text-white ring-white/20 hover:bg-white/15 sm:px-5 sm:py-3 sm:text-sm" onClick={loadProfile} disabled={loadingProfile}>
              <span translate="no" className="material-symbols-outlined text-[18px]">refresh</span>
              Recargar
            </ActionButton>
            <ActionButton variant="secondary" className="px-3 py-2 text-xs bg-white text-[#1e40af] sm:px-5 sm:py-3 sm:text-sm" onClick={() => publicUrl && navigator.clipboard?.writeText(publicUrl)} disabled={!publicUrl}>
              <span translate="no" className="material-symbols-outlined text-[18px]">link</span>
              Copiar perfil
            </ActionButton>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-black shadow-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-red-50 text-red-700 ring-1 ring-red-100'}`}>
          {feedback.message}
        </div>
      )}
      {profileError && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100">{profileError}</div>}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[290px_1fr] lg:gap-5">
        <aside className="min-w-0 space-y-3 lg:space-y-4">
          <div className="hidden rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-blue-100 lg:block">
            <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-[2rem] bg-slate-100 ring-4 ring-white">
              {profileData.photoURL ? <img src={profileData.photoURL} alt="Avatar" className="h-full w-full object-cover" /> : <span translate="no" className="material-symbols-outlined flex h-full w-full items-center justify-center text-6xl text-slate-300">person</span>}
              <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-black/60 py-2 text-center text-xs font-black text-white backdrop-blur">
                Cambiar foto
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
            <div className="mt-4 text-center">
              <p className="truncate text-lg font-black text-[#1a2b4b]">{profileData.displayName || 'Usuario'}</p>
              <p className="truncate text-sm font-bold text-slate-500">@{profileData.username || 'sin_usuario'}</p>
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

              {activeTab === 'style' && (
                <section className="space-y-6">
                  <div
                    className="overflow-hidden rounded-[2rem] shadow-xl ring-1 ring-slate-200"
                    style={{ backgroundColor: profileData.publicTheme?.surface || defaultPublicTheme.surface }}
                  >
                    <div
                      className="relative min-h-40 p-5 text-white"
                      style={{
                        background: `linear-gradient(135deg, ${profileData.publicTheme?.primary || defaultPublicTheme.primary}, ${profileData.publicTheme?.secondary || defaultPublicTheme.secondary})`
                      }}
                    >
                      <div className="absolute right-4 top-4 h-20 w-20 rounded-full opacity-70 blur-2xl" style={{ backgroundColor: profileData.publicTheme?.accent || defaultPublicTheme.accent }} />
                      <p className="relative text-xs font-black uppercase tracking-[0.2em] opacity-80">Vista previa</p>
                      <h3 className="relative mt-2 text-3xl font-black">{profileData.displayName || 'Tu perfil'}</h3>
                      <p className="relative mt-1 text-sm font-bold opacity-85">@{profileData.username || 'tu_usuario'}</p>
                    </div>
                    <div className="grid gap-3 bg-white/80 p-5 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Tema</p>
                        <p className="mt-1 font-black" style={{ color: profileData.publicTheme?.text || defaultPublicTheme.text }}>{profileData.publicTheme?.name || defaultPublicTheme.name}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Botón</p>
                        <span className="mt-2 inline-flex rounded-full px-4 py-2 text-sm font-black text-white" style={{ backgroundColor: profileData.publicTheme?.primary || defaultPublicTheme.primary }}>Mensaje</span>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Acento</p>
                        <div className="mt-2 h-8 rounded-full" style={{ backgroundColor: profileData.publicTheme?.accent || defaultPublicTheme.accent }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-[#1a2b4b]">Elige una paleta</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Estos colores se aplican a tu perfil público para que se sienta único.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {profileThemes.map(theme => {
                        const selected = (profileData.publicTheme?.id || defaultPublicTheme.id) === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => updateProfileField('publicTheme', theme)}
                            className={`group overflow-hidden rounded-3xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${selected ? 'border-[#1e40af] ring-4 ring-blue-100' : 'border-slate-200'}`}
                          >
                            <div className="h-20 rounded-2xl" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
                              <div className="flex h-full items-end justify-end p-3">
                                <span className="h-8 w-8 rounded-full ring-4 ring-white/60" style={{ backgroundColor: theme.accent }} />
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="font-black" style={{ color: theme.text }}>{theme.name}</p>
                                <p className="text-xs font-bold text-slate-400">{theme.primary} · {theme.accent}</p>
                              </div>
                              {selected && <span translate="no" className="material-symbols-outlined text-[#1e40af]">check_circle</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end"><ActionButton onClick={() => handleSaveProfile('style')} disabled={Boolean(savingKey)}>{savingKey === 'style' ? 'Guardando...' : 'Guardar estilo'}</ActionButton></div>
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
                <section className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><h3 className="text-lg font-black text-[#1a2b4b]">Direcciones guardadas</h3><p className="text-sm font-semibold text-slate-500">{profileData.addresses.length} dirección{profileData.addresses.length === 1 ? '' : 'es'} registrada{profileData.addresses.length === 1 ? '' : 's'}.</p></div>
                    <ActionButton onClick={() => openAddressModal()}><span translate="no" className="material-symbols-outlined text-[18px]">add_location</span>Agregar dirección</ActionButton>
                  </div>
                  {profileData.addresses.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center"><span translate="no" className="material-symbols-outlined text-5xl text-[#1e40af]/50">location_off</span><h3 className="mt-3 text-lg font-black text-[#1a2b4b]">No tienes direcciones todavía</h3><p className="mt-1 text-sm font-semibold text-slate-500">Agrega una para acelerar compras y coordinación de envíos.</p></div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {profileData.addresses.map((address, index) => (
                        <article key={`${address.street}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-black text-[#1a2b4b]">{address.name || `Dirección ${index + 1}`}</p>{address.isDefault && <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">Principal</span>}</div><span translate="no" className="material-symbols-outlined text-[#1e40af]">home_pin</span></div>
                          <p className="text-sm font-bold text-slate-700">{address.street} {address.number}{address.depto ? `, Depto ${address.depto}` : ''}</p><p className="mt-1 text-sm font-semibold text-slate-500">{address.comuna}, {address.region}</p>{address.reference && <p className="mt-2 text-xs font-semibold text-slate-400">{address.reference}</p>}
                          <div className="mt-4 flex flex-wrap gap-2"><ActionButton variant="secondary" className="px-3 py-2 text-xs" onClick={() => openAddressModal(index)}>Editar</ActionButton>{!address.isDefault && <ActionButton variant="secondary" className="px-3 py-2 text-xs" onClick={() => setDefaultAddressIndex(index)}>Principal</ActionButton>}<ActionButton variant="secondary" className="px-3 py-2 text-xs text-red-600 hover:bg-red-50" onClick={() => setDeleteAddressIndex(index)}>Eliminar</ActionButton></div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'payments' && (
                <section className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Banco"><SelectInput value={profileData.bankDetails?.bank || ''} onChange={e => updateBankField('bank', e.target.value)}><option value="">Selecciona banco</option>{chileBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}</SelectInput></Field>
                    <Field label="Tipo de cuenta"><SelectInput value={profileData.bankDetails?.accountType || ''} onChange={e => updateBankField('accountType', e.target.value)}><option value="">Selecciona tipo</option>{accountTypes.map(type => <option key={type} value={type}>{type}</option>)}</SelectInput></Field>
                    <Field label="Número de cuenta"><TextInput value={profileData.bankDetails?.accountNumber || ''} onChange={e => updateBankField('accountNumber', e.target.value)} placeholder="000000000" /></Field>
                  </div>
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

              {activeTab === 'security' && (
                <section className="space-y-6">
                  <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"><h3 className="text-lg font-black text-[#1a2b4b]">Sesión actual</h3><p className="mt-2 text-sm font-semibold text-slate-500">ID Firebase: <span className="break-all font-mono text-xs">{currentUser.uid}</span></p><p className="mt-1 text-sm font-semibold text-slate-500">Correo: {currentUser.email}</p></div>
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-5"><h3 className="text-lg font-black text-red-700">Zona de peligro</h3><p className="mt-2 text-sm font-semibold text-red-600">Esto desactiva tu perfil en la base de datos y deja tus carpetas privadas. Para confirmar escribe <b>eliminar</b>.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><TextInput value={deleteConfirmationText} onChange={e => setDeleteConfirmationText(e.target.value)} placeholder="eliminar" className="border-red-200 focus:border-red-500 focus:ring-red-100" /><ActionButton variant="danger" onClick={handleDeleteAccount} disabled={deleteConfirmationText.toLowerCase() !== 'eliminar' || savingKey === 'delete-account'}>{savingKey === 'delete-account' ? 'Eliminando...' : 'Eliminar cuenta'}</ActionButton></div></div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {addressModal.open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form onSubmit={saveAddress} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-[#1a2b4b]">{addressModal.index === null ? 'Agregar dirección' : 'Editar dirección'}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Estos datos se guardan en tu perfil.</p></div><button type="button" onClick={() => setAddressModal({ open: false, index: null })} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><span translate="no" className="material-symbols-outlined">close</span></button></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre de referencia"><TextInput value={addressForm.name} onChange={e => setAddressForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Casa, oficina..." /></Field>
              <Field label="Región"><SelectInput value={addressForm.region} onChange={e => setAddressForm(prev => ({ ...prev, region: e.target.value, comuna: '' }))}><option value="">Selecciona región</option>{chileData.map(region => <option key={region.region} value={region.region}>{region.region}</option>)}</SelectInput></Field>
              <Field label="Comuna"><SelectInput value={addressForm.comuna} onChange={e => setAddressForm(prev => ({ ...prev, comuna: e.target.value }))} disabled={!addressForm.region}><option value="">Selecciona comuna</option>{availableComunas.map(comuna => <option key={comuna} value={comuna}>{comuna}</option>)}</SelectInput></Field>
              <Field label="Calle"><TextInput value={addressForm.street} onChange={e => setAddressForm(prev => ({ ...prev, street: e.target.value }))} placeholder="Av. Principal" /></Field>
              <Field label="Número"><TextInput value={addressForm.number} onChange={e => setAddressForm(prev => ({ ...prev, number: e.target.value }))} placeholder="1234" /></Field>
              <Field label="Piso"><TextInput value={addressForm.floor} onChange={e => setAddressForm(prev => ({ ...prev, floor: e.target.value }))} placeholder="Opcional" /></Field>
              <Field label="Depto / Casa"><TextInput value={addressForm.depto} onChange={e => setAddressForm(prev => ({ ...prev, depto: e.target.value }))} placeholder="Opcional" /></Field>
              <Field label="Referencia"><TextInput value={addressForm.reference} onChange={e => setAddressForm(prev => ({ ...prev, reference: e.target.value }))} placeholder="Portón azul, conserjería..." /></Field>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><ActionButton type="button" variant="secondary" onClick={() => setAddressModal({ open: false, index: null })}>Cancelar</ActionButton><ActionButton type="submit" disabled={savingKey === 'addresses'}>{savingKey === 'addresses' ? 'Guardando...' : 'Guardar dirección'}</ActionButton></div>
          </form>
        </div>
      )}

      {deleteAddressIndex !== null && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-black text-[#1a2b4b]">Eliminar dirección</h3><p className="mt-2 text-sm font-semibold text-slate-500">Esta acción eliminará la dirección de tu perfil.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><ActionButton variant="secondary" onClick={() => setDeleteAddressIndex(null)}>Cancelar</ActionButton><ActionButton variant="danger" onClick={confirmDeleteAddress} disabled={savingKey === 'addresses'}>Eliminar</ActionButton></div></div></div>
      )}

      {defaultAddressIndex !== null && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-black text-[#1a2b4b]">Cambiar dirección principal</h3><p className="mt-2 text-sm font-semibold text-slate-500">La dirección seleccionada quedará como predeterminada.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><ActionButton variant="secondary" onClick={() => setDefaultAddressIndex(null)}>Cancelar</ActionButton><ActionButton onClick={confirmDefaultAddress} disabled={savingKey === 'addresses'}>Confirmar</ActionButton></div></div></div>
      )}
    </div>
  );
};

export default ProfilePage;
