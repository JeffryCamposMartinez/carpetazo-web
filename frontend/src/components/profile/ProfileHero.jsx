import { Link } from 'react-router-dom';
import { ReportMenu } from '../moderation/ReportButton';
import { SocialLogo } from './SocialLogo';
import { bannerForScreen } from '../../utils/responsiveImage';
import { getCardStyle } from './profileStyles';
import { readableOn } from '../../utils/color';

// Presentación del perfil: portada, avatar, nombre, datos y contacto; la forma cambia según el diseño elegido.
export default function ProfileHero({
  avatarBlock, contactSeller, displayName, displayNameSize,
  handleImageUpload, handleSaveBio, heroActions, heroBanner, heroContainerClass, heroMuted, heroPadding,
  heroTheme, isCenteredLayout, isEditingBio, isGamerLayout, isOwner, isPosterLayout, layoutId,
  ownerButtonClass, primaryAddress, publicTheme, savingBio, savingImage, seller, setIsEditingBio, setTempBio,
  setThemePanelOpen, tempBio, themePanelOpen
}) {
  return (
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
                </h1>
                <p className="mt-1.5 text-[15px] font-bold leading-snug" style={{ color: heroTheme.primary }}>@{seller?.username}</p>
                {seller?.fullName && <p className="text-sm font-medium leading-snug" style={heroMuted}>{seller.fullName}</p>}
                {seller?.username && (
                  <Link to={`/cartas?seller=${encodeURIComponent(seller.username)}`} className="mt-1 inline-flex min-h-8 items-center gap-1 text-sm font-bold underline-offset-2 hover:underline focus:outline-none focus-visible:underline" style={{ color: heroTheme.primary }}>
                    <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">style</span>
                    Ver sus cartas en venta
                  </Link>
                )}
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

          {/* Ubicación (ciudad y región). Carpetas, cartas y reseñas van en la franja de confianza bajo la presentación */}
          {primaryAddress && (
            <p className={`mt-3 flex ${isCenteredLayout ? 'justify-center' : ''}`}>
              <span className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${isPosterLayout ? 'backdrop-blur-sm' : ''}`} style={{ backgroundColor: isPosterLayout ? 'rgba(255,255,255,0.14)' : `${heroTheme.primary}14`, color: heroTheme.text, boxShadow: `inset 0 0 0 1px ${isPosterLayout ? 'rgba(255,255,255,0.28)' : `${heroTheme.primary}2e`}` }}>
                <span translate="no" className="material-symbols-outlined shrink-0 text-[17px]" style={{ color: heroTheme.primary }} aria-hidden="true">location_on</span>
                <span className="truncate">{[primaryAddress.comuna, primaryAddress.region].filter(Boolean).join(', ') || primaryAddress.name}</span>
              </span>
            </p>
          )}

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
  );
}
