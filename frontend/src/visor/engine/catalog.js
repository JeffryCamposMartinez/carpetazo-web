// Ficha real de Carpetazo para un identificador reconocido. No se inventa ningún dato: lo que no llega, no se muestra.
export const SITE = 'https://carpetazo.cl';
const NUMERIC_ID = /^[1-9]\d{0,9}$/;

// Con la página aislada (COEP) las imágenes de otro dominio se bloquean: se piden por el mismo origen (/r2, proxy de vite)
export const imageUrlFor = (manifest, meta) => (meta?.imageKey && manifest?.imageBase ? `${globalThis.crossOriginIsolated ? '/r2' : manifest.imageBase}/${meta.imageKey.split('/').map(encodeURIComponent).join('/')}` : null);

/** Ficha pública: /api/tcg/card/:productId (precio solo si hay ofertas válidas en Carpetazo). */
export const loadCardSheet = async (productId, { apiBase = '/api', fetchImpl = (...a) => fetch(...a), signal } = {}) => {
  if (!NUMERIC_ID.test(String(productId))) return null; // p. ej. Mitos y Leyendas usa otro identificador
  try {
    const res = await fetchImpl(`${apiBase}/tcg/card/${productId}`, { signal });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body.success) return null;
    const low = Number.isFinite(body.low) && body.low > 0 ? body.low : null;
    return { card: body.card, low, high: Number.isFinite(body.high) && body.high > 0 ? body.high : null, offers: body.offers?.length || 0, path: body.card?.path || null };
  } catch { return null; }
};

export const cardPageUrl = (sheet, meta) => (sheet?.path ? `${SITE}${sheet.path}` : NUMERIC_ID.test(String(meta?.productId)) ? `${SITE}/catalogo/${meta.productId}` : `${SITE}/explorar?q=${encodeURIComponent(meta?.name || '')}`);
