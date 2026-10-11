import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Sheet from './Sheet';
import LoadingState from '../ui/LoadingState';
import EmptyState from '../ui/EmptyState';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const TCG_LABELS = { Pokemon: 'Pokémon', OnePiece: 'One Piece', YuGiOh: 'Yu-Gi-Oh!' };
const tcgLabel = (value) => TCG_LABELS[value] || value;
const TABS = [['public', 'Públicas'], ['private', 'No públicas'], ['all', 'Todas']];

// Elegir una carta para mandarla en el chat: las mías de carpetas públicas, las mías de carpetas no públicas, o todas las que están a la venta en el sitio.
// Una carta de una carpeta no pública se ve en el chat sin enlace (no tiene página).
export default function CardPicker({ open, onClose, onPick, myUsername }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(myUsername ? 'public' : 'all');
  const [tcg, setTcg] = useState('');
  const [cards, setCards] = useState([]);
  const [tcgs, setTcgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { if (open) setTab(myUsername ? 'public' : 'all'); }, [open, myUsername]);
  useEffect(() => { setTcg(''); setTcgs([]); }, [tab]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim().length >= 2) params.set('q', query.trim());
      if (tcg) params.set('tcg', tcg);
      setLoading(true);
      setFailed(false);
      const request = tab === 'all' ? api.searchCards(params.toString()) : api.getMyCards(`${params.toString()}${params.size ? '&' : ''}scope=${tab}`);
      request
        .then((result) => {
          if (cancelled) return;
          setCards(result.success ? result.cards || [] : []);
          if (tab !== 'all' && result.success && !tcg) setTcgs(result.tcgs || []);
        })
        .catch(() => { if (!cancelled) { setFailed(true); setCards([]); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query, tab, tcg]);

  const emptyText = tab === 'private' ? 'No tienes cartas en carpetas no públicas con esos filtros.' : tab === 'public' ? 'No tienes cartas en carpetas públicas con esos filtros.' : 'Prueba con otro nombre o juego.';
  const sellerOf = (card) => (tab === 'all' ? card.folder?.user?.name || card.folder?.user?.username || 'Vendedor' : card.folderName);
  const gameOf = (card) => tcgLabel(tab === 'all' ? card.folder?.tcg : card.tcg);
  const gameChips = tab === 'all' ? ['Pokemon', 'Mitos y Leyendas', 'OnePiece', 'Magic', 'YuGiOh', 'Riftbound'] : tcgs;

  return (
    <Sheet open={open} onClose={onClose} title="Enviar una carta" full className="sm:max-w-lg">
      <div className="shrink-0 px-4 pb-2">
        <label className="flex h-12 items-center gap-2 rounded-full bg-slate-100 px-4 focus-within:ring-2 focus-within:ring-[#1e40af]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px] text-slate-500">search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por nombre de la carta" aria-label="Buscar carta" className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 p-0 text-[16px] text-slate-900 outline-none placeholder:text-slate-500" />
        </label>
        {myUsername && (
          <div role="tablist" aria-label="Origen de las cartas" className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
            {TABS.map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`h-9 rounded-full px-2 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${tab === value ? 'bg-[#1e40af] text-white shadow-sm' : 'text-slate-600 [@media(hover:hover)]:hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
        )}
        {gameChips.length > 0 && (
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por juego">
            {[['', 'Todos los juegos'], ...gameChips.map((value) => [value, tcgLabel(value)])].map(([value, label]) => (
              <button key={value || 'all'} type="button" onClick={() => setTcg(value)} aria-pressed={tcg === value} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${tcg === value ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-900/10 [@media(hover:hover)]:hover:bg-blue-50'}`}>{label}</button>
            ))}
          </div>
        )}
        {tab === 'private' && <p className="mt-1.5 text-xs text-slate-500">Estas cartas no tienen página: quien las reciba las verá en el chat, sin enlace.</p>}
      </div>
      <div className="min-h-[14rem] flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {loading && cards.length === 0 ? <LoadingState variant="compact" label="Buscando cartas…" />
          : failed ? <EmptyState variant="plain" icon="cloud_off" title="No pudimos buscar cartas">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          : cards.length === 0 ? <EmptyState variant="plain" icon="search_off" title="No encontramos cartas">{emptyText}</EmptyState>
          : (
            <ul>
              {cards.map((card) => (
                <li key={card.id}>
                  <button type="button" onClick={() => onPick(card)} className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100">
                    {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded bg-slate-200 object-cover" /> : <span className="h-14 w-10 shrink-0 rounded bg-slate-200" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-extrabold text-[#12315f]">{card.name}</span>
                      <span className="block truncate text-xs text-slate-500">{[gameOf(card), sellerOf(card)].filter(Boolean).join(' · ')}</span>
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
