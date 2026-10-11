import { avatarColor, initialOf } from './messageUtils';

// Foto de perfil redonda; sin foto, la inicial sobre un color propio de cada persona. `online` agrega el punto verde de "en línea".
export default function Avatar({ name = '', src = null, size = 48, online = false, className = '' }) {
  const style = { width: size, height: size };
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={style}>
      {src
        ? <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" draggable="false" className="h-full w-full rounded-full bg-slate-200 object-cover" />
        : <span aria-hidden="true" className="flex h-full w-full items-center justify-center rounded-full font-extrabold text-white" style={{ backgroundColor: avatarColor(name), fontSize: Math.round(size * 0.42) }}>{initialOf(name)}</span>}
      {online && <span aria-hidden="true" className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
    </span>
  );
}
