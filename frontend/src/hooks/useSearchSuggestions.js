import { useCallback, useState } from 'react';
import { api } from '../services/api';

const KEY = 'carpetazo:recent-searches';
const MAX_RECENT = 6;
let popularRequest = null; // una sola consulta por visita; el servidor ya la guarda 5 minutos

// Una búsqueda se guarda solo si parece el nombre de una carta: sin correos, teléfonos ni textos largos
export const isSearchable = (text) => text.length >= 2 && text.length <= 60 && !/@|https?:|\d{6,}/i.test(text);

const readRecent = () => {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && isSearchable(item)).slice(0, MAX_RECENT) : [];
  } catch (_error) { return []; }
};
const writeRecent = (list) => { try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch (_error) { /* sin almacenamiento: solo dura esta visita */ } };

// Búsquedas recientes (solo en este navegador) y populares (de todos los compradores) del buscador del encabezado
export default function useSearchSuggestions() {
  const [recent, setRecent] = useState(readRecent);
  const [popular, setPopular] = useState([]);

  const remember = useCallback((term) => {
    if (!isSearchable(term)) return;
    setRecent((previous) => {
      const next = [term, ...previous.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);
  const remove = useCallback((term) => setRecent((previous) => { const next = previous.filter((item) => item !== term); writeRecent(next); return next; }), []);
  const clear = useCallback(() => { writeRecent([]); setRecent([]); }, []);
  const loadPopular = useCallback(() => {
    popularRequest ||= api.getPopularSearches().then((res) => (res?.success && Array.isArray(res.terms) ? res.terms : [])).catch(() => { popularRequest = null; return []; });
    popularRequest.then(setPopular);
  }, []);

  return { recent, popular, remember, remove, clear, loadPopular };
}
