import { useEffect, useState } from 'react';
import { api } from '../services/api';

// Identificador con el que la lista de deseadas guarda una carta: el mismo que arma el servidor a partir de lo que enviamos al agregarla
export const wishlistKeyOf = (payload) => {
  if (!payload) return '';
  if (payload.external?.productId !== undefined && payload.external?.productId !== null) return `tcgcsv:${payload.external.categoryId}:${payload.external.productId}`;
  return payload.productId ? String(payload.productId) : '';
};

// Qué cartas ya están en las listas de deseadas de la persona (identificador → id del ítem), para pintar el corazón lleno desde el inicio
export default function useWishlistIndex(enabled) {
  const [index, setIndex] = useState(() => new Map());
  useEffect(() => {
    if (!enabled) { setIndex(new Map()); return undefined; }
    let cancelled = false;
    api.getMyWishlist().then((response) => {
      if (cancelled) return;
      const next = new Map();
      for (const item of response.items || []) {
        if (!item.productId) continue;
        next.set(item.productId, item.id);
        if (item.productId.startsWith('myl:')) next.set(item.productId.slice(4), item.id); // las fichas del catálogo de Mitos traen el id sin el prefijo
      }
      setIndex(next);
    }).catch(() => { /* sin la lista, el corazón simplemente empieza vacío */ });
    return () => { cancelled = true; };
  }, [enabled]);
  return index;
}
