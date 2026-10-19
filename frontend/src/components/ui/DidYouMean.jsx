import useQuerySuggestion from '../../hooks/useQuerySuggestion';

// «¿Quisiste decir…?» bajo un buscador de cartas; tocar la sugerencia la usa como búsqueda
export default function DidYouMean({ query, onPick, className = '' }) {
  const suggestion = useQuerySuggestion(query);
  if (!suggestion) return null;
  return (
    <p className={`text-sm font-semibold text-slate-600 ${className}`} aria-live="polite">
      ¿Quisiste decir{' '}
      <button type="button" onClick={() => onPick(suggestion)} className="rounded font-extrabold text-[#1e40af] underline decoration-[#facc15] decoration-2 underline-offset-4 transition-colors hover:text-[#12315f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">{suggestion}</button>?
    </p>
  );
}
