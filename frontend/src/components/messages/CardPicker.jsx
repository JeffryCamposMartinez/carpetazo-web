import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Sheet from './Sheet';
import LoadingState from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;

// Elegir una carta a la venta para mandarla en el chat (se ve con su foto, precio y un enlace a su página)
export default function CardPicker({ open, onClose, onPick, myUsername }) {
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim().length >= 2) params.set('q', query.trim());
      if (mine && myUsername) params.set('seller', myUsername.toLowerCase());
      setLoading(true);
      setFailed(false);
      api.searchCards(params.toString())
        .then((result) => { if (!cancelled) setCards(result.success ? result.cards || [] : []); })
        .catch(() => { if (!cancelled) { setFailed(true); setCards([]); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query, mine, myUsername]);

  return (
    <Sheet open={open} onClose={onClose} title="Enviar una carta" full className="sm:max-w-lg">
      <div className="shrink-0 px-4 pb-2">
        <label className="flex h-12 items-center gap-2 rounded-full bg-slate-100 px-4 focus-within:ring-2 focus-within:ring-[#1e40af]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px] text-slate-500">search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por nombre de la carta" aria-label="Buscar carta" className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 p-0 text-[16px] text-slate-900 outline-none placeholder:text-slate-500" />
        </label>
        {myUsername && (
          <div className="mt-2 flex gap-2">
            {[[false, 'Todas'], [true, 'Mis cartas']].map(([value, label]) => (
              <button key={label} type="button" onClick={() => setMine(value)} aria-pressed={mine === value} className={`h-9 rounded-full px-4 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${mine === value ? 'bg-[#1e40af] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-[14rem] flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {loading && cards.length === 0 ? <LoadingState variant="compact" label="Buscando cartas…" />
          : failed ? <EmptyState variant="plain" icon="cloud_off" title="No pudimos buscar cartas">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          : cards.length === 0 ? <EmptyState variant="plain" icon="search_off" title="No encontramos cartas">{mine ? 'Aún no tienes cartas a la venta con ese nombre.' : 'Prueba con otro nombre.'}</EmptyState>
          : (
            <ul>
              {cards.map((card) => (
                <li key={card.id}>
                  <button type="button" onClick={() => onPick(card)} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100">
                    {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded bg-slate-200 object-cover" /> : <span className="h-14 w-10 shrink-0 rounded bg-slate-200" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-extrabold text-[#12315f]">{card.name}</span>
                      <span className="block truncate text-xs text-slate-500">{card.folder?.user?.name || card.folder?.user?.username || 'Vendedor'}</span>
                    </span>
                    <span className="shrink-0 text-[15px] font-black tabular-nums text-[#12315f]">{Number(card.price) > 0 ? formatCLP(card.price) : 'Consultar'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </Sheet>
  );
}
