import { ensureExternalUrl, formatWhatsAppNumber, getInstagramHref } from '../utils/contact';
import { loadThemeFonts } from '../utils/themeFonts';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { readableOn } from '../utils/color';
import { getDisplayScale, getEffectClassName, getFontStack, getProfileBackgroundStyle, getSideBackgroundStyle, profileDistributionOptions } from '../components/profile/profileStyles';
import ProfileAvatar from '../components/profile/ProfileAvatar';
import useProfileImages from '../hooks/useProfileImages';
import useProfileTheme from '../hooks/useProfileTheme';
import ProfileStudio from '../components/profile/studio/ProfileStudio';
import ProfileTrustStrip from '../components/profile/ProfileTrustStrip';
import { ProfileContactBar, ProfileLoading, ProfileUnavailable } from '../components/profile/ProfileStates';
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

  // El servidor indica si quien mira es el dueño (ya no se publica el identificador interno)
  const isOwner = Boolean(seller?.isOwner ?? (currentUser?.uid && seller?.firebaseUid === currentUser.uid));
  const displayName = seller?.name || seller?.fullName || seller?.username || 'Vendedor Anónimo';
  const avatarUrl = seller?.photoURL;
  const {
    applyThemePalette, handleThemeFieldChange, handleThemeFieldsChange, markThemeSaved, publicTheme, resetPublicTheme,
    saveCurrentTheme, savedTheme, savingTheme, setThemePanelOpen, setThemePanelTab, themeDirty, themePanelOpen, themePanelTab
  } = useProfileTheme({ isOwner, seller, setSeller, showToast });
  const { handleImageUpload, savingImage } = useProfileImages({ currentUser, isOwner, refreshAppUser, setSeller, showToast });
  const primaryAddress = useMemo(() => (
    seller?.addresses?.find(address => address.isDefault) || seller?.addresses?.[0] || null
  ), [seller?.addresses]);
  const totalCards = useMemo(() => folders.reduce((total, folder) => total + (Number(folder.cardsCount) || 0), 0), [folders]);
  const profileLevel = Math.max(1, Math.round((folders.length * 2) + (totalCards / 12) + 1));
  const spotlightFolders = folders.slice(0, 3);
  const showProfileShowcase = folders.length > 0 && publicTheme.showcaseStyle !== 'minimal';
  const isPosterLayout = publicTheme.profileLayout === 'poster';
  const displayScale = getDisplayScale(publicTheme.font);
  // Fuentes del perfil: solo las tres elegidas (títulos, contenido y cifras); el editor carga el resto al abrir la pestaña de letra
  useEffect(() => {
    loadThemeFonts(['Inter', publicTheme.font, publicTheme.bodyFont, publicTheme.dataFont]);
  }, [publicTheme.font, publicTheme.bodyFont, publicTheme.dataFont]);
  // Nombre: crece con la pantalla, acotado entre móvil y escritorio (más grande en el diseño póster)
  const displayNameSize = `clamp(${(1.7 * displayScale).toFixed(2)}rem, ${(1.05 * displayScale).toFixed(2)}rem + ${(2.4 * displayScale).toFixed(2)}vw, ${((isPosterLayout ? 3.2 : 2.9) * displayScale).toFixed(2)}rem)`;
  const selectedDistribution = profileDistributionOptions.find(option => option.id === publicTheme.profileDistribution) || profileDistributionOptions[0];
  const getDistributionOrder = (moduleName) => {
    const index = selectedDistribution.order.indexOf(moduleName);
    return index === -1 ? 99 : index + 1;
  };
  const getDistributionSpan = (moduleName) => selectedDistribution.spans?.[moduleName] || 'lg:col-span-12';

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: savedTheme } }));
    return () => {
      window.dispatchEvent(new CustomEvent('carpetazo:public-profile-theme', { detail: { theme: null } }));
    };
  }, [publicTheme]);

  const loadSeller = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await api.getUserProfile(sellerUsername);
      const user = result.user;
      setSeller(user);
      markThemeSaved(user.publicTheme);
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

  if (loading) return <ProfileLoading />;
  if (errorMsg) return <ProfileUnavailable />;

  const heroActions = [
    ...(showMessageButton ? [{ id: 'message', label: 'Enviar mensaje' }] : []),
    ...socialLinks.filter((social) => social.available && getSocialEnabled(social.field)),
  ];
  const ownerButtonClass = 'inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-bold text-[#12315f] shadow-md ring-1 ring-black/5 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]';
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
    <ProfileAvatar avatarSizeClass={avatarSizeClass} avatarUrl={avatarUrl} displayName={displayName} displayScale={displayScale} handleImageUpload={handleImageUpload} isOwner={isOwner} isPosterLayout={isPosterLayout} isSmallAvatar={isSmallAvatar} profileLevel={profileLevel} publicTheme={publicTheme} />
  );

  const profileStudioProps = { applyThemePalette, avatarUrl, displayName, getSocialEnabled, handleThemeFieldChange,
    handleThemeFieldsChange, messageButtonEnabled, resetPublicTheme, saveCurrentTheme, savedTheme, savingTheme,
    setThemePanelOpen, setThemePanelTab, socialLinks, themeDirty, themePanelTab, totalCards };

  const profileModulesProps = { avatarUrl, displayName, folders, getDistributionOrder, getDistributionSpan,
    getSocialEnabled, isOwner, profileLevel, publicTheme, seller, showProfileShowcase, spotlightFolders, textMuted,
    totalCards };

  const profileHeroProps = { avatarBlock, contactSeller, displayName, displayNameSize,
    handleImageUpload, handleSaveBio, heroActions, heroBanner, heroContainerClass, heroMuted,
    heroPadding, heroTheme, isCenteredLayout, isEditingBio, isGamerLayout, isOwner, isPosterLayout, layoutId,
    ownerButtonClass, primaryAddress, publicTheme, savingBio, savingImage, seller, setIsEditingBio, setTempBio,
    setThemePanelOpen, tempBio, themePanelOpen };

  return (
    <div
      className={`min-h-screen [&_h1]:[font-family:var(--seller-font)] [&_section_h2]:[font-family:var(--seller-font)] [&_section_h2]:[font-size:var(--seller-h2)] ${showMessageButton ? 'pb-24 sm:pb-0' : ''}`}
      style={{ fontFamily: getFontStack(publicTheme.bodyFont), '--seller-font': getFontStack(publicTheme.font), '--seller-data': getFontStack(publicTheme.dataFont), '--seller-h2': `${(1.45 * displayScale).toFixed(2)}rem` }}
    >
      <div className="mx-auto w-full max-w-[1470px] xl:px-4 2xl:px-6" style={getSideBackgroundStyle(publicTheme)}>
      <div className={`relative min-h-screen w-full overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.22)] ${getEffectClassName(publicTheme)}`} style={getProfileBackgroundStyle(publicTheme)}>

      {/* Presentación: la forma cambia según la opción elegida (Clásico, Compacto, Showcase, Póster o Gamer) */}
      <ProfileHero {...profileHeroProps} />

      {/* Confianza: reseñas, carpetas, cartas y nivel de un vistazo */}
      <ProfileTrustStrip folders={folders.length} profileLevel={profileLevel} publicTheme={publicTheme} reviewSummary={seller?.reviewSummary} totalCards={totalCards} />

      {/* Módulos: el orden y el ancho salen de la distribución elegida */}
      <ProfileModules {...profileModulesProps} />
      </div>
      </div>

      {isOwner && themePanelOpen && <ProfileStudio {...profileStudioProps} />}
      {showMessageButton && (
        <ProfileContactBar displayName={displayName} folders={folders.length} onContact={contactSeller} publicTheme={publicTheme} readableOn={readableOn} totalCards={totalCards} />
      )}
    </div>
  );
}
