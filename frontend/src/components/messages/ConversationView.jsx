import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import useConversation from '../../hooks/useConversation';
import { useToast } from '../ui/ToastProvider';
import { ReportSheet } from '../moderation/ReportButton';
import VerifiedBadge from '../ui/VerifiedBadge';
import EmptyState from '../ui/EmptyState';
import Avatar from './Avatar';
import Composer from './Composer';
import ContactInfo from './ContactInfo';
import { ForwardSheet, MessageInfoSheet, StarredSheet } from './ChatSheets';
import CardPicker from './CardPicker';
import ImagePreview, { pickPhotos } from './ImagePreview';
import ImageViewer from './ImageViewer';
import MenuButton from './MenuButton';
import MessageActionMenu from './MessageActionMenu';
import MessageList from './MessageList';
import { EDIT_WINDOW_MS, QUICK_REPLIES_BUYER, QUICK_REPLIES_SELLER, decodeMessage, lastSeenLabel, summaryOf } from './messageUtils';

const TYPING_IDLE_MS = 2200;
const REMOTE_TYPING_MS = 5000;
const SEARCH_LOAD_CAP = 1500;

// Una conversación completa: encabezado, mensajes, barra para escribir y todas las hojas (info, reenviar, fotos, cartas…)
export default function ConversationView({
  partnerKey, hint, bus, initialDraft, onDraft, onBack, showBack, chats, myUsername, onListChanged, onSettings, jumpId, onJumped, onOpenStarredMessage
}) {
  const { showToast } = useToast();
  const conv = useConversation(partnerKey, { onChanged: onListChanged });
  const { messages, partner, settings, blockedByMe, hasMore, loadingOlder } = conv;
  const list = useRef(null);
  const typingTimer = useRef(null);
  const remoteTimer = useRef(null);
  const sentTyping = useRef(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [info, setInfo] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);
  const [forwarding, setForwarding] = useState(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [messageInfo, setMessageInfo] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [files, setFiles] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [search, setSearch] = useState({ open: false, query: '', at: 0 });
  const [flashId, setFlashId] = useState(null);

  const partnerId = partner?.id || hint?.id || '';
  const name = partner?.name || hint?.name || 'Chat';
  const avatar = partner?.photoURL ?? hint?.avatar ?? null;
  const username = partner?.username || hint?.username || '';
  const muted = Boolean(settings.mutedUntil && new Date(settings.mutedUntil) > new Date());
  const presence = partner?.presence;
  const quickReplies = myUsername && messages.some((message) => message.senderId === partnerId) ? QUICK_REPLIES_SELLER : QUICK_REPLIES_BUYER;

  // ---- Eventos en vivo (mensajes, lecturas, escribiendo…)
  useEffect(() => {
    if (!bus) return undefined;
    const handle = (event) => {
      const { type, payload } = event.detail;
      if (payload?.partnerId && partnerId && payload.partnerId !== partnerId) return;
      if (type === 'typing') {
        window.clearTimeout(remoteTimer.current);
        setRemoteTyping(Boolean(payload.isTyping));
        if (payload.isTyping) remoteTimer.current = window.setTimeout(() => setRemoteTyping(false), REMOTE_TYPING_MS);
      } else if (['message', 'read', 'delivered', 'settings', 'poll'].includes(type)) {
        if (type === 'message') { window.clearTimeout(remoteTimer.current); setRemoteTyping(false); }
        conv.load({ silent: true });
      }
    };
    bus.addEventListener('chat', handle);
    return () => bus.removeEventListener('chat', handle);
  }, [bus, partnerId, conv.load]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Leído: al ver la conversación, lo que llegó queda como leído
  const markVisible = useCallback(() => { if (document.visibilityState === 'visible' && document.hasFocus()) conv.markRead(); }, [conv.markRead]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setTimeout(markVisible, 350);
    window.addEventListener('focus', markVisible);
    document.addEventListener('visibilitychange', markVisible);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', markVisible); document.removeEventListener('visibilitychange', markVisible); };
  }, [markVisible, messages.length]);

  // ---- "Escribiendo…" hacia la otra persona
  const sendTyping = useCallback((value) => { if (partnerId) api.setTyping(partnerId, value).catch(() => null); }, [partnerId]);
  const onTyping = useCallback((value) => {
    window.clearTimeout(typingTimer.current);
    if (value) {
      if (!sentTyping.current) { sentTyping.current = true; sendTyping(true); }
      typingTimer.current = window.setTimeout(() => { sentTyping.current = false; sendTyping(false); }, TYPING_IDLE_MS);
    } else if (sentTyping.current) { sentTyping.current = false; sendTyping(false); }
  }, [sendTyping]);
  useEffect(() => () => { window.clearTimeout(typingTimer.current); window.clearTimeout(remoteTimer.current); if (sentTyping.current && partnerId) api.setTyping(partnerId, false).catch(() => null); }, [partnerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada conversación empieza sin respuesta, corrección ni búsqueda pendientes
  useEffect(() => { setReplyTo(null); setEditing(null); setMenu(null); setSearch({ open: false, query: '', at: 0 }); setRemoteTyping(false); }, [partnerKey]);

  // ---- Ir a un mensaje (cita, destacado o resultado de búsqueda)
  const jump = useCallback(async (id) => {
    for (let tries = 0; tries < 8 && !list.current?.has(id); tries += 1) { if (!(await conv.loadOlder())) break; await new Promise((resolve) => window.setTimeout(resolve, 60)); }
    if (list.current?.toMessage(id)) { setFlashId(id); window.setTimeout(() => setFlashId(null), 1400); }
  }, [conv.loadOlder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (jumpId && !conv.loading && messages.length) { jump(jumpId); onJumped?.(); } }, [jumpId, conv.loading, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Buscar dentro del chat (carga los mensajes anteriores para buscar en todo el historial)
  useEffect(() => { if (search.open && hasMore && !loadingOlder && messages.length < SEARCH_LOAD_CAP) conv.loadOlder(); }, [search.open, hasMore, loadingOlder, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => {
    const needle = search.query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return messages.filter((message) => !message.hidden && decodeMessage(message.content).text.toLowerCase().includes(needle)).map((message) => message.id);
  }, [messages, search.query]);
  const matchAt = matches.length ? ((search.at % matches.length) + matches.length) % matches.length : 0;
  const currentMatch = matches[matches.length - 1 - matchAt] || null; // 1.º = el más reciente
  useEffect(() => { if (currentMatch) list.current?.toMessage(currentMatch); }, [currentMatch]);

  // ---- Acciones sobre un mensaje
  const authorOf = (message) => (message.senderId === partnerId ? name : 'Tú');
  const startReply = (message) => { const s = summaryOf(message.content, message.attachment); setEditing(null); setReplyTo({ id: message.id, senderId: message.senderId === partnerId ? partnerId : 'me', text: decodeMessage(message.content).text, kind: s.icon === 'photo_camera' ? 'image' : s.icon === 'style' ? 'card' : 'text', preview: s.text || 'Mensaje', author: authorOf(message) }); };
  const actions = {
    react: (message, emoji) => conv.react(message.id, emoji).catch((error) => showToast(error.message || 'No se pudo reaccionar.', 'error')),
    reply: startReply,
    copy: (message) => navigator.clipboard?.writeText(decodeMessage(message.content).text).then(() => showToast('Mensaje copiado', 'success')).catch(() => showToast('No se pudo copiar.', 'error')),
    forward: (message) => setForwarding(message),
    star: (message) => conv.star(message.id, !message.starred).then(() => showToast(message.starred ? 'Quitado de destacados' : 'Mensaje destacado', 'success')).catch(() => showToast('No se pudo cambiar el destacado.', 'error')),
    edit: (message) => { setReplyTo(null); setEditing({ id: message.id, text: decodeMessage(message.content).text }); },
    info: (message) => setMessageInfo(message),
    report: (message) => setReporting({ targetType: 'message', targetId: message.id })
  };
  const openMenu = useCallback((message, point) => {
    const own = message.senderId !== partnerId;
    setMenu({ message, point, own, hasText: Boolean(decodeMessage(message.content).text), canEdit: own && message.senderId !== 'me' && !decodeMessage(message.content).audio && !message.attachment?.unavailable && Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS });
  }, [partnerId]);

  const saveEdit = async (id, text) => {
    try { await conv.edit(id, text); setEditing(null); onListChanged?.(); } catch (error) { showToast(error.code === 'edit_window' ? 'Ya pasaron más de 15 minutos: no se puede corregir.' : error.message || 'No se pudo corregir.', 'error'); setEditing(null); }
  };
  const send = ({ text = '', file = null, cardId = null, audio = null }) => { const reply = replyTo; setReplyTo(null); conv.send({ text, file, cardId, audio, replyTo: reply }); };
  const sendPhotos = (items) => { setFiles([]); items.forEach(({ file, caption }, at) => conv.send({ text: caption, file, replyTo: at === 0 ? replyTo : null })); setReplyTo(null); };
  const addFiles = (incoming) => { const result = pickPhotos(incoming, files); if (result.error) showToast(result.error, 'error'); setFiles(result.files); };
  const forward = async (ids) => {
    setForwardBusy(true);
    try {
      const result = await api.forwardMessage(forwarding.id, ids);
      const failed = (result.results || []).filter((entry) => !entry.ok);
      showToast(failed.length ? `Reenviado, pero ${failed.length} no se pudo enviar.` : 'Mensaje reenviado', failed.length ? 'error' : 'success');
      setForwarding(null);
      onListChanged?.();
    } catch (error) { showToast(error.message || 'No se pudo reenviar.', 'error'); } finally { setForwardBusy(false); }
  };
  const changeSettings = (patch) => {
    const local = { ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}), ...(patch.archived !== undefined ? { archived: patch.archived } : {}), ...(patch.muted !== undefined ? { mutedUntil: patch.muted ? new Date(Date.now() + 8 * 3600000).toISOString() : null } : {}) };
    conv.setSettings((previous) => ({ ...previous, ...local }));
    onSettings(partnerId, { remote: patch, local: { ...patch, muted: Boolean(patch.muted) } }).then(() => conv.load({ silent: true })).catch((error) => showToast(error.message || 'No se pudo guardar el cambio.', 'error'));
    if (patch.archived) onBack?.();
  };
  const toggleBlock = async () => {
    try {
      if (blockedByMe) await api.unblockUser(partnerId); else await api.blockUser(partnerId);
      conv.setBlockedByMe(!blockedByMe);
      showToast(blockedByMe ? 'Desbloqueaste a esta persona' : 'Bloqueaste a esta persona', 'success');
    } catch (error) { showToast(error.message || 'No se pudo cambiar el bloqueo.', 'error'); }
  };

  const status = remoteTyping ? 'escribiendo…' : presence ? (presence.online ? 'en línea' : lastSeenLabel(presence.lastSeenAt)) : '';
  const myReaction = menu ? (menu.message.reactions || []).find((reaction) => reaction.mine)?.emoji : null;
  const menuItems = [
    { id: 'info', icon: 'info', label: 'Datos del contacto', onClick: () => setInfo(true) },
    { id: 'search', icon: 'search', label: 'Buscar en el chat', onClick: () => setSearch({ open: true, query: '', at: 0 }) },
    { id: 'starred', icon: 'star', label: 'Mensajes destacados', onClick: () => setStarredOpen(true) },
    { id: 'mute', icon: muted ? 'notifications_active' : 'notifications_off', label: muted ? 'Activar sonido' : 'Silenciar 8 horas', onClick: () => changeSettings({ muted: muted ? null : '8h' }) },
    { id: 'unarchive', icon: 'unarchive', label: 'Sacar de archivadas', hidden: !settings?.archived, onClick: () => changeSettings({ archived: false }) },
    { id: 'unblock', icon: 'block', label: 'Desbloquear', danger: true, hidden: !blockedByMe, onClick: toggleBlock }
  ];

  if (conv.notFound) {
    return (
      <section className="chat-wallpaper flex h-full min-h-0 flex-col items-center justify-center px-6" aria-label="Conversación no encontrada">
        <EmptyState icon="person_off" title="No encontramos esta conversación" action={{ label: 'Volver a mis chats', icon: 'arrow_back', onClick: onBack }}>La persona ya no existe o la dirección no es correcta.</EmptyState>
      </section>
    );
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-[#dbeafe]" aria-label={`Conversación con ${name}`}>
      {search.open ? (
        <header className="flex h-[60px] shrink-0 items-center gap-1 bg-white px-2 shadow-sm">
          <button type="button" onClick={() => setSearch({ open: false, query: '', at: 0 })} aria-label="Cerrar búsqueda" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"><span translate="no" aria-hidden="true" className="material-symbols-outlined">arrow_back</span></button>
          <input autoFocus value={search.query} onChange={(event) => setSearch({ open: true, query: event.target.value, at: 0 })} placeholder="Buscar en el chat" aria-label="Buscar en el chat" className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 px-2 text-[16px] outline-none placeholder:text-slate-500" />
          <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500" aria-live="polite">{search.query.trim().length >= 2 ? (matches.length ? `${matchAt + 1} de ${matches.length}` : 'Sin resultados') : ''}</span>
          {[['keyboard_arrow_up', 'Resultado anterior', 1], ['keyboard_arrow_down', 'Resultado siguiente', -1]].map(([icon, label, step]) => (
            <button key={icon} type="button" disabled={!matches.length} onClick={() => setSearch((previous) => ({ ...previous, at: previous.at + step }))} aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"><span translate="no" aria-hidden="true" className="material-symbols-outlined">{icon}</span></button>
          ))}
        </header>
      ) : (
        <header className="flex h-[60px] shrink-0 items-center gap-1 bg-gradient-to-r from-[#0b214a] to-[#1e40af] pr-1 text-white shadow-[0_2px_8px_rgba(8,18,42,0.25)]">
          {showBack && <button type="button" onClick={onBack} aria-label="Volver a los chats" className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"><span translate="no" aria-hidden="true" className="material-symbols-outlined">arrow_back</span></button>}
          <button type="button" onClick={() => setInfo(true)} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${showBack ? '' : 'pl-3'}`} aria-label={`Datos de ${name}`}>
            <Avatar name={name} src={avatar} size={40} online={Boolean(presence?.online)} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[16px] font-extrabold leading-tight"><span className="truncate">{name}</span>{partner?.verified && <VerifiedBadge size={17} color="#93c5fd" />}</span>
              <span className={`block truncate text-[12.5px] font-semibold leading-tight ${remoteTyping ? 'text-[#facc15]' : 'text-blue-100'}`} aria-live="polite">{status || (username ? `@${username}` : '')}</span>
            </span>
          </button>
          {username && <Link to={`/${username}`} aria-label={`Ver perfil de ${name}`} title="Ver perfil" className="hidden h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] sm:flex"><span translate="no" aria-hidden="true" className="material-symbols-outlined">storefront</span></Link>}
          <button type="button" onClick={() => setSearch({ open: true, query: '', at: 0 })} aria-label="Buscar en el chat" className="hidden h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] sm:flex"><span translate="no" aria-hidden="true" className="material-symbols-outlined">search</span></button>
          <MenuButton items={menuItems} label="Opciones del chat" onDark />
        </header>
      )}

      {conv.error && <div role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{conv.error} <button type="button" onClick={() => conv.load()} className="underline">Reintentar</button></div>}

      <MessageList
        ref={list} messages={messages} partner={partner || { id: partnerId }} partnerName={name} resetKey={partnerKey} loading={conv.loading} hasMore={hasMore} loadingOlder={loadingOlder}
        onLoadOlder={conv.loadOlder} firstUnreadId={conv.firstUnreadId} typing={remoteTyping} query={search.open ? search.query : ''} currentMatchId={search.open ? currentMatch : null} flashId={flashId}
        onMenu={openMenu} onReply={startReply} onJump={jump} onImage={setViewer} onRetry={conv.retry} onDiscard={conv.discard}
      />

      <Composer
        draft={initialDraft} onDraft={(text) => onDraft?.(partnerId, text)} onSend={(text) => send({ text })} onTyping={onTyping}
        replyTo={replyTo} replyAuthor={replyTo?.author} onCancelReply={() => setReplyTo(null)}
        editing={editing} onCancelEdit={() => setEditing(null)} onSaveEdit={saveEdit}
        onFiles={addFiles} onOpenCards={() => setCardsOpen(true)} quickReplies={quickReplies} showQuick={!conv.loading && messages.length === 0}
        blocked={blockedByMe ? { byMe: true } : null} onUnblock={toggleBlock} focusKey={partnerKey} onVoice={(audio) => send({ audio })} onNotice={(message) => showToast(message, 'error')}
      />

      <MessageActionMenu target={menu} onClose={() => setMenu(null)} actions={actions} myReaction={myReaction} />
      <ContactInfo open={info} onClose={() => setInfo(false)} partner={partner || { id: partnerId, name, photoURL: avatar, username }} settings={settings} muted={muted} blockedByMe={blockedByMe}
        onSettings={changeSettings} onToggleBlock={() => { setInfo(false); toggleBlock(); }} onViewImage={setViewer}
        onStarred={() => setStarredOpen(true)} onSearch={() => setSearch({ open: true, query: '', at: 0 })} onReport={() => { setInfo(false); setReporting({ targetType: 'user', targetId: partnerId }); }} />
      <StarredSheet open={starredOpen} onClose={() => setStarredOpen(false)} partnerId={partnerId} onOpenMessage={(message) => jump(message.id)} />
      <ForwardSheet open={Boolean(forwarding)} onClose={() => setForwarding(null)} chats={chats.filter((chat) => (chat.otherUser || chat.partner)?.id !== partnerId)} onSend={forward} busy={forwardBusy} />
      <MessageInfoSheet message={messageInfo} partnerName={name} onClose={() => setMessageInfo(null)} />
      <CardPicker open={cardsOpen} onClose={() => setCardsOpen(false)} myUsername={myUsername} onPick={(card) => { setCardsOpen(false); send({ cardId: card.id }); }} />
      <ImagePreview files={files} onClose={() => setFiles([])} onRemove={(at) => setFiles((previous) => previous.filter((_, index) => index !== at))} onSend={sendPhotos} />
      <ImageViewer src={viewer} onClose={() => setViewer(null)} />
      {reporting && <ReportSheet {...reporting} onClose={() => setReporting(null)} />}
    </section>
  );
}
