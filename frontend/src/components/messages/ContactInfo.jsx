import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import Avatar from './Avatar';
import Sheet from './Sheet';
import VerifiedBadge from '../ui/VerifiedBadge';
import { lastSeenLabel } from './messageUtils';
import SvgIcon from '../ui/SvgIcon';

const MUTE_OPTIONS = [['8h', '8 horas'], ['1w', '1 semana'], ['always', 'Siempre']];

// Información de la persona del chat: perfil, fotos compartidas, silenciar, archivar, bloquear y reportar
export default function ContactInfo({ open, onClose, partner, settings, blockedByMe, muted, onSettings, onToggleBlock, onViewImage, onStarred, onSearch, onReport }) {
  const [media, setMedia] = useState(null);

  useEffect(() => {
    if (!open || !partner?.id) return undefined;
    let cancelled = false;
    setMedia(null);
    api.getChatMedia(partner.id).then((res) => { if (!cancelled) setMedia(res.media || []); }).catch(() => { if (!cancelled) setMedia([]); });
    return () => { cancelled = true; };
  }, [open, partner?.id]);

  if (!partner) return null;
  const presence = partner.presence;
  const status = presence ? (presence.online ? 'En línea' : lastSeenLabel(presence.lastSeenAt)) : '';
  const row = 'flex min-h-14 w-full items-center gap-4 px-5 text-left text-[15px] font-semibold transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100';

  return (
    <Sheet open={open} onClose={onClose} title="Datos del contacto" full>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
        <div className="flex flex-col items-center px-5 pb-4 pt-2 text-center">
          <Avatar name={partner.name} src={partner.photoURL} size={96} online={Boolean(presence?.online)} />
          <h3 className="mt-3 flex items-center gap-1.5 text-xl font-extrabold text-[#12315f]">{partner.name}{partner.verified && <VerifiedBadge size={20} />}</h3>
          {partner.username && <p className="text-sm font-semibold text-slate-500">@{partner.username}</p>}
          {partner.publicComuna && <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><SvgIcon name="location_on" translate="no" aria-hidden="true" className="text-[16px]" />{partner.publicComuna}</p>}
          {status && <p className={`mt-1 text-sm font-semibold ${presence?.online ? 'text-emerald-600' : 'text-slate-500'}`}>{status}</p>}
          <div className="mt-4 grid w-full grid-cols-3 gap-2">
            {[
              partner.username ? { id: 'profile', icon: 'person', label: 'Perfil', to: `/${partner.username}` } : null,
              { id: 'search', icon: 'search', label: 'Buscar', onClick: () => { onClose(); onSearch(); } },
              { id: 'starred', icon: 'star', label: 'Destacados', onClick: () => { onClose(); onStarred(); } }
            ].filter(Boolean).map((action) => {
              const content = (<><SvgIcon name={action.icon} translate="no" aria-hidden="true" className="text-[24px] text-[#1e40af]" /><span className="text-xs font-bold text-[#12315f]">{action.label}</span></>);
              const cls = 'flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl bg-[#eff6ff] transition-colors hover:bg-[#dbeafe] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';
              return action.to ? <Link key={action.id} to={action.to} className={cls}>{content}</Link> : <button key={action.id} type="button" onClick={action.onClick} className={cls}>{content}</button>;
            })}
          </div>
        </div>

        <section aria-label="Fotos compartidas" className="border-t border-slate-100 px-5 py-4">
          <h4 className="text-sm font-extrabold text-[#12315f]">Fotos compartidas</h4>
          {media === null ? <p className="mt-2 text-sm text-slate-500">Cargando…</p>
            : media.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aún no se comparten fotos en esta conversación.</p>
            : (
              <ul className="mt-2 grid grid-cols-4 gap-1.5">
                {media.slice(0, 12).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => onViewImage(item.imageUrl)} aria-label="Ver foto" className="block aspect-square w-full overflow-hidden rounded-lg bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                      <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section aria-label="Notificaciones" className="border-t border-slate-100 py-2">
          <p className="px-5 pb-1 pt-2 text-sm font-extrabold text-[#12315f]">{muted ? 'Silenciada' : 'Silenciar notificaciones'}</p>
          <div className="flex flex-wrap gap-2 px-5 pb-2">
            {muted
              ? <button type="button" onClick={() => onSettings({ muted: null })} className="h-10 rounded-full bg-[#1e40af] px-5 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">Activar sonido</button>
              : MUTE_OPTIONS.map(([value, label]) => <button key={value} type="button" onClick={() => onSettings({ muted: value })} className="h-10 rounded-full bg-slate-100 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">{label}</button>)}
          </div>
        </section>

        <section className="border-t border-slate-100 py-1">
          {/* Ya no se puede archivar ni bloquear; solo se deja salir de esos estados a quien ya los tenía */}
          {settings.archived && (
            <button type="button" onClick={() => onSettings({ archived: false })} className={row}>
              <SvgIcon name="unarchive" translate="no" aria-hidden="true" className="text-[22px] text-slate-500" />Sacar de archivadas
            </button>
          )}
          {blockedByMe && (
            <button type="button" onClick={onToggleBlock} className={`${row} text-red-600`}>
              <SvgIcon name="block" translate="no" aria-hidden="true" className="text-[22px] text-red-500" />Desbloquear a {partner.name}
            </button>
          )}
          <button type="button" onClick={onReport} className={`${row} text-red-600`}>
            <SvgIcon name="flag" translate="no" aria-hidden="true" className="text-[22px] text-red-500" />Reportar a {partner.name}
          </button>
        </section>
      </div>
    </Sheet>
  );
}
