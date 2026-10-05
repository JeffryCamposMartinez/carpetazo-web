import NotFound from './NotFound';
import WishlistSection from '../components/wishlist/WishlistSection';
import ReviewsSection, { Stars } from '../components/reviews/Reviews';
import { ensureExternalUrl, formatWhatsAppNumber, getInstagramHref } from '../utils/contact';
import { loadThemeFonts } from '../utils/themeFonts';
import { bannerForScreen } from '../utils/responsiveImage';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getFolderFilter } from '../config/folderOptions';
import { ReportMenu } from '../components/moderation/ReportButton';
import { getAverageRGB, getComplementaryHex, readableOn } from '../utils/color';
import { BODY_FONT_STACK, PANEL_TABS, avatarFrameOptions, backgroundStyleOptions, cardStyleOptions, defaultPublicTheme, fontExamples, fontOptions, getAvatarFrameStyle, getCardStyle, getDisplayScale, getEffectClassName, getFontStack, getProfileBackgroundStyle, getSideBackgroundStyle, profileDistributionOptions, profileEffectOptions, profileLayoutOptions, profileThemes, resolveSurfaceTheme, showcaseStyleOptions, sideBackgroundOptions, themeKey } from '../components/profile/profileStyles';
import { LayoutWire, MiniScene, OptionTile, PanelSection, ShowcaseWire, ToggleRow } from '../components/profile/ProfileEditorParts';
import { SocialLogo } from '../components/profile/SocialLogo';

const normalizeFolder = (folder) => ({
  ...folder,
  cardsCount: folder.cardsCount ?? folder._count?.cards ?? 0,
  color: folder.color || 'red'
});

