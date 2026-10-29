// Contrato de inventario: el escáner NO sabe cómo se guarda una carta; recibe un adaptador con `addCard`.
//   addCard({ folderId, productId, game, name, qty }) → Promise<{ created:boolean, stock:number }>
// El servidor valida propiedad, plan y límites (POST /api/folders/:id/cards); el cliente nunca decide permisos.

/** Adaptador real de Carpetazo (se usa al integrarlo en el frontend con la sesión de Firebase). */
export const createCarpetazoInventory = ({ apiBase = '/api', getToken, fetchImpl = (...a) => fetch(...a) }) => {
  const call = async (path, options = {}) => {
    const token = await getToken?.();
    if (!token) throw Object.assign(new Error('Inicia sesión para guardar cartas'), { code: 'auth_required' });
    const res = await fetchImpl(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || body.error || 'No se pudo guardar'), { code: body.code || `http_${res.status}`, status: res.status, body });
    return body;
  };
  return {
    async addCard({ folderId, productId, name, qty = 1 }) {
      const id = encodeURIComponent(folderId);
      try {
        const out = await call(`/folders/${id}/cards`, { method: 'POST', body: JSON.stringify({ tcgId: String(productId), name, stock: qty, data: {} }) });
        return { created: true, stock: out.card?.stock ?? qty };
      } catch (error) {
        // Ya existía en la carpeta: se suma a su stock con las operaciones existentes (nunca se duplica la carta)
        const existing = error.body?.details?.existingCardId;
        if (error.code !== 'card_identity_conflict' || !existing) throw error;
        const folder = await call(`/folders/${id}`), current = (folder.folder?.cards || folder.cards || []).find((c) => c.id === existing);
        if (!current) throw error;
        const stock = (Number(current.stock) || 0) + qty;
        await call(`/folders/${id}/cards/${encodeURIComponent(existing)}`, { method: 'PUT', body: JSON.stringify({ stock }) });
        return { created: false, stock };
      }
    },
  };
};

/** Adaptador sin sesión (app aislada): no guarda nada; la UI solo ofrece abrir la ficha. */
export const noInventory = { addCard: async () => { throw Object.assign(new Error('Guardar en carpetas requiere iniciar sesión en Carpetazo'), { code: 'auth_required' }); } };
