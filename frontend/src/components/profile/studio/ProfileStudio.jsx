import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { loadThemeFonts } from '../../../utils/themeFonts';
import { ALL_FONTS } from '../profileFonts';
import { PANEL_TABS } from '../profileStyles';
import { STUDIO, Symbol } from './StudioParts';
import StudioThemeTab from './StudioThemeTab';
import StudioTypeTab from './StudioTypeTab';
import { StudioCardsTab, StudioLayoutTab, StudioSceneTab, StudioSocialTab } from './StudioOptionTabs';

// «Profile Studio»: editor de apariencia del perfil (solo el dueño). Los cambios se ven al instante detrás y se guardan en la cuenta.
// Celular: hoja desde abajo (deja ver un poco del perfil). Pantallas anchas: panel a la derecha.
export default function ProfileStudio({
  applyThemePalette, avatarUrl, displayName, getSocialEnabled, handleThemeFieldChange, handleThemeFieldsChange,
  messageButtonEnabled, resetPublicTheme, saveCurrentTheme, savedTheme, savingTheme, setThemePanelOpen,
  setThemePanelTab, socialLinks, themeDirty, themePanelTab, totalCards
}) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const closeRef = useRef(() => setThemePanelOpen(false));
  closeRef.current = () => setThemePanelOpen(false);
  const initial = displayName[0]?.toUpperCase() || 'V';
  useBodyScrollLock();

  // Fuentes del propio editor y, en la pestaña de letra, todas las de la lista para ver cada muestra
  useEffect(() => { loadThemeFonts(['DM Sans', 'Manrope']); }, []);
  useEffect(() => {
    if (themePanelTab === 'font') loadThemeFonts(ALL_FONTS);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [themePanelTab]);

  // Foco dentro del panel mientras está abierto; Escape cierra y el foco vuelve al botón que lo abrió
  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const items = Array.from(panelRef.current?.querySelectorAll('button:not(:disabled), input, select, [href]') || []);
      if (items.length === 0) return;
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === panelRef.current)) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, []);

  const tabProps = { avatarUrl, initial, onField: handleThemeFieldChange, theme: savedTheme };

  return createPortal(
    <>
      <div className="sheet-backdrop fixed inset-0 z-[1300] touch-none bg-[#0a1322]/30" onClick={() => setThemePanelOpen(false)} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-title"
        className="studio-panel fixed inset-x-0 bottom-0 z-[1301] flex h-[90dvh] flex-col overflow-hidden rounded-t-[24px] text-[14px] shadow-[0_-16px_50px_rgba(8,18,42,0.35)] outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[min(540px,100%)] sm:rounded-none sm:rounded-l-[24px]"
        style={{ backgroundColor: STUDIO.ground, color: STUDIO.ink, fontFamily: "'DM Sans', Inter, system-ui, sans-serif" }}
      >
        <header className="relative shrink-0 touch-none overflow-hidden px-5 pt-5 text-white sm:px-7 sm:pt-7" style={{ background: 'radial-gradient(ellipse at 100% 0, rgba(50,89,138,0.44), transparent 60%), #12283f' }}>
          <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-[60px] h-[200px] w-[200px] rounded-full border border-white/5" />
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25 sm:hidden" />
          <div className="relative flex items-center gap-3">
            <span className="hidden h-[43px] w-[43px] shrink-0 place-items-center rounded-xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),transparent)] text-[#fbd96b] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] min-[380px]:grid">
              <Symbol name="tune" className="text-[22px]" />
            </span>
            <h2 id="studio-title" className="min-w-0 flex-1 text-[clamp(21px,5vw,27px)] font-bold leading-tight tracking-[-0.03em]" style={{ fontFamily: STUDIO.heading }}>Tu perfil. Tu estilo.</h2>
            <button type="button" onClick={() => setThemePanelOpen(false)} aria-label="Cerrar personalización" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 transition-[background-color,transform] duration-150 active:scale-[0.94] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#fbd96b] [@media(hover:hover)]:hover:bg-white/15">
              <Symbol name="close" className="text-[22px]" />
            </button>
          </div>
          <p className="relative mb-4 mt-3 hidden text-[13px] leading-relaxed text-[#bacbdc] min-[380px]:block sm:mb-5 sm:mt-4">Diseña un espacio a la altura de tu colección.</p>
          <div className="relative flex items-center gap-2 border-t border-white/10 py-3 text-xs text-[#d1dce8]" aria-live="polite">
            <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${savingTheme ? 'bg-slate-300' : themeDirty ? 'bg-[#ffd453] shadow-[0_0_0_4px_rgba(255,212,83,0.12)]' : 'bg-[#75ddbc] shadow-[0_0_0_4px_rgba(117,221,188,0.12)]'}`} />
            <span className="min-w-0 truncate">{savingTheme ? 'Guardando…' : themeDirty ? 'Cambios sin guardar' : 'Cambios guardados'}</span>
            <span className="ml-auto shrink-0 rounded-[5px] border border-white/10 px-2 py-1 text-[11px] text-[#a4bad2]">Vista en vivo</span>
          </div>
        </header>

        <nav aria-label="Qué personalizar" className="grid shrink-0 grid-cols-6 gap-0.5 border-b bg-white px-2 py-1.5 shadow-[0_3px_12px_rgba(23,41,64,0.02)] sm:gap-1 sm:px-4 sm:py-2.5" style={{ borderColor: STUDIO.line }}>
          {PANEL_TABS.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={themePanelTab === id}
              onClick={() => setThemePanelTab(id)}
              className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-[9px] px-0.5 text-[11px] font-semibold transition-[background-color,color] duration-150 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2b63d8] ${themePanelTab === id ? 'bg-[#edf3ff] text-[#2454c6] shadow-[inset_0_0_0_1px_rgba(36,84,198,0.06)]' : 'text-[#5d6d82] [@media(hover:hover)]:hover:bg-[#f6f8fc] [@media(hover:hover)]:hover:text-[#2454c6]'}`}
            >
              <Symbol name={icon} className="text-[21px]" filled={themePanelTab === id} />
              <span className="max-w-full truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div ref={bodyRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-8 pt-6 [scrollbar-color:#c8d3e1_transparent] [scrollbar-width:thin] sm:px-7 sm:pt-7">
          {themePanelTab === 'theme' && <StudioThemeTab applyThemePalette={applyThemePalette} avatarUrl={avatarUrl} handleThemeFieldChange={handleThemeFieldChange} initial={initial} publicTheme={savedTheme} />}
          {themePanelTab === 'font' && <StudioTypeTab displayName={displayName} onFields={handleThemeFieldsChange} publicTheme={savedTheme} totalCards={totalCards} />}
          {themePanelTab === 'cards' && <StudioCardsTab {...tabProps} />}
          {themePanelTab === 'scene' && <StudioSceneTab {...tabProps} />}
          {themePanelTab === 'layout' && <StudioLayoutTab {...tabProps} />}
          {themePanelTab === 'social' && <StudioSocialTab getSocialEnabled={getSocialEnabled} messageButtonEnabled={messageButtonEnabled} onField={handleThemeFieldChange} socialLinks={socialLinks} />}
        </div>

        <footer className="grid shrink-0 grid-cols-[1fr_1.5fr] gap-2.5 border-t bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(23,41,64,0.02)] sm:px-7 sm:pt-4" style={{ borderColor: STUDIO.line }}>
          <button type="button" onClick={resetPublicTheme} disabled={savingTheme} className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] border bg-white px-2 text-[13px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2b63d8] disabled:opacity-50 [@media(hover:hover)]:hover:bg-[#f5f7fa]" style={{ borderColor: STUDIO.line, color: STUDIO.ink }}>
            <Symbol name="restart_alt" className="text-[19px]" />Restablecer
          </button>
          <button type="button" onClick={saveCurrentTheme} disabled={savingTheme || !themeDirty} className={`flex min-h-12 items-center justify-center gap-2 rounded-[10px] border px-2 text-[13px] font-bold transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2b63d8] focus-visible:ring-offset-2 ${themeDirty || savingTheme ? 'border-[#173a64] bg-[#173a64] text-white shadow-[0_4px_8px_rgba(23,58,100,0.1)] [@media(hover:hover)]:hover:bg-[#2454c6]' : 'cursor-default border-[#d7e8df] bg-[#edf4f1] text-[#3d7159]'}`}>
            <Symbol name={savingTheme ? 'hourglass_empty' : 'check'} className="text-[19px]" />{savingTheme ? 'Guardando…' : themeDirty ? 'Guardar cambios' : 'Guardado'}
          </button>
          <small className="col-span-2 hidden items-center justify-center gap-1.5 text-xs sm:flex" style={{ color: STUDIO.muted }}>
            <Symbol name="lock" className="text-[14px]" />Se guarda en tu cuenta y se ve en tu perfil público
          </small>
        </footer>
      </aside>
    </>,
    document.body
  );
}
