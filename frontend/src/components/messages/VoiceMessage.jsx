import { useEffect, useRef, useState } from 'react';
import { formatDuration } from './messageUtils';
import SvgIcon from '../ui/SvgIcon';

const RATES = [1, 1.5, 2];
let active = null; // solo suena una nota de voz a la vez: al reproducir otra, la anterior se detiene

// Reproductor de una nota de voz dentro de la burbuja: reproducir/pausar, curva de volumen que avanza, tocar para adelantar y velocidad 1×, 1,5×, 2×
export default function VoiceMessage({ audio, own }) {
  const media = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const total = Number(audio.seconds) || 1;
  const bars = Array.isArray(audio.wave) && audio.wave.length ? audio.wave : Array.from({ length: 36 }, (_, index) => 28 + ((index * 37) % 55));

  const stopSelf = () => { media.current?.pause(); setPlaying(false); };
  useEffect(() => () => { media.current?.pause(); if (active === stopSelf) active = null; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ensure = () => {
    if (media.current) return media.current;
    const element = new Audio(audio.url);
    element.preload = 'none';
    element.addEventListener('timeupdate', () => setProgress(Math.min(1, element.currentTime / (Number.isFinite(element.duration) && element.duration > 0 ? element.duration : total))));
    element.addEventListener('ended', () => { setPlaying(false); setProgress(0); element.currentTime = 0; });
    element.addEventListener('pause', () => setPlaying(false));
    element.addEventListener('play', () => setPlaying(true));
    element.addEventListener('error', () => { setFailed(true); setPlaying(false); });
    media.current = element;
    return element;
  };

  const toggle = async () => {
    const element = ensure();
    if (playing) { element.pause(); return; }
    if (active && active !== stopSelf) active();
    active = stopSelf;
    element.playbackRate = rate;
    setFailed(false);
    try { await element.play(); } catch { setFailed(true); }
  };
  const seek = (ratio) => { const element = ensure(); const length = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : total; element.currentTime = Math.max(0, Math.min(1, ratio)) * length; setProgress(ratio); };
  const cycleRate = () => { const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; setRate(next); if (media.current) media.current.playbackRate = next; };

  const played = own ? 'bg-[#facc15]' : 'bg-[#1e40af]';
  const idle = own ? 'bg-white/40' : 'bg-slate-300';
  const shown = playing || progress > 0 ? Math.max(0, total - progress * total) : total;

  return (
    <div className="flex w-[15.5rem] max-w-full items-center gap-2.5 py-1 sm:w-[17rem]">
      <button type="button" onClick={toggle} aria-label={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,filter] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${own ? 'bg-white text-[#1e40af]' : 'bg-[#1e40af] text-white'}`}>
        <SvgIcon name={playing ? 'pause' : 'play_arrow'} translate="no" aria-hidden="true" className="text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }} />
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider" tabIndex={0} aria-label="Avance de la nota de voz" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(progress * total)}
          onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); seek((event.clientX - rect.left) / rect.width); }}
          onKeyDown={(event) => { if (event.key === 'ArrowRight') seek(progress + 0.1); if (event.key === 'ArrowLeft') seek(progress - 0.1); }}
          className="flex h-8 cursor-pointer items-center gap-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
        >
          {bars.map((value, index) => <span key={index} className={`w-[3px] shrink-0 rounded-full ${index / bars.length < progress ? played : idle}`} style={{ height: `${Math.max(14, value)}%` }} />)}
        </div>
        <div className={`flex items-center justify-between text-[11px] tabular-nums ${own ? 'text-white/75' : 'text-slate-500'}`}>
          <span>{failed ? 'No se pudo reproducir' : formatDuration(shown)}</span>
          {(playing || rate !== 1) && <button type="button" onClick={cycleRate} aria-label={`Velocidad ${rate}×`} className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${own ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>{String(rate).replace('.', ',')}×</button>}
        </div>
      </div>
    </div>
  );
}
