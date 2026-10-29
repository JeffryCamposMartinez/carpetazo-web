// Sesión de escaneo: historial de identificaciones y acciones sobre el inventario, SEPARADO del reconocimiento visual.
// Reconocer ≠ guardar: una identificación solo cambia el inventario cuando el usuario la confirma y la envía.

let counter = 0;

export class ScanSession {
  constructor() { this.entries = []; this.listeners = new Set(); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  #emit() { this.listeners.forEach((fn) => fn(this.entries)); }

  /** Registra una identificación (una por presentación de carta). `generation` evita contar dos veces la misma presentación. */
  record({ generation, result, game }) {
    if (!result?.best || result.status === 'sin_coincidencias') return null; // sin coincidencia no es una carta detectada: no entra a la lista
    const existing = this.entries.find((e) => e.generation === generation);
    if (existing) { existing.result = result; this.#emit(); return existing; } // la misma carta re-evaluada (p. ej. tras OCR): se actualiza, no se duplica
    // La misma carta ya registrada (aunque se re-detecte tras un temblor o volver a mostrarla) no se repite: sube al inicio y se cambia la cantidad con +
    const pid = result?.best?.meta?.productId, dup = result?.status !== 'ambiguo' && pid != null && this.entries.find((e) => e.state !== 'descartada' && e.game === game && e.result?.status !== 'ambiguo' && this.chosen(e)?.meta?.productId === pid);
    // Ambiguas: la misma carta mostrada de nuevo da el mismo conjunto de impresiones → no se duplica
    const altKey = (x) => (x?.alternatives || []).map((a) => a.meta.productId).sort().join(',');
    const sameSet = result.status === 'ambiguo' && this.entries.find((e) => e.state !== 'descartada' && e.game === game && !e.choice && e.result?.status === 'ambiguo' && altKey(e.result) === altKey(result));
    if (sameSet) { this.entries = [sameSet, ...this.entries.filter((e) => e !== sameSet)]; this.#emit(); return sameSet; }
    if (dup) { this.entries = [dup, ...this.entries.filter((e) => e !== dup)]; this.#emit(); return dup; }
    const entry = { entryId: `s${++counter}`, generation, game, result, choice: null, qty: 1, state: 'pendiente', at: Date.now(), error: null };
    this.entries.unshift(entry); this.#emit();
    return entry;
  }

  /** La impresión que el usuario eligió entre alternativas (o la del sistema si es única). */
  chosen(entry) { return entry.choice || entry.result?.best || null; }
  choose(entryId, candidate) { const e = this.#get(entryId); e.choice = candidate; this.#emit(); }
  setQty(entryId, qty) { const e = this.#get(entryId); e.qty = Math.max(1, Math.min(999, Math.trunc(qty) || 1)); this.#emit(); }
  discard(entryId) { this.#get(entryId).state = 'descartada'; this.#emit(); }
  #get(id) { const e = this.entries.find((x) => x.entryId === id); if (!e) throw new Error('Entrada desconocida'); return e; }

  /** Estados: pendiente → guardando → guardada | error. Una entrada guardada o en curso no se reenvía (idempotente). */
  async commit(entryId, inventory, folderId) {
    const e = this.#get(entryId), pick = this.chosen(e);
    if (e.state === 'guardada' || e.state === 'guardando' || e.state === 'descartada') return e;
    if (!pick || !pick.meta?.productId) { e.state = 'error'; e.error = 'No hay una impresión elegida'; this.#emit(); return e; }
    if (e.result.status === 'ambiguo' && !e.choice) { e.state = 'error'; e.error = 'Elige la impresión antes de guardar'; this.#emit(); return e; }
    e.state = 'guardando'; e.error = null; this.#emit();
    try { await inventory.addCard({ folderId, productId: pick.meta.productId, game: e.game, name: pick.meta.name, qty: e.qty }); e.state = 'guardada'; }
    catch (error) { e.state = 'error'; e.error = error.message || 'No se pudo guardar'; }
    this.#emit();
    return e;
  }

  /** Resumen al terminar: totales por carta (agrupadas por impresión) y qué quedó pendiente. */
  summary() {
    const by = new Map(), live = this.entries.filter((e) => e.state !== 'descartada');
    for (const e of live) {
      const pick = this.chosen(e); if (!pick) continue;
      const key = `${e.game}:${pick.meta.productId}`, row = by.get(key) || { key, game: e.game, name: pick.meta.name, set: pick.meta.setName, number: pick.meta.number, productId: pick.meta.productId, qty: 0, saved: 0 };
      row.qty += e.qty; if (e.state === 'guardada') row.saved += e.qty; by.set(key, row);
    }
    return { cards: [...by.values()], total: live.reduce((s, e) => s + e.qty, 0), saved: live.filter((e) => e.state === 'guardada').reduce((s, e) => s + e.qty, 0), pending: live.filter((e) => e.state === 'pendiente').length, errors: live.filter((e) => e.state === 'error').length };
  }
}
