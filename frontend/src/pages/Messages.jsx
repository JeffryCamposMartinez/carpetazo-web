import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import useChatList from '../hooks/useChatList';
import useChatStream from '../hooks/useChatStream';
import useVisualViewport from '../hooks/useVisualViewport';
import ChatList from '../components/messages/ChatList';
import ConversationView from '../components/messages/ConversationView';
import { ChatActionSheet, NewChatSheet, PrivacySheet, StarredSheet } from '../components/messages/ChatSheets';
import { personOf } from '../components/messages/messageUtils';
import usePageMeta from '../hooks/usePageMeta';

const POLL_LIVE_MS = 45000; // con la conexión en vivo basta una revisión de respaldo
const POLL_FALLBACK_MS = 4000;
const draftsKey = (uid) => `carpetazo:chat-drafts:${uid}`;
const readDrafts = (uid) => { try { const value = JSON.parse(localStorage.getItem(draftsKey(uid)) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };

const useMedia = (query) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
};

// Mensajes: en el celular ocupa toda la pantalla como WhatsApp (lista y conversación, con el botón atrás del teléfono); en pantalla ancha, dos columnas.
export default function Messages() {
  usePageMeta({ title: 'Mensajes | Carpetazo', description: 'Tus conversaciones con compradores y vendedores de Carpetazo.', path: '/mensajes' });
  const { currentUser, appUser } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const list = useChatList(currentUser);
  const isDesktop = useMedia('(min-width: 1024px)');
  const viewport = useVisualViewport(!isDesktop);
  const [bus] = useState(() => new EventTarget());
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState({ loading: false, messages: [] });
  const [archivedView, setArchivedView] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [actionChat, setActionChat] = useState(null);
  const [hint, setHint] = useState(null);
  const [offer, setOffer] = useState(null); // carta propia que se ofrece desde la lista de deseos de la otra persona: { key, card }
  const [jumpId, setJumpId] = useState(null);
  const [drafts, setDrafts] = useState(() => (currentUser ? readDrafts(currentUser.uid) : {}));
  const pushed = useRef(false);
  const reloadSoon = useRef(null);
  const activeKey = params.get('c') || '';
  const uid = currentUser?.uid;
  useBodyScrollLock(!isDesktop && Boolean(uid));
  useEffect(() => { document.body.classList.add('chat-screen'); return () => document.body.classList.remove('chat-screen'); }, []);

  const sources = archivedView ? list.archived : list.chats;
  const activeChat = useMemo(() => [...list.chats, ...list.archived].find((chat) => { const person = personOf(chat); return person.id === activeKey || person.username === activeKey; }) || null, [list.chats, list.archived, activeKey]);
  const activeHint = activeChat ? personOf(activeChat) : hint && (hint.key === activeKey) ? hint : null;

  // ---- Navegación: el chat abierto vive en la dirección (?c=), así el botón atrás del teléfono vuelve a la lista
  const openChat = useCallback((chat, jump = null) => {
    const person = personOf(chat);
    navigate(`/mensajes?c=${encodeURIComponent(person.id || person.username)}`, { replace: Boolean(params.get('c')) });
    pushed.current = !params.get('c');
    setJumpId(jump);
    setQuery('');
  }, [navigate, params]);
  const closeChat = useCallback(() => {
    if (pushed.current) navigate(-1); else navigate('/mensajes', { replace: true });
    pushed.current = false;
  }, [navigate]);

  // Llegar desde un perfil o un catálogo con "Enviar mensaje" (puede traer un borrador)
  useEffect(() => {
    const target = location.state?.startChatWith;
    if (!target || !uid) return;
    const key = target.username || target.id || target.userId || target.firebaseUid;
    if (!key) return;
    setHint({ key, id: target.id || '', name: target.name || target.username || 'Vendedor', username: target.username || '', avatar: target.avatar || target.photoURL || null });
    if (typeof target.draft === 'string' && target.draft) setDrafts((previous) => ({ ...previous, [key]: target.draft.slice(0, 500) }));
    if (target.card) setOffer({ key, card: target.card });
    pushed.current = false; // la entrada intermedia se reemplaza: atrás vuelve a la pantalla de origen y la flecha de la app, a la lista
    navigate(`/mensajes?c=${encodeURIComponent(key)}`, { replace: true, state: {} });
  }, [location.state, uid, navigate]);

  // ---- Borradores: cada chat guarda lo que quedó escrito
  const saveDraft = useCallback((partnerId, text) => {
    if (!partnerId || !uid) return;
    setDrafts((previous) => {
      const next = { ...previous };
      if (text) next[partnerId] = text; else delete next[partnerId];
      try { localStorage.setItem(draftsKey(uid), JSON.stringify(next)); } catch { /* sin almacenamiento */ }
      return next;
    });
  }, [uid]);

  // ---- Tiempo real y respaldo por consultas
  const onEvent = useCallback((type, payload) => {
    bus.dispatchEvent(new CustomEvent('chat', { detail: { type, payload } }));
    if (type === 'typing') return;
    window.clearTimeout(reloadSoon.current);
    reloadSoon.current = window.setTimeout(() => { list.load({ silent: true }); window.dispatchEvent(new Event('carpetazo:messages-updated')); }, 250);
  }, [bus, list.load]); // eslint-disable-line react-hooks/exhaustive-deps
  useChatStream({ enabled: Boolean(uid), onEvent, onStatus: setLive });

  useEffect(() => {
    if (!uid) return undefined;
    let timer = null;
    const tick = async () => {
      if (!document.hidden) {
        await list.load({ silent: true });
        bus.dispatchEvent(new CustomEvent('chat', { detail: { type: 'poll', payload: {} } }));
        if (!live && activeKey) api.getTyping(activeKey).then((result) => bus.dispatchEvent(new CustomEvent('chat', { detail: { type: 'typing', payload: { isTyping: Boolean(result.isTyping) } } }))).catch(() => null);
      }
      timer = window.setTimeout(tick, live ? POLL_LIVE_MS : POLL_FALLBACK_MS);
    };
    timer = window.setTimeout(tick, live ? POLL_LIVE_MS : POLL_FALLBACK_MS);
    const wake = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', wake);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
  }, [uid, live, activeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Buscar mensajes en todos los chats
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSearchState({ loading: false, messages: [] }); return undefined; }
    let cancelled = false;
    setSearchState((previous) => ({ ...previous, loading: true }));
    const timer = window.setTimeout(() => {
      api.searchChats(q).then((result) => { if (!cancelled) setSearchState({ loading: false, messages: result.messages || [] }); }).catch(() => { if (!cancelled) setSearchState({ loading: false, messages: [] }); });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  // ---- Acciones de la lista
  const changeSettings = useCallback(async (partnerId, patch) => {
    if (patch.remote?.markedUnread === false) await api.markConversationRead(partnerId).catch(() => null);
    try { await list.updateSettings(partnerId, patch); } catch (error) { showToast(error.message || 'No se pudo guardar el cambio.', 'error'); }
    window.dispatchEvent(new Event('carpetazo:messages-updated'));
  }, [list, showToast]);
  const startWith = (person) => {
    setSheet(null);
    setHint({ key: person.username, id: '', name: person.name, username: person.username, avatar: person.photoURL || null });
    const existing = list.chats.find((chat) => personOf(chat).username === person.username);
    navigate(`/mensajes?c=${encodeURIComponent(existing ? personOf(existing).id : person.username)}`, { replace: Boolean(params.get('c')) });
    pushed.current = !params.get('c');
  };
  const openFromMessage = (result) => { if (result.partner) openChat({ otherUser: result.partner }, result.id); };
  const leave = () => { if (window.history.length > 1) navigate(-1); else navigate('/'); };

  const menuItems = archivedView ? [] : [
    { id: 'new', icon: 'edit_square', label: 'Nuevo chat', onClick: () => setSheet('new') },
    { id: 'starred', icon: 'star', label: 'Mensajes destacados', onClick: () => setSheet('starred') },
    { id: 'archived', icon: 'archive', label: 'Archivadas', badge: list.counts.archivedCount, hidden: !list.counts.archivedCount, onClick: () => { list.openArchived(); setArchivedView(true); } },
    { id: 'privacy', icon: 'lock', label: 'Privacidad del chat', onClick: () => setSheet('privacy') },
    { id: 'home', icon: 'home', label: 'Ir al inicio', onClick: () => navigate('/') }
  ];

  if (!currentUser) {
    return (
      <div className="flex-1 px-4 py-20 text-center">
        <p className="text-base font-semibold text-[#12315f]">Debes iniciar sesión para ver tus mensajes.</p>
        <Link to="/bienvenida" className="mt-5 inline-flex h-12 items-center rounded-full bg-[#facc15] px-7 text-[15px] font-extrabold text-[#12315f] shadow-sm transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.97]">Iniciar sesión</Link>
      </div>
    );
  }

  const listPane = (
    <ChatList
      chats={sources} loading={list.loading} error={list.error} counts={list.counts} activeId={activeChat ? personOf(activeChat).id : activeKey}
      drafts={drafts} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} searchState={searchState}
      onOpen={openChat} onActions={setActionChat} onRetry={() => list.load()} onOpenArchived={() => { list.openArchived(); setArchivedView(true); }}
      onNewChat={() => setSheet('new')} menuItems={menuItems} onOpenResult={openFromMessage}
      title={archivedView ? 'Archivadas' : 'Mensajes'} archivedView={archivedView}
      onBack={archivedView ? () => { setArchivedView(false); list.closeArchived(); } : leave} backMobileOnly={!archivedView}
    />
  );

  const conversation = activeKey ? (
    <ConversationView
      key={activeKey} partnerKey={activeKey} hint={activeHint} bus={bus} initialDraft={drafts[activeHint?.id] ?? drafts[activeKey] ?? ''} onDraft={saveDraft}
      onBack={closeChat} showBack={!isDesktop} chats={list.chats} myUsername={appUser?.username || ''}
      onListChanged={() => { list.load({ silent: true }); window.dispatchEvent(new Event('carpetazo:messages-updated')); }} onSettings={list.updateSettings}
      jumpId={jumpId} onJumped={() => setJumpId(null)}
      offer={offer?.key === activeKey ? offer.card : null} onOfferUsed={() => setOffer(null)}
    />
  ) : null;

  const overlays = (
    <>
      <NewChatSheet open={sheet === 'new'} onClose={() => setSheet(null)} onPick={startWith} myUsername={appUser?.username || ''} />
      <PrivacySheet open={sheet === 'privacy'} onClose={() => setSheet(null)} privacy={list.privacy} onChange={(next) => list.updatePrivacy(next).catch((error) => showToast(error.message || 'No se pudo guardar.', 'error'))} />
      <StarredSheet open={sheet === 'starred'} onClose={() => setSheet(null)} onOpenMessage={(message) => message.partner && openChat({ otherUser: message.partner }, message.id)} />
      <ChatActionSheet chat={actionChat} pinnedCount={list.chats.filter((chat) => chat.pinned).length} onClose={() => setActionChat(null)} onSettings={changeSettings} />
    </>
  );

  // Celular: pantalla completa (lista o conversación), ajustada al teclado
  if (!isDesktop) {
    return (
      <div className="fixed inset-x-0 z-[60] overflow-hidden bg-white" style={{ top: viewport.top, height: viewport.height }}>
        <div className={`${activeKey ? 'hidden' : 'flex'} h-full flex-col`}>{listPane}</div>
        {conversation && <div className="chat-slide-in absolute inset-0 bg-[#dbeafe]">{conversation}</div>}
        {overlays}
      </div>
    );
  }

  return (
    <div className="px-0 py-0 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-[1470px]">
        <div className="grid h-[calc(100dvh-180px)] min-h-[560px] overflow-hidden bg-white shadow-[0_24px_80px_rgba(2,6,23,0.22)] md:rounded-[1.75rem] md:border md:border-white/60 lg:grid-cols-[400px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-slate-200">{listPane}</aside>
          <div className="min-h-0 bg-[#dbeafe]">
            {conversation || (
              <div className="chat-wallpaper flex h-full flex-col items-center justify-center px-8 text-center">
                <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#1e40af] shadow-md"><span translate="no" className="material-symbols-outlined text-[40px]">forum</span></span>
                <h2 className="mt-5 text-2xl font-extrabold text-[#12315f]">Tus mensajes de Carpetazo</h2>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-slate-600">Elige una conversación para ver los mensajes. Puedes mandar fotos y cartas a la venta desde el clip.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {overlays}
    </div>
  );
}
