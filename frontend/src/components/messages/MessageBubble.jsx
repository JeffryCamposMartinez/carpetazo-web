import { memo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Ticks, { messageStatus } from './Ticks';
import VoiceMessage from './VoiceMessage';
import { clock, decodeMessage, splitLinks, splitMatches } from './messageUtils';

const LONG_PRESS_MS = 420;
const REPLY_DISTANCE = 56;
const MAX_PULL = 76;
const haptic = (ms) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };
const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;

// Texto con enlaces (se abren en otra pestaña) y las coincidencias de la búsqueda resaltadas
function RichText({ text, query, own }) {
  return splitLinks(text).map((part, index) => (part.type === 'link'
    ? <a key={index} href={part.value} target="_blank" rel="noopener noreferrer nofollow" onClick={(event) => event.stopPropagation()} className={`[overflow-wrap:anywhere] underline underline-offset-2 ${own ? 'text-[#bfdbfe]' : 'text-[#1e40af]'}`}>{part.value}</a>
    : splitMatches(part.value, query).map((piece, at) => (piece.match ? <mark key={`${index}-${at}`} className="rounded bg-[#facc15] px-0.5 text-[#12315f]">{piece.text}</mark> : <span key={`${index}-${at}`}>{piece.text}</span>))));
}

function CardAttachment({ attachment, own, onImage }) {
  if (!attachment || attachment.unavailable) {
    return (
      <div className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${own ? 'bg-white/15 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">block</span>
        Esta carta ya no está disponible
      </div>
    );
  }
  // La foto se ve grande para revisar los detalles; al tocarla se abre a pantalla completa. Una carta de una carpeta no pública no tiene página, así que no lleva botón.
  return (
    <div className={`mb-1 w-[16.5rem] max-w-full overflow-hidden rounded-xl p-2 ${own ? 'bg-white/15' : 'bg-slate-100'}`}>
      {attachment.imageUrl
        ? (
          <button type="button" onClick={() => onImage?.(attachment.imageUrl)} aria-label={`Ver ${attachment.name} a pantalla completa`} className="block w-full overflow-hidden rounded-lg bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
            <img src={attachment.imageUrl} alt={attachment.name} loading="lazy" draggable="false" className="aspect-[5/7] w-full object-cover" />
          </button>
        )
        : <span aria-hidden="true" className="flex aspect-[5/7] w-full items-center justify-center rounded-lg bg-slate-200 text-slate-400"><span translate="no" className="material-symbols-outlined text-[40px]">style</span></span>}
      <div className="px-1 pb-0.5 pt-2">
        <span className={`block text-[15px] font-extrabold leading-tight ${own ? 'text-white' : 'text-[#12315f]'}`}>{attachment.name}</span>
        {attachment.set && <span className={`mt-0.5 block truncate text-xs ${own ? 'text-blue-100' : 'text-slate-500'}`}>{attachment.set}</span>}
        <span className={`mt-1 block text-[17px] font-black tabular-nums ${own ? 'text-[#facc15]' : 'text-[#12315f]'}`}>{Number(attachment.price) > 0 ? formatCLP(attachment.price) : 'Consultar'}</span>
      </div>
      {attachment.private
        ? <span className={`block px-1 pt-1 text-[11px] font-bold ${own ? 'text-blue-100' : 'text-slate-500'}`}>Carta no publicada</span>
        : (
          <Link to={`/carta/${attachment.id}`} onClick={(event) => event.stopPropagation()} className={`mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-extrabold transition-[filter,transform] active:scale-[0.97] [@media(hover:hover)]:hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${own ? 'bg-[#facc15] text-[#12315f]' : 'bg-[#1e40af] text-white'}`}>
            Ir a ver carta
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        )}
    </div>
  );
}

function ReplyQuote({ reply, own, partnerName, onJump }) {
  const author = reply.gone ? '' : reply.senderId && reply.senderId !== 'me' && reply.senderId === own?.partnerId ? partnerName : 'Tú';
  return (
    <button type="button" onClick={(event) => { event.stopPropagation(); if (reply.id) onJump(reply.id); }} disabled={!reply.id} className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${own?.mine ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200/70'}`}>
      <span translate="no" aria-hidden="true" className={`material-symbols-outlined mt-px shrink-0 text-[16px] ${own?.mine ? 'text-[#facc15]' : 'text-[#1e40af]'}`}>reply</span>
      <span className="min-w-0 flex-1">
        {author && <span className={`block truncate text-xs font-extrabold ${own?.mine ? 'text-[#facc15]' : 'text-[#1e40af]'}`}>{author}</span>}
        <span className={`line-clamp-2 break-words ${own?.mine ? 'text-blue-50' : 'text-slate-600'}`}>
          {reply.gone ? 'Mensaje no disponible' : reply.kind === 'image' ? (reply.text ? `Foto · ${reply.text}` : 'Foto') : reply.kind === 'card' ? (reply.text ? `Carta · ${reply.text}` : 'Carta') : reply.text}
        </span>
      </span>
    </button>
  );
}

function MessageBubble({ message, own, partnerId, partnerName, grouped, query, current, flash, onMenu, onReply, onJump, onImage, onRetry, onDiscard }) {
  const rowRef = useRef(null);
  const touch = useRef(null);
  const [imageBroken, setImageBroken] = useState(false);
  const body = decodeMessage(message.content);
  const image = body.imageUrl || body.imageBase64;
  const hasText = Boolean(body.text);
  const status = own ? messageStatus(message) : null;
  const reactions = message.reactions || [];

  const openMenu = (point) => { if (!message.temp && !message.hidden) onMenu(message, point); };

  // Mantener presionado abre el menú; deslizar hacia la derecha responde (como en WhatsApp)
  const onTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const { clientX, clientY } = event.touches[0];
    touch.current = { x: clientX, y: clientY, mode: null, timer: window.setTimeout(() => { if (touch.current && !touch.current.mode) { touch.current.mode = 'press'; haptic(14); openMenu({ x: clientX, y: clientY }); } }, LONG_PRESS_MS), fired: false };
  };
  const onTouchMove = (event) => {
    const state = touch.current;
    if (!state || state.mode === 'press') return;
    const dx = event.touches[0].clientX - state.x;
    const dy = event.touches[0].clientY - state.y;
    if (!state.mode) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        window.clearTimeout(state.timer);
        state.mode = Math.abs(dx) > Math.abs(dy) * 1.4 && dx > 0 && !message.temp ? 'swipe' : 'scroll';
      }
    }
    if (state.mode === 'swipe') {
      const pull = Math.min(MAX_PULL, dx * 0.7);
      if (rowRef.current) rowRef.current.style.transform = `translateX(${pull}px)`;
      const icon = rowRef.current?.parentElement?.querySelector('[data-reply-icon]');
      if (icon) { icon.style.opacity = String(Math.min(1, pull / REPLY_DISTANCE)); icon.style.transform = `scale(${0.6 + Math.min(0.4, pull / REPLY_DISTANCE * 0.4)})`; }
      if (pull >= REPLY_DISTANCE && !state.fired) { state.fired = true; haptic(10); }
    }
  };
  const onTouchEnd = (event) => {
    const state = touch.current;
    touch.current = null;
    if (!state) return;
    window.clearTimeout(state.timer);
    if (state.mode === 'press' && event.cancelable) event.preventDefault(); // al soltar tras mantener presionado no debe caer un clic sobre lo que apareció debajo
    if (rowRef.current) { rowRef.current.style.transition = 'transform 160ms cubic-bezier(0.23,1,0.32,1)'; rowRef.current.style.transform = ''; window.setTimeout(() => { if (rowRef.current) rowRef.current.style.transition = ''; }, 180); }
    const icon = rowRef.current?.parentElement?.querySelector('[data-reply-icon]');
    if (icon) icon.style.opacity = '0';
    if (state.mode === 'swipe' && state.fired) onReply(message);
  };

  const tail = !grouped ? (own
    ? "after:absolute after:-right-[7px] after:top-0 after:h-0 after:w-0 after:border-l-[8px] after:border-t-[10px] after:border-l-transparent after:border-t-[#1e40af] after:content-['']"
    : "after:absolute after:-left-[7px] after:top-0 after:h-0 after:w-0 after:border-r-[8px] after:border-t-[10px] after:border-r-transparent after:border-t-white after:content-['']") : '';
  const radius = !grouped ? (own ? 'rounded-2xl rounded-tr-none' : 'rounded-2xl rounded-tl-none') : 'rounded-2xl';

  return (
    <div data-mid={message.id} className={`relative flex px-3 sm:px-6 ${own ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-[2px]' : 'mt-2'} ${reactions.length ? 'mb-3' : ''} ${flash ? 'chat-flash' : ''}`}>
      <span data-reply-icon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/10 text-slate-600 opacity-0 sm:left-8">
        <span translate="no" className="material-symbols-outlined text-[20px]">reply</span>
      </span>
      <div
        ref={rowRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onContextMenu={(event) => { event.preventDefault(); openMenu({ x: event.clientX, y: event.clientY }); }}
        className={`group relative max-w-[84%] touch-pan-y select-none [-webkit-touch-callout:none] sm:max-w-[68%] sm:select-text ${own ? 'flex flex-col items-end' : ''}`}
      >
        <div className={`relative px-2.5 pb-1.5 pt-1.5 shadow-[0_1px_1px_rgba(15,23,42,0.14)] ${radius} ${tail} ${own ? 'bg-[#1e40af] text-white' : 'bg-white text-slate-900'} ${message.pending ? 'opacity-80' : ''} ${current ? 'ring-2 ring-[#facc15]' : ''}`}>
          {!message.temp && !message.hidden && (
            <button type="button" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onMenu(message, { x: rect.right, y: rect.bottom }); }} aria-label="Opciones del mensaje" className={`absolute right-1 top-1 z-10 hidden h-7 w-7 items-center justify-center rounded-full opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] group-hover:opacity-100 sm:flex ${own ? 'bg-[#1e40af] text-white/80' : 'bg-white text-slate-500'}`}>
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
            </button>
          )}
          {message.forwarded && (
            <p className={`mb-0.5 flex items-center gap-1 text-xs italic ${own ? 'text-blue-100' : 'text-slate-500'}`}>
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[14px]">forward</span>Reenviado
            </p>
          )}
          {message.replyTo && <ReplyQuote reply={message.replyTo} own={{ mine: own, partnerId }} partnerName={partnerName} onJump={onJump} />}
          {body.cardId && <CardAttachment attachment={message.attachment} own={own} onImage={(src) => onImage?.(src, message.id)} />}
          {body.audio && !message.hidden && <VoiceMessage audio={body.audio} own={own} />}
          {image && (
            imageBroken ? (
              <div className={`mb-1 flex h-28 w-[14rem] max-w-full flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${own ? 'bg-white/15 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">broken_image</span>
                La foto no está disponible
              </div>
            ) : (
            <button type="button" onClick={() => onImage(image, message.id)} aria-label="Ver foto" className="relative mb-1 block overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
              <img src={image} alt="Foto enviada" loading="lazy" draggable="false" onError={() => setImageBroken(true)} className="max-h-80 min-h-24 w-full min-w-[9rem] max-w-[16rem] bg-black/10 object-cover sm:max-w-[20rem]" />
              {!hasText && (
                <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {clock(message.createdAt)}{own && <Ticks status={status} />}
                </span>
              )}
            </button>
            )
          )}
          {message.hidden && <p className="flex items-center gap-1 text-sm italic text-slate-500"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px]">visibility_off</span>{message.content}</p>}
          {hasText && !message.hidden && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.35]">
              <RichText text={body.text} query={query} own={own} />
              <span aria-hidden="true" className={`inline-block h-3 ${own ? 'w-[88px]' : 'w-[60px]'}`} />
            </p>
          )}
          {(hasText || !image || imageBroken) && !message.hidden && (
            <span className={`absolute bottom-1 right-2 flex items-center gap-1 text-[11px] leading-none ${own ? 'text-white/70' : 'text-slate-400'}`}>
              {message.starred && <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
              {message.editedAt && <span>editado</span>}
              <span>{clock(message.createdAt)}</span>
              {own && <Ticks status={status} />}
            </span>
          )}
          {(body.cardId || body.audio) && !hasText && !message.hidden && <span aria-hidden="true" className="block h-3" />}
          {reactions.length > 0 && (
            <span className={`absolute -bottom-3.5 ${own ? 'right-2' : 'left-2'} flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[13px] leading-none shadow-[0_1px_3px_rgba(15,23,42,0.25)] ring-1 ring-slate-100`}>
              {reactions.map((reaction) => <span key={reaction.emoji} className={reaction.mine ? 'rounded-full bg-[#dbeafe] px-0.5' : 'px-0.5'}>{reaction.emoji}</span>)}
              {reactions.reduce((sum, reaction) => sum + reaction.count, 0) > 1 && <span className="pl-0.5 text-[11px] font-bold text-slate-500">{reactions.reduce((sum, reaction) => sum + reaction.count, 0)}</span>}
            </span>
          )}
        </div>
        {message.failed && (
          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-red-600">
            <span>{message.failReason || 'No se pudo enviar.'}</span>
            <button type="button" onClick={() => onRetry(message.id)} className="rounded-full bg-red-50 px-2.5 py-1 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Reintentar</button>
            <button type="button" onClick={() => onDiscard(message.id)} className="rounded-full px-2.5 py-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Descartar</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
