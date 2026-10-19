import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AttachSheet from './AttachSheet';
import EmojiPicker from './EmojiPicker';
import { MicButton, RecordingBar } from './VoiceControls';
import useVoiceRecorder, { voiceSupported } from '../../hooks/useVoiceRecorder';
import SvgIcon from '../ui/SvgIcon';

const MAX_HEIGHT = 140;

// Barra para escribir, como la de WhatsApp: emojis, texto que crece, clip, cámara y botón de enviar. También sirve para responder y corregir.
export default function Composer({
  draft, onDraft, onSend, onTyping, replyTo, replyAuthor, onCancelReply, editing, onCancelEdit, onSaveEdit,
  onFiles, onOpenCards, quickReplies, showQuick, blocked, onUnblock, focusKey, onVoice, onNotice, attachedCard, onRemoveCard
}) {
  const [text, setText] = useState(draft || '');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const field = useRef(null);
  const camera = useRef(null);
  const recorder = useVoiceRecorder();
  const [voice, setVoice] = useState(null); // { mode: 'hold' | 'locked', slide: { dx, dy } }
  const held = useRef(false);
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const hasText = text.trim().length > 0;
  const showSend = hasText || Boolean(editing);
  const canVoice = Boolean(onVoice) && voiceSupported();

  // ---- Notas de voz
  const finishVoice = async (send) => {
    const result = await recorder.stop(send);
    setVoice(null);
    if (send && result) onVoice(result);
    else if (send) onNotice?.('Mantén presionado para grabar un mensaje de voz.');
  };
  const startVoice = async (mode) => {
    held.current = mode === 'hold';
    try { await recorder.start(); } catch (error) { onNotice?.(error.code === 'denied' ? 'Permite el micrófono en tu navegador para enviar notas de voz.' : 'Tu navegador no puede grabar audio.'); return; }
    recorder.setLimitHandler(() => finishVoice(true));
    if (mode === 'hold' && !held.current) { await recorder.stop(false); onNotice?.('Mantén presionado para grabar un mensaje de voz.'); return; }
    onTyping?.(false);
    setVoice({ mode, slide: { dx: 0, dy: 0 } });
  };
  const releaseVoice = () => { held.current = false; if (recorder.recording) finishVoice(true); };
  const cancelVoice = () => { held.current = false; finishVoice(false); };

  const resize = () => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };
  useLayoutEffect(resize, [text]);

  // Al cambiar de conversación (o empezar a responder o corregir) el texto y el foco se reinician
  useEffect(() => { setText(draft || ''); setEmojiOpen(false); }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editing) setText(editing.text); }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (replyTo || editing) field.current?.focus({ preventScroll: true }); }, [replyTo?.id, editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!touch) field.current?.focus({ preventScroll: true }); }, [focusKey, touch]);

  const change = (value) => {
    setText(value);
    if (!editing) { onDraft?.(value); onTyping?.(value.trim().length > 0); }
  };

  const submit = () => {
    if (!hasText) return;
    if (editing) { onSaveEdit(editing.id, text.trim()); setText(''); return; }
    onSend(text.trim());
    setText('');
    onDraft?.('');
    onTyping?.(false);
    setEmojiOpen(false);
    field.current?.focus({ preventScroll: true }); // el teclado no se cierra entre mensajes
  };

  const insertEmoji = (emoji) => {
    const el = field.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    change(`${text.slice(0, start)}${emoji}${text.slice(end)}`);
    window.requestAnimationFrame(() => { if (el) { const at = start + emoji.length; el.setSelectionRange(at, at); } });
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !touch && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
    if (event.key === 'Escape') { if (editing) onCancelEdit(); else if (replyTo) onCancelReply(); else setEmojiOpen(false); }
  };

  const onPaste = (event) => {
    const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (files.length) { event.preventDefault(); onFiles(files); }
  };

  if (blocked) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 bg-[#f1f5fb] px-4 py-3 text-sm font-semibold text-slate-600 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <span>{blocked.byMe ? 'Bloqueaste a esta persona.' : 'No puedes enviar mensajes a esta persona.'}</span>
        {blocked.byMe && <button type="button" onClick={onUnblock} className="h-11 rounded-full bg-[#1e40af] px-5 text-sm font-extrabold text-white transition-[filter,transform] active:scale-[0.97] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">Desbloquear</button>}
      </div>
    );
  }

  const bar = editing || replyTo;
  return (
    <div className="shrink-0 bg-[#e6edfa]">
      {bar && (
        <div className="flex items-center gap-2 px-3 pt-2 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
            <SvgIcon name={editing ? 'edit' : 'reply'} translate="no" aria-hidden="true" className="shrink-0 text-[20px] text-[#1e40af]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-extrabold text-[#1e40af]">{editing ? 'Corregir mensaje' : replyAuthor}</span>
              <span className="block truncate text-[13px] text-slate-600">{editing ? editing.text : replyTo.preview}</span>
            </span>
            <button type="button" onClick={editing ? onCancelEdit : onCancelReply} aria-label="Cancelar" className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
              <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[20px]" />
            </button>
          </div>
        </div>
      )}
      {attachedCard && (
        <div className="flex items-center gap-2 px-3 pt-2 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-2 py-2 shadow-sm ring-1 ring-black/5">
            {attachedCard.imageUrl ? <img src={attachedCard.imageUrl} alt="" className="h-14 w-10 shrink-0 rounded bg-slate-200 object-cover" /> : <span className="h-14 w-10 shrink-0 rounded bg-slate-200" />}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold text-[#1e40af]">{attachedCard.id ? 'Se enviará con esta carta' : 'Se enviará con esta foto'}</span>
              <span className="block truncate text-[14px] font-extrabold text-[#12315f]">{attachedCard.name}</span>
              {attachedCard.id && <span className="block text-[13px] font-bold tabular-nums text-slate-600">{Number(attachedCard.price) > 0 ? `$${Math.round(Number(attachedCard.price)).toLocaleString('es-CL')}` : 'Consultar'}</span>}
            </span>
            <button type="button" onClick={onRemoveCard} aria-label="Quitar la carta" className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
              <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[20px]" />
            </button>
          </div>
        </div>
      )}
      {showQuick && !bar && !hasText && (
        <div className="hide-scrollbar flex gap-2 overflow-x-auto px-3 pt-2 sm:px-5">
          {quickReplies.map((reply) => (
            <button key={reply} type="button" onClick={() => onSend(reply)} className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-[#1e40af] shadow-sm ring-1 ring-black/5 transition-[transform,background-color] duration-150 hover:bg-[#dbeafe] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">{reply}</button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 px-2 pb-2 pt-2 sm:px-5 sm:pb-3 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
        {voice ? <RecordingBar seconds={recorder.seconds} level={recorder.level} locked={voice.mode === 'locked'} slide={voice.slide} onCancel={cancelVoice} /> : <div className="flex min-h-12 min-w-0 flex-1 items-end rounded-[1.65rem] bg-white shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-[#1e40af]/50">
          <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => { setEmojiOpen((open) => { if (!open) field.current?.blur(); else field.current?.focus(); return !open; }); }} aria-label={emojiOpen ? 'Mostrar el teclado' : 'Emojis'} aria-pressed={emojiOpen} className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-[#1e40af] focus:outline-none focus-visible:text-[#1e40af]">
            <SvgIcon name={emojiOpen ? 'keyboard' : 'mood'} translate="no" aria-hidden="true" className="text-[26px]" />
          </button>
          <textarea
            ref={field}
            value={text}
            rows={1}
            onChange={(event) => change(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={() => setEmojiOpen(false)}
            onBlur={() => onTyping?.(false)}
            enterKeyHint={touch ? 'enter' : 'send'}
            aria-label="Escribe un mensaje"
            placeholder="Mensaje"
            maxLength={4000}
            className="max-h-[140px] min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-0 py-3 text-[16px] focus:ring-0 leading-6 text-slate-900 outline-none placeholder:text-slate-500"
          />
          {!editing && (
            <>
              <button type="button" onClick={() => setAttachOpen(true)} aria-label="Adjuntar" className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-[#1e40af] focus:outline-none focus-visible:text-[#1e40af]">
                <SvgIcon name="attach_file" translate="no" aria-hidden="true" className="-rotate-45 text-[26px]" />
              </button>
              {touch && !hasText && (
                <>
                  <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const files = [...(event.target.files || [])]; event.target.value = ''; if (files.length) onFiles(files); }} />
                  <button type="button" onClick={() => camera.current?.click()} aria-label="Cámara" className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 focus:outline-none focus-visible:text-[#1e40af]">
                    <SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="text-[26px]" />
                  </button>
                </>
              )}
            </>
          )}
        </div>}
        {!showSend && canVoice ? (
          <MicButton
            locked={voice?.mode === 'locked'} recording={Boolean(voice)} onStart={startVoice}
            onSlide={(slide) => setVoice((previous) => (previous ? { ...previous, slide } : previous))}
            onLock={() => setVoice((previous) => (previous ? { mode: 'locked', slide: { dx: 0, dy: 0 } } : previous))}
            onRelease={releaseVoice} onCancel={cancelVoice} onSend={() => finishVoice(true)}
          />
        ) : (
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={submit}
          disabled={!hasText}
          aria-label={editing ? 'Guardar corrección' : 'Enviar'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-[0_2px_6px_rgba(8,18,42,0.28)] transition-[transform,filter,opacity] duration-150 hover:brightness-95 active:scale-90 disabled:bg-white disabled:text-slate-400 disabled:shadow-sm disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#e6edfa]"
        >
          <SvgIcon name={editing ? 'check' : 'send'} translate="no" aria-hidden="true" className="text-[24px]" />
        </button>
        )}
      </div>
      {emojiOpen && <EmojiPicker onPick={insertEmoji} className="border-t border-slate-200" height="h-[15.5rem]" />}
      <AttachSheet open={attachOpen} onClose={() => setAttachOpen(false)} onFiles={onFiles} onCard={onOpenCards} quickReplies={quickReplies} onQuick={(reply) => onSend(reply)} />
    </div>
  );
}
