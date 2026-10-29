import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useImageSearch from '../../hooks/useImageSearch';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { guideRect, isAligned } from '../../utils/cardGuide';
import SvgIcon from '../ui/SvgIcon';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';

const BTN_MAIN = 'inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#facc15] px-6 text-base font-extrabold text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1d3a] disabled:opacity-40 disabled:pointer-events-none';
const CORNERS = ['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'];

// Nombre de la carta sin número ni variante: "Crispin - 133/142 (Cosmos Holo)" → "Crispin"
const cleanName = (name) => String(name || '').split(' - ')[0].replace(/\s*[([][^)\]]*[)\]]/g, '').trim();

// Buscar una carta con la cámara, en una hoja que cubre toda la pantalla en el celular y en un cuadro centrado en el computador.
// Se reconoce en el propio dispositivo; con la carta reconocida se cierra y los resultados se muestran en Cartas.
export default function ScanModal({ onClose }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const closeRef = useRef(null);
  const { phase, corners, result, progress, error, startCamera, capture, retry } = useImageSearch(videoRef);
  const [shown, setShown] = useState(false); // entrada suave
  const [ar, setAr] = useState(0.75); // proporción real del vídeo: el marco y la imagen coinciden
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [slow, setSlow] = useState(false);
  useBodyScrollLock(true);

  // Con el temporizador, el doble montaje del modo desarrollo no abre la cámara dos veces
  useEffect(() => { const timer = setTimeout(startCamera, 0); return () => clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const frame = requestAnimationFrame(() => setShown(true)); closeRef.current?.focus({ preventScroll: true }); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    const video = videoRef.current;
    const stage = stageRef.current;
    const sync = () => video.videoWidth && video.videoHeight && setAr(video.videoWidth / video.videoHeight);
    video.addEventListener('loadedmetadata', sync);
    video.addEventListener('resize', sync);
    const observer = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(stage);
    return () => { video.removeEventListener('loadedmetadata', sync); video.removeEventListener('resize', sync); observer.disconnect(); };
  }, []);

  const busy = phase === 'loading' || phase === 'recognizing';
  // Si buscar demora más de 2 segundos se ofrece reintentar (por si quedó colgado)
  useEffect(() => {
    setSlow(false);
    if (!busy) return undefined;
    const timer = setTimeout(() => setSlow(true), 2000);
    return () => clearTimeout(timer);
  }, [busy, phase]);
  const best = result?.status === 'sin_coincidencias' ? null : (result?.best || result?.alternatives?.[0])?.meta;
  useEffect(() => {
    if (phase !== 'done' || !best) return;
    onClose();
    navigate(`/cartas?q=${encodeURIComponent(cleanName(best.name))}&tcg=${encodeURIComponent('Pokémon')}`);
  }, [phase, best, navigate, onClose]);

  const camera = phase === 'camera';
  const guide = guideRect(ar);
  const aligned = camera && isAligned(corners, guide);
  // La imagen ocupa todo el espacio libre sin deformarse (la caja tiene siempre la proporción del vídeo)
  const fit = box.h && box.w / box.h > ar ? { height: box.h, width: box.h * ar } : { width: box.w, height: box.w / ar };
  const busyLabel = phase === 'loading' ? 'Preparando el buscador…' : 'Reconociendo la carta…';

  return (
    <div role="dialog" aria-modal="true" aria-label="Buscar carta con la cámara" className={`fixed inset-0 z-[300] flex items-stretch justify-center bg-[#0b1d3a] transition-[opacity,background-color] duration-200 ease-out sm:items-center sm:p-6 ${shown ? 'opacity-100 sm:bg-black/65' : 'opacity-0'}`} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`flex h-[100dvh] w-full flex-col bg-[#0b1d3a] pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] sm:h-[min(46rem,92dvh)] sm:max-w-md sm:overflow-hidden sm:rounded-3xl sm:pb-4 sm:pt-0 sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:ring-1 sm:ring-white/10 ${shown ? 'translate-y-0' : 'translate-y-10'}`}>
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
            <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[24px]" />
          </button>
          <h2 className="min-w-0 flex-1 text-base font-extrabold leading-tight text-white">Buscar con la cámara</h2>
          <span className="rounded-full bg-[#facc15] px-3 py-1 text-xs font-extrabold text-[#12315f]">Pokémon</span>
        </div>

        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className={camera ? 'relative overflow-hidden bg-black' : 'hidden'} style={fit}>
            <video ref={videoRef} playsInline muted autoPlay aria-label="Vista de la cámara" className="h-full w-full object-contain" />
            {/* Marco guía con la proporción de una carta: se pone verde cuando la carta calza y solo entonces se reconoce */}
            <div aria-hidden="true" className="pointer-events-none absolute rounded-2xl shadow-[0_0_0_9999px_rgba(11,29,58,0.55)]" style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%` }}>
              {CORNERS.map((corner) => <span key={corner} className={`absolute h-10 w-10 transition-colors duration-150 ${aligned ? 'border-green-400' : 'border-[#facc15]'} ${corner}`} />)}
              {aligned && <span className="absolute inset-0 rounded-2xl bg-green-400/15 ring-2 ring-green-400" />}
            </div>
            <p className="absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[92%] rounded-full bg-[#0b1d3a]/85 px-4 py-1.5 text-center text-sm font-bold text-white" role="status">{aligned ? 'Perfecto, no te muevas…' : 'Encaja la carta en el marco, entera y quieta'}</p>
          </div>

          {busy && (
            <div className="flex flex-col items-center px-6">
              <LoadingState variant="section" tone="dark" label={busyLabel} hint={progress ? `Descargando el modelo: ${progress}% (solo la primera vez)` : undefined} />
              {slow && <button type="button" onClick={retry} className="inline-flex h-12 items-center justify-center rounded-full border-2 border-white/70 px-8 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Reintentar</button>}
            </div>
          )}

          {phase === 'error' && <div className="w-full px-4"><EmptyState variant="plain" tone="dark" icon="error" title="No pudimos usar la cámara" action={{ label: 'Intentar de nuevo', onClick: startCamera }} secondary={{ label: 'Cerrar', onClick: onClose }}>{error}</EmptyState></div>}

          {phase === 'done' && !best && <div className="w-full px-4"><EmptyState variant="plain" tone="dark" icon="image_search" title="No encontramos esa carta" action={{ label: 'Probar de nuevo', onClick: startCamera }} secondary={{ label: 'Cerrar', onClick: onClose }}>Puede que no esté en el catálogo de Pokémon. Acércate, con buena luz y sin reflejos.</EmptyState></div>}
        </div>

        <div className="px-4 pt-3 sm:px-6">
          <button type="button" className={BTN_MAIN} disabled={!camera} onClick={capture}>
            <SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="text-[26px]" />Capturar
          </button>
        </div>
      </div>
    </div>
  );
}
