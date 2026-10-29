// Orquestador: cámara → (worker de visión) detección → seguimiento → recorte → (worker de reconocimiento) → fusión → evento.
// Reglas de rendimiento: la detección corre a ~8 fps en un fotograma reducido; el reconocimiento completo solo se dispara
// UNA vez por carta quieta; los resultados de cartas ya retiradas se descartan (generación del seguimiento).
import { Camera } from './camera.js';
import { CardTracker } from './tracker.js';
import { fuse } from './fusion.js';
import { adapterForCatalogGame } from './games/adapters.js';
import { cleanOcrName } from './games/common.js';

const OCR_TIMEOUT_MS = 8000
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('El OCR tardó demasiado')), ms))])

export class Scanner {
  /**
   * @param {object} o
   * @param {HTMLVideoElement} o.video
   * @param {(event:object)=>void} o.onEvent eventos: status, detection, quality, recognizing, result, error, progress
   * @param {{model:string, wasm:string, index:string, ocr:string}} o.paths
   */
  constructor({ video, onEvent, paths, backend = { device: 'wasm', dtype: 'q8' }, detectFps = 8, useOcr = true }) {
    Object.assign(this, { video, onEvent, paths, backend, detectInterval: 1000 / detectFps, useOcr });
    this.camera = new Camera(video); this.camera.onEnded = () => { this.#stopLoop(); this.onEvent({ type: 'error', code: 'camera_ended', message: 'La cámara se detuvo.' }); };
    this.tracker = new CardTracker();
    this.game = null; this.running = false; this.ready = false;
    this.vision = null; this.recognizer = null;
    this.detecting = false; this.lastDetect = 0; this.lastSignature = null; this.lastDetection = null;
    this.jobs = new Map(); this.rescues = new Map(); this.nextId = 1; this.timers = new Set(); this.raf = null;
    this.stats = { detectMs: [], embedMs: [], searchMs: [], cropMs: [], e2eMs: [] };
  }

  // ---- ciclo de vida ----------------------------------------------------------------------------------------------

  async start(game) {
    this.game = game;
    this.onEvent({ type: 'status', status: 'camara' });
    await this.camera.start(); // un solo flujo; errores clasificados por Camera
    if (this.disposed) { this.camera.stop(); return; } // se cerró mientras la cámara se abría: no queda ni la cámara ni los workers
    this.#boot();
    this.running = true; this.locked = false;
    this.#loop();
  }

  /** Crea los workers de visión y de reconocimiento una sola vez (con la cámara o con una foto suelta). */
  #boot() {
    if (!this.vision) {
      this.vision = new Worker(new URL('./vision.worker.js', import.meta.url), { type: 'module' });
      this.vision.onmessage = (e) => this.#onVision(e.data);
      this.vision.onerror = (e) => this.onEvent({ type: 'error', code: 'vision_worker', message: String(e.message || 'Error en el detector') });
    }
    if (!this.recognizer) {
      this.onEvent({ type: 'status', status: 'modelo' });
      this.recognizer = new Worker(new URL('./recognizer.worker.js', import.meta.url), { type: 'module' });
      this.recognizer.onmessage = (e) => this.#onRecognizer(e.data);
      this.recognizer.onerror = (e) => this.onEvent({ type: 'error', code: 'model_worker', message: String(e.message || 'Error en el reconocedor') });
      this.recognizer.postMessage({ type: 'init', modelBase: this.paths.model, wasmBase: this.paths.wasm, indexBase: this.paths.index, ...this.backend });
    }
  }

  /**
   * Foto suelta (de la galería o de la cámara del teléfono): mismo flujo que el vídeo, con un solo fotograma.
   * Si el detector no encuentra el contorno de la carta, se toma la foto completa (la persona ya la recortó).
   * @param {string} game
   * @param {ImageBitmap} bitmap la foto completa; se libera aquí
   */
  async scanImage(game, bitmap) {
    this.game = game;
    this.#boot();
    this.running = true; this.locked = false;
    this.tracker.reset();
    const generation = this.tracker.generation, startedAt = performance.now();
    try {
      const w = bitmap.width, h = bitmap.height, s = 240 / Math.max(w, h);
      const small = await createImageBitmap(bitmap, { resizeWidth: Math.max(1, Math.round(w * s)), resizeHeight: Math.max(1, Math.round(h * s)), resizeQuality: 'low' });
      const msg = await new Promise((resolve) => { this.stillWaiter = resolve; this.vision.postMessage({ type: 'detect', id: 'still', bitmap: small }, [small]); });
      const det = msg.detection?.corners ? msg.detection : { corners: [[0, 0], [1, 0], [1, 1], [0, 1]], whole: true };
      this.lastDetection = det; this.lastSignature = msg.signature || null;
      this.onEvent({ type: 'detection', corners: det.corners, reason: msg.reason, state: 'stable', drift: 0, ms: msg.ms });
      const waitReady = async () => { for (let i = 0; i < 600 && !this.ready; i++) await new Promise((r) => setTimeout(r, 100)); return this.ready; }; // el modelo puede estar descargándose
      if (!(await waitReady())) { this.onEvent({ type: 'error', code: 'model_not_ready', message: 'El modelo todavía no cargó. Intenta de nuevo en un momento.' }); bitmap.close?.(); return; }
      const id = this.nextId++;
      this.jobs.set(id, { generation, startedAt, corners: det.corners, det, still: true });
      this.onEvent({ type: 'recognizing', id });
      this.vision.postMessage({ type: 'crop', id, bitmap, corners: det.corners, hires: this.useOcr && (adapterForCatalogGame(this.game)?.ocrRegions.length || 0) > 0 }, [bitmap]);
    } catch (error) { bitmap.close?.(); this.onEvent({ type: 'error', code: 'frame', message: String(error.message || error) }); }
  }

