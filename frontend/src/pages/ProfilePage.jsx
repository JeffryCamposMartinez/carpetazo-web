import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { chileData } from '../utils/chileData';

const chileBanks = [
  "Banco de Chile - Edwards",
  "Banco Internacional",
  "Banco Estado",
  "ScotiaBank",
  "BCI",
  "Banco Do Brasil",
  "Corpbanca",
  "BICE",
  "HSBC Bank",
  "Banco Santander",
  "Banco Itau",
  "Banco Security",
  "Banco Falabella",
  "Banco Ripley",
  "Rabobank",
  "Banco Consorcio",
  "Banco Paris",
  "BBVA",
  "COOPEUCH",
  "Mercado Pago",
  "Global66",
  "Tenpo"
];

const accountTypes = [
  "Cuenta corriente", 
  "Cuenta vista", 
  "Cuenta de ahorro",
  "Cuenta Rut"
];

const CustomDropdown = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer focus:outline-none focus:border-[#2563eb] transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? "text-slate-800 font-bold" : "text-slate-400 font-medium"}>
          {value || placeholder}
        </span>
        <span className="material-symbols-outlined text-slate-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto">
          {options.map((opt, i) => (
            <div 
              key={i} 
              className={`px-5 py-3 hover:bg-blue-50 cursor-pointer text-sm transition-colors ${value === opt ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 font-medium'}`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProfilePage = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [profileData, setProfileData] = useState({
    fullName: '', displayName: '', bio: '', phone: '', rut: '', 
    facebookUrl: '', instagramUrl: '', youtubeUrl: '', 
    addresses: [], bankDetails: {}
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rutError, setRutError] = useState('');
  
  // Modal states
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressFormData, setAddressFormData] = useState({ region: '', comuna: '', street: '', number: '', floor: '', depto: '', name: '', reference: '' });
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [availableComunas, setAvailableComunas] = useState([]);
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [deleteConfirmationIndex, setDeleteConfirmationIndex] = useState(null);
  const [defaultConfirmationIndex, setDefaultConfirmationIndex] = useState(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  const tabsContainerRef = useRef(null);

  const tabs = [
    { id: 'general', label: 'General', icon: 'person' },
    { id: 'avatar', label: 'Avatar', icon: 'image' },
    { id: 'personal', label: 'Información Personal', icon: 'badge' },
    { id: 'redes', label: 'Redes Sociales', icon: 'share' },
    { id: 'direcciones', label: 'Direcciones', icon: 'location_on' },
    { id: 'bancarios', label: 'Datos Bancarios', icon: 'account_balance' },
    { id: 'cuenta', label: 'Cuenta', icon: 'settings' }
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(prev => ({ ...prev, ...docSnap.data() }));
        }
      }
    };
    fetchProfile();
  }, [currentUser]);

  useEffect(() => {
    const handleTabsScroll = () => {
      if (tabsContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
      }
    };
    
    // Initial check and event listeners
    handleTabsScroll();
    window.addEventListener('resize', handleTabsScroll);
    
    // Also attach to the ref directly for robust mobile tracking
    const currentRef = tabsContainerRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleTabsScroll);
    }

    return () => {
      window.removeEventListener('resize', handleTabsScroll);
      if (currentRef) {
        currentRef.removeEventListener('scroll', handleTabsScroll);
      }
    };
  }, [tabsContainerRef.current]);

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      bankDetails: {
        ...(prev.bankDetails || {}),
        [field]: value
      }
    }));
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (rutError) return;
    setSavingProfile(true);
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await setDoc(docRef, profileData, { merge: true });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSavingProfile(false);
    }
  };

  const formatRut = (value) => {
    let cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length <= 1) return cleanRut;
    let body = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1);
    return `${body}-${dv}`;
  };

  const validateRut = (rut) => {
    if (!rut) return true;
    const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length < 8) return false;
    let body = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1);
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier < 7 ? multiplier + 1 : 2;
    }
    let expectedDv = 11 - (sum % 11);
    if (expectedDv === 11) expectedDv = '0';
    else if (expectedDv === 10) expectedDv = 'K';
    else expectedDv = expectedDv.toString();
    return dv === expectedDv;
  };

  const handleRutChange = (e) => {
    const formatted = formatRut(e.target.value);
    setProfileData(prev => ({ ...prev, rut: formatted }));
    if (formatted && !validateRut(formatted)) {
      setRutError('El RUT ingresado no es válido');
    } else {
      setRutError('');
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/webp', 0.5);
        setProfileData(prev => ({
          ...prev,
          avatarBase64: compressedBase64
        }));
      };
    };
  };

  const openAddAddressModal = () => {
    setAddressFormData({ region: '', comuna: '', street: '', number: '', floor: '', depto: '', name: '', reference: '' });
    setEditingAddressIndex(null);
    setIsAddressModalOpen(true);
  };

  const handleEditAddressClick = (idx) => {
    const addr = profileData.addresses[idx];
    setAddressFormData(addr);
    const regionData = chileData.find(r => r.region === addr.region);
    setAvailableComunas(regionData ? regionData.comunas : []);
    setEditingAddressIndex(idx);
    setIsAddressModalOpen(true);
  };

  const handleAddressInputChange = (field, value) => {
    setAddressFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'region') {
      const regionData = chileData.find(r => r.region === value);
      setAvailableComunas(regionData ? regionData.comunas : []);
      setAddressFormData(prev => ({ ...prev, comuna: '' }));
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    const newAddresses = [...(profileData.addresses || [])];
    if (editingAddressIndex !== null) {
      newAddresses[editingAddressIndex] = { ...newAddresses[editingAddressIndex], ...addressFormData };
    } else {
      const newAddr = { ...addressFormData, isDefault: newAddresses.length === 0 };
      newAddresses.push(newAddr);
    }
    setProfileData(prev => ({ ...prev, addresses: newAddresses }));
    setIsAddressModalOpen(false);
    
    // Auto save
    const docRef = doc(db, 'users', currentUser.uid);
    await setDoc(docRef, { addresses: newAddresses }, { merge: true });
  };

  const handleDeleteAddress = (idx) => {
    setDeleteConfirmationIndex(idx);
  };

  const confirmDeleteAddress = async () => {
    const newAddresses = [...(profileData.addresses || [])];
    const wasDefault = newAddresses[deleteConfirmationIndex].isDefault;
    newAddresses.splice(deleteConfirmationIndex, 1);
    
    if (wasDefault && newAddresses.length > 0) {
      newAddresses[0].isDefault = true;
    }
    
    setProfileData(prev => ({ ...prev, addresses: newAddresses }));
    setDeleteConfirmationIndex(null);
    
    const docRef = doc(db, 'users', currentUser.uid);
    await setDoc(docRef, { addresses: newAddresses }, { merge: true });
  };

  const confirmSetDefaultAddress = async () => {
    const newAddresses = [...(profileData.addresses || [])].map((addr, idx) => ({
      ...addr,
      isDefault: idx === defaultConfirmationIndex
    }));
    setProfileData(prev => ({ ...prev, addresses: newAddresses }));
    setDefaultConfirmationIndex(null);
    
    const docRef = doc(db, 'users', currentUser.uid);
    await setDoc(docRef, { addresses: newAddresses }, { merge: true });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.toLowerCase() !== 'eliminar') return;
    
    setIsDeletingAccount(true);
    try {
      const foldersRef = collection(db, 'folders');
      const qFolders = query(foldersRef, where('userId', '==', currentUser.uid));
      const foldersSnap = await getDocs(qFolders);
      
      for (const folderDoc of foldersSnap.docs) {
        await setDoc(folderDoc.ref, { isPublic: false, isDeactivated: true }, { merge: true });
      }

      await setDoc(doc(db, 'users', currentUser.uid), {
        isActive: false,
        isDeactivated: true,
        deactivatedAt: new Date().toISOString()
      }, { merge: true });
      
      await deleteUser(currentUser);
      
      navigate('/');
    } catch (error) {
      console.error("Error al eliminar la cuenta:", error);
      alert("Error al eliminar la cuenta. Por seguridad, es posible que debas cerrar sesión, volver a ingresar e intentarlo nuevamente.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-[1500px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none flex flex-col relative z-10 min-h-[calc(100vh-80px)] pb-12">
          <div className="flex-1 bg-transparent p-4 md:p-8 flex flex-col relative z-20">
            
            <div className="flex flex-col lg:flex-row gap-8 relative z-10 w-full h-full max-w-7xl mx-auto">
              
              {/* Sidebar Menu */}
              <div className="lg:w-[320px] shrink-0 flex flex-col gap-6">
                
                {/* Avatar / User Info Card */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-row lg:flex-col items-center lg:text-center relative overflow-hidden group gap-4 lg:gap-0">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent -z-10"></div>
                  
                  <div className="relative cursor-pointer lg:mb-5 shrink-0">
                    <div className="w-20 h-20 lg:w-32 lg:h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center relative z-10">
                      {profileData.avatarBase64 || currentUser?.photoURL ? (
                        <img src={profileData.avatarBase64 || currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[64px] text-slate-300">person</span>
                      )}
                    </div>
                    {/* Hover overlay for changing avatar */}
                    <div className="absolute inset-0 bg-[#1a2b4b]/60 backdrop-blur-sm rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
                      <span className="material-symbols-outlined text-white text-3xl mb-1">photo_camera</span>
                      <span className="text-white text-xs font-bold">Cambiar Foto</span>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/gif, image/webp" 
                        onChange={handleAvatarUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="absolute -inset-4 bg-blue-400 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 -z-10"></div>
                  </div>
                  
                  <div className="flex flex-col items-start lg:items-center min-w-0">
                    <h2 className="text-xl lg:text-2xl font-black text-[#1a2b4b] truncate w-full leading-tight mb-0.5 lg:mb-1">
                      {profileData.displayName || currentUser?.displayName || 'Usuario'}
                    </h2>
                    <p className="text-xs lg:text-sm text-slate-500 truncate w-full font-medium">{currentUser?.email}</p>
                  </div>
                </div>

                {/* Vertical Tabs */}
                <div className="relative w-full">
                  <div className="lg:hidden flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 opacity-80">
                    <span className="material-symbols-outlined text-[14px] animate-[bounce_1s_infinite_horizontal]">swipe</span>
                    Desliza para más opciones
                  </div>
                  <div 
                    ref={tabsContainerRef}
                    className="bg-white/95 backdrop-blur-xl rounded-3xl p-3 lg:p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-row lg:flex-col gap-2 overflow-x-auto hide-scrollbar lg:overflow-visible relative scroll-smooth"
                  >
                    <div className="hidden lg:block px-4 py-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Ajustes de Cuenta</h3>
                    </div>
                    {tabs.filter(t => t.id !== 'avatar').map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-w-[115px] flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-4 py-3 lg:py-4 px-3 lg:px-5 font-bold text-xs lg:text-sm transition-all duration-300 rounded-2xl shrink-0 lg:w-full lg:text-left ${
                          activeTab === tab.id 
                            ? 'bg-[#1a2b4b] text-white shadow-[0_8px_16px_-6px_rgba(26,43,75,0.4)] lg:scale-[1.02] border border-[#1a2b4b]/10' 
                            : 'bg-transparent text-slate-500 hover:text-[#1a2b4b] hover:bg-slate-50 hover:shadow-sm'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[20px] lg:text-[24px] transition-colors duration-300 ${activeTab === tab.id ? 'text-[#ffcb05]' : 'text-slate-400'}`}>{tab.icon}</span>
                        <span className="truncate w-full text-center lg:text-left">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Left fade indicator - mobile only */}
                  <div className={`absolute left-0 top-7 bottom-0 w-12 bg-gradient-to-r from-[#1a2b4b]/40 to-transparent rounded-l-3xl pointer-events-none lg:hidden flex items-center justify-start pl-1.5 transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="material-symbols-outlined text-white animate-pulse text-xl drop-shadow-md">chevron_left</span>
                  </div>

                  {/* Right fade indicator - mobile only */}
                  <div className={`absolute right-0 top-7 bottom-0 w-12 bg-gradient-to-l from-[#1a2b4b]/40 to-transparent rounded-r-3xl pointer-events-none lg:hidden flex items-center justify-end pr-1.5 transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="material-symbols-outlined text-white animate-pulse text-xl drop-shadow-md">chevron_right</span>
                  </div>
                </div>

              </div>

              {/* Dynamic Content Area */}
              <div className="flex-1 flex flex-col">
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 md:p-8 lg:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 relative overflow-hidden min-h-[500px] lg:min-h-[600px] flex flex-col">
                  {/* Decorative blobs */}
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[80px] -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-[60px] -z-10 transform -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

                  <div className="flex items-center justify-between mb-8 lg:mb-10 relative z-10 border-b border-slate-100 pb-6 lg:pb-8">
                    <div>
                      <h1 className="text-3xl lg:text-4xl font-black text-[#1a2b4b] tracking-tight mb-2">
                        {tabs.find(t => t.id === activeTab)?.label}
                      </h1>
                      <p className="text-slate-500 font-medium text-sm">
                        {activeTab === 'general' && 'Información básica de tu perfil público'}
                        {activeTab === 'personal' && 'Datos privados para facturación y seguridad'}
                        {activeTab === 'direcciones' && 'Gestiona dónde quieres recibir tus compras'}
                        {activeTab === 'bancarios' && 'Configura tus cuentas para recibir pagos'}
                        {activeTab === 'redes' && 'Conecta tus plataformas favoritas'}
                        {activeTab === 'cuenta' && 'Opciones avanzadas y zona de peligro'}
                      </p>
                    </div>
                  </div>

                  {showSuccess && (
                    <div className="mb-8 bg-emerald-50 text-emerald-700 p-5 rounded-2xl border border-emerald-200 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out] shadow-sm">
                      <span className="material-symbols-outlined text-[24px]">check_circle</span>
                      <span className="font-bold">¡Cambios guardados con éxito!</span>
                    </div>
                  )}

                  <div className="w-full relative z-10 flex-1">
                    
                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                      <form onSubmit={handleSaveProfile} className="flex flex-col h-full justify-between">
                        <div className="flex flex-col gap-8 max-w-3xl">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Nombre completo</label>
                              <input 
                                type="text" 
                                value={profileData.fullName || ''}
                                onChange={(e) => handleInputChange('fullName', e.target.value)}
                                className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#2563eb] transition-all font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                placeholder="Ej. Juan Pérez"
                              />
                            </div>
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Nombre de usuario</label>
                              <div className="relative flex items-center">
                                <span className="absolute left-5 text-slate-400 font-bold">@</span>
                                <input 
                                  type="text" 
                                  value={profileData.displayName || ''}
                                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                                  className="w-full pl-10 pr-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#2563eb] transition-all font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                  placeholder="mi-usuario"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Correo de acceso</label>
                              <div className="relative">
                                <input 
                                  type="email" 
                                  value={currentUser.email || ''}
                                  disabled
                                  className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-100/80 text-slate-500 cursor-not-allowed font-medium pr-24"
                                />
                                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2563eb] text-sm font-bold hover:underline">Cambiar</button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Contraseña</label>
                              <div className="relative">
                                <input 
                                  type="password" 
                                  value="****************"
                                  disabled
                                  className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-100/80 text-slate-400 cursor-not-allowed font-medium pr-32"
                                />
                                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#2563eb] text-sm font-bold hover:underline">Actualizar</button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Biografía / Acerca de mí</label>
                            <textarea 
                              value={profileData.bio || ''}
                              onChange={(e) => handleInputChange('bio', e.target.value)}
                              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#2563eb] transition-all font-medium text-slate-800 placeholder:text-slate-400 h-32 resize-none"
                              placeholder="Cuéntale a la comunidad sobre ti y tus colecciones..."
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-8 mt-12">
                          <button type="submit" disabled={savingProfile} className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-[#1a2b4b] to-[#2563eb] hover:from-[#111c33] hover:to-[#1d4ed8] text-white font-black rounded-2xl shadow-[0_10px_20px_-10px_rgba(37,99,235,0.6)] hover:shadow-[0_15px_30px_-10px_rgba(37,99,235,0.7)] transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none text-base tracking-wide">
                            {savingProfile ? 'Guardando cambios...' : 'Guardar Información'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* PERSONAL TAB */}
                    {activeTab === 'personal' && (
                      <form onSubmit={handleSaveProfile} className="flex flex-col h-full justify-between">
                        <div className="flex flex-col gap-8 max-w-3xl">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">RUT Chileno</label>
                              <input 
                                type="text" 
                                value={profileData.rut || ''}
                                onChange={handleRutChange}
                                className={`w-full px-5 py-3.5 rounded-2xl border-2 transition-all font-bold text-slate-800 placeholder:text-slate-400 ${
                                  rutError 
                                    ? 'border-red-400 focus:border-red-500 bg-red-50/50 focus:bg-red-50' 
                                    : 'border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#2563eb]'
                                }`}
                                placeholder="12.345.678-9"
                              />
                              {rutError && <span className="text-sm text-red-500 font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">error</span> {rutError}</span>}
                            </div>
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Teléfono de contacto</label>
                              <div className="relative flex items-center">
                                <span className="absolute left-5 text-slate-400 font-bold">+56 9</span>
                                <input 
                                  type="text" 
                                  value={profileData.phone || ''}
                                  onChange={(e) => handleInputChange('phone', e.target.value)}
                                  className="w-full pl-16 pr-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#2563eb] transition-all font-bold text-slate-800 placeholder:text-slate-400"
                                  placeholder="1234 5678"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-8 mt-12">
                          <button 
                            type="submit" 
                            disabled={savingProfile || rutError != ''} 
                            className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-[#1a2b4b] to-[#2563eb] hover:from-[#111c33] hover:to-[#1d4ed8] text-white font-black rounded-2xl shadow-[0_10px_20px_-10px_rgba(37,99,235,0.6)] hover:shadow-[0_15px_30px_-10px_rgba(37,99,235,0.7)] transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none text-base tracking-wide"
                          >
                            {savingProfile ? 'Guardando cambios...' : 'Guardar Datos Privados'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* SOCIAL NETWORKS TAB */}
                    {activeTab === 'redes' && (
                      <form onSubmit={handleSaveProfile} className="flex flex-col h-full justify-between">
                        <div className="flex flex-col gap-6 max-w-3xl">
                          
                          <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 flex items-center gap-5 transition-all focus-within:border-[#1877F2] focus-within:bg-white">
                            <div className="w-12 h-12 bg-[#1877F2]/10 rounded-xl flex items-center justify-center text-[#1877F2]">
                              <span className="material-symbols-outlined text-[28px]">thumb_up</span>
                            </div>
                            <div className="flex-1">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Perfil de Facebook</label>
                              <div className="flex items-center text-slate-400 font-medium">
                                facebook.com/
                                <input 
                                  type="text" 
                                  value={profileData.facebookUrl || ''}
                                  onChange={(e) => handleInputChange('facebookUrl', e.target.value)}
                                  className="flex-1 bg-transparent border-none outline-none text-slate-900 font-bold ml-1 placeholder:text-slate-300"
                                  placeholder="tu-pagina"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 flex items-center gap-5 transition-all focus-within:border-[#E4405F] focus-within:bg-white">
                            <div className="w-12 h-12 bg-[#E4405F]/10 rounded-xl flex items-center justify-center text-[#E4405F]">
                              <span className="material-symbols-outlined text-[28px]">photo_camera</span>
                            </div>
                            <div className="flex-1">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Perfil de Instagram</label>
                              <div className="flex items-center text-slate-400 font-medium">
                                instagram.com/
                                <input 
                                  type="text" 
                                  value={profileData.instagramUrl || ''}
                                  onChange={(e) => handleInputChange('instagramUrl', e.target.value)}
                                  className="flex-1 bg-transparent border-none outline-none text-slate-900 font-bold ml-1 placeholder:text-slate-300"
                                  placeholder="tu_usuario"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 flex items-center gap-5 transition-all focus-within:border-[#FF0000] focus-within:bg-white">
                            <div className="w-12 h-12 bg-[#FF0000]/10 rounded-xl flex items-center justify-center text-[#FF0000]">
                              <span className="material-symbols-outlined text-[28px]">play_circle</span>
                            </div>
                            <div className="flex-1">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Canal de Youtube</label>
                              <div className="flex items-center text-slate-400 font-medium">
                                youtube.com/
                                <input 
                                  type="text" 
                                  value={profileData.youtubeUrl || ''}
                                  onChange={(e) => handleInputChange('youtubeUrl', e.target.value)}
                                  className="flex-1 bg-transparent border-none outline-none text-slate-900 font-bold ml-1 placeholder:text-slate-300"
                                  placeholder="c/tu_canal"
                                />
                              </div>
                            </div>
                          </div>

                        </div>

                        <div className="flex justify-end pt-8 mt-12">
                          <button type="submit" disabled={savingProfile} className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-[#1a2b4b] to-[#2563eb] hover:from-[#111c33] hover:to-[#1d4ed8] text-white font-black rounded-2xl shadow-[0_10px_20px_-10px_rgba(37,99,235,0.6)] hover:shadow-[0_15px_30px_-10px_rgba(37,99,235,0.7)] transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none text-base tracking-wide">
                            {savingProfile ? 'Vinculando redes...' : 'Guardar Redes'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* DIRECCIONES TAB */}
                    {activeTab === 'direcciones' && (
                      <div className="flex flex-col h-full justify-between">
                        <div className="flex flex-col">
                          
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-400 uppercase tracking-widest text-sm">Libreta de Direcciones</h3>
                            <button 
                              onClick={openAddAddressModal}
                              className="flex items-center gap-2 text-sm font-black bg-[#eef2ff] text-[#2563eb] hover:bg-[#2563eb] hover:text-white rounded-xl px-4 py-2.5 transition-all shadow-sm hover:shadow-md"
                            >
                              <span className="material-symbols-outlined text-[18px]">add_location</span>
                              Nueva Dirección
                            </button>
                          </div>

                          {(!profileData.addresses || profileData.addresses.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                              <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-slate-300">location_off</span>
                              </div>
                              <h3 className="text-lg font-bold text-slate-700 mb-2">No tienes direcciones</h3>
                              <p className="text-slate-500 font-medium mb-6">Agrega al menos una dirección para tus compras y envíos.</p>
                              <button 
                                onClick={openAddAddressModal}
                                className="px-6 py-3 bg-[#1a2b4b] text-white font-bold rounded-xl hover:bg-[#2563eb] transition-colors shadow-md"
                              >
                                Agregar mi primera dirección
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                              {profileData.addresses.map((addr, idx) => (
                                <div 
                                  key={idx} 
                                  onClick={() => { if(!addr.isDefault) setDefaultConfirmationIndex(idx); }}
                                  className={`border-2 rounded-2xl p-5 relative group transition-all flex flex-col justify-between ${!addr.isDefault ? 'cursor-pointer border-slate-100 hover:border-blue-300 bg-white hover:shadow-md' : 'border-blue-500 bg-blue-50/20 shadow-sm'}`}
                                >
                                  <div>
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${addr.isDefault ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-100 text-slate-400'}`}>
                                          <span className="material-symbols-outlined">{addr.isDefault ? 'home' : 'location_on'}</span>
                                        </div>
                                        <div>
                                          <h4 className="font-black text-slate-800 text-lg leading-tight">{addr.name || 'Sin nombre'}</h4>
                                          {addr.isDefault && (
                                            <span className="text-blue-600 text-xs font-black uppercase tracking-wider">Dirección Principal</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="text-slate-600 font-medium text-sm space-y-1 ml-13">
                                      <p>{addr.street} {addr.number}{addr.depto ? `, Depto ${addr.depto}` : ''}{addr.floor ? `, Piso ${addr.floor}` : ''}</p>
                                      <p>{addr.comuna}, {addr.region}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleEditAddressClick(idx)} className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2563eb] transition-colors">
                                      <span className="material-symbols-outlined text-[20px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDeleteAddress(idx)} className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                      <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* BANCARIOS TAB */}
                    {activeTab === 'bancarios' && (
                      <form onSubmit={handleSaveProfile} className="flex flex-col h-full justify-between">
                        <div className="flex flex-col gap-8 max-w-3xl">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3 relative">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Institución Bancaria</label>
                              <CustomDropdown 
                                options={chileBanks}
                                value={profileData.bankDetails?.bank || ''}
                                onChange={(val) => handleBankInputChange('bank', val)}
                                placeholder="Seleccionar Banco"
                              />
                            </div>
                            <div className="flex flex-col gap-3 relative">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Tipo de cuenta</label>
                              <CustomDropdown 
                                options={accountTypes}
                                value={profileData.bankDetails?.accountType || ''}
                                onChange={(val) => handleBankInputChange('accountType', val)}
                                placeholder="Seleccionar Tipo de Cuenta"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                              <label className="text-sm font-black text-slate-700 uppercase tracking-wide">Número de cuenta</label>
                              <input 
                                type="text" 
                                value={profileData.bankDetails?.accountNumber || ''}
                                onChange={(e) => handleBankInputChange('accountNumber', e.target.value)}
                                className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#2563eb] transition-all font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium tracking-wider"
                                placeholder="Ej. 123456789"
                              />
                            </div>
                          </div>
                          
                          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4 mt-4">
                            <span className="material-symbols-outlined text-blue-500 mt-0.5">info</span>
                            <p className="text-sm text-blue-800/80 font-medium leading-relaxed">Estos datos son estrictamente confidenciales y solo se utilizarán para transferirte el dinero de tus ventas de manera segura a tu cuenta personal.</p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-8 mt-12">
                          <button type="submit" disabled={savingProfile} className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-[#1a2b4b] to-[#2563eb] hover:from-[#111c33] hover:to-[#1d4ed8] text-white font-black rounded-2xl shadow-[0_10px_20px_-10px_rgba(37,99,235,0.6)] hover:shadow-[0_15px_30px_-10px_rgba(37,99,235,0.7)] transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none text-base tracking-wide">
                            {savingProfile ? 'Guardando datos...' : 'Guardar Datos Bancarios'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* CUENTA SETTINGS */}
                    {activeTab === 'cuenta' && (
                      <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
                        <div className="bg-red-50/50 border border-red-200 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-red-100 rounded-full blur-[60px] -z-10 transform translate-x-1/3 -translate-y-1/3 opacity-50 pointer-events-none"></div>
                          
                          <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[28px]">warning</span>
                            </div>
                            <div>
                              <h2 className="text-xl font-black text-red-700 mb-1">Zona de Peligro</h2>
                              <p className="text-sm text-red-900/80 font-medium">Las acciones en esta sección no se pueden deshacer.</p>
                            </div>
                          </div>

                          <div className="bg-white/80 backdrop-blur-sm border border-red-100 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Eliminar mi cuenta</h3>
                            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                              Se cerrará tu sesión, se desactivarán todas tus publicaciones y se deshabilitará tu cuenta. Tu historial de compras y ventas se conserva por motivos legales. Esta acción no se puede deshacer.
                            </p>
                            
                            <div className="flex flex-col gap-4">
                              <label className="text-sm font-bold text-slate-700">
                                Para confirmar, escribe <span className="text-red-600 font-black px-1.5 py-0.5 bg-red-50 rounded">eliminar</span> a continuación:
                              </label>
                              <input 
                                type="text"
                                value={deleteConfirmationText}
                                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                className="w-full max-w-sm px-5 py-3.5 rounded-xl border-2 border-slate-200 focus:outline-none focus:border-red-500 transition-colors font-bold text-slate-800"
                                placeholder="Escribe 'eliminar'"
                                disabled={isDeletingAccount}
                              />
                              
                              <div className="pt-2">
                                <button 
                                  onClick={handleDeleteAccount}
                                  disabled={deleteConfirmationText.toLowerCase() !== 'eliminar' || isDeletingAccount}
                                  className="w-full md:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg hover:shadow-red-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                                  {isDeletingAccount ? 'Eliminando cuenta...' : 'Eliminar mi cuenta'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-8 rounded-xl w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto hide-scrollbar">
            <button 
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h2 className="text-2xl font-bold text-[#1a2b4b] mb-6">
              {editingAddressIndex !== null ? 'Editar dirección' : 'Agregar dirección'}
            </h2>
            
            <form onSubmit={handleSaveAddress} className="flex flex-col gap-6">
              <div>
                <h3 className="text-sm font-bold text-[#1a2b4b] mb-4">Dirección *</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">País</label>
                    <input type="text" value="Chile" disabled className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">Región *</label>
                    <select 
                      required
                      value={addressFormData.region}
                      onChange={(e) => handleAddressInputChange('region', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 bg-white text-gray-900" 
                    >
                      <option value="" disabled className="text-gray-500">Seleccionar región</option>
                      {chileData.map((reg, idx) => (
                        <option key={idx} value={reg.region} className="text-gray-900">{reg.region}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">Comuna *</label>
                    <select 
                      required
                      disabled={!addressFormData.region}
                      value={addressFormData.comuna}
                      onChange={(e) => handleAddressInputChange('comuna', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400" 
                    >
                      <option value="" disabled className="text-gray-500">Seleccionar comuna</option>
                      {availableComunas.map((com, idx) => (
                        <option key={idx} value={com} className="text-gray-900">{com}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2 md:col-span-2 flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">Calle/Avenida (Opcional)</label>
                    <input 
                      type="text" 
                      value={addressFormData.street}
                      onChange={(e) => handleAddressInputChange('street', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500" 
                      placeholder="Ej: Av. Providencia" 
                    />
                  </div>
                  <div className="col-span-1 flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">Número (Opcional)</label>
                    <input 
                      type="text" 
                      value={addressFormData.number}
                      onChange={(e) => handleAddressInputChange('number', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500" 
                      placeholder="1234" 
                    />
                  </div>
                  <div className="col-span-1 flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">Piso (Opcional)</label>
                    <input 
                      type="text" 
                      value={addressFormData.floor}
                      onChange={(e) => handleAddressInputChange('floor', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500" 
                      placeholder="5" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 md:col-span-1 flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#1a2b4b]">Depto/Oficina (Opcional)</label>
                    <input 
                      type="text" 
                      value={addressFormData.depto}
                      onChange={(e) => handleAddressInputChange('depto', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500" 
                      placeholder="501" 
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Los datos específicos (Calle, Número, Piso) son necesarios solo si tienes una tienda física.</p>
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-6">
                <label className="text-sm font-bold text-[#1a2b4b]">Nombre de la dirección (Opcional)</label>
                <input 
                  type="text" 
                  value={addressFormData.name}
                  onChange={(e) => handleAddressInputChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="Ej: Nombre de tu tienda, Casa, Trabajo..."
                />
                <p className="text-xs text-gray-500">Útil si tienes una tienda física o quieres darle un alias a esta dirección.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#1a2b4b]">Referencia adicional (Opcional)</label>
                <textarea 
                  value={addressFormData.reference}
                  onChange={(e) => handleAddressInputChange('reference', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 resize-none h-24"
                  placeholder="Frente al metro, edificio azul, portón negro, etc."
                />
                <p className="text-xs text-gray-500">Puntos de referencia, descripción de la fachada, indicaciones especiales, etc.</p>
              </div>

              <div className="flex justify-end gap-4 pt-6 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-6 py-2.5 text-gray-700 font-bold hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingProfile}
                  className="px-8 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingProfile ? 'Guardando...' : (editingAddressIndex !== null ? 'Actualizar' : 'Agregar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmationIndex !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-8 rounded-[24px] w-full max-w-[400px] shadow-2xl flex flex-col items-center text-center animate-[scaleIn_0.2s_ease-out]">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h2 className="text-[22px] font-bold text-[#1a2b4b] mb-3">¿Eliminar dirección?</h2>
            <p className="text-gray-600 mb-8 text-[15px] leading-relaxed">
              Estás a punto de eliminar esta dirección. <br />Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDeleteConfirmationIndex(null)}
                className="flex-1 py-3 text-[#1a2b4b] font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteAddress}
                className="flex-1 py-3 bg-[#e32c2b] text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Set Default Confirmation Modal */}
      {defaultConfirmationIndex !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white p-8 rounded-[24px] w-full max-w-[400px] shadow-2xl flex flex-col items-center text-center animate-[scaleIn_0.2s_ease-out]">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[32px]">home_pin</span>
            </div>
            <h2 className="text-[22px] font-bold text-[#1a2b4b] mb-3">¿Dirección principal?</h2>
            <p className="text-gray-600 mb-8 text-[15px] leading-relaxed">
              ¿Quieres establecer esta dirección como tu dirección por defecto para futuros envíos?
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDefaultConfirmationIndex(null)}
                className="flex-1 py-3 text-[#1a2b4b] font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmSetDefaultAddress}
                className="flex-1 py-3 bg-[#2563eb] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProfilePage;
