import { useEffect, useRef } from 'react';
import { auth } from '../services/firebase';
import { apiUrl } from '../services/api';

// Conexión de eventos en tiempo real con el servidor (mensajes nuevos, lecturas, "escribiendo…"). Va con la sesión en el encabezado,
// por eso usa fetch y no EventSource. Si se corta, reintenta con espera creciente; mientras tanto la pantalla sigue al día por consultas.
// onEvent(tipo, datos) y onStatus(true|false) pueden cambiar entre renders sin reiniciar la conexión.
export default function useChatStream({ enabled, onEvent, onStatus }) {
  const handlers = useRef({ onEvent, onStatus });
  handlers.current = { onEvent, onStatus };

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let controller = null;
    let timer = null;
    let attempt = 0;

    const parse = (frame) => {
      let type = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      let payload = {};
      try { payload = data ? JSON.parse(data) : {}; } catch { /* aviso sin datos */ }
      return { type, payload };
    };

    const connect = async () => {
      if (cancelled) return;
      controller = new AbortController();
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!token) throw new Error('sin sesión');
        const response = await fetch(apiUrl('/chats/stream'), { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: controller.signal, cache: 'no-store' });
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut = buffer.indexOf('\n\n');
          while (cut !== -1) {
            const { type, payload } = parse(buffer.slice(0, cut));
            buffer = buffer.slice(cut + 2);
            if (type === 'ready') { attempt = 0; handlers.current.onStatus?.(true); } else handlers.current.onEvent?.(type, payload);
            cut = buffer.indexOf('\n\n');
          }
        }
      } catch (error) {
        if (cancelled || error?.name === 'AbortError') return;
      }
      handlers.current.onStatus?.(false);
      if (cancelled) return;
      attempt += 1;
      timer = window.setTimeout(connect, Math.min(1500 * 2 ** Math.min(attempt, 4), 20000));
    };
    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.abort();
      handlers.current.onStatus?.(false);
    };
  }, [enabled]);
}
