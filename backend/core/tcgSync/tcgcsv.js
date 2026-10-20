// Cliente de TCGCSV (espejo público de solo lectura de la API de TCGplayer): pausa entre pedidos y reintentos ante límites del servidor.
const BASE = process.env.TCGCSV_BASE || 'https://tcgcsv.com/tcgplayer';
const USER_AGENT = 'Carpetazo.cl/1.0 (sincronizacion de catalogo)';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class TcgcsvClient {
  constructor({ delayMs = 120, retries = 3, onWait = () => {} } = {}) {
    Object.assign(this, { delayMs, retries, onWait, nextSlot: 0 });
  }

  async json(path) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const now = Date.now();
      const at = Math.max(now, this.nextSlot);
      this.nextSlot = at + this.delayMs;
      if (at > now) await sleep(at - now);
      try {
        const response = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
        if (response.status === 404 || response.status === 403) return null;
        if (response.status === 429 || response.status >= 500) {
          const wait = Math.min(60000, (Number(response.headers.get('retry-after')) || 0) * 1000 || 2000 * 3 ** attempt);
          this.onWait(`TCGCSV respondió ${response.status}; espero ${Math.round(wait / 1000)} s`);
          lastError = new Error(`HTTP ${response.status}`);
          await sleep(wait);
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        try { return JSON.parse(await response.text()); } catch { return null; } // una categoría vacía responde un XML de error
      } catch (error) {
        lastError = error;
        await sleep(1000 * 3 ** attempt);
      }
    }
    throw lastError || new Error('Sin respuesta');
  }

  categories() { return this.json('/categories').then((data) => data?.results || []); }
  groups(categoryId) { return this.json(`/${categoryId}/groups`).then((data) => data?.results || []); }
  products(categoryId, groupId) { return this.json(`/${categoryId}/${groupId}/products`).then((data) => data?.results || null); }
}
