import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import LoadingState from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';
import { dayLabel, isSameDay } from './messageUtils';

const GROUP_MS = 5 * 60 * 1000;
const NEAR_BOTTOM = 140;
const FAB_AT = 420;

// Lista de mensajes con el comportamiento de WhatsApp: abre en el primer mensaje sin leer (o al final), mantiene la posición al cargar
// mensajes antiguos, sigue al final solo si ya estabas abajo y muestra el botón "ir al final" con los mensajes nuevos.
const MessageList = forwardRef(function MessageList({
  messages, partner, partnerName, resetKey, loading, hasMore, loadingOlder, onLoadOlder, firstUnreadId, typing, query, currentMatchId, flashId,
  onMenu, onReply, onJump, onImage, onRetry, onDiscard, onAtBottom
}, ref) {
  const scroller = useRef(null);
  const topSentinel = useRef(null);
  const state = useRef({ initial: true, firstId: null, height: 0, lastId: null, near: true });
  const [fab, setFab] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const partnerId = partner?.id;

  const items = useMemo(() => messages.map((message, index) => {
    const previous = messages[index - 1];
    const own = message.senderId !== partnerId;
    const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
    const unreadHere = message.id === firstUnreadId;
    const grouped = !newDay && !unreadHere && previous && (previous.senderId !== partnerId) === own && new Date(message.createdAt) - new Date(previous.createdAt) < GROUP_MS;
    return { message, own, newDay, unreadHere, grouped: Boolean(grouped) };
  }), [messages, partnerId, firstUnreadId]);

  const toBottom = (behavior = 'smooth') => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : behavior });
  };
  const toMessage = (id, block = 'center') => {
    const el = scroller.current?.querySelector(`[data-mid="${id}"]`);
    if (!el) return false;
    el.scrollIntoView({ block, behavior: 'smooth' });
    return true;
  };
  useImperativeHandle(ref, () => ({ toBottom, toMessage, has: (id) => Boolean(scroller.current?.querySelector(`[data-mid="${id}"]`)) }));

  // Cada conversación empieza de cero
  useEffect(() => { state.current = { initial: true, firstId: null, height: 0, lastId: null, near: true }; setFab(false); setNewBelow(0); }, [resetKey]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !messages.length) return;
    const current = state.current;
    const firstId = messages[0].id;
    const last = messages[messages.length - 1];

    if (current.initial) {
      if (loading) return;
      current.initial = false;
      const divider = firstUnreadId && el.querySelector('[data-unread-divider]');
      if (divider) el.scrollTop = Math.max(0, divider.offsetTop - 72); else el.scrollTop = el.scrollHeight;
    } else if (current.firstId && current.firstId !== firstId && messages.some((message) => message.id === current.firstId)) {
      el.scrollTop += el.scrollHeight - current.height; // llegaron mensajes antiguos arriba: la vista no salta
    } else if (current.lastId && current.lastId !== last.id) {
      const mine = last.senderId !== partnerId;
      if (mine || current.near) toBottom(mine ? 'smooth' : 'auto'); else setNewBelow((count) => count + 1);
    }
    current.firstId = firstId;
    current.lastId = last.id;
    current.height = el.scrollHeight;
  }, [messages, loading, firstUnreadId, partnerId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    state.current.near = distance < NEAR_BOTTOM;
    state.current.height = el.scrollHeight;
    setFab(distance > FAB_AT);
    if (distance < NEAR_BOTTOM) { setNewBelow(0); onAtBottom?.(); }
  };

  // Si el espacio de la lista cambia (se abre el teclado, aparece la barra de respuesta), lo último sigue a la vista
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let height = el.clientHeight;
    const observer = new ResizeObserver(() => {
      if (el.clientHeight !== height && state.current.near) el.scrollTop = el.scrollHeight;
      height = el.clientHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Al llegar al principio se piden los mensajes anteriores
  useEffect(() => {
    const el = topSentinel.current;
    if (!el || !hasMore || loadingOlder || loading) return undefined;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && !state.current.initial) onLoadOlder(); }, { root: scroller.current, rootMargin: '200px 0px 0px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, loading, onLoadOlder, messages.length]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label="Mensajes" className="chat-wallpaper h-full overflow-y-auto overscroll-contain pb-3 pt-2">
        <div ref={topSentinel} aria-hidden="true" className="h-px" />
        {loadingOlder && <LoadingState variant="compact" label="Cargando mensajes anteriores…" />}
        {!hasMore && !loading && (
          <p className="mx-auto mb-2 mt-3 flex max-w-[22rem] items-start gap-2 rounded-xl bg-[#fef3c7] px-3 py-2 text-center text-[12.5px] font-semibold leading-snug text-[#6b4f00] shadow-sm">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined mt-px shrink-0 text-[16px]">lock</span>
            <span>Conversación privada. Acuerden entrega y pago con calma y no pagues por adelantado a quien no conoces.</span>
          </p>
        )}
        {loading && messages.length === 0 ? <LoadingState variant="section" label="Cargando los mensajes…" />
          : messages.length === 0 ? <EmptyState variant="plain" icon="waving_hand" title="Empieza la conversación" className="mt-4">Escribe el primer mensaje. Puedes mandar fotos y cartas desde el clip.</EmptyState>
          : items.map(({ message, own, newDay, unreadHere, grouped }) => (
            <div key={message.id}>
              {newDay && (
                <div className="flex justify-center py-2">
                  <span className="rounded-lg bg-white/90 px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">{dayLabel(message.createdAt)}</span>
                </div>
              )}
              {unreadHere && (
                <div data-unread-divider className="my-2 flex justify-center">
                  <span className="rounded-full bg-[#12315f] px-4 py-1 text-xs font-bold text-white shadow-sm">Mensajes sin leer</span>
                </div>
              )}
              <MessageBubble
                message={message} own={own} partnerId={partnerId} partnerName={partnerName} grouped={grouped} query={query}
                current={currentMatchId === message.id} flash={flashId === message.id}
                onMenu={onMenu} onReply={onReply} onJump={onJump} onImage={onImage} onRetry={onRetry} onDiscard={onDiscard}
              />
            </div>
          ))}
        {typing && (
          <div className="mt-2 flex px-3 sm:px-6">
            <div role="status" aria-label={`${partnerName} está escribiendo`} className="flex items-center gap-1 rounded-2xl rounded-tl-none bg-white px-4 py-3 shadow-[0_1px_1px_rgba(15,23,42,0.14)]">
              {[0, 1, 2].map((dot) => <span key={dot} className="chat-typing-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: `${dot * 150}ms` }} />)}
            </div>
          </div>
        )}
      </div>
      {fab && (
        <button type="button" onClick={() => toBottom('smooth')} aria-label={newBelow ? `Ir al final: ${newBelow} mensajes nuevos` : 'Ir al final'} className="chat-pop absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-[0_2px_8px_rgba(8,18,42,0.3)] transition-[transform,filter] duration-150 hover:brightness-95 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] sm:right-5">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">keyboard_arrow_down</span>
          {newBelow > 0 && <span className="absolute -top-2 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#facc15] px-1 text-[11px] font-black text-[#12315f]">{newBelow > 99 ? '99+' : newBelow}</span>}
        </button>
      )}
    </div>
  );
});

export default MessageList;
