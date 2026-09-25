import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 900;
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
  };
  reader.onerror = reject;
});

const encodeMessage = ({ text, imageBase64 }) => JSON.stringify({
  v: 1,
  text: text || '',
  imageBase64: imageBase64 || null
});

const decodeMessage = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) {
      return {
        text: parsed.text || '',
        imageBase64: parsed.imageBase64 || null
      };
    }
  } catch {
    // Mensajes antiguos en texto plano.
  }
  return { text: content || '', imageBase64: null };
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

  const activeOther = useMemo(() => getOtherUser(activeChat, currentUser), [activeChat, currentUser]);

  const loadChats = async () => {
    if (!currentUser) return;
    setLoadingChats(true);
    setErrorMsg('');
    try {
      const result = await api.getChats();
      setChats(result.chats || result.data || []);
    } catch (error) {
      console.error('Error loading chats:', error);
      setErrorMsg('No pudimos cargar tus conversaciones.');
    } finally {
      setLoadingChats(false);
    }
  };

  const loadMessages = async (chat) => {
    const other = getOtherUser(chat, currentUser);
    if (!other.id) return;
    setLoadingMessages(true);
    try {
      const result = await api.getMessages(other.id);
      const list = result.messages || result.data || [];
      if (result.otherUser) {
        setActiveChat(previous => previous?.id === chat.id ? { ...previous, otherUser: result.otherUser, otherId: result.otherUser.id } : previous);
      }
      setMessages(list);
      await Promise.all(
        list
          .filter(message => message.receiverId && message.receiverId !== message.senderId && !message.isRead)
          .map(message => api.markMessageRead(message.id).catch(() => null))
      );
    } catch (error) {
      console.error('Error loading messages:', error);
      setErrorMsg('No pudimos cargar los mensajes.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    document.body.style.backgroundColor = '#ffffff';
    document.body.classList.add('hide-global-bg');
    return () => {
      document.body.style.backgroundColor = '';
      document.body.classList.remove('hide-global-bg');
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChat?.id]);

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setPendingImage(await compressImage(file));
    } catch (error) {
      console.error('Error compressing image:', error);
      setErrorMsg('No pudimos procesar la imagen.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if ((!newMessage.trim() && !pendingImage) || !activeOther.id || sending) return;

    const payload = encodeMessage({ text: newMessage.trim(), imageBase64: pendingImage });
    setSending(true);
    setNewMessage('');
    setPendingImage(null);

    try {
      await api.sendMessage(activeOther.id, payload);
      await Promise.all([loadMessages(activeChat), loadChats()]);
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMsg('No pudimos enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  if (!currentUser) {
    return <div className="p-8 text-center flex-1 mt-20">Debes iniciar sesión para ver tus mensajes.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 pt-6 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[72vh] grid grid-cols-1 md:grid-cols-[320px_1fr]">
          <aside className={`border-r border-slate-200 bg-slate-50 ${activeChat ? 'hidden md:block' : 'block'}`}>
            <div className="p-5 border-b border-slate-200">
              <h1 className="text-2xl font-black text-slate-900">Mensajes</h1>
              <p className="text-sm text-slate-500">Tus conversaciones de Carpetazo</p>
            </div>

            {loadingChats ? (
              <p className="p-5 text-slate-500">Cargando chats...</p>
            ) : chats.length === 0 ? (
              <p className="p-5 text-slate-500">Aún no tienes conversaciones.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {chats.map(chat => {
                  const other = getOtherUser(chat, currentUser);
                  const last = decodeMessage(chat.lastMessage || chat.content || '');
                  const active = activeChat?.id === chat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChat(chat)}
                      className={`w-full text-left p-4 flex gap-3 hover:bg-white transition ${active ? 'bg-white' : ''}`}
                    >
                      <div className="w-11 h-11 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center font-black text-blue-700">
                        {other.avatar ? <img src={other.avatar} alt="" className="w-full h-full object-cover" /> : other.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{other.name}</p>
                        <p className="text-sm text-slate-500 truncate">{last.imageBase64 ? '📷 Imagen' : last.text || 'Sin mensajes'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-col min-h-[72vh]`}>
            {activeChat ? (
              <>
                <header className="p-4 border-b border-slate-200 flex items-center gap-3">
                  <button onClick={() => setActiveChat(null)} className="md:hidden w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <span translate="no" className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <div className="w-11 h-11 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center font-black text-blue-700">
                    {activeOther.avatar ? <img src={activeOther.avatar} alt="" className="w-full h-full object-cover" /> : activeOther.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">{activeOther.name}</h2>
                    <p className="text-xs text-slate-500">Conversación privada</p>
                  </div>
                </header>

                {errorMsg && <div className="m-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{errorMsg}</div>}

                <div className="flex-1 p-4 overflow-y-auto bg-slate-100/70 space-y-3">
                  {loadingMessages ? (
                    <p className="text-center text-slate-500">Cargando mensajes...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-slate-500 mt-10">Empieza la conversación 👋</p>
                  ) : (
                    messages.map(message => {
                      const own = message.senderId !== activeOther.id;
                      const body = decodeMessage(message.content);
                      return (
                        <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${own ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-900 rounded-bl-md'}`}>
                            {body.imageBase64 && <img src={body.imageBase64} alt="Adjunto" className="mb-2 max-h-72 rounded-xl object-contain" />}
                            {body.text && <p className="whitespace-pre-wrap break-words">{body.text}</p>}
                            <p className={`mt-1 text-[10px] ${own ? 'text-blue-100' : 'text-slate-400'}`}>
                              {message.createdAt ? new Date(message.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {pendingImage && (
                  <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-3">
                    <img src={pendingImage} alt="Imagen pendiente" className="w-16 h-16 rounded-xl object-cover" />
                    <button onClick={() => setPendingImage(null)} className="text-sm font-bold text-red-600">Quitar imagen</button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                    <span translate="no" className="material-symbols-outlined">image</span>
                  </button>
                  <input
                    value={newMessage}
                    onChange={event => setNewMessage(event.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 rounded-full border border-slate-300 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button disabled={sending || (!newMessage.trim() && !pendingImage)} className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-50">
                    <span translate="no" className="material-symbols-outlined">{sending ? 'hourglass_empty' : 'send'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                Selecciona una conversación.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
