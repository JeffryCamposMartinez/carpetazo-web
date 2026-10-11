import { useMemo, useState } from 'react';
import { EMOJI_CATEGORIES, readFrequent, rememberEmoji } from './emojiData';

// Selector de emojis por categorías. Los más usados por la persona van primero.
export default function EmojiPicker({ onPick, className = '', height = 'h-64' }) {
  const frequent = useMemo(() => readFrequent(), []);
  const categories = useMemo(() => EMOJI_CATEGORIES.filter((category) => category.id !== 'frecuentes' || frequent.length).map((category) => (category.id === 'frecuentes' ? { ...category, emojis: frequent } : category)), [frequent]);
  const [active, setActive] = useState(categories[0].id);
  const current = categories.find((category) => category.id === active) || categories[0];

  return (
    <div className={`flex flex-col bg-white ${className}`}>
      <div role="tablist" aria-label="Categorías de emojis" className="hide-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1">
        {categories.map((category) => (
          <button key={category.id} type="button" role="tab" aria-selected={active === category.id} aria-label={category.label} title={category.label} onClick={() => setActive(category.id)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${active === category.id ? 'bg-[#dbeafe] text-[#1e40af]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">{category.icon}</span>
          </button>
        ))}
      </div>
      <p className="px-3 pb-1 pt-2 text-xs font-bold text-slate-500">{current.label}</p>
      <div role="tabpanel" className={`${height} overflow-y-auto overscroll-contain px-2 pb-2`}>
        <div className="grid grid-cols-8 gap-0.5">
          {current.emojis.map((emoji) => (
            <button key={emoji} type="button" onClick={() => { rememberEmoji(emoji); onPick(emoji); }} aria-label={emoji} className="flex h-10 items-center justify-center rounded-lg text-[26px] leading-none transition-transform duration-100 hover:bg-slate-100 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">{emoji}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
