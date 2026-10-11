import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { encodeMessage } from '../components/messages/messageUtils';

const PAGE = 50;
const byTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

// Mensajes de una conversación: carga por páginas, envío al instante (con reintento si falla), reacciones, destacados y correcciones.
// `partnerKey` es el id o el usuario de la otra persona.
export default function useConversation(partnerKey, { onChanged } = {}) {
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [settings, setSettings] = useState({ pinned: false, archived: false, mutedUntil: null, markedUnread: false });
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const keyRef = useRef(partnerKey);
  const requestRef = useRef(0);
  const pendingFiles = useRef(new Map()); // id temporal -> { file, previewUrl } para poder reintentar un envío fallido
  keyRef.current = partnerKey;

  const reset = useCallback(() => {
    setMessages([]); setPartner(null); setHasMore(false); setFirstUnreadId(null); setError(''); setNotFound(false);
    setSettings({ pinned: false, archived: false, mutedUntil: null, markedUnread: false });
  }, []);

  // Une la página nueva con lo que ya había: se conservan los mensajes más antiguos ya cargados y los envíos aún en camino
  const merge = useCallback((page, silent) => {
    setMessages((previous) => {
      const temps = previous.filter((message) => message.temp);
      const older = silent && page.length ? previous.filter((message) => !message.temp && new Date(message.createdAt) < new Date(page[0].createdAt)) : [];
      const realIds = new Set(page.map((message) => message.id));
      return [...older, ...page, ...temps.filter((message) => !realIds.has(message.id))].sort(byTime);
    });
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    const key = keyRef.current;
    if (!key) return null;
    const request = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const result = await api.getMessages(key, { limit: PAGE });
      if (request !== requestRef.current || key !== keyRef.current) return null;
      merge(result.messages || [], silent);
      if (!silent) { setHasMore(Boolean(result.hasMore)); setFirstUnreadId(result.firstUnreadId || null); }
      if (result.otherUser) setPartner(result.otherUser);
      if (result.settings) setSettings(result.settings);
      setBlockedByMe(Boolean(result.blockedByMe));
      setError('');
      setNotFound(false);
      return result;
    } catch (err) {
      if (err?.status === 404) setNotFound(true);
      else console.error('Error loading messages:', err);
      if (err?.status === 404) { /* la conversación no existe */ }
      else if (!silent) setError('No pudimos cargar los mensajes.');
      return null;
    } finally {
      if (!silent && request === requestRef.current) setLoading(false);
    }
  }, [merge]);

  const loadOlder = useCallback(async () => {
    const first = messages.find((message) => !message.temp);
    if (!first || loadingOlder || !hasMore) return 0;
    setLoadingOlder(true);
    try {
      const result = await api.getMessages(keyRef.current, { before: first.id, limit: PAGE });
      const older = result.messages || [];
      setMessages((previous) => { const ids = new Set(previous.map((message) => message.id)); return [...older.filter((message) => !ids.has(message.id)), ...previous].sort(byTime); });
      setHasMore(Boolean(result.hasMore));
      return older.length;
    } catch (err) {
      console.error('Error loading older messages:', err);
      return 0;
    } finally { setLoadingOlder(false); }
  }, [messages, loadingOlder, hasMore]);

  useEffect(() => {
    reset();
    if (partnerKey) load();
    return () => { requestRef.current += 1; };
  }, [partnerKey, load, reset]);

  const patch = (id, change) => setMessages((previous) => previous.map((message) => (message.id === id ? { ...message, ...change } : message)));

  // Envío: el mensaje aparece al instante y se confirma (✓) cuando el servidor lo recibe. Si falla queda con "!" para reintentar.
  const deliver = useCallback(async (tempId, { text, file, cardId, replyTo, audio }) => {
    try {
      let imageUrl = null;
      let voice = null;
      if (audio) {
        const form = new FormData();
        form.append('audio', audio.blob, 'voz.webm');
        voice = { url: (await api.uploadAudio(form)).url, seconds: audio.seconds, wave: audio.wave };
      }
      if (file) {
        const form = new FormData();
        form.append('image', file);
        form.append('type', 'message');
        imageUrl = (await api.uploadImage(form)).url;
      }
      const result = await api.sendMessage(keyRef.current, encodeMessage({ text, imageUrl, cardId, audio: voice }), replyTo?.id || null);
      const saved = pendingFiles.current.get(tempId);
      if (saved?.previewUrl) URL.revokeObjectURL(saved.previewUrl);
      pendingFiles.current.delete(tempId);
      setMessages((previous) => previous.map((message) => (message.id === tempId ? result.message : message)).sort(byTime));
      onChanged?.();
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      patch(tempId, { pending: false, failed: true, failReason: err?.code === 'blocked' ? err.message : 'No se pudo enviar. Toca para reintentar.' });
      return false;
    }
  }, [onChanged]);

  const send = useCallback(async ({ text = '', file = null, cardId = null, card = null, replyTo = null, audio = null }) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const previewUrl = file ? URL.createObjectURL(file) : null;
    const audioUrl = audio ? URL.createObjectURL(audio.blob) : null;
    if (file || audio) pendingFiles.current.set(tempId, { file, previewUrl: previewUrl || audioUrl, audio });
    const optimistic = {
      id: tempId, temp: true, pending: true, senderId: 'me', content: encodeMessage({ text, imageUrl: previewUrl, cardId, audio: audio ? { url: audioUrl, seconds: audio.seconds, wave: audio.wave } : null }), createdAt: new Date().toISOString(),
      isRead: false, deliveredAt: null, reactions: [], starred: false, attachment: card && cardId ? { id: card.id, name: card.name, imageUrl: card.imageUrl, price: card.price, set: card.set || null } : null,
      replyTo: replyTo ? { id: replyTo.id, senderId: replyTo.senderId, text: replyTo.text, kind: replyTo.kind } : null,
      retry: { text, cardId, replyTo }
    };
    setMessages((previous) => [...previous, optimistic]);
    return deliver(tempId, { text, file, cardId, replyTo, audio });
  }, [deliver]);

  const retry = useCallback((tempId) => {
    const failed = messages.find((message) => message.id === tempId && message.failed);
    if (!failed) return;
    patch(tempId, { pending: true, failed: false, failReason: '' });
    const saved = pendingFiles.current.get(tempId);
    deliver(tempId, { ...failed.retry, file: saved?.file || null, audio: saved?.audio || null });
  }, [messages, deliver]);

  const discard = useCallback((tempId) => {
    const saved = pendingFiles.current.get(tempId);
    if (saved?.previewUrl) URL.revokeObjectURL(saved.previewUrl);
    pendingFiles.current.delete(tempId);
    setMessages((previous) => previous.filter((message) => message.id !== tempId));
  }, []);

  const react = useCallback(async (id, emoji) => {
    setMessages((previous) => previous.map((message) => {
      if (message.id !== id) return message;
      const others = (message.reactions || []).map((entry) => (entry.mine ? { ...entry, count: entry.count - 1, mine: false } : entry)).filter((entry) => entry.count > 0);
      if (!emoji) return { ...message, reactions: others };
      const existing = others.find((entry) => entry.emoji === emoji);
      return { ...message, reactions: existing ? others.map((entry) => (entry.emoji === emoji ? { ...entry, count: entry.count + 1, mine: true } : entry)) : [...others, { emoji, count: 1, mine: true }] };
    }));
    try { await api.reactToMessage(id, emoji || null); } catch (err) { await load({ silent: true }); throw err; }
  }, [load]);

  const star = useCallback(async (id, starred) => {
    patch(id, { starred });
    try { await api.starMessage(id, starred); } catch (err) { patch(id, { starred: !starred }); throw err; }
  }, []);

  const edit = useCallback(async (id, text) => {
    const result = await api.editMessage(id, text);
    patch(id, { content: result.message.content, editedAt: result.message.editedAt });
    return result.message;
  }, []);

  // Marca como leído lo que llegó. Devuelve true si había algo por marcar.
  const markRead = useCallback(async () => {
    const hasUnread = messages.some((message) => !message.temp && message.senderId === partner?.id && !message.isRead);
    if (!hasUnread && !settings.markedUnread) return false;
    setMessages((previous) => previous.map((message) => (message.senderId === partner?.id ? { ...message, isRead: true } : message)));
    setSettings((previous) => ({ ...previous, markedUnread: false }));
    try { await api.markConversationRead(keyRef.current); window.dispatchEvent(new Event('carpetazo:messages-updated')); } catch { /* se reintenta en la próxima consulta */ }
    return true;
  }, [messages, partner?.id, settings.markedUnread]);

  useEffect(() => () => {
    pendingFiles.current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
    pendingFiles.current.clear();
  }, [partnerKey]);

  return { notFound, messages, partner, settings, blockedByMe, setBlockedByMe, hasMore, firstUnreadId, loading, loadingOlder, error, load, loadOlder, send, retry, discard, react, star, edit, markRead, setSettings };
}
