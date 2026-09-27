import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const encodeMessage = ({ text, imageUrl, imageBase64 }) => JSON.stringify({
  v: 1,
  text: text || '',
  imageUrl: imageUrl || null,
  imageBase64: imageBase64 || null
});

const decodeMessage = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) {
      return {
        text: parsed.text || '',
        imageUrl: parsed.imageUrl || null,
        imageBase64: parsed.imageBase64 || null
      };
    }
  } catch {
    // Mensajes antiguos en texto plano.
  }
  return { text: content || '', imageUrl: null, imageBase64: null };
};

const getOtherUser = (chat, currentUser) => {
  const other = chat?.otherUser || chat?.partner || {};
  return {
    id: other.id || chat?.otherId || '',
    firebaseUid: other.firebaseUid,
    name: other.name || other.username || 'Usuario',
    avatar: other.photoURL || null
  };
};

export default function Messages() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const activeChatRef = useRef(null);
  const activeLoadRequestRef = useRef(0);
  const refreshInProgressRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const optimisticImageUrlsRef = useRef(new Set());

  const activeOther = useMemo(() => getOtherUser(activeChat, currentUser), [activeChat, currentUser]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const loadChats = async ({ silent = false } = {}) => {
    if (!currentUser) return;
    if (!silent) {
      setLoadingChats(true);
      setErrorMsg('');
    }
    try {
      const result = await api.getChats();
      const nextChats = (result.chats || result.data || []).filter(chat => {
        const other = getOtherUser(chat, currentUser);
        return other.firebaseUid !== currentUser.uid;
      });
      setChats(nextChats);

      const currentActive = activeChatRef.current;
      if (currentActive) {
        const refreshedActive = nextChats.find(chat => chat.id === currentActive.id);
        if (refreshedActive) {
          setActiveChat(refreshedActive);
        }
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      if (!silent) setErrorMsg('No pudimos cargar tus conversaciones.');
    } finally {
      if (!silent) setLoadingChats(false);
    }
  };

  const loadMessages = async (chat, { silent = false } = {}) => {
    const other = getOtherUser(chat, currentUser);
    if (!other.id) return;
    const requestId = ++activeLoadRequestRef.current;
    if (!silent) setLoadingMessages(true);
    try {
      const result = await api.getMessages(other.id);
      const list = result.messages || result.data || [];
      const latestOther = getOtherUser(activeChatRef.current, currentUser);
      if (requestId !== activeLoadRequestRef.current || latestOther.id !== other.id) return;
      if (result.otherUser) {
        setActiveChat(previous => previous?.id === chat.id ? { ...previous, otherUser: result.otherUser, otherId: result.otherUser.id } : previous);
      }
      setMessages(list);
      await Promise.all(
        list
          .filter(message => message.senderId === other.id && !message.isRead)
          .map(message => api.markMessageRead(message.id).catch(() => null))
      );
      setMessages(previous => previous.map(message => (
        message.senderId === other.id ? { ...message, isRead: true } : message
      )));
      window.dispatchEvent(new Event('carpetazo:messages-updated'));
    } catch (error) {
      console.error('Error loading messages:', error);
      if (!silent) setErrorMsg('No pudimos cargar los mensajes.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const refreshMessagesRealtime = async () => {
    if (!currentUser || refreshInProgressRef.current) return;
    refreshInProgressRef.current = true;
    try {
      const currentActive = activeChatRef.current;
      await Promise.all([
        loadChats({ silent: true }),
        currentActive ? loadMessages(currentActive, { silent: true }) : Promise.resolve()
      ]);
    } finally {
      refreshInProgressRef.current = false;
    }
  };

  useEffect(() => {
    document.body.style.backgroundColor = '';
    document.body.classList.remove('hide-global-bg');
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    loadChats();
  }, [currentUser?.uid]);

  useEffect(() => {
    const targetUser = location.state?.startChatWith;
    if (!targetUser || loadingChats) return;

    const targetId = targetUser.id || targetUser.userId || targetUser.firebaseUid;
    if (!targetId) return;

    const existingChat = chats.find(chat => {
      const other = getOtherUser(chat, currentUser);
      return [other.id, other.firebaseUid].includes(targetId);
    });

    const nextChat = existingChat || {
      id: `draft-${targetId}`,
      otherId: targetId,
      otherUser: {
        id: targetId,
        firebaseUid: targetUser.firebaseUid,
        name: targetUser.name || targetUser.username || 'Vendedor',
        username: targetUser.username,
        photoURL: targetUser.avatar || targetUser.photoURL || ''
      }
    };

    setActiveChat(nextChat);
    navigate('/mensajes', { replace: true, state: {} });
  }, [location.state, chats, loadingChats, currentUser, navigate]);

  useEffect(() => {
    if (activeChat) loadMessages(activeChat);
  }, [activeChat?.id]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const handleFocus = () => refreshMessagesRealtime();
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshMessagesRealtime();
    };

    const intervalId = window.setInterval(() => {
      if (!document.hidden) refreshMessagesRealtime();
    }, 3000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.uid]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleMessagesScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 180;
  };

  useEffect(() => {
    if (shouldStickToBottomRef.current) scrollToBottom('smooth');
  }, [messages.length]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    scrollToBottom('auto');
  }, [activeChat?.id]);

  useEffect(() => () => {
    const previewUrl = pendingImage?.previewUrl;
    if (previewUrl && !optimisticImageUrlsRef.current.has(previewUrl)) URL.revokeObjectURL(previewUrl);
  }, [pendingImage?.previewUrl]);

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Sube una imagen válida.');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('La imagen debe pesar menos de 10 MB.');
      event.target.value = '';
      return;
    }
    try {
      if (pendingImage?.previewUrl && !optimisticImageUrlsRef.current.has(pendingImage.previewUrl)) URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    } catch (error) {
      console.error('Error preparing image:', error);
      setErrorMsg('No pudimos procesar la imagen.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if ((!newMessage.trim() && !pendingImage) || !activeOther.id || sending) return;

    const textToSend = newMessage.trim();
    const imagePreviewUrl = pendingImage?.previewUrl || null;
    const tempId = `temp-${Date.now()}`;
    if (imagePreviewUrl) optimisticImageUrlsRef.current.add(imagePreviewUrl);
    shouldStickToBottomRef.current = true;
    setSending(true);
    setNewMessage('');
    setPendingImage(null);

    setMessages(previous => [
      ...previous,
      {
        id: tempId,
        senderId: 'me',
        receiverId: activeOther.id,
        content: encodeMessage({ text: textToSend, imageUrl: imagePreviewUrl }),
        createdAt: new Date().toISOString(),
        isRead: false,
        pending: true
      }
    ]);

    try {
      let imageUrl = null;
      if (pendingImage?.file) {
        const formData = new FormData();
        formData.append('image', pendingImage.file);
        formData.append('type', 'message');
        const uploadResult = await api.uploadImage(formData);
        imageUrl = uploadResult.url;
      }

      const payload = encodeMessage({ text: textToSend, imageUrl });
      await api.sendMessage(activeOther.id, payload);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        optimisticImageUrlsRef.current.delete(imagePreviewUrl);
      }
      await Promise.all([loadMessages(activeChat, { silent: true }), loadChats({ silent: true })]);
      window.dispatchEvent(new Event('carpetazo:messages-updated'));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(previous => previous.filter(message => message.id !== tempId));
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        optimisticImageUrlsRef.current.delete(imagePreviewUrl);
      }
      setErrorMsg('No pudimos enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  if (!currentUser) {
    return <div className="p-8 text-center flex-1 mt-20">Debes iniciar sesión para ver tus mensajes.</div>;
  }

  return (
    <div className="min-h-[calc(100vh-132px)] bg-transparent px-0 py-0 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-[1470px]">
        <div className="grid h-[calc(100vh-132px)] min-h-[620px] grid-cols-1 overflow-hidden bg-white/95 shadow-[0_24px_80px_rgba(2,6,23,0.22)] backdrop-blur md:h-[calc(100vh-180px)] md:rounded-[2rem] md:border md:border-white/60 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={`min-h-0 border-r border-slate-200 bg-white ${activeChat ? 'hidden lg:flex' : 'flex'} flex-col`}>
            <div className="shrink-0 border-b border-slate-200 bg-[#f0f2f5] p-4">
              <h1 className="text-2xl font-black text-slate-900">Mensajes</h1>
              <p className="text-sm text-slate-500">Tus conversaciones de Carpetazo</p>
            </div>

            {loadingChats ? (
              <p className="p-5 text-slate-500">Cargando chats...</p>
            ) : chats.length === 0 ? (
              <p className="p-5 text-slate-500">Aún no tienes conversaciones.</p>
            ) : (
              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                {chats.map(chat => {
                  const other = getOtherUser(chat, currentUser);
                  const last = decodeMessage(chat.lastMessage || chat.content || '');
                  const active = activeChat?.id === chat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChat(chat)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${active ? 'bg-blue-50' : 'bg-white'}`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-black text-blue-700">
                        {other.avatar ? <img src={other.avatar} alt="" className="w-full h-full object-cover" /> : other.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{other.name}</p>
                        <p className="text-sm text-slate-500 truncate">{last.imageUrl || last.imageBase64 ? '📷 Imagen' : last.text || 'Sin mensajes'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className={`${activeChat ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col bg-[#efeae2]`}>
            {activeChat ? (
              <>
                <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-200 bg-[#f0f2f5] px-4">
                  <button onClick={() => setActiveChat(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 lg:hidden">
                    <span translate="no" className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-black text-blue-700">
                    {activeOther.avatar ? <img src={activeOther.avatar} alt="" className="w-full h-full object-cover" /> : activeOther.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">{activeOther.name}</h2>
                    <p className="text-xs text-slate-500">Conversación privada</p>
                  </div>
                </header>

                {errorMsg && <div className="m-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{errorMsg}</div>}

                <div ref={messagesScrollRef} onScroll={handleMessagesScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.42)_0_1px,transparent_1px),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.32)_0_1px,transparent_1px)] bg-[length:24px_24px] px-4 py-5 md:px-8">
                  {loadingMessages && messages.length === 0 ? (
                    <p className="text-center text-slate-500">Cargando mensajes...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-slate-500 mt-10">Empieza la conversación 👋</p>
                  ) : (
                    messages.map(message => {
                      const own = message.senderId !== activeOther.id;
                      const body = decodeMessage(message.content);
                      const tickClass = message.pending ? 'text-slate-400' : message.isRead ? 'text-sky-500' : 'text-slate-400';
                      const TickIcon = () => own ? (
                        <span className={`ml-1 inline-flex align-[-2px] text-[15px] leading-none ${tickClass}`} title={message.pending ? 'No recibido todavía' : message.isRead ? 'Visto' : 'Enviado y recibido'}>
                          {message.pending ? '✓' : '✓✓'}
                        </span>
                      ) : null;
                      return (
                        <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[68%] ${own ? 'bg-[#d9fdd3] text-slate-900 rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md'} ${message.pending ? 'opacity-75' : ''}`}>
                            {(body.imageUrl || body.imageBase64) && <img src={body.imageUrl || body.imageBase64} alt="Adjunto" className="mb-2 max-h-72 rounded-xl object-contain" />}
                            {body.text && <p className="whitespace-pre-wrap break-words">{body.text}</p>}
                            <p className="mt-1 text-right text-[10px] text-slate-400">
                              {message.createdAt ? new Date(message.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                              <TickIcon />
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {pendingImage && (
                  <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-[#f0f2f5] px-4 py-3">
                    <img src={pendingImage.previewUrl} alt="Imagen pendiente" className="w-16 h-16 rounded-xl object-cover" />
                    <button onClick={() => { if (pendingImage?.previewUrl && !optimisticImageUrlsRef.current.has(pendingImage.previewUrl)) URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }} className="text-sm font-bold text-red-600">Quitar imagen</button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex h-[72px] shrink-0 gap-2 border-t border-slate-200 bg-[#f0f2f5] px-3 py-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-white">
                    <span translate="no" className="material-symbols-outlined">image</span>
                  </button>
                  <input
                    value={newMessage}
                    onChange={event => setNewMessage(event.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="min-w-0 flex-1 rounded-full border border-transparent bg-white px-5 text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button disabled={sending || (!newMessage.trim() && !pendingImage)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-sm disabled:opacity-50">
                    <span translate="no" className="material-symbols-outlined">{sending ? 'hourglass_empty' : 'send'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[#efeae2] text-slate-500">
                Selecciona una conversación.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
