// Chat en tiempo real: cada persona con la app abierta mantiene una conexión de eventos (SSE) y el servidor le avisa al instante
// de mensajes nuevos, lecturas, "escribiendo…" y reacciones. Los avisos son mínimos ({ partnerId }): el cliente vuelve a pedir lo que cambió.
// Un solo proceso del servidor: las conexiones viven en memoria. Si la conexión falla, la web sigue funcionando por consultas periódicas.
const streams = new Map(); // userId -> conexiones abiertas
const MAX_STREAMS_PER_USER = 4; // pestañas o dispositivos a la vez

export const addStream = (userId, res) => {
  let set = streams.get(userId);
  if (!set) { set = new Set(); streams.set(userId, set); }
  set.add(res);
  while (set.size > MAX_STREAMS_PER_USER) {
    const oldest = set.values().next().value;
    set.delete(oldest);
    try { oldest.end(); } catch (_error) { /* ya estaba cerrada */ }
  }
};

export const removeStream = (userId, res) => {
  const set = streams.get(userId);
  if (!set) return;
  set.delete(res);
  if (!set.size) streams.delete(userId);
};

export const isOnline = (userId) => (streams.get(userId)?.size || 0) > 0;

export const publish = (userId, type, data = {}) => {
  const set = streams.get(userId);
  if (!set) return;
  const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(frame); } catch (_error) { /* la conexión se cierra sola */ }
  }
};

export const openStreamCount = () => [...streams.values()].reduce((total, set) => total + set.size, 0);
