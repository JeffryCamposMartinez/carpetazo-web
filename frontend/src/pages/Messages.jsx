import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
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
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyMessage, setReplyMessage] = useState(null);
  const touchStartPos = useRef(null);
  const touchTimer = useRef(null);

  // Make body background white so keyboard gaps blend in
  useEffect(() => {
    document.body.style.backgroundColor = '#ffffff';
    document.body.classList.add('hide-global-bg');
    return () => {
      document.body.style.backgroundColor = '';
      document.body.classList.remove('hide-global-bg');
    };
  }, []);

  // Parse potential target user to start a chat from URL state
  useEffect(() => {
    if (location.state?.startChatWith) {
      const targetUser = location.state.startChatWith;
      // Check if chat already exists
      const existingChat = chats.find(c => c.participants.includes(targetUser.id));
      if (existingChat) {
        setActiveChat(existingChat);
        // Clear state to avoid infinite loops on re-render
        navigate('/mensajes', { replace: true, state: {} });
      } else if (!loadingChats) {
        // Create new chat
        const createNewChat = async () => {
          const newChatData = {
            participants: [currentUser.uid, targetUser.id],
            participantNames: {
              [currentUser.uid]: currentUser.displayName || 'Usuario',
              [targetUser.id]: targetUser.name || 'Vendedor'
            },
            participantAvatars: {
              [currentUser.uid]: currentUser.photoURL || '',
              [targetUser.id]: targetUser.avatar || ''
            },
            updatedAt: serverTimestamp(),
            lastMessage: ''
          };
          const chatRef = await addDoc(collection(db, 'chats'), newChatData);
          setActiveChat({ id: chatRef.id, ...newChatData });
          navigate('/mensajes', { replace: true, state: {} });
        };
        createNewChat();
      }
    }
  }, [location.state, chats, loadingChats, currentUser, navigate]);

  // Listen to User's Chats
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by updatedAt desc
      chatsData.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setChats(chatsData);
      setLoadingChats(false);
    }, (error) => {
      console.error("Error fetching chats:", error);
      alert("Error al cargar los chats: " + error.message);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Listen to Active Chat Messages
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);

      // Mark unread messages as read
      const unreadDocs = snapshot.docs.filter(d => {
        const data = d.data();
        return data.senderId !== currentUser.uid && !data.read;
      });

      if (unreadDocs.length > 0) {
        const batch = writeBatch(db);
        unreadDocs.forEach(d => {
          const msgRef = doc(db, `chats/${activeChat.id}/messages`, d.id);
          batch.update(msgRef, { read: true });
        });
        await batch.commit().catch(err => console.error("Error marking messages as read:", err));
      }

      setTimeout(() => {
        const container = messagesEndRef.current?.parentElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [activeChat, currentUser.uid]);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsProcessingImage(true);
    try {
      const compressedBase64 = await compressImage(file);
      setPendingImage(compressedBase64);
    } catch (err) {
      console.error("Error compressing image:", err);
      alert("Hubo un error al procesar la imagen.");
    } finally {
      setIsProcessingImage(false);
      // Reset input value so the same file can be selected again
      e.target.value = '';
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        setIsProcessingImage(true);
        try {
          const compressedBase64 = await compressImage(file);
          setPendingImage(compressedBase64);
        } catch (err) {
          console.error("Error compressing pasted image:", err);
          alert("Hubo un error al procesar la imagen pegada.");
        } finally {
          setIsProcessingImage(false);
        }
        break;
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingImage) || !activeChat) return;

    const msgText = newMessage.trim();
    const imageToSend = pendingImage;
    
    setNewMessage('');
    setPendingImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const replyTo = replyMessage;
    setReplyMessage(null);

    // Add message
    await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
      text: msgText,
      imageBase64: imageToSend || null,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
      ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text, imageBase64: replyTo.imageBase64 || null, senderId: replyTo.senderId } } : {})
    });

    // Update chat last message
    await setDoc(doc(db, 'chats', activeChat.id), {
      lastMessage: imageToSend ? (msgText ? `📷 ${msgText}` : '📷 Imagen') : msgText,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  if (!currentUser) {
    return <div className="p-8 text-center flex-1 mt-20">Debes iniciar sesión para ver tus mensajes.</div>;
  }

  const getOtherParticipant = (chat) => {
    const otherId = chat.participants.find(id => id !== currentUser.uid);
    return {
      id: otherId,
      name: chat.participantNames?.[otherId] || 'Usuario',
      avatar: chat.participantAvatars?.[otherId] || null
    };
  };

  const handleTouchStart = (e, msg) => {
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimer.current = setTimeout(() => {
      setSelectedMessage(msg);
      touchTimer.current = null;
    }, 500); // 500ms for long press
  };

  const handleTouchMove = (e) => {
    if (!touchStartPos.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    
    if (Math.abs(currentX - touchStartPos.current.x) > 10 || Math.abs(currentY - touchStartPos.current.y) > 10) {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
    }
  };

  const handleTouchEnd = (e, msg) => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    if (!touchStartPos.current) return;
    
    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - touchStartPos.current.x;
    
    // Swipe left logic
    if (deltaX < -50) {
      setSelectedMessage(msg);
    }
    
    touchStartPos.current = null;
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setSelectedMessage(msg);
  };

  const copyMessageToClipboard = async () => {
    if (selectedMessage && selectedMessage.text) {
      try {
        await navigator.clipboard.writeText(selectedMessage.text);
        setSelectedMessage(null);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    }
  };

  const handleReply = () => {
    setReplyMessage(selectedMessage);
    setSelectedMessage(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 w-full bg-white flex min-h-0 overflow-visible" style={{ maxHeight: 'calc(100vh - 124px)' }}>
      {/* INBOX (Left Sidebar) */}
      <div className={`w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-xl font-black text-[#1a2b4b]">Mensajes</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{chats.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-4 text-center text-gray-400">Cargando...</div>
          ) : chats.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No tienes mensajes aún. ¡Busca un vendedor y contáctalo!
            </div>
          ) : (
            chats.map(chat => {
              const otherUser = getOtherParticipant(chat);
              const isActive = activeChat?.id === chat.id;
              return (
                <div 
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={`flex items-center gap-3 p-4 cursor-pointer border-b border-gray-50 transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center overflow-hidden text-[#1a2b4b] font-bold text-lg">
                    {otherUser.avatar ? (
                      <img src={otherUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      otherUser.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{otherUser.name}</h4>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {chat.updatedAt?.toMillis ? new Date(chat.updatedAt.toMillis()).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{chat.lastMessage || '...'}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ACTIVE CHAT (Right Area) */}
      <div className={`flex-1 flex flex-col min-h-0 bg-[#f0f2f5] ${!activeChat ? 'hidden md:flex' : 'fixed inset-0 z-50 md:static md:flex md:z-auto'}`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">forum</span>
            <h3 className="text-xl font-bold text-gray-600 mb-2">Carpetazo Chat</h3>
            <p className="text-gray-400 max-w-sm">Selecciona una conversación de la izquierda para comenzar a coordinar tus tratos.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
              <button className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 flex items-center justify-center" onClick={() => setActiveChat(null)}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden font-bold text-[#1a2b4b]">
                {getOtherParticipant(activeChat).avatar ? (
                  <img src={getOtherParticipant(activeChat).avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  getOtherParticipant(activeChat).name.charAt(0).toUpperCase()
                )}
              </div>
              <h3 className="font-bold text-[#1a2b4b]">{getOtherParticipant(activeChat).name}</h3>
            </div>

            {/* Deactivated User Banner */}
            {activeChat.participantDeactivated?.[getOtherParticipant(activeChat).id] && (
              <div className="bg-red-50 border-b border-red-200 p-3 text-xs md:text-sm text-red-800 text-center shadow-sm z-10 font-bold">
                ⚠️ Este usuario ha deshabilitado su cuenta.
              </div>
            )}

            {/* Disclaimer Banner */}
            <div className="bg-yellow-50 border-b border-yellow-200 p-3 text-xs md:text-sm text-yellow-800 text-center shadow-sm z-10 flex items-center justify-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-[18px]">security</span>
              <div>
                <strong>Recomendación de Seguridad:</strong> Si hacen un intercambio en persona, júntense en un lugar público y revisen bien las cartas antes de entregarlas. Carpetazo.cl solo facilita este chat y no se responsabiliza por tratos externos.
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map(msg => {
                const isMe = msg.senderId === currentUser.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={(e) => handleTouchEnd(e, msg)}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                  >
                    <div className={`p-3 rounded-2xl relative shadow-sm break-words whitespace-pre-wrap ${
                      isMe 
                        ? 'bg-[#1a2b4b] text-white rounded-br-sm' 
                        : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}>
                      {/* Reply preview inside bubble */}
                      {msg.replyTo && (
                        <div className={`mb-2 px-2 py-1 rounded-lg border-l-4 text-xs ${
                          isMe 
                            ? 'border-blue-300 bg-white/10 text-blue-100' 
                            : 'border-blue-400 bg-gray-100 text-gray-600'
                        }`}>
                          <span className="font-bold block mb-0.5">
                            {msg.replyTo.senderId === currentUser.uid ? 'Tú' : getOtherParticipant(activeChat).name}
                          </span>
                          {msg.replyTo.imageBase64 && !msg.replyTo.text && <span>📷 Imagen</span>}
                          {msg.replyTo.text && <span className="truncate block max-w-[200px]">{msg.replyTo.text}</span>}
                        </div>
                      )}
                      {msg.imageBase64 && (
                        <img 
                          src={msg.imageBase64} 
                          alt="adjunto" 
                          className="max-w-full rounded-lg mb-2 cursor-pointer border border-black/10" 
                          onClick={() => window.open(msg.imageBase64, '_blank')}
                        />
                      )}
                      {msg.text}
                    </div>
                    <div className={`text-[10px] text-gray-400 mt-1 flex items-center gap-1 ${isMe ? 'self-end' : 'self-start'}`}>
                      {msg.createdAt?.toDate ? 
                        new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(msg.createdAt.toDate()) 
                        : 'Enviando...'}
                      {isMe && (
                        <span className={`material-symbols-outlined text-[14px] ${msg.read ? 'text-blue-500' : 'text-gray-400'}`}>
                          {msg.read ? 'done_all' : 'done'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-200 flex flex-col z-10 overflow-visible">
              {activeChat.participantDeactivated?.[getOtherParticipant(activeChat).id] ? (
                <div className="text-center text-sm font-medium text-amber-700 bg-amber-50 p-4">
                  No puedes enviar mensajes porque la cuenta de este usuario fue deshabilitada.
                </div>
              ) : (
                <>
                  {/* Reply Preview Bar */}
                  {replyMessage && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-100">
                      <div className="flex-1 border-l-4 border-blue-500 pl-2">
                        <span className="text-xs font-bold text-blue-600 block">
                          {replyMessage.senderId === currentUser.uid ? 'Tú' : getOtherParticipant(activeChat).name}
                        </span>
                        <span className="text-xs text-gray-500 truncate block max-w-[250px]">
                          {replyMessage.imageBase64 && !replyMessage.text ? '📷 Imagen' : replyMessage.text}
                        </span>
                      </div>
                      <button onClick={() => setReplyMessage(null)} className="text-gray-400 hover:text-gray-600 p-1">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  )}
                  {/* Image Preview Area */}
                  {pendingImage && (
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={pendingImage} alt="Pendiente" className="h-16 w-16 object-cover rounded-lg border border-gray-300" />
                        <span className="text-sm text-gray-600 font-medium">Imagen lista para enviar</span>
                      </div>
                      <button 
                        onClick={() => setPendingImage(null)}
                        className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">close</span>
                      </button>
                    </div>
                  )}
                  {isProcessingImage && (
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Procesando imagen...
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="p-3 flex gap-2 items-start max-w-4xl mx-auto w-full overflow-visible">
                    {/* Hidden File Inputs */}
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleImageSelect}
                    />
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      ref={cameraInputRef} 
                      className="hidden" 
                      onChange={handleImageSelect}
                    />
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1 mb-1">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-[#1a2b4b] hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                        title="Adjuntar imagen"
                      >
                        <span className="material-symbols-outlined text-[24px]">attach_file</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => cameraInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-[#1a2b4b] hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center md:hidden"
                        title="Tomar foto"
                      >
                        <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Escribe un mensaje o pega una imagen..."
                      className="flex-1 bg-gray-100 border-none rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a2b4b] resize-none min-h-[44px] max-h-32 text-[16px] text-gray-900 shadow-sm"
                      rows="1"
                    />
                    <button 
                      type="submit" 
                      disabled={(!newMessage.trim() && !pendingImage) || isProcessingImage}
                      className="w-11 h-11 rounded-full bg-[#1e40af] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 hover:bg-blue-800 transition-colors shadow-sm mb-0.5"
                    >
                      <span className="material-symbols-outlined text-[20px]">send</span>
                    </button>
                  </form>
                </>
              )}
            </div>
            
            {/* Options Modal */}
            {selectedMessage && (
              <div className="absolute inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4" onClick={() => setSelectedMessage(null)}>
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Opciones del mensaje</h3>
                  </div>
                  <div className="flex flex-col p-2">
                    <button 
                      onClick={handleReply}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors text-gray-700 font-medium"
                    >
                      <span className="material-symbols-outlined text-gray-500">reply</span>
                      Responder
                    </button>
                    <button 
                      onClick={copyMessageToClipboard}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors text-gray-700 font-medium"
                    >
                      <span className="material-symbols-outlined text-gray-500">content_copy</span>
                      Copiar texto
                    </button>
                    <button 
                      onClick={() => setSelectedMessage(null)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors text-red-600 font-medium mt-1"
                    >
                      <span className="material-symbols-outlined text-red-500">close</span>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
