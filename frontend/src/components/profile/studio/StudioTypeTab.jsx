import { useState } from 'react';
import { FONT_NOTES, FONT_ROLES, TYPE_PAIRS } from '../profileFonts';
import { getFontStack } from '../profileStyles';
import { STUDIO, StudioIntro, StudioSection, Symbol, cardState } from './StudioParts';

const stack = (font) => getFontStack(font);

// Tipografía en tres funciones: títulos, contenido y cifras. Arriba, una muestra con las tres juntas.
export default function StudioTypeTab({ displayName, onFields, publicTheme, totalCards }) {
  const [role, setRole] = useState('font');
  const [search, setSearch] = useState('');
  const activeRole = FONT_ROLES.find((item) => item.field === role);
  const fonts = activeRole.fonts.filter((font) => font.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedPair = TYPE_PAIRS.find((pair) => FONT_ROLES.every((item) => pair[item.field] === (publicTheme[item.field] || 'Inter')));

  return (
    <>
      <StudioIntro tab="font" title="Tres voces, una identidad." text="Una fuente para los títulos, otra para leer y otra para las cifras. Empieza con una combinación lista o elige cada una." />

      <div className="relative isolate overflow-hidden rounded-[13px] border border-[#294760] bg-[#12283f] p-5 text-[#f5f8ff] shadow-[0_10px_25px_rgba(14,40,75,0.07)] sm:p-6">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-65">
          <i className="absolute -right-[60px] top-12 h-[135px] w-[98px] -rotate-[20deg] rounded-[7px] border border-[#adc8e338] bg-[linear-gradient(130deg,#82a4cc0a,transparent)]" />
          <i className="absolute -right-[46px] top-16 h-[135px] w-[98px] -rotate-12 rounded-[7px] border border-[#d9bd6b25]" />
          <i className="absolute -right-8 top-[83px] h-[135px] w-[98px] -rotate-[4deg] rounded-[7px] border border-[#adc8e338]" />
        </span>
        <span className="block text-xs text-[#a6bfd6]">Vista previa de tu perfil</span>
        <strong className="my-4 block text-[clamp(25px,6vw,34px)] font-bold leading-[1.15] tracking-[-0.02em] [overflow-wrap:anywhere]" style={{ fontFamily: stack(publicTheme.font) }}>{displayName}</strong>
        <p className="max-w-[290px] text-[13px] leading-relaxed text-[#c9d6e3]" style={{ fontFamily: stack(publicTheme.bodyFont) }}>Un espacio para las cartas que te representan. Encuentra, comparte y arma tu próxima colección.</p>
        <span className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-2xl tabular-nums" style={{ fontFamily: stack(publicTheme.dataFont) }}>{totalCards.toLocaleString('es-CL')} <small className="text-xs text-[#9bb5cf]">cartas</small></span>
          <span className="flex items-center gap-1 text-[13px] text-[#f3d384]" style={{ fontFamily: stack(publicTheme.bodyFont) }}>Ver carpetas <Symbol name="chevron_right" className="text-[16px]" /></span>
        </span>
      </div>

      <StudioSection title="Combinaciones listas" hint="Una dirección completa, aplicada en un toque." aside={<Symbol name="text_fields" className="text-[20px] text-[#7189a7]" />}>
        <div className="grid grid-cols-2 gap-3">
          {TYPE_PAIRS.map((pair) => {
            const selected = selectedPair?.id === pair.id;
            return (
              <button key={pair.id} type="button" aria-pressed={selected} onClick={() => onFields({ font: pair.font, bodyFont: pair.bodyFont, dataFont: pair.dataFont })} className={`${cardState(selected)} p-3 sm:p-3.5`}>
                <span className="relative mb-3 flex h-[52px] items-baseline gap-2 border-b border-[#e8edf4]">
                  <span className="text-[30px] leading-none tracking-[-0.03em]" style={{ fontFamily: stack(pair.font), color: STUDIO.ink }}>Aa</span>
                  <span className="text-lg leading-none text-[#7a8ca4]" style={{ fontFamily: stack(pair.bodyFont) }}>Aa</span>
                  <small className="ml-auto text-xs tabular-nums text-[#7a8ca4]" style={{ fontFamily: stack(pair.dataFont) }}>01</small>
                  {selected && <Symbol name="check_circle" className="absolute -right-1 -top-1 bg-white text-[18px] text-[#2454c6]" filled />}
                </span>
                <strong className="block text-[13px] font-bold" style={{ fontFamily: STUDIO.heading, color: STUDIO.ink }}>{pair.name}</strong>
                <small className="mt-1 block text-xs leading-snug" style={{ color: STUDIO.muted }}>{pair.mood}</small>
                <span className="mt-2.5 block text-[11px] leading-snug text-[#75859a] [overflow-wrap:anywhere]">{pair.font} + {pair.bodyFont}</span>
              </button>
            );
          })}
        </div>
      </StudioSection>

      <StudioSection title="Elige cada fuente" hint="Variedad con intención: cada función con fuentes que le sientan." aside={`${activeRole.fonts.length} fuentes`}>
        <div role="group" aria-label="Función de la tipografía" className="grid grid-cols-3 gap-1 rounded-[11px] border bg-[#eef2f8] p-1" style={{ borderColor: STUDIO.line }}>
          {FONT_ROLES.map((item) => (
            <button key={item.field} type="button" aria-pressed={role === item.field} onClick={() => { setRole(item.field); setSearch(''); }} className={`min-h-11 rounded-[7px] px-1 text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-150 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2b63d8] ${role === item.field ? 'bg-white text-[#2454c6] shadow-[0_2px_5px_rgba(23,41,64,0.05)]' : 'text-[#5d6d82]'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="my-3.5 flex flex-wrap justify-between gap-1 text-xs leading-snug" style={{ color: STUDIO.muted }}>
          {activeRole.description}<strong className="font-semibold text-[#365581]">{publicTheme[role] || 'Inter'}</strong>
        </p>
        {activeRole.fonts.length > 8 && (
          <label className="mb-3.5 flex min-h-11 items-center gap-2 rounded-[9px] border bg-white px-3 text-[#7890ae] focus-within:ring-[3px] focus-within:ring-[#2b63d8]" style={{ borderColor: STUDIO.line }}>
            <Symbol name="search" className="text-[18px]" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar una fuente…" aria-label="Buscar fuente" className="min-w-0 flex-1 bg-transparent text-base text-[#172940] outline-none sm:text-sm" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          {fonts.map((font) => {
            const selected = (publicTheme[role] || 'Inter') === font;
            return (
              <button key={font} type="button" aria-pressed={selected} onClick={() => onFields({ [role]: font })} className={`${cardState(selected)} flex flex-col p-3 sm:p-3.5`}>
                <span className="flex min-h-5 items-center justify-between gap-1 text-xs" style={{ color: STUDIO.muted }}>
                  <span className="min-w-0 truncate">{font}</span>
                  {selected && <Symbol name="check_circle" className="shrink-0 text-[17px] text-[#2454c6]" filled />}
                </span>
                <strong className="my-2 grid min-h-[84px] items-center rounded-lg bg-[linear-gradient(140deg,#f5f7fa,#fbfcfe)] p-3 text-[36px] font-normal leading-tight [overflow-wrap:anywhere]" style={{ fontFamily: stack(font), color: STUDIO.ink }}>
                  {role === 'dataFont' ? '01 / 20' : 'Aa'}
                </strong>
                <small className="text-xs leading-snug" style={{ color: STUDIO.muted }}>{FONT_NOTES[font]}</small>
              </button>
            );
          })}
        </div>
        {fonts.length === 0 && <p className="p-5 text-center text-sm" style={{ color: STUDIO.muted }}>No hay fuentes con ese nombre.</p>}
      </StudioSection>
    </>
  );
}
