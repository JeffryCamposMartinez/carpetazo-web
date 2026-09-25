import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { getFolderFilter } from './Dashboard';

const getAverageRGB = (imgEl, width, height) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgEl, 0, 0, width, height);
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (let i = 0; i < data.length; i += 400) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count += 1;
    }
    return { r: Math.floor(r / count), g: Math.floor(g / count), b: Math.floor(b / count) };
  } catch {
    return { r: 26, g: 43, b: 75 };
  }
};

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / d + 2;
    if (max === b) h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
};

const getComplementaryHex = (r, g, b) => {
  let [h, s, l] = rgbToHsl(r, g, b);
  h = (h + 180) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let rp = 0; let gp = 0; let bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
};

const normalizeFolder = (folder) => ({
  ...folder,
  cardsCount: folder.cardsCount ?? folder._count?.cards ?? 0,
  color: folder.color || 'red'
});

const defaultPublicTheme = {
  id: 'classic-blue',
  name: 'Azul Carpetazo',
  primary: '#1e40af',
  secondary: '#93c5fd',
  accent: '#facc15',
  surface: '#DBEAFE',
  text: '#1a2b4b'
};

export default function SellerProfile() {
  const { sellerUsername } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const isOwner = currentUser?.uid && seller?.firebaseUid === currentUser.uid;
  const displayName = seller?.name || seller?.fullName || seller?.username || 'Vendedor Anónimo';
  const avatarUrl = seller?.photoURL;
  const publicTheme = useMemo(() => ({
    ...defaultPublicTheme,
    ...(seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {})
  }), [seller?.publicTheme]);
  const primaryAddress = useMemo(() => (
    seller?.addresses?.find(address => address.isDefault) || seller?.addresses?.[0] || null
  ), [seller?.addresses]);

  const loadSeller = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await api.getUserProfile(sellerUsername);
      const user = result.user;
      setSeller(user);
      setFolders((user.folders || []).map(normalizeFolder));
    } catch (error) {
      console.error('Error loading public seller profile:', error);
      setErrorMsg('El vendedor no existe o el perfil no está disponible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (sellerUsername) loadSeller();
  }, [sellerUsername]);

  const compressImage = (file, type) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = type === 'banner' ? 1920 : 420;
        const maxHeight = type === 'banner' ? 600 : 420;
        let { width, height } = img;
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const rgb = type === 'banner' ? getAverageRGB(img, width, height) : null;
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('No se pudo preparar la imagen.'));
            return;
          }

          resolve({
            file: new File([blob], `${type}-${Date.now()}.webp`, { type: blob.type || 'image/webp' }),
            dominantColor: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null,
            complementaryColor: rgb ? getComplementaryHex(rgb.r, rgb.g, rgb.b) : null
          });
        }, 'image/webp', type === 'banner' ? 0.72 : 0.7);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;
    if (!file.type.startsWith('image/')) return alert('Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return alert('La imagen es demasiado grande. Máximo 10MB.');

    setSavingImage(true);
    try {
      const processedImage = await compressImage(file, type);

      const formData = new FormData();
      formData.append('image', processedImage.file);
      formData.append('type', type);

      const response = await api.uploadImage(formData);
      if (response.success) {
        const payload = type === 'banner'
          ? {
            bannerBase64: response.url,
            bannerDominantColor: response.dominantColor || processedImage.dominantColor,
            bannerComplementaryColor: response.complementaryColor || processedImage.complementaryColor
          }
          : { photoURL: response.url };

        setSeller(prev => ({ ...prev, ...payload }));
      } else {
        alert(response.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      alert(error?.message || 'No se pudo guardar la imagen.');
    } finally {
      event.target.value = '';
      setSavingImage(false);
    }
  };

  const handleSaveBio = async () => {
    if (!isOwner) return;
    setSavingBio(true);
    try {
      const response = await api.updateProfile({ bio: tempBio });
      setSeller(prev => ({ ...prev, ...(response.user || {}), bio: tempBio }));
      setIsEditingBio(false);
    } catch (error) {
      console.error('Error saving bio:', error);
      alert('No se pudo guardar la biografía.');
    } finally {
      setSavingBio(false);
    }
  };

  const contactSeller = () => {
    if (!currentUser) return navigate('/login');
    navigate('/mensajes', {
      state: {
        startChatWith: {
          id: seller.id,
          name: displayName,
          avatar: avatarUrl
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#DBEAFE]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-[#1e40af]" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-[#DBEAFE] p-6 text-center">
        <span translate="no" className="material-symbols-outlined mb-4 text-6xl text-red-500">error</span>
        <h2 className="max-w-md text-2xl font-black text-[#1a2b4b]">{errorMsg}</h2>
        <Link to="/" className="mt-6 rounded-xl bg-[#1e40af] px-6 py-3 font-black text-white shadow-md">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: publicTheme.surface }}>
      <section className="relative overflow-hidden bg-white shadow-sm">
        {seller?.bannerBase64 ? (
          <div className="absolute inset-x-0 top-0 h-[270px] bg-cover bg-center sm:h-[340px] md:inset-0 md:h-auto" style={{ backgroundImage: `url(${seller.bannerBase64})` }} />
        ) : (
          <div className="absolute inset-x-0 top-0 h-[270px] bg-gradient-to-br sm:h-[340px] md:inset-0 md:h-auto" style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary}, ${publicTheme.secondary})` }} />
        )}
        <div className={`absolute inset-x-0 top-0 h-[270px] sm:h-[340px] md:inset-0 md:h-auto ${seller?.bannerBase64 ? 'bg-gradient-to-b from-black/20 via-transparent to-black/35 md:bg-gradient-to-t md:from-black/25 md:via-transparent md:to-black/10' : 'bg-white/30 md:bg-white/75 md:backdrop-blur-[2px]'}`} />

        {savingImage && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
            <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-[#1e40af]" />
          </div>
        )}

        {isOwner && (
          <label className="absolute right-3 top-3 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white shadow-lg ring-1 ring-white/25 backdrop-blur hover:bg-black/60 sm:right-4 sm:top-4 sm:rounded-2xl sm:bg-white/90 sm:text-[#1a2b4b] sm:ring-white/80 sm:hover:bg-white sm:text-sm">
            <span translate="no" className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            <span className="hidden sm:inline">Cambiar fondo</span>
            <input type="file" accept="image/*" className="hidden" onChange={event => handleImageUpload(event, 'banner')} />
          </label>
        )}

        <div className="relative z-10 mx-auto flex min-h-[430px] w-full max-w-[1300px] flex-col justify-end gap-4 px-4 pb-6 pt-[185px] sm:min-h-[520px] sm:px-6 sm:pt-[260px] md:min-h-0 md:flex-row md:items-end md:gap-5 md:px-10 md:py-12">
          <div className="relative z-20 -mb-10 ml-3 h-28 w-28 shrink-0 overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-4 ring-white sm:ml-5 sm:h-32 sm:w-32 md:mb-0 md:ml-0 md:h-40 md:w-40">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white" style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary})` }}>
                {displayName[0]?.toUpperCase() || 'V'}
              </div>
            )}
            {isOwner && (
              <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-black/60 py-2 text-center text-xs font-black text-white">
                Foto
                <input type="file" accept="image/*" className="hidden" onChange={event => handleImageUpload(event, 'avatar')} />
              </label>
            )}
          </div>

          <div className="min-w-0 flex-1 rounded-[2rem] bg-white/92 p-4 pt-12 shadow-2xl ring-1 ring-white/80 backdrop-blur-sm sm:p-5 sm:pt-14 md:bg-white/70 md:p-6 md:pt-6 md:backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-[1.9rem] font-black leading-[0.95] sm:text-4xl md:text-5xl" style={{ color: publicTheme.text }}>{displayName}</h1>
                  <span translate="no" className="material-symbols-outlined" style={{ color: publicTheme.primary, fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <p className="mt-1 text-sm font-black text-slate-500">@{seller?.username || seller?.firebaseUid}</p>
                {seller?.fullName && <p className="mt-1 text-sm font-semibold text-slate-600">{seller.fullName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {!isOwner && (
                  <button onClick={contactSeller} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:brightness-90" style={{ backgroundColor: publicTheme.primary }}>
                    <span translate="no" className="material-symbols-outlined text-[18px]">chat</span>
                    Mensaje
                  </button>
                )}
                {seller?.phone && (
                  <a href={`https://wa.me/${seller.phone.replace(/[^0-9]/g, '').startsWith('56') ? seller.phone.replace(/[^0-9]/g, '') : `56${seller.phone.replace(/[^0-9]/g, '')}`}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-black ring-1" style={{ backgroundColor: `${publicTheme.secondary}33`, color: publicTheme.text, borderColor: publicTheme.secondary }}>WhatsApp</a>
                )}
                {seller?.instagramUrl && (
                  <a href={`https://instagram.com/${seller.instagramUrl.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-black ring-1" style={{ backgroundColor: `${publicTheme.accent}22`, color: publicTheme.text, borderColor: publicTheme.accent }}>Instagram</a>
                )}
              </div>
            </div>

            <div className="mt-5">
              {isEditingBio ? (
                <div className="space-y-3">
                  <textarea value={tempBio} onChange={event => setTempBio(event.target.value)} className="min-h-24 w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#1e40af] focus:ring-4 focus:ring-blue-100" placeholder="Cuéntale a la comunidad sobre ti..." />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditingBio(false)} className="rounded-xl px-4 py-2 text-sm font-black text-slate-500 hover:bg-slate-100">Cancelar</button>
                    <button onClick={handleSaveBio} disabled={savingBio} className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-black text-white disabled:opacity-60">{savingBio ? 'Guardando...' : 'Guardar'}</button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-start gap-2">
                  <p className="min-h-6 flex-1 border-l-4 pl-3 text-sm font-semibold italic leading-relaxed text-slate-600 line-clamp-4 md:line-clamp-none md:text-base" style={{ borderColor: `${publicTheme.primary}55` }}>
                    {seller?.bio ? `"${seller.bio}"` : isOwner ? 'Aún no has escrito una biografía.' : 'Este vendedor aún no tiene biografía.'}
                  </p>
                  {isOwner && (
                    <button onClick={() => { setTempBio(seller?.bio || ''); setIsEditingBio(true); }} className="rounded-full p-2 text-slate-400 hover:bg-blue-50 hover:text-[#1e40af]">
                      <span translate="no" className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {primaryAddress && (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800 ring-1 ring-blue-100">
                <span translate="no" className="material-symbols-outlined text-[16px]">location_on</span>
                <span className="truncate">{[primaryAddress.name, primaryAddress.comuna, primaryAddress.region].filter(Boolean).join(' · ')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <div className="mb-5 flex items-center justify-between rounded-3xl bg-white/70 p-4 shadow-sm ring-1 ring-blue-100 sm:mb-6 sm:border-b sm:border-[#1a2b4b]/10 sm:bg-transparent sm:p-0 sm:pb-4 sm:shadow-none sm:ring-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${publicTheme.primary}18` }}>
              <span translate="no" className="material-symbols-outlined" style={{ color: publicTheme.primary }}>auto_stories</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black leading-tight sm:text-2xl" style={{ color: publicTheme.text }}>Carpetas públicas</h2>
              <p className="text-xs font-semibold text-slate-500 sm:text-sm">Catálogos publicados por este vendedor.</p>
            </div>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: publicTheme.primary }}>{folders.length}</span>
        </div>

        {folders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-blue-200 bg-white/70 p-10 text-center shadow-sm">
            <span translate="no" className="material-symbols-outlined text-6xl text-blue-300">inventory_2</span>
            <p className="mt-3 text-lg font-black text-slate-500">Este vendedor aún no tiene carpetas públicas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {folders.map(folder => (
              <Link to={`/c/${folder.id}`} key={folder.id} className="@container group relative mx-auto flex aspect-[32/37] w-full max-w-[320px] cursor-pointer flex-col transition-transform duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat drop-shadow-lg transition-all group-hover:drop-shadow-2xl" style={{ filter: getFolderFilter(folder.color) }} />
                <div className="relative z-10 flex h-full w-full flex-col justify-between pb-[15%] pl-[18%] pr-[16%] pt-[5%]">
                  <div>
                    <div className="flex justify-end">
                      <div className="flex items-center gap-[1.5cqi] rounded-[3cqi] bg-black/30 px-[3cqi] py-[1.5cqi] text-[4.5cqi] font-bold text-white shadow-sm">
                        <span translate="no" className="material-symbols-outlined text-[5cqi]">style</span>
                        {folder.cardsCount}
                      </div>
                    </div>
                    <h3 className="mt-[2cqi] line-clamp-3 w-full break-words text-[11cqi] font-extrabold leading-tight text-white drop-shadow-md" title={folder.name}>{folder.name}</h3>
                  </div>
                  <span className="w-fit rounded-[2cqi] border border-white/60 px-[3cqi] py-[1cqi] text-[3.5cqi] font-bold uppercase tracking-wider text-white drop-shadow-sm">{folder.tcg}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
