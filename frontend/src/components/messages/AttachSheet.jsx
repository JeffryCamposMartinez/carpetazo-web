import { useRef, useState } from 'react';
import Sheet from './Sheet';
import SvgIcon from '../ui/SvgIcon';

const CIRCLE = 'flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-[transform,filter] duration-150 group-active:scale-90 [@media(hover:hover)]:group-hover:brightness-110';

// Hoja del clip: galería, cámara, carta de Carpetazo y respuestas rápidas
export default function AttachSheet({ open, onClose, onFiles, onCard, quickReplies, onQuick }) {
  const gallery = useRef(null);
  const camera = useRef(null);
  const [view, setView] = useState('menu');
  const close = () => { setView('menu'); onClose(); };
  const picked = (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length) { close(); onFiles(files); }
  };

  return (
    <Sheet open={open} onClose={close} title={view === 'quick' ? 'Respuestas rápidas' : 'Adjuntar'}>
      <input ref={gallery} type="file" accept="image/*" multiple onChange={picked} className="hidden" />
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={picked} className="hidden" />
      {view === 'menu' ? (
        <div className="grid grid-cols-4 gap-y-5 px-4 pb-6 pt-3">
          {[
            ['Galería', 'photo_library', 'bg-[#1e40af]', () => gallery.current?.click()],
            ['Cámara', 'photo_camera', 'bg-[#0284c7]', () => camera.current?.click()],
            ['Carta', 'style', 'bg-[#12315f]', () => { close(); onCard(); }],
            ['Respuestas', 'bolt', 'bg-[#eab308] !text-[#12315f]', () => setView('quick')]
          ].map(([label, icon, color, run]) => (
            <button key={label} type="button" onClick={run} className="group flex flex-col items-center gap-2 rounded-xl py-1 text-xs font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
              <span className={`${CIRCLE} ${color}`}><SvgIcon name={icon} translate="no" aria-hidden="true" className="text-[28px]" /></span>
              {label}
            </button>
          ))}
        </div>
      ) : (
        <ul className="overflow-y-auto px-2 pb-4">
          {quickReplies.map((reply) => (
            <li key={reply}>
              <button type="button" onClick={() => { close(); onQuick(reply); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100">
                <SvgIcon name="bolt" translate="no" aria-hidden="true" className="text-[20px] text-[#1e40af]" />{reply}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
