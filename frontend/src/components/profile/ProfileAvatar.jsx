import { readableOn } from '../../utils/color';
import { getAvatarFrameStyle } from './profileStyles';

// Foto del vendedor con su marco, el nivel como la gema de coste de una carta y, para el dueño, el botón de cambiarla
export default function ProfileAvatar({ avatarSizeClass, avatarUrl, displayName, displayScale, handleImageUpload, isOwner, isPosterLayout, isSmallAvatar, profileLevel, publicTheme }) {
  return (
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
        <span className="font-black leading-none tabular-nums" style={{ fontFamily: 'var(--seller-data)', fontSize: `${((isSmallAvatar ? 0.95 : 1.15) * Math.max(displayScale, 0.75)).toFixed(2)}rem` }} aria-hidden="true">{profileLevel}</span>
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
}
