import { memo, useRef } from 'react';
import Avatar from './Avatar';
import Ticks, { messageStatus } from './Ticks';
import LoadingState from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';
import MenuButton from './MenuButton';
import { listTime, personOf, splitMatches, summaryOf } from './messageUtils';

const LONG_PRESS_MS = 420;
const Icon = ({ name, className = '' }) => <span translate="no" aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>;

// Una fila de la lista: avatar, nombre, último mensaje con su estado, hora y no leídos
const ChatRow = memo(function ChatRow({ chat, active, draft, query, onOpen, onActions }) {
  const person = personOf(chat);
  const press = useRef(null);
  const summary = summaryOf(chat.content, null);
  const unread = Number(chat.unreadCount || 0);
  const flagged = unread > 0 || chat.markedUnread;
  const mine = chat.lastFromMe;

  const start = (event) => {
    const { clientX, clientY } = event.touches[0];
    press.current = { x: clientX, y: clientY, timer: window.setTimeout(() => { press.current = { fired: true }; try { navigator.vibrate?.(14); } catch { /* sin vibración */ } onActions(chat); }, LONG_PRESS_MS) };
  };
  const move = (event) => {
    const state = press.current;
    if (!state || state.fired) return;
    if (Math.abs(event.touches[0].clientX - state.x) > 10 || Math.abs(event.touches[0].clientY - state.y) > 10) { window.clearTimeout(state.timer); press.current = null; }
  };
  const end = (event) => {
    const state = press.current;
    if (state?.timer) window.clearTimeout(state.timer);
    if (state?.fired) event.preventDefault(); // el mantener presionado no abre el chat
    press.current = null;
  };

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onOpen(chat)}
        onContextMenu={(event) => { event.preventDefault(); onActions(chat); }}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        onTouchCancel={end}
        aria-current={active ? 'true' : undefined}
        className={`flex min-h-[4.75rem] w-full select-none items-center gap-3 px-4 py-2.5 text-left transition-colors [-webkit-touch-callout:none] focus:outline-none focus-visible:bg-slate-100 active:bg-slate-100 ${active ? 'bg-[#dbeafe]' : 'bg-white hover:bg-slate-50'}`}
      >
        <Avatar name={person.name} src={person.avatar} size={52} />
        <span className="min-w-0 flex-1 border-b border-slate-100 pb-2.5 pt-0.5 group-last:border-b-0">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-[16px] text-slate-900 ${flagged ? 'font-extrabold' : 'font-bold'}`}>{splitMatches(person.name, query).map((piece, index) => (piece.match ? <mark key={index} className="rounded bg-[#facc15] text-[#12315f]">{piece.text}</mark> : <span key={index}>{piece.text}</span>))}</span>
            <span className={`shrink-0 text-xs tabular-nums ${flagged && !chat.muted ? 'font-bold text-[#1e40af]' : 'text-slate-500'}`}>{listTime(chat.createdAt)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {draft
              ? <span className="min-w-0 flex-1 truncate text-[14px] text-slate-500"><span className="font-bold text-red-600">Borrador: </span>{draft}</span>
              : (
                <span className={`flex min-w-0 flex-1 items-center gap-1 text-[14px] ${flagged ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                  {mine && <Ticks status={messageStatus(chat)} className="!text-slate-400 [&>span]:text-slate-400" />}
                  {summary.icon && <Icon name={summary.icon} className="shrink-0 text-[17px]" />}
                  <span className="truncate">{chat.hidden ? 'Mensaje oculto por moderación' : summary.text || (summary.icon ? '' : 'Sin mensajes')}</span>
                </span>
              )}
            {chat.pinned && <Icon name="push_pin" className="shrink-0 -rotate-45 text-[16px] text-slate-400" />}
            {chat.muted && <Icon name="notifications_off" className="shrink-0 text-[16px] text-slate-400" />}
            {unread > 0
              ? <span aria-label={`${unread} mensajes sin leer`} className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-black ${chat.muted ? 'bg-slate-300 text-slate-700' : 'bg-[#facc15] text-[#12315f]'}`}>{unread > 99 ? '99+' : unread}</span>
              : chat.markedUnread ? <span aria-label="Marcada como no leída" className="h-3 w-3 shrink-0 rounded-full bg-[#facc15]" /> : null}
          </span>
        </span>
      </button>
      <button type="button" onClick={() => onActions(chat)} aria-label={`Opciones del chat con ${person.name}`} className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm ring-1 ring-black/5 transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] group-hover:opacity-100 lg:flex">
        <Icon name="keyboard_arrow_down" className="text-[22px]" />
      </button>
    </li>
  );
});

const FILTERS = [['all', 'Todos'], ['unread', 'No leídos'], ['pinned', 'Fijados']];

// Columna izquierda: título, búsqueda, filtros y la lista de conversaciones
export default function ChatList({
  chats, loading, error, counts, activeId, drafts, filter, onFilter, query, onQuery, searchState, onOpen, onActions, onRetry,
  onOpenArchived, onNewChat, menuItems, onOpenResult, title = 'Mensajes', onBack, backMobileOnly = false, archivedView = false
}) {
  const unreadChats = chats.filter((chat) => chat.unreadCount > 0 || chat.markedUnread).length;
  const q = query.trim().toLowerCase();
  const visible = chats.filter((chat) => (filter === 'unread' ? chat.unreadCount > 0 || chat.markedUnread : filter === 'pinned' ? chat.pinned : true))
    .filter((chat) => !q || personOf(chat).name.toLowerCase().includes(q) || personOf(chat).username.toLowerCase().includes(q));
  const searching = q.length >= 2;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 bg-gradient-to-r from-[#0b214a] to-[#1e40af] px-4 pb-3 pt-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {onBack && <button type="button" onClick={onBack} aria-label={archivedView ? 'Volver a los chats' : 'Salir de mensajes'} className={`-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${backMobileOnly ? 'lg:hidden' : ''}`}><Icon name="arrow_back" /></button>}
            <h1 className="truncate text-[1.6rem] font-extrabold leading-tight">{title}</h1>
          </div>
          {menuItems?.length > 0 && <MenuButton items={menuItems} label="Más opciones de mensajes" onDark />}
        </div>
        <label className="mt-2 flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 ring-1 ring-white/15 focus-within:bg-white focus-within:text-slate-900 focus-within:ring-2 focus-within:ring-[#facc15]">
          <Icon name="search" className="text-[22px] opacity-80" />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar un chat o un mensaje" aria-label="Buscar un chat o un mensaje" className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 p-0 text-[16px] outline-none placeholder:text-white/70 focus:placeholder:text-slate-500" />
          {query && <button type="button" onClick={() => onQuery('')} aria-label="Borrar búsqueda" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"><Icon name="close" className="text-[20px]" /></button>}
        </label>
      </header>

      {!searching && (
        <div role="tablist" aria-label="Filtrar chats" className="hide-scrollbar flex shrink-0 gap-2 overflow-x-auto bg-white px-4 py-2.5">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => onFilter(id)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${filter === id ? 'bg-[#dbeafe] text-[#1e40af]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}{id === 'unread' && unreadChats > 0 && <span className="rounded-full bg-[#1e40af] px-1.5 text-[11px] text-white">{unreadChats}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? <LoadingState variant="section" label="Cargando tus chats…" />
          : error ? <EmptyState variant="plain" icon="cloud_off" title="No pudimos cargar tus chats" action={{ label: 'Reintentar', icon: 'refresh', onClick: onRetry }}>Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          : searching ? (
            <div>
              {visible.length > 0 && <><p className="px-4 pb-1 pt-3 text-xs font-extrabold text-slate-500">Chats</p><ul>{visible.map((chat) => <ChatRow key={chat.id} chat={chat} active={activeId === personOf(chat).id} draft="" query={query} onOpen={onOpen} onActions={onActions} />)}</ul></>}
              <p className="px-4 pb-1 pt-3 text-xs font-extrabold text-slate-500">Mensajes</p>
              {searchState.loading ? <LoadingState variant="compact" label="Buscando mensajes…" />
                : searchState.messages.length === 0 ? <p className="px-4 pb-4 text-sm text-slate-500">No hay mensajes con «{query.trim()}».</p>
                : (
                  <ul>
                    {searchState.messages.map((result) => (
                      <li key={result.id}>
                        <button type="button" onClick={() => onOpenResult(result)} className="flex min-h-[4.25rem] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100">
                          <Avatar name={result.partner?.name} src={result.partner?.photoURL} size={44} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2"><span className="truncate text-[15px] font-bold text-slate-900">{result.partner?.name || 'Chat'}</span><span className="shrink-0 text-xs text-slate-500">{listTime(result.createdAt)}</span></span>
                            <span className="mt-0.5 line-clamp-2 break-words text-[13.5px] text-slate-600">{result.fromMe && <span className="font-semibold">Tú: </span>}{splitMatches(result.snippet, query).map((piece, index) => (piece.match ? <mark key={index} className="rounded bg-[#facc15] text-[#12315f]">{piece.text}</mark> : <span key={index}>{piece.text}</span>))}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          ) : (
            <>
              {!archivedView && counts.archivedCount > 0 && filter === 'all' && (
                <button type="button" onClick={onOpenArchived} className="flex min-h-14 w-full items-center gap-4 px-6 text-left text-[15px] font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100">
                  <Icon name="archive" className="text-[22px] text-slate-500" />
                  <span className="flex-1">Archivadas</span>
                  <span className={`text-sm ${counts.archivedUnread ? 'font-extrabold text-[#1e40af]' : 'font-semibold text-slate-400'}`}>{counts.archivedCount}</span>
                </button>
              )}
              {visible.length === 0
                ? (chats.length === 0
                  ? <EmptyState variant="plain" icon="forum" title="Aún no tienes conversaciones" action={{ label: 'Elegir un vendedor', icon: 'edit_square', onClick: onNewChat }} secondary={{ label: 'Ver cartas a la venta', to: '/cartas' }}>Cuando le escribas a un vendedor o alguien te escriba, la conversación aparecerá aquí.</EmptyState>
                  : <EmptyState variant="plain" icon={filter === 'unread' ? 'mark_chat_read' : 'push_pin'} title={filter === 'unread' ? 'No tienes chats sin leer' : 'No hay chats fijados'}>{filter === 'unread' ? 'Estás al día con tus conversaciones.' : 'Mantén presionado un chat y elige «Fijar chat» para tenerlo arriba.'}</EmptyState>)
                : <ul>{visible.map((chat) => <ChatRow key={chat.id} chat={chat} active={activeId === personOf(chat).id} draft={drafts[personOf(chat).id]} query="" onOpen={onOpen} onActions={onActions} />)}</ul>}
            </>
          )}
      </div>

      <button type="button" onClick={onNewChat} aria-label="Nuevo chat" className="absolute bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow-[0_6px_16px_-4px_rgba(8,18,42,0.5)] transition-[transform,filter] duration-150 hover:brightness-95 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 lg:hidden">
        <Icon name="edit_square" className="text-[26px]" />
      </button>
    </div>
  );
}
