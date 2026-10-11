import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

// Lista de conversaciones del usuario (activas y archivadas) con sus ajustes: fijada, silenciada, archivada, no leída.
export default function useChatList(currentUser) {
  const [chats, setChats] = useState([]);
  const [archived, setArchived] = useState([]);
  const [counts, setCounts] = useState({ archivedCount: 0, archivedUnread: 0, totalUnread: 0 });
  const [privacy, setPrivacy] = useState({ showLastSeen: true, showReadReceipts: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const archivedOpen = useRef(false);
  const busy = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!currentUser || (busy.current && silent)) return;
    busy.current = true;
    if (!silent) { setLoading(true); setError(''); }
    try {
      const [main, old] = await Promise.all([api.getChats(), archivedOpen.current ? api.getChats(true) : null]);
      const own = (list) => (list || []).filter((chat) => (chat.otherUser || chat.partner)?.firebaseUid !== currentUser.uid);
      setChats(own(main.chats));
      if (old) setArchived(own(old.chats));
      setCounts({ archivedCount: main.archivedCount || 0, archivedUnread: main.archivedUnread || 0, totalUnread: main.totalUnread || 0 });
      if (main.privacy) setPrivacy(main.privacy);
      setError('');
    } catch (err) {
      console.error('Error loading chats:', err);
      if (!silent) setError('No pudimos cargar tus conversaciones.');
    } finally {
      busy.current = false;
      if (!silent) setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  // Las archivadas solo se piden cuando se abre esa sección
  const openArchived = useCallback(async () => {
    archivedOpen.current = true;
    try { const result = await api.getChats(true); setArchived(result.chats || []); } catch { /* se reintenta en la próxima consulta */ }
  }, []);
  const closeArchived = useCallback(() => { archivedOpen.current = false; }, []);

  // Ajuste de un chat: se ve al instante y luego se confirma con el servidor
  const updateSettings = useCallback(async (partnerId, patch) => {
    const apply = (list) => list.map((chat) => ((chat.otherUser || chat.partner)?.id === partnerId ? { ...chat, ...patch.local } : chat));
    setChats(apply);
    setArchived(apply);
    try {
      await api.setChatSettings(partnerId, patch.remote);
    } catch (err) {
      await load({ silent: true });
      throw err;
    }
    await load({ silent: true });
  }, [load]);

  const updatePrivacy = useCallback(async (next) => {
    setPrivacy((previous) => ({ ...previous, ...next }));
    try { const result = await api.setChatPrivacy(next); setPrivacy(result.privacy); } catch (err) { await load({ silent: true }); throw err; }
  }, [load]);

  return { chats, archived, counts, privacy, loading, error, load, openArchived, closeArchived, updateSettings, updatePrivacy };
}