export default function SellerProfile() {
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
    if (!file.type.startsWith('image/')) return alert('Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return alert('La imagen es demasiado grande. Máximo 10MB.');

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
        alert('Recibimos tu imagen. Queda pendiente de revisión y se mostrará cuando el equipo la apruebe.');
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
      alert('No se pudo guardar el tema.');
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

  return (
    <div
      className="min-h-screen [&_h1]:[font-family:var(--seller-font)] [&_section_h2]:[font-family:var(--seller-font)] [&_section_h2]:[font-size:var(--seller-h2)]"
      style={{ fontFamily: BODY_FONT_STACK, '--seller-font': getFontStack(publicTheme.font), '--seller-h2': `${(1.45 * displayScale).toFixed(2)}rem` }}
    >
      <div className="mx-auto w-full max-w-[1470px] xl:px-4 2xl:px-6" style={getSideBackgroundStyle(publicTheme)}>
      <div className={`relative min-h-screen w-full overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.22)] ${getEffectClassName(publicTheme)}`} style={getProfileBackgroundStyle(publicTheme)}>

      {/* Presentación: la forma cambia según la opción elegida (Clásico, Compacto, Showcase, Póster o Gamer) */}
      <section className="relative overflow-visible" style={{ backgroundColor: isPosterLayout ? '#05070d' : publicTheme.card }}>
        {seller?.bannerBase64 ? (
          <div className={`absolute inset-x-0 top-0 bg-cover bg-center ${heroBanner}`} style={{ backgroundImage: `url(${bannerForScreen(seller.bannerBase64)})` }} />
        ) : (
          <div className={`absolute inset-x-0 top-0 ${heroBanner}`} style={{ backgroundImage: `linear-gradient(135deg, ${publicTheme.text}, ${publicTheme.primary}, ${publicTheme.secondary})` }} />
        )}
        {isPosterLayout
          ? <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/45 to-black/85" />
          : <div className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/25 via-transparent to-black/30 ${heroBanner}`} />}

        {savingImage && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70" role="status" aria-label="Subiendo imagen">
            <div className="h-10 w-10 animate-spin rounded-full border-b-4 border-[#1e40af]" />
          </div>
        )}

        {isOwner && (
          <div className="absolute right-3 top-3 z-30 flex flex-wrap justify-end gap-2 sm:right-4 sm:top-4">
            <button type="button" onClick={() => setThemePanelOpen((prev) => !prev)} aria-expanded={themePanelOpen} className={ownerButtonClass}>
              <span translate="no" className="material-symbols-outlined text-[19px]">palette</span>
              <span className="hidden sm:inline">Personalizar</span>
              <span className="sm:hidden">Estilo</span>
            </button>
            <label className={`${ownerButtonClass} cursor-pointer`} title="Imagen de fondo de tu presentación">
              <span translate="no" className="material-symbols-outlined text-[19px]">panorama</span>
              <span className="hidden sm:inline">Banner</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'banner')} aria-label="Cambiar banner" />
            </label>
            <label className={`${ownerButtonClass} cursor-pointer`} title="Imagen de fondo de toda la página">
              <span translate="no" className="material-symbols-outlined text-[19px]">wallpaper</span>
              <span className="hidden sm:inline">Fondo de página</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageUpload(event, 'wallpaper')} aria-label="Cambiar fondo de página" />
            </label>
          </div>
        )}

        <div className={`relative z-10 mx-auto flex w-full max-w-[1220px] px-4 pb-6 sm:px-6 md:px-8 ${heroPadding} ${heroContainerClass}`}>
          {!isGamerLayout && avatarBlock}

          <div className={`relative min-w-0 ${isCenteredLayout ? 'w-full max-w-[780px] text-center' : 'flex-1'} ${isPosterLayout ? 'px-1' : `p-4 ring-1 sm:p-5 md:p-6 ${layoutId === 'showcase' ? '-mt-14 pt-16 sm:-mt-16 sm:pt-20' : ''}`}`} style={isPosterLayout ? undefined : getCardStyle(publicTheme)}>
            <div className={`flex flex-col gap-4 ${isCenteredLayout ? 'items-center' : 'lg:flex-row lg:items-start lg:justify-between'}`}>
              <div className={`min-w-0 ${isGamerLayout ? 'flex items-center gap-4' : ''}`}>
                {isGamerLayout && avatarBlock}
                <div className="min-w-0">
                  <h1 className={`break-words font-black leading-[1.05] ${isPosterLayout ? 'drop-shadow-[0_3px_14px_rgba(0,0,0,0.55)]' : ''}`} style={{ color: heroTheme.text, fontSize: displayNameSize }}>
                    {displayName}
                    {/* Pegado a la última palabra del nombre, aunque ocupe varias líneas */}
                    <span translate="no" className="material-symbols-outlined ml-1.5 align-[-0.12em] text-[22px] leading-none" style={{ color: heroTheme.primary, fontVariationSettings: "'FILL' 1" }} title="Vendedor verificado" aria-label="Vendedor verificado">verified</span>
                  </h1>
                  <p className="mt-1.5 text-[15px] font-bold leading-snug" style={{ color: heroTheme.primary }}>@{seller?.username}</p>
                  {seller?.fullName && <p className="text-sm font-medium leading-snug" style={heroMuted}>{seller.fullName}</p>}
                </div>
              </div>

              {heroActions.length > 0 && (
                <div className={`flex items-center gap-2 ${isCenteredLayout ? 'w-full max-w-sm justify-center' : ''}`}>
                  {heroActions.map((action) => action.id === 'message' ? (
                    <button
                      key="message"
                      type="button"
                      onClick={contactSeller}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold shadow-md transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:flex-none"
                      style={{ backgroundColor: publicTheme.accent, color: readableOn(publicTheme.accent) }}
                    >
                      <span translate="no" className="material-symbols-outlined text-[20px]">chat</span>
                      Enviar mensaje
                    </button>
                  ) : (
                    <a
                      key={action.id}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={action.label}
                      title={action.label}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
                    >
                      <SocialLogo type={action.id} className="h-6 w-6" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Datos del vendedor en fichas cortas: se leen de un vistazo y se acomodan en varias líneas en móvil */}
            <ul className={`mt-3 flex flex-wrap gap-1.5 ${isCenteredLayout ? 'justify-center' : ''}`} aria-label="Datos del vendedor">
              {[
                { icon: 'folder_open', label: folderCountLabel },
                { icon: 'style', label: cardCountLabel },
                ...(primaryAddress ? [{ icon: 'location_on', label: [primaryAddress.comuna, primaryAddress.region].filter(Boolean).join(', ') || primaryAddress.name }] : [])
              ].map((chip) => (
                <li key={chip.icon} className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold tabular-nums ${isPosterLayout ? 'backdrop-blur-sm' : ''}`} style={{ backgroundColor: isPosterLayout ? 'rgba(255,255,255,0.14)' : `${heroTheme.primary}14`, color: heroTheme.text, boxShadow: `inset 0 0 0 1px ${isPosterLayout ? 'rgba(255,255,255,0.28)' : `${heroTheme.primary}2e`}` }}>
                  <span translate="no" className="material-symbols-outlined shrink-0 text-[17px]" style={{ color: heroTheme.primary }} aria-hidden="true">{chip.icon}</span>
                  <span className="truncate">{chip.label}</span>
                </li>
              ))}
              {seller?.reviewSummary && (
                <li>
                  <a href="#resenas" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold tabular-nums transition hover:brightness-95 focus:outline-none focus-visible:ring-2" style={{ backgroundColor: seller.reviewSummary.count > 0 ? '#fef3c7' : isPosterLayout ? 'rgba(255,255,255,0.14)' : `${heroTheme.primary}14`, color: seller.reviewSummary.count > 0 ? '#713f12' : heroTheme.text, boxShadow: `inset 0 0 0 1px ${seller.reviewSummary.count > 0 ? '#f59e0b55' : isPosterLayout ? 'rgba(255,255,255,0.28)' : `${heroTheme.primary}2e`}` }}>
                    {seller.reviewSummary.showAverage
                      ? <><Stars value={seller.reviewSummary.average} size={14} />{seller.reviewSummary.average.toFixed(1)}<span className="font-semibold opacity-75">({seller.reviewSummary.count})</span></>
                      : seller.reviewSummary.count > 0
                        ? <><span translate="no" className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1", color: '#d97706' }} aria-hidden="true">star</span>{seller.reviewSummary.count} {seller.reviewSummary.count === 1 ? 'reseña' : 'reseñas'}</>
                        : <><span translate="no" className="material-symbols-outlined text-[17px]" style={{ color: heroTheme.primary }} aria-hidden="true">star</span>Sin reseñas todavía</>}
                  </a>
                </li>
              )}
            </ul>

            <div className="mt-4">
              {isEditingBio ? (
                <div className="space-y-3 text-left">
                  <textarea value={tempBio} onChange={(event) => setTempBio(event.target.value)} maxLength={500} aria-label="Biografía" className="min-h-24 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none focus:ring-4" style={{ backgroundColor: publicTheme.card === 'transparent' ? '#ffffff' : publicTheme.card, borderColor: `${publicTheme.primary}55`, color: publicTheme.text }} placeholder="Cuéntale a la comunidad quién eres y qué coleccionas" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditingBio(false)} className="h-10 rounded-full px-4 text-sm font-bold hover:bg-black/5" style={heroMuted}>Cancelar</button>
                    <button onClick={handleSaveBio} disabled={savingBio} className="h-10 rounded-full px-5 text-sm font-extrabold disabled:opacity-60" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>{savingBio ? 'Guardando…' : 'Guardar biografía'}</button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-start gap-2 ${isCenteredLayout ? 'justify-center' : ''}`}>
                  <p className={`min-h-6 max-w-[65ch] whitespace-pre-line break-words border-l-4 pl-3 text-left text-[15px] font-medium leading-relaxed ${isCenteredLayout ? '' : 'flex-1'} ${layoutId === 'compact' ? 'line-clamp-3' : ''}`} style={{ borderColor: `${heroTheme.primary}66`, color: heroTheme.text, opacity: seller?.bio ? 0.85 : 0.75 }}>
                    {seller?.bio ? seller.bio : isOwner ? 'Aún no escribes tu biografía.' : 'Este vendedor aún no escribe su biografía.'}
                  </p>
                  {isOwner && (
                    <button onClick={() => { setTempBio(seller?.bio || ''); setIsEditingBio(true); }} aria-label="Editar biografía" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5" style={{ color: heroTheme.primary }}>
                      <span translate="no" className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  )}
                </div>
              )}
              {!isOwner && seller?.id && (
                <div className={`mt-3 ${isCenteredLayout ? 'flex justify-center' : ''}`}>
                  <ReportMenu
                    buttonStyle={heroMuted}
                    options={[
                      { targetType: 'user', targetId: seller.id, blockUserId: seller.id, label: 'Reportar a este usuario' },
                      { targetType: 'profile_image', targetId: seller.photoURL ? seller.id : null, label: 'Reportar la foto de perfil' },
                      { targetType: 'profile_banner', targetId: seller.bannerBase64 ? seller.id : null, label: 'Reportar el banner' },
                      { targetType: 'profile_wallpaper', targetId: seller.wallpaperBase64 ? seller.id : null, label: 'Reportar el fondo del perfil' },
                      { targetType: 'profile_text', targetId: seller.id, label: 'Reportar el nombre o la biografía' }
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Módulos: el orden y el ancho salen de la distribución elegida */}
      <main className="relative z-10 mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
          {showProfileShowcase && (
            <section className={`min-w-0 border p-5 ring-1 ${getDistributionSpan('showcase')}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: getDistributionOrder('showcase') }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black leading-tight md:text-2xl" style={{ color: publicTheme.text }}>
                  {publicTheme.showcaseStyle === 'seller' ? 'Catálogo destacado' : publicTheme.showcaseStyle === 'collector' ? 'Colección destacada' : 'Carpetas favoritas'}
                </h2>
                <span className="text-sm font-bold tabular-nums" style={textMuted}>{spotlightFolders.length} de {folders.length}</span>
              </div>
              <ul className="divide-y" style={{ borderColor: `${publicTheme.primary}22` }}>
                {spotlightFolders.map((folder) => (
                  <li key={folder.id} style={{ borderColor: `${publicTheme.primary}22` }}>
                    <Link to={`/c/${folder.id}`} className="group flex items-center gap-3 py-3 focus:outline-none focus-visible:ring-2" style={{ color: publicTheme.text }}>
                      <span className="h-14 w-11 shrink-0 rounded-md bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat shadow-md" style={{ filter: getFolderFilter(folder.color) }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-extrabold">{folder.name}</span>
                        <span className="block truncate text-sm font-medium" style={textMuted}>{folder.tcg} · {folder.cardsCount} {folder.cardsCount === 1 ? 'carta' : 'cartas'}</span>
                      </span>
                      <span translate="no" className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ color: publicTheme.primary }}>arrow_forward</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showProfileShowcase && (
            <section className={`min-w-0 border p-5 ring-1 ${getDistributionSpan('stats')}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.accent}55`, order: getDistributionOrder('stats') }}>
              <h2 className="text-xl font-black leading-tight md:text-2xl" style={{ color: publicTheme.text }}>Resumen</h2>
              <dl className="mt-3 divide-y" style={{ borderColor: `${publicTheme.primary}22` }}>
                {[
                  ['Carpetas públicas', folders.length, 'auto_stories'],
                  ['Cartas mostradas', totalCards.toLocaleString('es-CL'), 'style'],
                  ['Nivel del perfil', profileLevel, 'military_tech'],
                ].map(([label, value, icon]) => (
                  <div key={label} className="flex items-center gap-3 py-3" style={{ borderColor: `${publicTheme.primary}22` }}>
                    <dt className="flex min-w-0 flex-1 items-center gap-3 text-sm font-semibold">
                      <span translate="no" aria-hidden="true" className="material-symbols-outlined shrink-0 text-[24px]" style={{ color: publicTheme.primary }}>{icon}</span>
                      <span style={textMuted}>{label}</span>
                    </dt>
                    <dd className="text-xl font-black tabular-nums" style={{ color: publicTheme.text }}>{value}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-1 text-sm" style={{ color: publicTheme.text }}>
                <summary className="cursor-pointer py-2 font-bold" style={{ color: publicTheme.primary }}>¿Cómo se calcula el nivel?</summary>
                <ul className="list-disc space-y-1 pl-5 pb-1 font-medium" style={textMuted}>
                  <li>+2 niveles por cada carpeta pública.</li>
                  <li>+1 nivel por cada 12 cartas subidas.</li>
                  <li>Todos empiezan en el nivel 1.</li>
                </ul>
              </details>
            </section>
          )}

          <section className={`min-w-0 space-y-5 ${getDistributionSpan('folders')}`} style={{ order: getDistributionOrder('folders') }}>
            <div className="flex items-center justify-between gap-3 p-4 ring-1 md:px-5" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33` }}>
              <div className="min-w-0">
                <h2 className="text-2xl font-black leading-tight" style={{ color: publicTheme.text }}>Carpetas públicas</h2>
                <p className="text-sm font-medium" style={textMuted}>Catálogos publicados por este vendedor.</p>
              </div>
              <span className="shrink-0 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>{folders.length}</span>
            </div>

            {folders.length === 0 ? (
              <div className="border border-dashed p-10 text-center" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}55` }}>
                <span translate="no" className="material-symbols-outlined text-5xl" style={{ color: `${publicTheme.primary}99` }}>inventory_2</span>
                <p className="mt-3 text-lg font-extrabold" style={{ color: publicTheme.text }}>Aún no hay carpetas públicas</p>
                <p className="mt-1 text-sm font-medium" style={textMuted}>{isOwner ? 'Crea una carpeta en tu panel y márcala como pública para que aparezca aquí.' : 'Cuando publique una carpeta, la verás aquí.'}</p>
                {isOwner && <Link to="/dashboard" className="mt-4 inline-flex h-11 items-center rounded-full px-6 text-sm font-extrabold" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>Ir a mis carpetas</Link>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {folders.map((folder) => (
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
          </section>

          {getSocialEnabled('showWishlist') && seller?.username && (
            <section className="min-w-0 border p-5 ring-1 empty:hidden lg:col-span-12" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: 99 }}>
              <WishlistSection
                username={seller.username}
                seller={{ id: seller.id, name: displayName, avatar: avatarUrl }}
                isOwner={isOwner}
                variant="profile"
                colors={{ primary: publicTheme.primary, accent: publicTheme.accent, text: publicTheme.text }}
              />
            </section>
          )}
          {seller?.username && (
            <section id="resenas" className="min-w-0 scroll-mt-32 border p-5 ring-1 lg:col-span-12" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: 98 }}>
              <ReviewsSection username={seller.username} isOwner={isOwner} colors={{ primary: publicTheme.primary, text: publicTheme.text }} />
            </section>
          )}
        </div>
      </main>
      </div>
      </div>

      {isOwner && themePanelOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 sm:bg-black/20" onClick={() => setThemePanelOpen(false)} aria-hidden="true" />
          <aside
            role="dialog"
            aria-label="Personalizar perfil"
            className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[82vh] flex-col rounded-t-3xl bg-[#F4F6FA] text-[#12315f] shadow-[0_-12px_40px_rgba(0,0,0,0.3)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl sm:shadow-[-12px_0_40px_rgba(0,0,0,0.25)]"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
          >
            <div className="rounded-t-3xl bg-[#12315f] px-4 pb-4 pt-4 text-white sm:rounded-tl-3xl sm:rounded-tr-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black leading-tight">Personalizar perfil</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-blue-100" aria-live="polite">
                    <span className={`h-2 w-2 rounded-full ${savingTheme ? 'bg-slate-300' : themeDirty ? 'bg-[#facc15]' : 'bg-emerald-400'}`} />
                    {savingTheme ? 'Guardando…' : themeDirty ? 'Cambios sin guardar' : 'Todo guardado'}
                  </p>
                </div>
                <button type="button" onClick={() => setThemePanelOpen(false)} aria-label="Cerrar panel" className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-blue-100 hover:bg-white/10">
                  <span translate="no" className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={resetPublicTheme} disabled={savingTheme} className="h-10 flex-1 rounded-full border border-white/30 px-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">Restablecer</button>
                <button type="button" onClick={saveCurrentTheme} disabled={savingTheme || !themeDirty} className="h-10 flex-[1.4] rounded-full bg-[#facc15] px-5 text-sm font-extrabold text-[#12315f] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40">Guardar cambios</button>
              </div>
            </div>

            <div role="tablist" aria-label="Qué personalizar" className="grid grid-cols-6 border-b border-slate-200 bg-white">
              {PANEL_TABS.map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={themePanelTab === id}
                  onClick={() => setThemePanelTab(id)}
                  className={`flex flex-col items-center gap-0.5 border-b-[3px] px-0.5 pb-2 pt-2.5 text-[11px] font-bold transition ${themePanelTab === id ? 'border-[#facc15] text-[#12315f]' : 'border-transparent text-slate-500 hover:text-[#12315f]'}`}
                >
                  <span translate="no" className="material-symbols-outlined text-[22px]" style={themePanelTab === id ? { fontVariationSettings: "'FILL' 1" } : undefined}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
              {themePanelTab === 'theme' && (
                <>
                  <PanelSection icon="palette" title="Paletas" hint="Elige una paleta lista. Después puedes ajustar cada color.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {profileThemes.map((theme) => (
                        <OptionTile key={theme.id} selected={publicTheme.id === theme.id} disabled={savingTheme} onClick={() => applyThemePalette(theme)} name={theme.name}>
                          <span className="relative block h-[84px] overflow-hidden rounded-xl" style={{ backgroundColor: theme.surface }}>
                            <span className="absolute inset-x-0 top-0 h-10" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} />
                            <span className="absolute inset-x-2.5 bottom-2 top-5 rounded-lg p-2 shadow-md" style={{ backgroundColor: theme.card }}>
                              <span className="block h-1.5 w-2/3 rounded-full" style={{ backgroundColor: theme.text }} />
                              <span className="mt-1.5 block h-2.5 w-10 rounded-full" style={{ backgroundColor: theme.accent }} />
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="colorize" title="Colores a tu medida" hint="Toca un color para cambiarlo. Se ve al instante en tu perfil.">
                    <div className="grid grid-cols-2 gap-2">
                      {[['primary', 'Principal'], ['secondary', 'Secundario'], ['accent', 'Acento'], ['surface', 'Fondo'], ['card', 'Contenedor'], ['text', 'Texto']].map(([field, label]) => {
                        const value = publicTheme[field] || defaultPublicTheme[field];
                        return (
                          <label key={field} className="relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-2 transition hover:border-slate-400 focus-within:ring-2 focus-within:ring-[#1e40af]">
                            <span className="h-11 w-11 shrink-0 rounded-xl shadow-inner ring-1 ring-black/10" style={{ backgroundColor: value }} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-extrabold text-[#12315f]">{label}</span>
                              <span className="block text-xs font-semibold uppercase tabular-nums text-slate-500">{value}</span>
                            </span>
                            <input type="color" value={value} onChange={(event) => handleThemeFieldChange(field, event.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                          </label>
                        );
                      })}
                    </div>
                  </PanelSection>
                </>
              )}

              {themePanelTab === 'font' && (
                <PanelSection icon="text_fields" title="Tipografía" hint="Cómo se leen tu nombre, tu biografía y tus carpetas.">
                  <div className="grid grid-cols-2 gap-2.5">
                    {fontOptions.map((font) => (
                      <OptionTile key={font} selected={publicTheme.font === font} onClick={() => handleThemeFieldChange('font', font)} name={font}>
                        <span className="flex h-[84px] flex-col justify-center rounded-xl bg-slate-50 px-3" style={{ fontFamily: getFontStack(font) }}>
                          <span className="text-[34px] font-bold leading-none text-[#12315f]">Aa</span>
                          <span className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-tight text-slate-500">{fontExamples[font]}</span>
                        </span>
                      </OptionTile>
                    ))}
                  </div>
                </PanelSection>
              )}

              {themePanelTab === 'cards' && (
                <PanelSection icon="dashboard_customize" title="Estilo de las tarjetas" hint="Cambia el aspecto de la presentación, la vitrina y los demás módulos.">
                  <div className="grid grid-cols-2 gap-2.5">
                    {cardStyleOptions.map((option) => (
                      <OptionTile key={option.id} selected={publicTheme.cardStyle === option.id} onClick={() => handleThemeFieldChange('cardStyle', option.id)} name={option.name} description={option.description}>
                        <MiniScene theme={{ ...savedTheme, cardStyle: option.id }} avatarUrl={avatarUrl} initial={displayName[0]?.toUpperCase()} />
                      </OptionTile>
                    ))}
                  </div>
                </PanelSection>
              )}

              {themePanelTab === 'scene' && (
                <>
                  <PanelSection icon="wallpaper" title="Fondo del perfil" hint="El escenario detrás de tu presentación, tu vitrina y tus carpetas.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {backgroundStyleOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.backgroundStyle === option.id} onClick={() => handleThemeFieldChange('backgroundStyle', option.id)} name={option.name} description={option.description}>
                          <MiniScene theme={{ ...savedTheme, backgroundStyle: option.id }} avatarUrl={avatarUrl} initial={displayName[0]?.toUpperCase()} />
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="view_sidebar" title="Franjas laterales" hint="Lo que se ve a la izquierda y a la derecha en pantallas anchas.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {sideBackgroundOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.sideBackgroundStyle === option.id} onClick={() => handleThemeFieldChange('sideBackgroundStyle', option.id)} name={option.name} description={option.description}>
                          <span className="relative block h-[84px] overflow-hidden rounded-xl" style={getSideBackgroundStyle({ ...savedTheme, sideBackgroundStyle: option.id })}>
                            <span className="absolute inset-y-2 left-[24%] right-[24%] rounded-lg bg-white/90 p-2 shadow-lg">
                              <span className="block h-1.5 w-3/4 rounded-full bg-[#12315f]" />
                              <span className="mt-1.5 block h-1 w-1/2 rounded-full bg-slate-300" />
                              <span className="mt-2 grid grid-cols-2 gap-1"><span className="h-5 rounded-[3px] bg-emerald-500" /><span className="h-5 rounded-[3px] bg-emerald-500" /></span>
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="account_circle" title="Marco de la foto" hint="El borde que rodea tu foto de perfil. Aquí ves tu foto real.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {avatarFrameOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.avatarFrame === option.id} onClick={() => handleThemeFieldChange('avatarFrame', option.id)} name={option.name} description={option.description}>
                          <span className="flex h-[92px] items-center justify-center rounded-xl bg-slate-100">
                            <span className="h-[68px] w-[68px] rounded-[1.3rem] p-[4px] shadow-lg" style={{ background: getAvatarFrameStyle({ ...savedTheme, avatarFrame: option.id }) }}>
                              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.05rem] bg-white text-lg font-black text-slate-500 ring-2 ring-white/90">
                                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
                              </span>
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="web_asset" title="Presentación" hint="Cómo se arma la parte de arriba de tu perfil.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {profileLayoutOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.profileLayout === option.id} onClick={() => handleThemeFieldChange('profileLayout', option.id)} name={option.name} description={option.description}>
                          <LayoutWire id={option.id} />
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="blur_on" title="Efecto" hint="Una capa visual sobre todo el perfil. «Sin efecto» es lo más liviano.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {profileEffectOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.profileEffect === option.id} onClick={() => handleThemeFieldChange('profileEffect', option.id)} name={option.name} description={option.description}>
                          <span className={`relative block h-[84px] overflow-hidden rounded-xl bg-[#0f172a] ${getEffectClassName({ ...savedTheme, profileEffect: option.id })}`}>
                            <span className="absolute inset-x-3 bottom-2.5 top-4 z-[2] flex items-center gap-2 rounded-lg bg-white/90 p-2 shadow-lg">
                              <span className="h-7 w-7 shrink-0 rounded-lg bg-[#facc15]" />
                              <span className="flex-1"><span className="block h-1.5 w-4/5 rounded-full bg-[#12315f]" /><span className="mt-1 block h-1 w-1/2 rounded-full bg-slate-300" /></span>
                            </span>
                          </span>
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection icon="trophy" title="Vitrina" hint="El módulo destacado que aparece bajo tu presentación.">
                    <div className="grid grid-cols-2 gap-2.5">
                      {showcaseStyleOptions.map((option) => (
                        <OptionTile key={option.id} selected={publicTheme.showcaseStyle === option.id} onClick={() => handleThemeFieldChange('showcaseStyle', option.id)} name={option.name} description={option.description}>
                          <ShowcaseWire id={option.id} />
                        </OptionTile>
                      ))}
                    </div>
                  </PanelSection>
                </>
              )}

              {themePanelTab === 'layout' && (
                <PanelSection icon="view_quilt" title="Orden de los módulos" hint="Dónde van la vitrina, el resumen y las carpetas, y cuánto espacio ocupa cada uno en pantallas anchas.">
                  <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#1e40af]" />Vitrina</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#facc15]" />Resumen</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" />Carpetas</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {profileDistributionOptions.map((option) => (
                      <OptionTile key={option.id} selected={publicTheme.profileDistribution === option.id} onClick={() => handleThemeFieldChange('profileDistribution', option.id)} name={option.name} description={option.description}>
                        <span className="grid h-[84px] auto-rows-fr grid-cols-12 gap-1 rounded-xl bg-slate-100 p-1.5" aria-hidden="true">
                          {option.order.map((moduleName) => {
                            const span = (option.spans?.[moduleName] || 'lg:col-span-12').replace('lg:col-span-', '');
                            return <span key={moduleName} className={`rounded-md ${moduleName === 'showcase' ? 'bg-[#1e40af]' : moduleName === 'stats' ? 'bg-[#facc15]' : 'bg-emerald-500'}`} style={{ gridColumn: `span ${span} / span ${span}` }} />;
                          })}
                        </span>
                      </OptionTile>
                    ))}
                  </div>
                </PanelSection>
              )}

              {themePanelTab === 'social' && (
                <PanelSection icon="share" title="Redes y contacto" hint="Elige cuáles botones se muestran en tu perfil público. Las redes solo aparecen si ya cargaste el dato en tu cuenta.">
                  <div className="space-y-2.5">
                    <ToggleRow enabled={messageButtonEnabled} onClick={() => handleThemeFieldChange('showMessageButton', messageButtonEnabled ? 'off' : 'on')} label="Mensaje privado" status={messageButtonEnabled ? 'Visible en tu perfil' : 'Oculto en tu perfil'}>
                      <span translate="no" className="material-symbols-outlined text-[24px] text-[#12315f]">chat</span>
                    </ToggleRow>
                    <ToggleRow enabled={getSocialEnabled('showWishlist')} onClick={() => handleThemeFieldChange('showWishlist', getSocialEnabled('showWishlist') ? 'off' : 'on')} label="Lista de cartas deseadas" status={getSocialEnabled('showWishlist') ? 'Visible en tu perfil y en tus carpetas' : 'Oculta para los demás'}>
                      <span translate="no" className="material-symbols-outlined text-[24px] text-[#12315f]">favorite</span>
                    </ToggleRow>
                    {socialLinks.map((social) => {
                      const enabled = getSocialEnabled(social.field);
                      return (
                        <ToggleRow key={social.id} enabled={enabled} onClick={() => handleThemeFieldChange(social.field, enabled ? 'off' : 'on')} label={social.label} status={social.available ? (enabled ? 'Visible en tu perfil' : 'Oculto en tu perfil') : 'Falta el dato en tu cuenta'}>
                          <SocialLogo type={social.id} className="h-6 w-6" />
                        </ToggleRow>
                      );
                    })}
                  </div>
                </PanelSection>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
