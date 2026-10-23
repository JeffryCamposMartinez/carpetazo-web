import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import Avatar from './Avatar';
import Sheet from './Sheet';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';
import { MAX_PINNED, fullStamp, personOf, summaryOf } from './messageUtils';
import SvgIcon from '../ui/SvgIcon';

const ROW = 'flex min-h-14 w-full items-center gap-4 px-5 text-left text-[15px] font-semibold transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100';
const Icon = ({ name, className = '' }) => <SvgIcon name={name} translate="no" aria-hidden="true" className={`text-[22px] ${className}`} />;

// ---------- Reenviar ----------
export function ForwardSheet({ open, onClose, chats, onSend, busy }) {
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('');
  useEffect(() => { if (open) { setSelected([]); setFilter(''); } }, [open]);
  const people = useMemo(() => chats.map(personOf).filter((person) => person.id && person.name.toLowerCase().includes(filter.trim().toLowerCase())), [chats, filter]);
  const toggle = (id) => setSelected((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : previous.length >= 5 ? previous : [...previous, id]));

  return (
    <Sheet open={open} onClose={onClose} title="Reenviar a…" full>
      <div className="shrink-0 px-4 pb-2">
        <label className="flex h-12 items-center gap-2 rounded-full bg-slate-100 px-4 focus-within:ring-2 focus-within:ring-[#1e40af]">
          <Icon name="search" className="text-slate-500" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar un chat" aria-label="Buscar un chat" className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 p-0 text-[16px] outline-none placeholder:text-slate-500" />
        </label>
      </div>
      <ul className="min-h-[12rem] flex-1 overflow-y-auto overscroll-contain pb-2">
        {people.length === 0 && <li><EmptyState variant="plain" icon="forum" title="No hay chats para reenviar">Solo puedes reenviar a personas con las que ya conversas.</EmptyState></li>}
        {people.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => toggle(person.id)} aria-pressed={selected.includes(person.id)} className={`${ROW} gap-3 py-2`}>
              <Avatar name={person.name} src={person.avatar} size={44} />
              <span className="min-w-0 flex-1 truncate text-slate-900">{person.name}</span>
              <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full ring-2 transition-colors ${selected.includes(person.id) ? 'bg-[#1e40af] text-white ring-[#1e40af]' : 'ring-slate-300'}`}>{selected.includes(person.id) && <Icon name="check" className="!text-[16px]" />}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="shrink-0 border-t border-slate-100 p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={!selected.length || busy} onClick={() => onSend(selected)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#facc15] text-[15px] font-extrabold text-[#12315f] shadow-sm transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
          {busy ? <ButtonSpinner tone="dark" /> : <Icon name="send" />}{selected.length ? `Reenviar a ${selected.length} ${selected.length === 1 ? 'chat' : 'chats'}` : 'Elige a quién reenviar'}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Destacados ----------
export function StarredSheet({ open, onClose, partnerId, onOpenMessage }) {
  const [state, setState] = useState({ loading: true, messages: [], failed: false });
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState({ loading: true, messages: [], failed: false });
    api.getStarredMessages(partnerId).then((res) => { if (!cancelled) setState({ loading: false, messages: res.messages || [], failed: false }); }).catch(() => { if (!cancelled) setState({ loading: false, messages: [], failed: true }); });
    return () => { cancelled = true; };
  }, [open, partnerId]);

  return (
    <Sheet open={open} onClose={onClose} title="Mensajes destacados" full>
      <div className="min-h-[14rem] flex-1 overflow-y-auto overscroll-contain pb-4">
        {state.loading ? <LoadingState variant="section" label="Cargando destacados…" />
          : state.failed ? <EmptyState variant="plain" icon="cloud_off" title="No pudimos cargar los destacados">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          : state.messages.length === 0 ? <EmptyState variant="plain" icon="star" title="Aún no destacas mensajes">Mantén presionado un mensaje y elige «Destacar» para guardarlo aquí, por ejemplo una dirección o un precio acordado.</EmptyState>
          : (
            <ul className="divide-y divide-slate-100">
              {state.messages.map((message) => (
                <li key={message.id}>
                  <button type="button" onClick={() => { onClose(); onOpenMessage(message); }} className={`${ROW} items-start gap-3 py-3`}>
                    <Avatar name={message.partner?.name} src={message.partner?.photoURL} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-extrabold text-[#12315f]">{message.partner?.name || 'Chat'}</span><span className="shrink-0 text-xs font-semibold text-slate-400">{fullStamp(message.createdAt)}</span></span>
                      <span className="mt-0.5 line-clamp-2 break-words text-[14px] font-medium text-slate-700">{summaryOf(message.content, message.attachment).text || 'Mensaje'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </Sheet>
  );
}

// ---------- Chat nuevo ----------
export function NewChatSheet({ open, onClose, onPick, myUsername = '' }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, sellers: [], failed: false });
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState((previous) => ({ ...previous, loading: true, failed: false }));
      api.getSellers(new URLSearchParams({ sort: query.trim() ? 'name' : 'visits', ...(query.trim() ? { q: query.trim() } : {}) }).toString())
        .then((res) => { if (!cancelled) setState({ loading: false, sellers: res.sellers || [], failed: false }); })
        .catch(() => { if (!cancelled) setState({ loading: false, sellers: [], failed: true }); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query]);

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo chat" full>
      <div className="shrink-0 px-4 pb-2">
        <label className="flex h-12 items-center gap-2 rounded-full bg-slate-100 px-4 focus-within:ring-2 focus-within:ring-[#1e40af]">
          <Icon name="search" className="text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un vendedor" aria-label="Buscar vendedor" className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 p-0 text-[16px] outline-none placeholder:text-slate-500" />
        </label>
        <p className="px-2 pt-2 text-xs font-bold text-slate-500">{query.trim() ? 'Resultados' : 'Vendedores más visitados'}</p>
      </div>
      <div className="min-h-[14rem] flex-1 overflow-y-auto overscroll-contain pb-4">
        {state.loading && state.sellers.length === 0 ? <LoadingState variant="compact" label="Buscando vendedores…" />
          : state.failed ? <EmptyState variant="plain" icon="cloud_off" title="No pudimos buscar vendedores">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          : state.sellers.length === 0 ? <EmptyState variant="plain" icon="search_off" title="No encontramos vendedores">Prueba con otro nombre o usuario.</EmptyState>
          : (
            <ul>
              {state.sellers.filter((seller) => seller.username && seller.username.toLowerCase() !== myUsername.toLowerCase()).map((seller) => (
                <li key={seller.username}>
                  <button type="button" onClick={() => onPick({ username: seller.username, name: seller.name, photoURL: seller.photoURL })} className={`${ROW} gap-3 py-2`}>
                    <Avatar name={seller.name} src={seller.photoURL} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-900">{seller.name}</span>
                      <span className="block truncate text-xs font-medium text-slate-500">@{seller.username}{seller.publicComuna ? ` · ${seller.publicComuna}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </Sheet>
  );
}

