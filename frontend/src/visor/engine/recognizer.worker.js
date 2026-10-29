// Worker de reconocimiento: carga el modelo una sola vez, mantiene los paquetes del índice y responde búsquedas.
// Protocolo (main → worker): init | loadGame | recognize | dispose. Solo se procesa el trabajo MÁS RECIENTE: si llega uno nuevo
// mientras se ejecuta otro, el pendiente anterior se descarta ({type:'dropped'}), así nunca se procesan fotogramas viejos.
import { AutoModel, Tensor, env } from '@huggingface/transformers';
import { IndexStore, topK } from './search.js';
import { INPUT_SIZE, MODEL_ID } from './constants.js';
import { toChw, poolEmbedding } from './embedding.js';
import { adapterForCatalogGame } from './games/adapters.js';

let model = null, store = null, backend = null, busy = false, pending = null, lastQ = null;
const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE); // buffer reutilizado en cada inferencia
const post = (msg, transfer) => self.postMessage(msg, transfer);

const embed = async (rgba) => {
  const out = await model({ pixel_values: new Tensor('float32', toChw(rgba, 4, chw), [1, 3, INPUT_SIZE, INPUT_SIZE]) });
  const [, tokens, d] = out.last_hidden_state.dims, v = poolEmbedding(out.last_hidden_state.data, tokens, d);
  out.last_hidden_state.dispose?.();
  return v;
};

const rotate180 = (rgba) => { const out = new Uint8ClampedArray(rgba.length), n = rgba.length / 4; for (let i = 0; i < n; i++) { const j = (n - 1 - i) * 4, k = i * 4; out[j] = rgba[k]; out[j + 1] = rgba[k + 1]; out[j + 2] = rgba[k + 2]; out[j + 3] = rgba[k + 3]; } return out; };

const handlers = {
  async init({ modelBase, wasmBase, indexBase, dtype = 'q8', device = 'wasm', threads }) {
    const t0 = performance.now();
    env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = modelBase;
    env.backends.onnx.wasm.wasmPaths = { mjs: `${wasmBase}ort-wasm-simd-threaded.mjs`, wasm: `${wasmBase}ort-wasm-simd-threaded.wasm` }; // runtime autoalojado (public/ort)
    env.backends.onnx.wasm.numThreads = threads ?? (self.crossOriginIsolated ? Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)) : 1);
    const progress = (p) => { if (p.status === 'progress') post({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total }); };
    try {
      model = await AutoModel.from_pretrained(MODEL_ID, { dtype, device, progress_callback: progress });
      backend = `${device}/${dtype}`;
    } catch (error) {
      if (device !== 'wasm') { model = await AutoModel.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback: progress }); backend = 'wasm/q8 (respaldo)'; } else throw error;
    }
    store = new IndexStore({ baseUrl: indexBase });
    const manifest = await store.loadManifest();
    // Calentamiento: la primera inferencia compila kernels; que no la pague la primera carta del usuario
    await embed(new Uint8ClampedArray(INPUT_SIZE * INPUT_SIZE * 4).fill(128));
    post({ type: 'ready', backend, loadMs: Math.round(performance.now() - t0), games: Object.fromEntries(Object.entries(manifest.games).map(([k, v]) => [k, { count: v.count, bytes: v.bytes, catalogCount: v.catalogCount }])), crossOriginIsolated: self.crossOriginIsolated });
  },

  async loadGame({ name }) {
    const t0 = performance.now(), pack = await store.loadGame(name);
    post({ type: 'gameLoaded', name, count: pack.info.count, ms: Math.round(performance.now() - t0) });
  },

  async recognize({ jobId, game, pixels, k = 40, retryBelow = 0.55 }) {
    const pack = await store.loadGame(game);
    const t0 = performance.now();
    let rgba = new Uint8ClampedArray(pixels), q = await embed(rgba), t1 = performance.now();
    let hits = topK(q, pack.bin, k), rotated = false;
    if (hits[0] && hits[0].score < retryBelow) { // quizá la carta está al revés: se prueba 180° y se queda con lo mejor
      const q2 = await embed(rotate180(rgba)), h2 = topK(q2, pack.bin, k);
      if (h2[0].score > hits[0].score) { hits = h2; rotated = true; q = q2; }
    }
    lastQ = q;
    post({ type: 'result', jobId, rotated, candidates: hits.map((h) => ({ score: h.score, meta: pack.meta[h.index] })), embedMs: Math.round(t1 - t0), searchMs: Math.round(performance.now() - t1) });
  },

  /** Las impresiones con ESE número impreso, ordenadas por parecido con la última carta: el parecido visual solo no las deja entre las 40 primeras (cartas casi sin color). */
  async byNumber({ reqId, game, number, k = 8 }) {
    const pack = await store.loadGame(game), adapter = adapterForCatalogGame(game);
    if (!lastQ || !adapter) return post({ type: 'byNumber', reqId, candidates: [] });
    const mask = Uint8Array.from(pack.meta, (m) => (adapter.canonNumber(m.number) === number ? 1 : 0));
    post({ type: 'byNumber', reqId, candidates: topK(lastQ, pack.bin, k, mask).map((h) => ({ score: h.score, meta: pack.meta[h.index] })) });
  },

  dispose() { model?.dispose?.(); model = null; store = null; post({ type: 'disposed' }); },
};

const run = async (msg) => {
  busy = true;
  try { await handlers[msg.type](msg); }
  catch (error) { post({ type: 'error', for: msg.type, jobId: msg.jobId, code: error.code || 'worker_error', message: String(error.message || error) }); }
  finally { busy = false; if (pending) { const next = pending; pending = null; run(next); } }
};

self.onmessage = ({ data }) => {
  if (data.type === 'recognize' && busy) { if (pending?.type === 'recognize') post({ type: 'dropped', jobId: pending.jobId }); pending = data; return; }
  if (busy) { // init/loadGame/dispose se encolan detrás del trabajo en curso sin pisar un recognize pendiente
    if (!pending) pending = data; else setTimeout(() => self.onmessage({ data }), 20);
    return;
  }
  run(data);
};
