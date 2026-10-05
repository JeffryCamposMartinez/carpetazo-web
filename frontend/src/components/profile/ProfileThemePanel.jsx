import { LayoutWire, MiniScene, OptionTile, PanelSection, ShowcaseWire, ToggleRow } from './ProfileEditorParts';
import { PANEL_TABS, avatarFrameOptions, backgroundStyleOptions, cardStyleOptions, defaultPublicTheme, fontExamples, fontOptions, getAvatarFrameStyle, getEffectClassName, getFontStack, getSideBackgroundStyle, profileDistributionOptions, profileEffectOptions, profileLayoutOptions, profileThemes, showcaseStyleOptions, sideBackgroundOptions } from './profileStyles';
import { SocialLogo } from './SocialLogo';

// Panel de apariencia del perfil (solo el dueño): tema, letra, fondos, marco, diseño y módulos.
export default function ProfileThemePanel({
  applyThemePalette, avatarUrl, displayName, getSocialEnabled, handleThemeFieldChange, messageButtonEnabled,
  publicTheme, resetPublicTheme, saveCurrentTheme, savedTheme, savingTheme, setThemePanelOpen,
  setThemePanelTab, socialLinks, themeDirty, themePanelTab
}) {
  return (
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
  );
}
