// Cámara: un único MediaStream, cámara trasera preferida, errores clasificados y liberación completa de pistas.

export const CAMERA_ERRORS = {
  unsupported: 'Este navegador no permite usar la cámara (o la página no está en HTTPS).',
  denied: 'Permiso de cámara denegado. Actívalo en los ajustes del sitio y vuelve a intentarlo.',
  not_found: 'No se encontró ninguna cámara en este dispositivo.',
  in_use: 'La cámara está siendo usada por otra aplicación.',
  overconstrained: 'La cámara no admite la resolución pedida.',
  unknown: 'No se pudo iniciar la cámara.',
};

export const classifyCameraError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'DevicesNotFoundError': return 'not_found';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return 'in_use';
    case 'OverconstrainedError': case 'ConstraintNotSatisfiedError': return 'overconstrained';
    default: return 'unknown';
  }
};

export class Camera {
  /** @param {HTMLVideoElement} video */
  constructor(video, { mediaDevices = globalThis.navigator?.mediaDevices } = {}) { Object.assign(this, { video, mediaDevices }); this.stream = null; this.starting = null; }

  get active() { return Boolean(this.stream?.getTracks().some((t) => t.readyState === 'live')); }

  /** Abre la cámara trasera. Idempotente: llamadas concurrentes comparten el mismo intento y nunca crean dos flujos. */
  async start() {
    if (this.stream) return this.stream;
    if (this.starting) return this.starting;
    if (!this.mediaDevices?.getUserMedia) throw Object.assign(new Error(CAMERA_ERRORS.unsupported), { code: 'unsupported' });
    this.starting = (async () => {
      try {
        // Primero resolución alta sin forzar (para leer texto pequeño); si el equipo no la admite, se relaja
        let stream;
        try { stream = await this.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }); }
        catch (e) { if (classifyCameraError(e) !== 'overconstrained') throw e; stream = await this.mediaDevices.getUserMedia({ audio: false, video: true }); }
        this.stream = stream;
        this.video.srcObject = stream; this.video.playsInline = true; this.video.muted = true;
        // Si el sistema detiene la pista (llamada, otra app), lo avisamos en vez de quedar con un vídeo congelado
        stream.getVideoTracks().forEach((t) => t.addEventListener('ended', () => { if (this.stream === stream) this.stop(); this.onEnded?.(); }));
        await this.video.play();
        return stream;
      } catch (error) {
        this.stop();
        const code = error.code || classifyCameraError(error);
        throw Object.assign(new Error(CAMERA_ERRORS[code] || CAMERA_ERRORS.unknown), { code, cause: error });
      } finally { this.starting = null; }
    })();
    return this.starting;
  }

  /** Detiene TODAS las pistas y suelta el vídeo (libera la luz de la cámara). */
  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) { try { this.video.pause(); } catch { /* sin vídeo */ } this.video.srcObject = null; }
  }

  get size() { return { width: this.video?.videoWidth || 0, height: this.video?.videoHeight || 0 }; }
}
