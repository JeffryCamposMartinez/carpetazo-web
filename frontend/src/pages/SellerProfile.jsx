import NotFound from './NotFound';
import { ensureExternalUrl, formatWhatsAppNumber, getInstagramHref } from '../utils/contact';
import { loadThemeFonts } from '../utils/themeFonts';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getAverageRGB, getComplementaryHex, readableOn } from '../utils/color';
import { BODY_FONT_STACK, defaultPublicTheme, fontOptions, getAvatarFrameStyle, getDisplayScale, getEffectClassName, getFontStack, getProfileBackgroundStyle, getSideBackgroundStyle, profileDistributionOptions, resolveSurfaceTheme, themeKey } from '../components/profile/profileStyles';
import ProfileThemePanel from '../components/profile/ProfileThemePanel';
import ProfileModules from '../components/profile/ProfileModules';
import ProfileHero from '../components/profile/ProfileHero';
import { useToast } from '../components/ui/ToastProvider';

const normalizeFolder = (folder) => ({
  ...folder,
  cardsCount: folder.cardsCount ?? folder._count?.cards ?? 0,
  color: folder.color || 'red'
});

export default function SellerProfile() {
  const { showToast } = useToast();
  const { sellerUsername } = useParams();
  const { currentUser, refreshAppUser } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [themePanelTab, setThemePanelTab] = useState('theme');
  const [savingTheme, setSavingTheme] = useState(false);
  const [savedThemeJson, setSavedThemeJson] = useState('');

  // El servidor indica si quien mira es el dueño (ya no se publica el identificador interno)
  const isOwner = Boolean(seller?.isOwner ?? (currentUser?.uid && seller?.firebaseUid === currentUser.uid));
  const displayName = seller?.name || seller?.fullName || seller?.username || 'Vendedor Anónimo';
  const avatarUrl = seller?.photoURL;
  const savedTheme = useMemo(() => ({
    ...defaultPublicTheme,
    ...(seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {})
  }), [seller?.publicTheme]);
  const publicTheme = useMemo(() => resolveSurfaceTheme(savedTheme), [savedTheme]);
  const primaryAddress = useMemo(() => (
    seller?.addresses?.find(address => address.isDefault) || seller?.addresses?.[0] || null
  ), [seller?.addresses]);
  const totalCards = useMemo(() => folders.reduce((total, folder) => total + (Number(folder.cardsCount) || 0), 0), [folders]);
  const profileLevel = Math.max(1, Math.round((folders.length * 2) + (totalCards / 12) + 1));
  const spotlightFolders = folders.slice(0, 3);
  const showProfileShowcase = folders.length > 0 && publicTheme.showcaseStyle !== 'minimal';
  const themeDirty = savedThemeJson !== '' && themeKey(savedTheme) !== savedThemeJson;
  const isPosterLayout = publicTheme.profileLayout === 'poster';
  const displayScale = getDisplayScale(publicTheme.font);
  // Fuentes del perfil: solo la del texto (Inter) y la elegida; al abrir el selector, todas para la vista previa
  useEffect(() => {
    loadThemeFonts(themePanelTab === 'font' ? ['Inter', ...fontOptions] : ['Inter', publicTheme.font]);
  }, [publicTheme.font, themePanelTab]);
  // Nombre: crece con la pantalla, acotado entre móvil y escritorio (más grande en el diseño póster)
  const displayNameSize = `clamp(${(1.7 * displayScale).toFixed(2)}rem, ${(1.05 * displayScale).toFixed(2)}rem + ${(2.4 * displayScale).toFixed(2)}vw, ${((isPosterLayout ? 3.2 : 2.9) * displayScale).toFixed(2)}rem)`;
  const selectedDistribution = profileDistributionOptions.find(option => option.id === publicTheme.profileDistribution) || profileDistributionOptions[0];
  const getDistributionOrder = (moduleName) => {
    const index = selectedDistribution.order.indexOf(moduleName);
    return index === -1 ? 99 : index + 1;
  };
  const getDistributionSpan = (moduleName) => selectedDistribution.spans?.[moduleName] || 'lg:col-span-12';
  const isNarrowStatsPanel = ['compact-shop', 'premium-gallery', 'trading-desk', 'sidebar-left', 'sidebar-right'].includes(selectedDistribution.id);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: savedTheme } }));
    return () => {
      window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: null } }));
    };
  }, [publicTheme]);

  useEffect(() => {
    if (!themePanelOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setThemePanelOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [themePanelOpen]);

  const loadSeller = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await api.getUserProfile(sellerUsername);
      const user = result.user;
      setSeller(user);
      setSavedThemeJson(themeKey({ ...defaultPublicTheme, ...(user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {}) }));
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

  useEffect(() => {
    document.body.classList.add('public-profile-active');
    
    const originalBodyBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = publicTheme.surface || '#1a2b4b';

    let metaThemeColor = document.querySelector("meta[name=theme-color]");
    let originalMetaColor = '';
    if (metaThemeColor) {
      originalMetaColor = metaThemeColor.getAttribute("content");
      metaThemeColor.setAttribute("content", publicTheme.primary || '#1a2b4b');
    } else {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = "theme-color";
      metaThemeColor.content = publicTheme.primary || '#1a2b4b';
      document.head.appendChild(metaThemeColor);
    }

    if (seller?.wallpaperBase64) {
      document.documentElement.style.setProperty('--seller-bg', `url(${seller.wallpaperBase64})`);
      document.documentElement.style.setProperty('--seller-overlay', 'transparent');
    } else {
      document.documentElement.style.removeProperty('--seller-bg');
      document.documentElement.style.removeProperty('--seller-overlay');
    }
    
    return () => {
      document.body.classList.remove('public-profile-active');
      document.documentElement.style.removeProperty('--seller-bg');
      document.documentElement.style.removeProperty('--seller-overlay');
      document.body.style.backgroundColor = originalBodyBg;
      
      if (metaThemeColor) {
        if (originalMetaColor) {
          metaThemeColor.setAttribute("content", originalMetaColor);
        } else {
          metaThemeColor.remove();
        }
      }
    };
  }, [seller?.wallpaperBase64, publicTheme.surface, publicTheme.primary]);

  const compressImage = (file, type) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
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
        }, 'image/webp', 1);
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
    if (!file.type.startsWith('image/')) return showToast('Sube una imagen válida.', 'error');
    if (file.size > 10 * 1024 * 1024) return showToast('La imagen es demasiado grande. Máximo 10 MB.', 'error');

    setSavingImage(true);
    try {
      const processedImage = await compressImage(file, type);

      const formData = new FormData();
      formData.append('image', processedImage.file);
      formData.append('type', type);

      const response = await api.uploadImage(formData);
      if (response.success && response.pending) {
        // Sin escaneo disponible y cuenta nueva: la imagen queda pendiente de revisión y no se muestra todavía
        const cleared = type === 'banner' ? { bannerBase64: null } : type === 'wallpaper' ? { wallpaperBase64: null } : { photoURL: null };
        setSeller(prev => ({ ...prev, ...cleared }));
        await refreshAppUser?.();
        showToast('Recibimos tu imagen. Queda pendiente de revisión y se mostrará cuando el equipo la apruebe.', { type: 'info', duration: 8000 });
      } else if (response.success) {
        const payload = type === 'banner'
          ? {
            bannerBase64: response.url,
            bannerDominantColor: response.dominantColor || processedImage.dominantColor,
            bannerComplementaryColor: response.complementaryColor || processedImage.complementaryColor
          }
          : type === 'wallpaper'
            ? { wallpaperBase64: response.url }
            : { photoURL: response.url };

        setSeller(prev => ({ ...prev, ...payload }));
        if (type === 'avatar') {
          try {
            await updateFirebaseProfile(currentUser, { photoURL: response.url });
          } catch (error) {
            console.warn('Firebase photo update skipped:', error);
          }
          await refreshAppUser?.();
        }
      } else {
        showToast(response.message || 'No se pudo subir la imagen.', 'error');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      showToast(error?.message || 'No se pudo guardar la imagen.', 'error');
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
      showToast('No se pudo guardar la biografía.', 'error');
    } finally {
      setSavingBio(false);
    }
  };

  const handleThemeChange = async (theme) => {
    if (!isOwner) return;
    setSeller(prev => ({ ...prev, publicTheme: theme }));
    setSavingTheme(true);
    try {
      const response = await api.updateProfile({ publicTheme: theme });
      setSeller(prev => ({ ...prev, ...(response.user || {}), publicTheme: theme }));
      setSavedThemeJson(themeKey({ ...defaultPublicTheme, ...theme }));
    } catch (error) {
      console.error('Error saving public theme:', error);
      showToast('No se pudo guardar el tema.', 'error');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleThemeFieldChange = (field, value) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: {
        ...savedTheme,
        id: 'custom',
        name: 'Tema personalizado',
        [field]: value
      }
    }));
  };

  const applyThemePalette = (theme) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: {
        ...savedTheme,
        id: theme.id,
        name: theme.name,
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        surface: theme.surface,
        card: theme.card,
        text: theme.text
      }
    }));
  };

  const resetPublicTheme = () => {
    setSeller(prev => ({
      ...prev,
      publicTheme: defaultPublicTheme
    }));
  };

  const saveCurrentTheme = () => handleThemeChange({
    ...savedTheme,
    id: publicTheme.id === 'custom' ? 'custom' : publicTheme.id,
    name: publicTheme.id === 'custom' ? 'Tema personalizado' : publicTheme.name
  });

  const contactSeller = () => {
    if (!currentUser) return navigate('/bienvenida');
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

  const getSocialEnabled = (field) => publicTheme[field] !== 'off';
  const messageButtonEnabled = getSocialEnabled('showMessageButton');
  const showMessageButton = !isOwner && messageButtonEnabled;
  const socialLinks = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      field: 'showWhatsApp',
      available: Boolean(seller?.phone),
      href: seller?.phone ? `https://wa.me/${formatWhatsAppNumber(seller.phone)}` : ''
    },
    {
      id: 'instagram',
      label: 'Instagram',
      field: 'showInstagram',
      available: Boolean(seller?.instagramUrl),
      href: seller?.instagramUrl ? getInstagramHref(seller.instagramUrl) : ''
    },
    {
      id: 'facebook',
      label: 'Facebook',
      field: 'showFacebook',
      available: Boolean(seller?.facebookUrl),
      href: seller?.facebookUrl ? ensureExternalUrl(seller.facebookUrl) : ''
    },
    {
      id: 'youtube',
      label: 'YouTube',
      field: 'showYoutube',
      available: Boolean(seller?.youtubeUrl),
      href: seller?.youtubeUrl ? ensureExternalUrl(seller.youtubeUrl) : ''
    }
  ];

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#DBEAFE]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-[#1e40af]" />
      </div>
    );
  }

  if (errorMsg) {
    return <NotFound />;
  }

  const heroActions = [
    ...(showMessageButton ? [{ id: 'message', label: 'Enviar mensaje' }] : []),
    ...socialLinks.filter((social) => social.available && getSocialEnabled(social.field)),
  ];
  const ownerButtonClass = 'inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-bold text-[#12315f] shadow-md ring-1 ring-black/5 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]';
  const folderCountLabel = `${folders.length} ${folders.length === 1 ? 'carpeta' : 'carpetas'}`;
  const cardCountLabel = `${totalCards.toLocaleString('es-CL')} ${totalCards === 1 ? 'carta' : 'cartas'}`;
  const textMuted = { color: publicTheme.text, opacity: 0.7 };

  // Presentación: cada opción cambia de verdad la forma de la cabecera, también en móvil
  const layoutId = ['classic', 'compact', 'showcase', 'poster', 'side-showcase'].includes(publicTheme.profileLayout) ? publicTheme.profileLayout : 'classic';
  const isGamerLayout = layoutId === 'side-showcase';
  const isCenteredLayout = layoutId === 'showcase' || layoutId === 'poster';
  // En el póster el texto va directo sobre el banner oscurecido: blanco con el acento del tema
  const heroTheme = isPosterLayout ? { ...publicTheme, text: '#ffffff', primary: publicTheme.accent } : publicTheme;
  const heroMuted = { color: heroTheme.text, opacity: 0.75 };
  const heroBanner = {
    classic: 'h-[230px] sm:h-[300px] md:inset-0 md:h-auto',
    compact: 'h-[118px] sm:h-[150px] md:h-[170px]',
    showcase: 'h-[200px] sm:h-[260px] md:h-[300px]',
    poster: 'bottom-0 h-auto',
    'side-showcase': 'h-[180px] sm:h-[240px] md:h-[270px]'
  }[layoutId];
  const heroPadding = {
    classic: 'pt-[140px] sm:pt-[200px] md:py-12',
    compact: 'pt-[70px] sm:pt-[96px] md:pt-[112px] md:pb-6',
    showcase: 'pt-[120px] sm:pt-[170px] md:pt-[200px] md:pb-10',
    poster: 'pt-[150px] sm:pt-[190px] md:pt-[150px] md:pb-10',
    'side-showcase': 'pt-[120px] sm:pt-[170px] md:pt-[190px] md:pb-10'
  }[layoutId];
  const heroContainerClass = {
    classic: 'flex-col justify-end gap-5 md:flex-row md:items-end',
    compact: 'flex-col justify-end gap-3 md:flex-row md:items-end md:gap-5',
    showcase: 'flex-col items-center',
    poster: 'flex-col items-center gap-4',
    'side-showcase': 'flex-col'
  }[layoutId];
  const avatarSizeClass = {
    classic: 'h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40',
    compact: 'h-20 w-20 sm:h-24 sm:w-24',
    showcase: 'h-28 w-28 sm:h-32 sm:w-32',
    poster: 'h-24 w-24 sm:h-28 sm:w-28',
    'side-showcase': 'h-[76px] w-[76px] sm:h-24 sm:w-24 md:h-28 md:w-28'
  }[layoutId];
  const isSmallAvatar = layoutId === 'compact' || isGamerLayout;

  const avatarBlock = (
    <div className={`relative z-20 shrink-0 ${avatarSizeClass}`}>
      {/* Nivel como la gema de coste de una carta */}
      <div
        className={`absolute z-20 flex flex-col items-center justify-center rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-4 ${isSmallAvatar ? '-right-2.5 -top-2.5 h-10 w-10' : '-right-3 -top-3 h-12 w-12 md:h-14 md:w-14'}`}
        style={{ backgroundColor: publicTheme.accent, color: readableOn(publicTheme.accent), '--tw-ring-color': isPosterLayout ? '#05070d' : publicTheme.card }}
        title={`Nivel ${profileLevel} del perfil`}
        aria-label={`Nivel ${profileLevel}`}
        role="img"
      >
        <span className={`font-bold leading-none opacity-80 ${isSmallAvatar ? 'text-[8px]' : 'text-[9px]'}`} aria-hidden="true">nivel</span>
        <span className="font-black leading-none tabular-nums" style={{ fontFamily: 'var(--seller-font)', fontSize: `${((isSmallAvatar ? 0.95 : 1.15) * Math.max(displayScale, 0.75)).toFixed(2)}rem` }} aria-hidden="true">{profileLevel}</span>
      </div>
      <div className={`h-full w-full p-[4px] shadow-[0_18px_44px_rgba(0,0,0,0.4)] ${isSmallAvatar ? 'rounded-[1.4rem]' : 'rounded-[2.2rem] sm:p-[5px]'}`} style={{ background: getAvatarFrameStyle(publicTheme) }}>
        <div className={`h-full w-full overflow-hidden bg-white ring-2 ring-white/90 ${isSmallAvatar ? 'rounded-[1.15rem]' : 'rounded-[1.9rem]'}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center font-black text-white ${isSmallAvatar ? 'text-3xl' : 'text-5xl'}`} style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary})` }}>
              {displayName[0]?.toUpperCase() || 'V'}
            </div>
          )}
        </div>
      </div>
      {isOwner && (
        isSmallAvatar ? (
          <label className="absolute -bottom-1 -left-1 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/75 text-white shadow-lg ring-2 ring-white transition hover:bg-black/90" title="Cambiar foto">
            <span translate="no" className="material-symbols-outlined text-[16px]">photo_camera</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'avatar')} aria-label="Cambiar foto de perfil" />
          </label>
        ) : (
          <label className="absolute inset-x-4 bottom-2 z-10 flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full bg-black/70 text-xs font-bold text-white shadow-lg ring-1 ring-white/30 transition hover:bg-black/85">
            <span translate="no" className="material-symbols-outlined text-[15px]">photo_camera</span>
            Cambiar foto
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'avatar')} aria-label="Cambiar foto de perfil" />
          </label>
        )
      )}
    </div>
  );

  const profileThemePanelProps = { applyThemePalette, avatarUrl, displayName, getSocialEnabled,
    handleThemeFieldChange, messageButtonEnabled, publicTheme, resetPublicTheme, saveCurrentTheme, savedTheme,
    savingTheme, setThemePanelOpen, setThemePanelTab, socialLinks, themeDirty, themePanelTab };

  const profileModulesProps = { avatarUrl, displayName, folders, getDistributionOrder, getDistributionSpan,
    getSocialEnabled, isOwner, profileLevel, publicTheme, seller, showProfileShowcase, spotlightFolders, textMuted,
    totalCards };

  const profileHeroProps = { avatarBlock, cardCountLabel, contactSeller, displayName, displayNameSize,
    folderCountLabel, handleImageUpload, handleSaveBio, heroActions, heroBanner, heroContainerClass, heroMuted,
    heroPadding, heroTheme, isCenteredLayout, isEditingBio, isGamerLayout, isOwner, isPosterLayout, layoutId,
    ownerButtonClass, primaryAddress, publicTheme, savingBio, savingImage, seller, setIsEditingBio, setTempBio,
    setThemePanelOpen, tempBio, themePanelOpen };

  return (
    <div
      className="min-h-screen [&_h1]:[font-family:var(--seller-font)] [&_section_h2]:[font-family:var(--seller-font)] [&_section_h2]:[font-size:var(--seller-h2)]"
      style={{ fontFamily: BODY_FONT_STACK, '--seller-font': getFontStack(publicTheme.font), '--seller-h2': `${(1.45 * displayScale).toFixed(2)}rem` }}
    >
      <div className="mx-auto w-full max-w-[1470px] xl:px-4 2xl:px-6" style={getSideBackgroundStyle(publicTheme)}>
      <div className={`relative min-h-screen w-full overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.22)] ${getEffectClassName(publicTheme)}`} style={getProfileBackgroundStyle(publicTheme)}>

      {/* Presentación: la forma cambia según la opción elegida (Clásico, Compacto, Showcase, Póster o Gamer) */}
      <ProfileHero {...profileHeroProps} />

      {/* Módulos: el orden y el ancho salen de la distribución elegida */}
      <ProfileModules {...profileModulesProps} />
      </div>
      </div>

      {isOwner && themePanelOpen && (
        <ProfileThemePanel {...profileThemePanelProps} />
      )}
    </div>
  );
}
