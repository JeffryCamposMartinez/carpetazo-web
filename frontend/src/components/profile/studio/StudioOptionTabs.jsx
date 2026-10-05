import { LayoutWire, MiniScene, ShowcaseWire } from '../ProfileEditorParts';
import { SocialLogo } from '../SocialLogo';
import { avatarFrameOptions, backgroundStyleOptions, cardStyleOptions, getAvatarFrameStyle, getEffectClassName, getSideBackgroundStyle, profileDistributionOptions, profileEffectOptions, profileLayoutOptions, showcaseStyleOptions, sideBackgroundOptions } from '../profileStyles';
import { OptionGrid, STUDIO, StudioIntro, StudioOption, StudioSection, StudioSwitchRow, Symbol } from './StudioParts';

const count = (list) => `${list.length} estilos`;

export function StudioCardsTab({ avatarUrl, initial, onField, theme }) {
  return (
    <>
      <StudioIntro tab="cards" title="No son simples tarjetas." text="Texturas y contornos para la presentación, la vitrina y cada módulo de tu perfil." />
      <StudioSection title="Acabado de las tarjetas" aside={count(cardStyleOptions)}>
        <OptionGrid>
          {cardStyleOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.cardStyle === option.id} onClick={() => onField('cardStyle', option.id)} name={option.name} description={option.description}>
              <MiniScene theme={{ ...theme, cardStyle: option.id }} avatarUrl={avatarUrl} initial={initial} />
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
    </>
  );
}

