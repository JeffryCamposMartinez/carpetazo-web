import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker from './EmojiPicker';
import { QUICK_REACTIONS } from './emojiData';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const MENU_W = 236;

// Menú de un mensaje: reacciones rápidas arriba y las acciones debajo. En el celular sube desde abajo; en pantalla ancha aparece junto al mensaje.
export default function MessageActionMenu({ target, onClose, actions, myReaction }) {
  const [picker, setPicker] = useState(false);
  const [place, setPlace] = useState(null);
  const ref = useRef(null);
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  useBodyScrollLock(Boolean(target) && phone);

  useEffect(() => { setPicker(false); setPlace(null); }, [target]);
  useEffect(() => {
    if (!target) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  // En pantalla ancha el menú se acomoda junto al mensaje sin salirse de la ventana
  useLayoutEffect(() => {
    if (!target || phone || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(target.point.x - width + 24, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(target.point.y + 6, window.innerHeight - height - 8));
    setPlace({ left, top });
  }, [target, phone, picker]);

  if (!target) return null;
  const { message, own, canEdit } = target;
  const items = [
    { id: 'reply', icon: 'reply', label: 'Responder', show: true },
    { id: 'copy', icon: 'content_copy', label: 'Copiar', show: Boolean(target.hasText) },
    { id: 'forward', icon: 'forward', label: 'Reenviar', show: true },
    { id: 'star', icon: message.starred ? 'star_half' : 'star', label: message.starred ? 'Quitar destacado' : 'Destacar', show: true },
    { id: 'edit', icon: 'edit', label: 'Corregir', show: canEdit },
    { id: 'info', icon: 'info', label: 'Info del mensaje', show: own },
    { id: 'report', icon: 'flag', label: 'Reportar', show: !own, danger: true }
  ].filter((item) => item.show);
  const choose = (id) => { onClose(); actions[id]?.(message); };
  const react = (emoji) => { onClose(); actions.react(message, emoji === myReaction ? null : emoji); };

  const content = (
    <div ref={ref} className={`chat-pop ${phone ? 'w-full px-3 pb-3' : ''}`} style={phone ? undefined : { position: 'fixed', width: MENU_W, left: place?.left ?? -9999, top: place?.top ?? -9999 }}>
      {picker ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          <EmojiPicker onPick={react} height="h-56" />
        </div>
      ) : (
        <>
          <div role="group" aria-label="Reaccionar" className="mb-2 flex items-center justify-between gap-0.5 rounded-full bg-white px-2 py-1.5 shadow-xl ring-1 ring-black/5">
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => react(emoji)} aria-label={`Reaccionar con ${emoji}`} className={`flex h-10 w-10 items-center justify-center rounded-full text-[24px] leading-none transition-transform duration-100 hover:scale-110 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${myReaction === emoji ? 'bg-[#dbeafe]' : ''}`}>{emoji}</button>
            ))}
            <button type="button" onClick={() => setPicker(true)} aria-label="Más reacciones" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">add</span>
            </button>
          </div>
          <ul role="menu" aria-label="Acciones del mensaje" className="overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-black/5">
            {items.map((item) => (
              <li key={item.id} role="none">
                <button type="button" role="menuitem" onClick={() => choose(item.id)} className={`flex min-h-12 w-full items-center gap-4 px-4 text-left text-[15px] font-semibold transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100 ${item.danger ? 'text-red-600' : 'text-slate-800'}`}>
                  <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[22px] ${item.danger ? 'text-red-500' : 'text-slate-500'}`}>{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="presentation">
      <button type="button" aria-label="Cerrar menú" tabIndex={-1} onClick={onClose} className="chat-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      {phone ? <div className="absolute inset-x-0 bottom-0">{content}</div> : content}
    </div>,
    document.body
  );
}
