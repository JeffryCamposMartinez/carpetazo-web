import { apiUrl } from './api';

// Pedidos al proxy de TCGCSV compartidos por todo el sitio: una misma ruta se descarga una sola vez
// (aunque la pidan a la vez la carpeta, la lista de deseados o un cambio de pestaña) y se reutiliza un rato.
const TTL_MS = 20 * 60 * 1000;
const MAX_ENTRIES = 80;
const entries = new Map(); // ruta -> { at, promise }

const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });

// `signal` solo cancela la espera de quien llama: la descarga sigue para los demás y queda en caché
const waitFor = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
};

// `path` es lo que va después de /tcgcsv, por ejemplo `/tcgplayer/3/groups`
export const tcgcsvJson = (path, signal) => {
  const hit = entries.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return waitFor(hit.promise, signal);
  const promise = fetch(apiUrl(`/tcgcsv${path}`))
    .then((response) => {
      if (!response.ok) throw new Error(`TCGCSV ${response.status}`);
      return response.json();
    })
    .catch((error) => { if (entries.get(path)?.promise === promise) entries.delete(path); throw error; });
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value);
  entries.set(path, { at: Date.now(), promise });
  return waitFor(promise, signal);
};