  setGame(game) {
    this.game = game; this.tracker.reset(); this.lastDetection = null; this.locked = false;
    if (this.ready) this.recognizer.postMessage({ type: 'loadGame', name: game });
  }

  /** Vuelve a permitir reconocer (el usuario pulsó «siguiente carta» o «intentar de nuevo»): hasta entonces el escáner no analiza fotogramas. */
  rescan() { this.locked = false; this.tracker.reset(); this.onEvent({ type: 'status', status: 'buscando' }); }

  /** Detiene la cámara y TODO lo que corre en segundo plano. Seguro de llamar varias veces. */
  stop() {
    this.running = false; this.#stopLoop();
    this.camera.stop();
    this.stillWaiter = null;
    this.tracker.reset(); this.jobs.clear(); this.locked = false;
    this.onEvent({ type: 'status', status: 'detenido' });
  }

  /** Libera además los workers y el modelo (al abandonar el escáner). */
  dispose() {
    this.disposed = true;
    this.stop();
    this.vision?.terminate(); this.vision = null;
    this.recognizer?.postMessage({ type: 'dispose' }); this.recognizer?.terminate(); this.recognizer = null;
    this.ready = false;
    import('./ocr.js').then((m) => m.disposeOcr()).catch(() => {});
  }

  #stopLoop() {
    if (this.raf != null) { (this.video.cancelVideoFrameCallback || cancelAnimationFrame).call(this.video.cancelVideoFrameCallback ? this.video : window, this.raf); this.raf = null; }
    this.timers.forEach(clearTimeout); this.timers.clear();
  }

  // ---- bucle de detección -----------------------------------------------------------------------------------------

  #loop() {
    if (!this.running) return;
    const tick = (now) => {
      this.raf = null;
      if (!this.running) return;
      if (!this.locked && !this.detecting && this.video.readyState >= 2 && now - this.lastDetect >= this.detectInterval && !document.hidden) this.#requestDetection(now);
      this.#schedule(tick);
    };
    this.#schedule(tick);
  }

  #schedule(tick) {
    if (this.video.requestVideoFrameCallback) this.raf = this.video.requestVideoFrameCallback((now) => tick(now));
    else this.raf = requestAnimationFrame(tick);
  }

  async #requestDetection(now) {
    this.detecting = true; this.lastDetect = now;
    try {
      const vw = this.video.videoWidth, vh = this.video.videoHeight; if (!vw || !vh) { this.detecting = false; return; }
      const s = 240 / Math.max(vw, vh), bitmap = await createImageBitmap(this.video, { resizeWidth: Math.round(vw * s), resizeHeight: Math.round(vh * s), resizeQuality: 'low' });
      this.vision.postMessage({ type: 'detect', id: now, bitmap }, [bitmap]);
    } catch { this.detecting = false; }
  }

  #onVision(msg) {
    if (msg.type === 'detection' && msg.id === 'still' && this.stillWaiter) { const done = this.stillWaiter; this.stillWaiter = null; done(msg); return; } // foto suelta: no pasa por el seguimiento
    if (msg.type === 'detection') {
      this.detecting = false; this.#push('detectMs', msg.ms);
      if (this.locked) return; // fotograma que ya estaba en curso cuando apareció el resultado
      const now = performance.now(), det = msg.detection;
      this.lastDetection = det; if (msg.signature) this.lastSignature = msg.signature;
      const out = this.tracker.update(det, now);
      this.onEvent({ type: 'detection', corners: det?.corners || null, reason: msg.reason, state: out.state, drift: out.drift, ms: msg.ms });
      if (out.state === 'held' && msg.signature && this.tracker.checkChanged(msg.signature)) this.onEvent({ type: 'status', status: 'buscando' });
      if (out.trigger) { if (this.alignCheck && !this.alignCheck(det.corners)) this.tracker.retry(); else this.#recognize(det, out.generation, now); } // con alignCheck solo se reconoce la carta que calza con el marco
    } else if (msg.type === 'crop') this.#onCrop(msg);
    else if (msg.type === 'error') { this.detecting = false; if (this.stillWaiter) { const done = this.stillWaiter; this.stillWaiter = null; done({}); return; } // foto suelta: sin contorno se usa la foto completa
      this.onEvent({ type: 'error', code: 'vision', message: msg.message }); }
  }

  // ---- reconocimiento ----------------------------------------------------------------------------------------------

  async #recognize(det, generation, startedAt) {
    if (!this.ready) { this.tracker.retry(); return; } // el modelo aún carga: se reintenta cuando la carta siga quieta
    const id = this.nextId++;
    this.jobs.set(id, { generation, startedAt, corners: det.corners, det });
    this.onEvent({ type: 'recognizing', id });
    try {
      const bitmap = await createImageBitmap(this.video); // resolución completa, solo una vez por carta
      this.vision.postMessage({ type: 'crop', id, bitmap, corners: det.corners, hires: this.useOcr && (adapterForCatalogGame(this.game)?.ocrRegions.length || 0) > 0 }, [bitmap]);
    } catch (error) { this.jobs.delete(id); this.tracker.retry(); this.onEvent({ type: 'error', code: 'frame', message: String(error.message || error) }); }
  }

  #onCrop(msg) {
    const job = this.jobs.get(msg.id);
    if (!job || job.generation !== this.tracker.generation) { this.jobs.delete(msg.id); return; } // la carta ya se fue
    if (msg.error) { this.jobs.delete(msg.id); this.tracker.retry(); if (job.still) this.onEvent({ type: 'error', code: 'frame', message: 'No se pudo leer esa foto.' }); return; }
    this.#push('cropMs', msg.ms);
    this.onEvent({ type: 'quality', quality: msg.quality });
    if (!msg.quality.ok && !job.still) { this.jobs.delete(msg.id); this.tracker.retry(); return; } // no se reconoce con imagen borrosa/oscura: pide mejorarla
    job.hires = msg.hires; job.sentAt = performance.now();
    this.recognizer.postMessage({ type: 'recognize', jobId: msg.id, game: this.game, pixels: msg.model }, [msg.model]);
  }

  #onRecognizer(msg) {
    switch (msg.type) {
      case 'progress': this.onEvent({ type: 'progress', file: msg.file, loaded: msg.loaded, total: msg.total }); break;
      case 'ready':
        this.ready = true; this.backendInfo = msg.backend; this.isolated = msg.crossOriginIsolated;
        // El OCR (≈12 MB) se prepara en segundo plano para que la primera carta no pague su arranque
        if (this.useOcr) this.timers.add(setTimeout(() => import('./ocr.js').then((m) => m.warmOcr(this.paths.ocr)).catch(() => {}), 2500));
        this.onEvent({ type: 'ready', backend: msg.backend, loadMs: msg.loadMs, games: msg.games, crossOriginIsolated: msg.crossOriginIsolated });
        if (this.game) this.recognizer.postMessage({ type: 'loadGame', name: this.game });
        this.onEvent({ type: 'status', status: 'buscando' });
        break;
      case 'gameLoaded': this.onEvent({ type: 'game_loaded', name: msg.name, count: msg.count, ms: msg.ms }); break;
      case 'dropped': { const job = this.jobs.get(msg.jobId); this.jobs.delete(msg.jobId); if (job?.still) this.onEvent({ type: 'error', code: 'dropped', message: 'No se pudo reconocer la foto. Intenta de nuevo.' }); break; }
      case 'byNumber': this.rescues.get(msg.reqId)?.(msg.candidates); this.rescues.delete(msg.reqId); break;
      case 'result': this.#onResult(msg); break;
      case 'error':
        if (msg.jobId) { this.jobs.delete(msg.jobId); this.tracker.retry(); }
        this.onEvent({ type: 'error', code: msg.code, message: msg.message, for: msg.for });
        break;
      default: break;
    }
  }

  async #onResult(msg) {
    const job = this.jobs.get(msg.jobId); this.jobs.delete(msg.jobId);
    if (!job || job.generation !== this.tracker.generation) return; // resultado obsoleto: la carta cambió mientras se calculaba
    this.#push('embedMs', msg.embedMs); this.#push('searchMs', msg.searchMs);
    const adapter = adapterForCatalogGame(this.game);
    const candidates = msg.candidates.map((c) => ({ id: String(c.meta.productId), score: c.score, meta: c.meta }));
    globalThis.__visorTop = candidates.slice(0, 5).map((c) => c.meta.name + ' ' + c.score.toFixed(3)); // diagnóstico
    let result = fuse({ candidates, adapter });
    const needsOcr = result.status !== 'confirmado';
    // OCR solo si lo visual no basta para fijar la impresión y hay números distintos entre los candidatos cercanos
    const nums = new Set(candidates.filter((c) => c.score >= candidates[0].score - 0.12).map((c) => adapter.canonNumber(c.meta.number)).filter(Boolean));
    const canRead = this.useOcr && job.hires && needsOcr && candidates.length > 0 && candidates[0].score >= 0.6;
    if (canRead && (result.status === 'sin_coincidencias' || nums.size > 1 || adapter.nameRegion)) {
      this.onEvent({ type: 'result', provisional: true, result, generation: job.generation, rotated: msg.rotated, timings: this.#timings(job, msg) });
      try {
        const { readRegions } = await import('./ocr.js');
        const num = await withTimeout(readRegions({ hires: job.hires, regions: adapter.ocrRegions, base: this.paths.ocr }), OCR_TIMEOUT_MS);
        if (job.generation !== this.tracker.generation) return;
        const parsed = adapter.parseOcr(num.text), pool = await this.#rescueByNumber(candidates, parsed.number, adapter);
        result = fuse({ candidates: pool, ocr: { ...parsed, raw: num.text }, adapter });
        let nm = { text: '', ms: 0 };
        if (result.status !== 'confirmado' && adapter.nameRegion) { // el nombre solo se lee si el número no bastó (ahorra ~200 ms en el caso habitual)
          nm = await withTimeout(readRegions({ hires: job.hires, regions: [adapter.nameRegion], base: this.paths.ocr, mode: 'name' }), OCR_TIMEOUT_MS);
          if (job.generation !== this.tracker.generation) return;
          result = fuse({ candidates: pool, ocr: { ...parsed, name: cleanOcrName(nm.text), raw: num.text }, adapter });
        }
        job.ocrMs = num.ms + nm.ms;
        this.lastOcr = { number: num.text.trim(), name: nm.text.trim() }; globalThis.__visorOcr = this.lastOcr; // diagnóstico (solo texto, nunca imágenes)
      } catch (error) { // sin OCR (o colgado, p. ej. en iOS) se entrega el resultado solo por imagen en vez de esperar para siempre
        import('./ocr.js').then((m) => m.disposeOcr()).catch(() => {});
        this.onEvent({ type: 'ocr_unavailable', message: String(error?.message || error) });
      }
    }
    this.tracker.hold(this.lastSignature);
    this.locked = true; // con resultado en pantalla no se analiza nada más hasta «Siguiente carta» / «Intentar de nuevo» (rescan)
    this.#push('e2eMs', performance.now() - job.startedAt);
    globalThis.__visorTimings = { ...this.#timings(job, msg), cropMs: this.stats.cropMs.at(-1), isolated: this.isolated }; // diagnóstico
    this.onEvent({ type: 'result', provisional: false, result, generation: job.generation, rotated: msg.rotated, timings: this.#timings(job, msg) });
  }

  /** Si el número impreso (a/b) no está entre los candidatos visuales, se añaden las impresiones con ese número; quedan marcadas `rescued` (nunca «confirmado»). */
  async #rescueByNumber(candidates, number, adapter) {
    if (!number || !number.includes('/') || candidates.some((c) => adapter.canonNumber(c.meta.number) === number)) return candidates;
    const reqId = this.nextId++, extra = await new Promise((resolve) => { this.rescues.set(reqId, resolve); this.recognizer.postMessage({ type: 'byNumber', reqId, game: this.game, number }); setTimeout(() => { this.rescues.delete(reqId); resolve([]); }, 2000); });
    globalThis.__visorRescue = { number, found: extra.map((c) => c.meta.name + ' ' + c.meta.number + ' ' + c.score.toFixed(3)) }; // diagnóstico
    const seen = new Set(candidates.map((c) => c.id)), added = extra.map((c) => ({ id: String(c.meta.productId), score: c.score, meta: c.meta, rescued: true })).filter((c) => !seen.has(c.id));
    return [...candidates, ...added].sort((a, b) => b.score - a.score);
  }

  #timings(job, msg) { return { embedMs: msg.embedMs, searchMs: msg.searchMs, ocrMs: job.ocrMs ?? null, totalMs: Math.round(performance.now() - job.startedAt) }; }
  #push(key, v) { const a = this.stats[key]; a.push(v); if (a.length > 200) a.shift(); }
}