// ---------- Privacidad ----------
function Switch({ checked, onChange, label, hint }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`${ROW} items-start gap-4 py-4`}>
      <span className="min-w-0 flex-1"><span className="block text-slate-900">{label}</span><span className="mt-0.5 block text-[13px] font-medium leading-snug text-slate-500">{hint}</span></span>
      <span aria-hidden="true" className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ${checked ? 'bg-[#1e40af]' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

export function PrivacySheet({ open, onClose, privacy, onChange }) {
  return (
    <Sheet open={open} onClose={onClose} title="Privacidad del chat">
      <div className="pb-4">
        <Switch checked={privacy.showLastSeen} onChange={(value) => onChange({ showLastSeen: value })} label="Mostrar mi última conexión" hint="Si lo apagas, tampoco verás cuándo se conectaron los demás." />
        <Switch checked={privacy.showReadReceipts} onChange={(value) => onChange({ showReadReceipts: value })} label="Confirmaciones de lectura" hint="Si lo apagas, no se ven los ✓✓ amarillos de «leído» entre tú y los demás. El «entregado» siempre se muestra." />
      </div>
    </Sheet>
  );
}

// ---------- Info de un mensaje propio ----------
export function MessageInfoSheet({ message, partnerName, onClose }) {
  if (!message) return null;
  const rows = [
    ['done_all', 'Leído', message.isRead ? fullStamp(message.readAt || message.createdAt) : 'Aún no'],
    ['check', 'Entregado', message.deliveredAt ? fullStamp(message.deliveredAt) : 'Aún no'],
    ['schedule', 'Enviado', fullStamp(message.createdAt)]
  ];
  return (
    <Sheet open onClose={onClose} title="Info del mensaje">
      <ul className="pb-4">
        {rows.map(([icon, label, value]) => (
          <li key={label} className="flex min-h-14 items-center gap-4 px-5">
            <Icon name={icon} className={label === 'Leído' && message.isRead ? 'text-[#eab308]' : 'text-slate-400'} />
            <span className="flex-1 text-[15px] font-semibold text-slate-800">{label}{label === 'Leído' ? ` por ${partnerName}` : ''}</span>
            <span className="text-sm font-medium text-slate-500">{value}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ---------- Opciones de un chat de la lista ----------
export function ChatActionSheet({ chat, pinnedCount, onClose, onSettings }) {
  const [muteMenu, setMuteMenu] = useState(false);
  useEffect(() => { setMuteMenu(false); }, [chat]);
  if (!chat) return null;
  const person = personOf(chat);
  const run = (patch) => { onClose(); onSettings(person.id, patch); };
  const canPin = chat.pinned || pinnedCount < MAX_PINNED;
  const unread = chat.markedUnread || chat.unreadCount > 0;

  return (
    <Sheet open onClose={onClose} title={person.name}>
      <ul className="pb-4">
        {muteMenu ? (
          [['8h', '8 horas'], ['1w', '1 semana'], ['always', 'Siempre']].map(([value, label]) => (
            <li key={value}><button type="button" onClick={() => run({ remote: { muted: value }, local: { muted: true } })} className={ROW}><Icon name="notifications_off" className="text-slate-500" />Silenciar {label}</button></li>
          ))
        ) : (
          <>
            <li><button type="button" disabled={!canPin} onClick={() => run({ remote: { pinned: !chat.pinned }, local: { pinned: !chat.pinned } })} className={`${ROW} disabled:opacity-50`}><Icon name="push_pin" className="text-slate-500" />{chat.pinned ? 'Desfijar chat' : canPin ? 'Fijar chat' : `Ya fijaste ${MAX_PINNED} chats`}</button></li>
            <li><button type="button" onClick={() => (chat.muted ? run({ remote: { muted: null }, local: { muted: false } }) : setMuteMenu(true))} className={ROW}><Icon name={chat.muted ? 'notifications_active' : 'notifications_off'} className="text-slate-500" />{chat.muted ? 'Activar sonido' : 'Silenciar'}</button></li>
            {chat.archived && <li><button type="button" onClick={() => run({ remote: { archived: false }, local: { archived: false } })} className={ROW}><Icon name="unarchive" className="text-slate-500" />Sacar de archivadas</button></li>}
            <li><button type="button" onClick={() => run({ remote: { markedUnread: !unread }, local: { markedUnread: !unread } })} className={ROW}><Icon name={unread ? 'drafts' : 'mark_chat_unread'} className="text-slate-500" />{unread ? 'Marcar como leído' : 'Marcar como no leído'}</button></li>
            {person.username && <li><Link to={`/${person.username}`} onClick={onClose} className={ROW}><Icon name="person" className="text-slate-500" />Ver perfil</Link></li>}
          </>
        )}
      </ul>
    </Sheet>
  );
}


// ---------- Confirmar una acción (bloquear, etc.) ----------
export function ConfirmSheet({ open, title, text, confirmLabel, danger = false, onConfirm, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-5 pb-5">
        <p className="text-[15px] leading-relaxed text-slate-600">{text}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-12 rounded-full px-6 text-[15px] font-bold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Cancelar</button>
          <button type="button" onClick={() => { onClose(); onConfirm(); }} className={`h-12 rounded-full px-6 text-[15px] font-extrabold text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${danger ? 'bg-red-600 focus-visible:ring-red-500' : 'bg-[#1e40af] focus-visible:ring-[#1e40af]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </Sheet>
  );
}
