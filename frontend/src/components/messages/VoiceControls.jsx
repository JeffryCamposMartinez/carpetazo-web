import { useEffect, useRef, useState } from 'react';
import { formatDuration } from './messageUtils';

const CANCEL_DX = 110;
const LOCK_DY = 80;
const Icon = ({ name, className = '', fill = false }) => <span translate="no" aria-hidden="true" className={`material-symbols-outlined ${className}`} style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>;

// Botón del micrófono, como en WhatsApp: en el celular se mantiene presionado para grabar, se desliza a la izquierda para cancelar y hacia arriba para
// dejar la grabación fija. Con el mouse un clic empieza a grabar (queda fija). Cuando la grabación está fija el botón pasa a ser «Enviar».
export function MicButton({ locked, recording, onStart, onSlide, onLock, onRelease, onCancel, onSend }) {
  const gesture = useRef(null);
  const touched = useRef(false); // el toque ya lo atendió el gesto de mantener presionado: el clic que lo sigue no cuenta

  if (locked) {
    return (
      <button type="button" onClick={onSend} aria-label="Enviar nota de voz" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-[0_2px_6px_rgba(8,18,42,0.28)] transition-[transform,filter] duration-150 hover:brightness-95 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#e6edfa]">
        <Icon name="send" className="text-[24px]" />
      </button>
    );
  }

  const down = (event) => {
    if (event.pointerType === 'mouse') return; // con el mouse se usa el clic
    event.preventDefault();
    touched.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, done: false };
    try { navigator.vibrate?.(10); } catch { /* sin vibración */ }
    onStart('hold');
  };
  const move = (event) => {
    const state = gesture.current;
    if (!state || state.done) return;
    const dx = event.clientX - state.x;
    const dy = state.y - event.clientY;
    onSlide({ dx: Math.min(0, dx), dy: Math.max(0, dy) });
    if (dx < -CANCEL_DX) { state.done = true; onCancel(); }
    else if (dy > LOCK_DY) { state.done = true; onLock(); }
  };
  const up = () => {
    const state = gesture.current;
    gesture.current = null;
    if (state && !state.done) onRelease();
  };

  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={() => { if (touched.current) { touched.current = false; return; } if (!recording) onStart('locked'); }}
      onContextMenu={(event) => event.preventDefault()}
      aria-label="Grabar nota de voz"
      className={`flex shrink-0 touch-none select-none items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-[0_2px_6px_rgba(8,18,42,0.28)] transition-[transform,filter,width,height] duration-150 hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#e6edfa] ${recording ? 'h-[4.25rem] w-[4.25rem] -translate-y-2' : 'h-12 w-12 active:scale-90'}`}
    >
      <Icon name="mic" className={recording ? 'text-[34px]' : 'text-[24px]'} fill />
    </button>
  );
}

// Barra que reemplaza al campo de texto mientras se graba: tiempo, volumen en vivo y, según el modo, «desliza para cancelar» o el basurero
export function RecordingBar({ seconds, level, locked, slide, onCancel }) {
  const [history, setHistory] = useState(() => Array(30).fill(0.08));
  const latest = useRef(level);
  latest.current = level;
  useEffect(() => {
    const timer = window.setInterval(() => setHistory((previous) => [...previous.slice(1), Math.max(0.08, latest.current)]), 110);
    return () => window.clearInterval(timer);
  }, []);
  const fade = Math.max(0.25, 1 - Math.abs(slide.dx) / CANCEL_DX);

  return (
    <div role="status" aria-label={`Grabando nota de voz, ${formatDuration(seconds)}`} className="relative flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[1.65rem] bg-white px-2 shadow-sm ring-1 ring-black/5">
      {locked
        ? <button type="button" onClick={onCancel} aria-label="Descartar grabación" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><Icon name="delete" className="text-[24px]" /></button>
        : <span aria-hidden="true" className="ml-3 h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />}
      <span className="w-11 shrink-0 text-[15px] font-bold tabular-nums text-slate-800">{formatDuration(seconds)}</span>
      {locked
        ? <div aria-hidden="true" className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden pr-1">{history.map((value, index) => <span key={index} className="w-[3px] shrink-0 rounded-full bg-[#1e40af]" style={{ height: `${Math.round(18 + value * 82)}%` }} />)}</div>
        : <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[14px] font-semibold text-slate-500" style={{ transform: `translateX(${slide.dx * 0.5}px)`, opacity: fade }}><Icon name="chevron_left" className="text-[20px]" />Desliza para cancelar</span>}
      {!locked && (
        <span aria-hidden="true" className="absolute -top-[4.5rem] right-[0.35rem] flex w-12 flex-col items-center gap-1 rounded-full bg-white py-3 shadow-[0_4px_14px_rgba(8,18,42,0.25)] ring-1 ring-black/5 transition-transform" style={{ transform: `translateY(${-Math.min(slide.dy, 56) * 0.4}px)` }}>
          <Icon name="lock" className="text-[20px] text-slate-600" />
          <Icon name="keyboard_arrow_up" className="-mt-1 text-[20px] text-slate-400" />
        </span>
      )}
    </div>
  );
}
