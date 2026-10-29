// Seguimiento temporal de la carta: decide CUÁNDO reconocer (una vez por carta) y cuándo es otra carta.
// El tiempo se inyecta (`now` en ms) para poder probarlo sin reloj real.
//
// Estados: idle → tracking → stable (dispara 1 reconocimiento) → held (carta ya reconocida, sin repetir) → idle
import { signatureDistance } from './quality.js';

export class CardTracker {
  constructor({ stableMs = 250, maxDrift = 0.018, lostMs = 500, changeThreshold = 14 } = {}) {
    Object.assign(this, { stableMs, maxDrift, lostMs, changeThreshold });
    this.reset();
  }

  reset() { this.state = 'idle'; this.last = null; this.steadySince = 0; this.steadyFrames = 0; this.lastSeen = -Infinity; this.heldSignature = null; this.generation = (this.generation || 0) + 1; }

  /** Desplazamiento medio de las esquinas entre dos fotogramas, en fracción del encuadre. */
  static drift(a, b) { let s = 0; for (let i = 0; i < 4; i++) s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]); return s / 4; }

  /**
   * @param {{corners:number[][]}|null} detection detección de este fotograma o null
   * @param {number} now ms
   * @returns {{state:string, trigger:boolean, drift:number|null, generation:number}}
   *   trigger=true UNA sola vez por carta: es el momento de recortar y reconocer.
   */
  update(detection, now) {
    if (!detection) {
      if (now - this.lastSeen > this.lostMs && this.state !== 'idle') this.reset();
      return { state: this.state, trigger: false, drift: null, generation: this.generation };
    }
    this.lastSeen = now;
    const prev = this.last;
    // Las esquinas del detector tiemblan ~1 px entre fotogramas aunque la carta esté quieta: se compara contra una media móvil
    const smooth = prev ? detection.corners.map((p, i) => [(p[0] + prev[i][0]) / 2, (p[1] + prev[i][1]) / 2]) : detection.corners;
    this.last = smooth;
    const drift = prev ? CardTracker.drift(prev, smooth) : null;
    const out = (trigger = false) => ({ state: this.state, trigger, drift, generation: this.generation });
    if (this.state === 'held') return out();
    if (this.state === 'idle') { this.state = 'tracking'; this.steadySince = now; this.steadyFrames = 1; return out(); }
    // Quieta = cada fotograma se movió menos de maxDrift; un movimiento reinicia la cuenta de estabilidad
    if (drift !== null && drift > this.maxDrift) { this.steadySince = now; this.steadyFrames = 1; if (this.state === 'stable') this.state = 'tracking'; return out(); }
    this.steadyFrames++;
    if (this.state === 'tracking' && this.steadyFrames >= 3 && now - this.steadySince >= this.stableMs) { this.state = 'stable'; return out(true); }
    return out();
  }

  /** El recorte no sirvió (borroso, modelo cargando…): vuelve a «tracking» y reintenta tras otra ventana de estabilidad. */
  retry() { if (this.state === 'stable') { this.state = 'tracking'; this.steadySince = this.lastSeen; this.steadyFrames = 1; } }

  /** Marca la carta actual como ya procesada: no vuelve a disparar hasta que cambie o desaparezca. */
  hold(signature) { this.state = 'held'; this.heldSignature = signature; }

  /** Con la carta en `held`, compara una firma nueva: si es distinta se libera para reconocer otra. */
  checkChanged(signature) {
    if (this.state !== 'held' || !this.heldSignature) return false;
    if (signatureDistance(this.heldSignature, signature) > this.changeThreshold) { this.reset(); return true; }
    return false;
  }
}
