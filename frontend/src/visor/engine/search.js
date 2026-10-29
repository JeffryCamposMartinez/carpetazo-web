// Búsqueda por similitud sobre paquetes int8 y carga/verificación de paquetes (sin DOM; fetch y caché inyectables).
import { DIMS, FORMAT, MODEL_TAG, QUANT_SCALE } from './constants.js';

/**
 * Top-k por producto punto (= coseno: los vectores están normalizados L2).
 * @param {Float32Array} query vector normalizado (DIMS)
 * @param {Int8Array} bin n·DIMS valores int8
 * @param {number} k
 * @param {Uint8Array=} mask 1 = candidato permitido (filtro previo)
 * @returns {{index:number, score:number}[]} ordenado de mayor a menor
 */
export const topK = (query, bin, k = 20, mask) => {
  const n = (bin.length / DIMS) | 0, best = []; let floor = -Infinity;
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    let s = 0; const o = i * DIMS;
    for (let d = 0; d < DIMS; d++) s += query[d] * bin[o + d];
    s /= QUANT_SCALE;
    if (best.length < k || s > floor) {
      let p = best.length; while (p > 0 && best[p - 1].score < s) p--;
      best.splice(p, 0, { index: i, score: s });
      if (best.length > k) best.pop();
      floor = best.length === k ? best.at(-1).score : -Infinity;
    }
  }
  return best;
};

export const quantize = (v) => Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * QUANT_SCALE))));

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));

export class IndexIncompatible extends Error { constructor(message, code) { super(message); this.name = 'IndexIncompatible'; this.code = code; } }

/**
 * Almacén de paquetes por juego. Descarga bajo demanda, verifica integridad (SHA-256 del manifest) y versión del modelo,
 * y guarda en Cache Storage para uso sin conexión. Distingue "sin red y sin copia" de "paquete corrupto".
 */
export class IndexStore {
  constructor({ baseUrl = '/index/', fetchImpl = (...a) => fetch(...a), cacheName = `visor-index-f${FORMAT}` } = {}) {
    Object.assign(this, { baseUrl, fetchImpl, cacheName });
    this.manifest = null; this.games = new Map();
  }

  async #cached(url) { try { return await (await caches.open(this.cacheName)).match(url); } catch { return undefined; } }
  async #store(url, response) { try { await (await caches.open(this.cacheName)).put(url, response); } catch { /* sin cuota o modo privado: solo no se guarda */ } }

  async #get(name, asBuffer, verify) {
    const url = `${this.baseUrl}${name}`;
    let res, offline = false;
    try { res = await this.fetchImpl(url, { cache: 'no-cache' }); if (!res.ok) throw new Error(`HTTP ${res.status}`); } catch { offline = true; }
    if (offline) {
      const hit = await this.#cached(url);
      if (!hit) throw new IndexIncompatible(`Sin conexión y sin copia local de ${name}`, 'offline_no_cache');
      res = hit;
    }
    const clone = res.clone(), data = asBuffer ? new Int8Array(await res.arrayBuffer()) : await res.json();
    if (verify && !(await verify(data))) {
      if (!offline) throw new IndexIncompatible(`Integridad inválida en ${name}`, 'integrity');
      throw new IndexIncompatible(`La copia local de ${name} está corrupta`, 'integrity');
    }
    if (!offline) await this.#store(url, clone);
    return data;
  }

  async loadManifest() {
    const m = await this.#get('manifest.json', false);
    if (m.model !== MODEL_TAG) throw new IndexIncompatible(`Índice (${m.model}) incompatible con el modelo del escáner (${MODEL_TAG})`, 'model_mismatch');
    return (this.manifest = m);
  }

  /** @returns {{meta:Array<object>, bin:Int8Array, info:object}} */
  async loadGame(name) {
    if (this.games.has(name)) return this.games.get(name);
    const m = this.manifest || await this.loadManifest(), info = m.games[name];
    if (!info) throw new IndexIncompatible(`Sin paquete para ${name}`, 'no_pack');
    const meta = await this.#get(`${name}.json`, false);
    const bin = await this.#get(`${name}.bin`, true, async (b) => (await sha256Hex(b)) === info.sha256 && b.length === info.count * DIMS);
    const fields = meta.fields, cards = meta.cards.map((row) => Object.fromEntries(fields.map((f, i) => [f, row[i]])));
    const pack = { meta: cards, bin, info };
    this.games.set(name, pack);
    return pack;
  }
}
