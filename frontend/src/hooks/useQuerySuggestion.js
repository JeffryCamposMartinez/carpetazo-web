import { useEffect, useState } from 'react';
import { api } from '../services/api';

// «¿Quisiste decir…?»: pide al servidor el texto corregido un momento después de dejar de escribir
export default function useQuerySuggestion(query) {
  const [suggestion, setSuggestion] = useState('');
  useEffect(() => {
    const text = String(query || '').trim();
    setSuggestion('');
    if (text.length < 3) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.suggestCardQuery(text)
        .then((response) => { if (!cancelled && response?.suggestion && response.suggestion.toLowerCase() !== text.toLowerCase()) setSuggestion(response.suggestion); })
        .catch(() => {});
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);
  return suggestion;
}
