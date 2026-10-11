import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';

// Foto a pantalla completa: se acerca con un toque, se descarga y se cierra con Esc o tocando fuera
export default function ImageViewer({ src, onClose }) {
  const [zoom, setZoom] = useState(false);
  useBodyScrollLock(Boolean(src));
  useEffect(() => { setZoom(false); }, [src]);
  useEscape(Boolean(src), onClose);
  if (!src) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Foto" className="chat-fade fixed inset-0 z-[95] flex flex-col bg-black/95 text-white">
      <div className="flex shrink-0 items-center justify-between px-2 py-2">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
        </button>
        <a href={src} download target="_blank" rel="noopener noreferrer" aria-label="Descargar foto" className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined">download</span>
        </a>
      </div>
      <div onClick={onClose} className={`flex min-h-0 flex-1 items-center justify-center p-2 ${zoom ? 'overflow-auto' : ''}`}>
        <img src={src} alt="Foto" onClick={(event) => { event.stopPropagation(); setZoom((value) => !value); }} className={`${zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'} select-none rounded-md`} style={zoom ? { width: '180%' } : undefined} draggable="false" />
      </div>
    </div>,
    document.body
  );
}