export function StudioSceneTab({ avatarUrl, initial, onField, theme }) {
  const photo = avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial;
  return (
    <>
      <StudioIntro tab="scene" title="Construye tu mundo." text="Desde una galería limpia hasta una sala de arcade: el escenario detrás de tu perfil." />
      <StudioSection title="Presentación" hint="Cómo se arma la parte de arriba de tu perfil." aside={count(profileLayoutOptions)}>
        <OptionGrid>
          {profileLayoutOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.profileLayout === option.id} onClick={() => onField('profileLayout', option.id)} name={option.name} description={option.description}>
              <LayoutWire id={option.id} />
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
      <StudioSection title="Atmósfera" hint="El fondo detrás de tu presentación, tu vitrina y tus carpetas." aside={count(backgroundStyleOptions)}>
        <OptionGrid>
          {backgroundStyleOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.backgroundStyle === option.id} onClick={() => onField('backgroundStyle', option.id)} name={option.name} description={option.description}>
              <MiniScene theme={{ ...theme, backgroundStyle: option.id }} avatarUrl={avatarUrl} initial={initial} />
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
      <StudioSection title="Fondo exterior" hint="Lo que se ve a los lados en pantallas anchas." aside={count(sideBackgroundOptions)}>
        <OptionGrid>
          {sideBackgroundOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.sideBackgroundStyle === option.id} onClick={() => onField('sideBackgroundStyle', option.id)} name={option.name} description={option.description} sampleStyle={getSideBackgroundStyle({ ...theme, sideBackgroundStyle: option.id })}>
              <span className="absolute inset-y-3 left-[24%] right-[24%] rounded-lg bg-white/90 p-2 shadow-lg" aria-hidden="true">
                <span className="block h-1.5 w-3/4 rounded-full bg-[#12315f]" />
                <span className="mt-1.5 block h-1 w-1/2 rounded-full bg-slate-300" />
                <span className="mt-2 grid grid-cols-2 gap-1"><span className="h-6 rounded-[3px] bg-emerald-500" /><span className="h-6 rounded-[3px] bg-emerald-500" /></span>
              </span>
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
      <StudioSection title="Marco de la foto" hint="El borde que rodea tu foto. Aquí ves tu foto real." aside={count(avatarFrameOptions)}>
        <OptionGrid>
          {avatarFrameOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.avatarFrame === option.id} onClick={() => onField('avatarFrame', option.id)} name={option.name} description={option.description} sampleClassName="grid place-items-center bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.65),transparent_85%)]">
              <span className="h-[69px] w-[69px] rounded-[23px] p-1 shadow-[0_12px_20px_rgba(19,38,61,0.12)]" style={{ background: getAvatarFrameStyle({ ...theme, avatarFrame: option.id }) }}>
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[19px] bg-[linear-gradient(150deg,#244e75,#0c2138)] text-xl font-semibold text-white ring-2 ring-white/90">{photo}</span>
              </span>
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
      <StudioSection title="Efectos visuales" hint="Una capa sobre todo el perfil. «Sin efecto» es lo más liviano." aside={count(profileEffectOptions)}>
        <OptionGrid>
          {profileEffectOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.profileEffect === option.id} onClick={() => onField('profileEffect', option.id)} name={option.name} description={option.description} sampleClassName={`bg-[#0f172a] ${getEffectClassName({ ...theme, profileEffect: option.id })}`}>
              <span className="absolute inset-x-3 bottom-3 top-5 z-[2] flex items-center gap-2 rounded-lg bg-white/90 p-2 shadow-lg" aria-hidden="true">
                <span className="h-8 w-8 shrink-0 rounded-lg" style={{ backgroundColor: theme.accent }} />
                <span className="flex-1"><span className="block h-1.5 w-4/5 rounded-full bg-[#12315f]" /><span className="mt-1 block h-1 w-1/2 rounded-full bg-slate-300" /></span>
              </span>
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
      <StudioSection title="Vitrina destacada" hint="El módulo que aparece bajo tu presentación." aside={count(showcaseStyleOptions)}>
        <OptionGrid>
          {showcaseStyleOptions.map((option) => (
            <StudioOption key={option.id} selected={theme.showcaseStyle === option.id} onClick={() => onField('showcaseStyle', option.id)} name={option.name} description={option.description}>
              <ShowcaseWire id={option.id} />
            </StudioOption>
          ))}
        </OptionGrid>
      </StudioSection>
    </>
  );
}

const MODULES = {
  showcase: { label: 'Vitrina', icon: 'style', className: 'bg-[#3764c5] text-white' },
  stats: { label: 'Resumen', icon: 'bar_chart', className: 'bg-[#f5ce63] text-[#5b4612]' },
  folders: { label: 'Carpetas', icon: 'folder', className: 'bg-[#298a79] text-white' },
};

export function StudioLayoutTab({ onField, theme }) {
  return (
    <>
      <StudioIntro tab="layout" title="Cada módulo en su lugar." text="Elige qué ve primero quien visita tu perfil y cuánto espacio ocupa cada parte en pantallas anchas." />
      <p className="mb-4 flex flex-wrap justify-between gap-2 rounded-lg border bg-white p-3 text-xs font-semibold" style={{ borderColor: STUDIO.line }}>
        {Object.values(MODULES).map((module) => (
          <span key={module.label} className="flex items-center gap-1.5" style={{ color: STUDIO.ink }}><span className={`h-3 w-3 rounded ${module.className}`} />{module.label}</span>
        ))}
      </p>
      <OptionGrid>
        {profileDistributionOptions.map((option) => (
          <StudioOption key={option.id} selected={theme.profileDistribution === option.id} onClick={() => onField('profileDistribution', option.id)} name={option.name} description={option.description} sampleClassName="p-3">
            <span className="grid h-full auto-rows-fr grid-cols-12 gap-[5px]" aria-hidden="true">
              {option.order.map((moduleName) => {
                const span = (option.spans?.[moduleName] || 'lg:col-span-12').replace('lg:col-span-', '');
                const module = MODULES[moduleName];
                return (
                  <i key={moduleName} className={`grid min-w-0 place-items-center rounded-[5px] px-0.5 not-italic shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${module.className}`} style={{ gridColumn: `span ${span} / span ${span}` }}>
                    <Symbol name={module.icon} className="text-[15px]" />
                    {Number(span) >= 4 && <span className="max-w-full truncate text-[9px] font-semibold leading-tight">{module.label}</span>}
                  </i>
                );
              })}
            </span>
          </StudioOption>
        ))}
      </OptionGrid>
    </>
  );
}

const SOCIAL_TONES = {
  whatsapp: 'bg-[#e8f7ee] text-[#16804d]',
  instagram: 'bg-[#fcecf5] text-[#b33683]',
  facebook: 'bg-[#eaf2ff] text-[#306fcf]',
  youtube: 'bg-[#fff0ef] text-[#c93f35]',
};

export function StudioSocialTab({ getSocialEnabled, messageButtonEnabled, onField, socialLinks }) {
  const toggle = (field, enabled) => onField(field, enabled ? 'off' : 'on');
  return (
    <>
      <StudioIntro tab="social" title="Abre la conversación." text="Controla qué ven tus visitantes. Las redes solo aparecen si ya cargaste el enlace en tu cuenta." />
      <div className="grid gap-2.5">
        <StudioSwitchRow enabled={messageButtonEnabled} onClick={() => toggle('showMessageButton', messageButtonEnabled)} label="Mensaje privado" status={messageButtonEnabled ? 'Visible en tu perfil' : 'Oculto en tu perfil'} icon={<Symbol name="chat" />} />
        <StudioSwitchRow enabled={getSocialEnabled('showWishlist')} onClick={() => toggle('showWishlist', getSocialEnabled('showWishlist'))} label="Lista de cartas deseadas" status={getSocialEnabled('showWishlist') ? 'Visible en tu perfil y en tus carpetas' : 'Oculta para los demás'} icon={<Symbol name="favorite" />} />
        {socialLinks.map((social) => {
          const enabled = getSocialEnabled(social.field);
          return (
            <StudioSwitchRow
              key={social.id}
              enabled={enabled}
              onClick={() => toggle(social.field, enabled)}
              label={social.label}
              status={social.available ? (enabled ? 'Visible en tu perfil' : 'Oculto en tu perfil') : 'Sin enlace configurado'}
              icon={<SocialLogo type={social.id} className="h-5 w-5" />}
              iconClassName={SOCIAL_TONES[social.id]}
            />
          );
        })}
      </div>
    </>
  );
}
