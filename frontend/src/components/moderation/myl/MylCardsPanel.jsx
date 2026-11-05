import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { useToast } from '../../ui/ToastProvider';
import SvgIcon from '../../ui/SvgIcon';
import { EmptyState, ErrorBox, ListSkeleton, Pills } from '../shared';
import MylCardForm from './MylCardForm';
import { titleCase } from './MylFields';

const subtitle = (card) => [card.edition, card.number, card.type && titleCase(card.type), card.frequency && titleCase(card.frequency)].filter(Boolean).join(' · ');

const ORIGIN = { mazos: ['Viene de mazos.cl', 'bg-slate-200 text-slate-700'], carpetazo: ['Agregada en Carpetazo', 'bg-[#facc15] text-[#12315f]'] };

function CardRow({ card, onEdit, showOrigin }) {
  return (
    <li className="mod-row-in flex gap-3 rounded-xl border border-[#dbe3f0] bg-white p-3">
      <div className="w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: '709 / 1016' }}>
        {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center text-center text-[10px] font-bold text-slate-500">Sin imagen</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold text-[#12315f]">{card.name}</p>
        {showOrigin && <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${ORIGIN[card.source][1]}`}>{ORIGIN[card.source][0]}</span>}
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{subtitle(card)}</p>
        {!card.imageUrl && <p className="mt-0.5 text-xs font-bold text-amber-800">Falta la imagen</p>}
      </div>
      {card.source === 'carpetazo' && <button type="button" onClick={() => onEdit(card)} className="flex h-11 shrink-0 items-center gap-1.5 self-center rounded-full bg-[#e8effc] px-4 text-sm font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-[#d6e2f8] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
        <SvgIcon name="edit" translate="no" aria-hidden="true" className="text-[18px]" />Editar
      </button>}
    </li>
  );
}

// Cartas de Mitos y Leyendas subidas a mano: crear las que faltan y corregir las que se subieron desde aquí (nadie borra desde esta sección)
export default function MylCardsPanel() {
  const { showToast } = useToast();
  const [options, setOptions] = useState(null);
  const [view, setView] = useState('new'); // new | list | search (buscar duplicadas en todo el catálogo)
  const [editing, setEditing] = useState(null);
  const [carry, setCarry] = useState({}); // la última carta subida: la siguiente parte con su bloque, edición y producto
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);

  const loadOptions = useCallback(() => api.getMylCardOptions().then(setOptions).catch((err) => setError(err.message || 'No se pudieron cargar las opciones.')), []);
  useEffect(() => { loadOptions(); }, [loadOptions]);

  useEffect(() => {
    if (view === 'new' || editing) return undefined;
    if (view === 'search' && query.trim().length < 2) { setList(null); return undefined; }
    let cancelled = false;
    setList(null);
    const timer = window.setTimeout(() => {
      api.getMylCards(query.trim(), page, view === 'search').then((res) => { if (!cancelled) setList(res); }).catch((err) => { if (!cancelled) { setList({ cards: [], total: 0, pages: 1 }); setError(err.message || 'No se pudo cargar la lista.'); } });
    }, query ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [view, editing, query, page]);

  const saved = (card, kind) => {
    loadOptions(); // la edición o el producto nuevos ya existen
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (kind === 'updated') {
      showToast(`«${card.name}» actualizada`, 'success');
      setEditing(null);
      return;
    }
    showToast(`«${card.name}» creada. Ya se ve en el catálogo.`, 'success');
    setCarry({ blockId: card.blockId, groupId: card.groupId, physicalProductId: card.physicalProductId ?? '', frequency: card.frequency });
    setFormKey((key) => key + 1);
  };

  if (!options) {
    return error ? <ErrorBox>{error}</ErrorBox> : <ListSkeleton rows={3} label="Cargando" />;
  }

  return (
    <section aria-label="Cartas de Mitos y Leyendas" className="mx-auto max-w-5xl">
      <ErrorBox>{error}</ErrorBox>
      {editing ? (
        <>
          <p className="mb-3 text-sm font-semibold text-slate-600">Editando <span className="font-extrabold text-[#12315f]">{editing.name}</span>. Puedes cambiar cualquier dato, su edición y su imagen.</p>
          <MylCardForm key={editing.productId} options={options} editing={editing} onSaved={saved} onCancel={() => setEditing(null)} />
        </>
      ) : (
        <>
          <Pills label="Vista" value={view} onChange={(next) => { setView(next); setPage(1); }} options={[['new', 'Subir carta nueva'], ['search', 'Buscar duplicadas'], ['list', 'Subidas desde aquí']]} />
          {view === 'new' ? (
            <>
              <p className="mb-3 max-w-2xl text-sm text-slate-600">Completa los datos como están en la carta. Al crearla queda de inmediato en el catálogo y en las búsquedas. La siguiente carta parte con el mismo bloque, edición y producto para subir varias seguidas.</p>
              <MylCardForm key={formKey} options={options} carry={carry} onSaved={saved} />
            </>
          ) : (
            <>
              {view === 'search' && <p className="mb-3 max-w-2xl text-sm text-slate-600">Busca por nombre en todo el catálogo de Mitos y Leyendas para ver si una carta ya existe y de dónde viene: de mazos.cl o agregada en Carpetazo. Solo se pueden editar las agregadas aquí.</p>}
              <div className="relative mb-3 max-w-md">
                <SvgIcon name="search" translate="no" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" />
                <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={view === 'search' ? 'Nombre de la carta (mín. 2 letras)' : 'Buscar por nombre'} aria-label="Buscar carta por nombre" className="h-12 w-full rounded-full border-2 border-[#12315f]/15 bg-white pl-11 pr-4 text-[15px] font-bold text-[#12315f] outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-medium placeholder:text-slate-400 focus:border-[#1e40af] focus:shadow-[0_0_0_3px_rgba(30,64,175,0.15)]" />
              </div>
              {view === 'search' && query.trim().length < 2 ? <EmptyState icon="search" title="Escribe el nombre de la carta">Verás todas las que coinciden y si vienen de mazos.cl o se agregaron en Carpetazo.</EmptyState> : list === null ? <ListSkeleton rows={4} label="Cargando cartas" /> : list.cards.length === 0 ? (
                <EmptyState icon="library_add" title={query ? 'No hay cartas con ese nombre' : 'Aún no hay cartas subidas desde aquí'}>{query ? 'Prueba con otra parte del nombre.' : 'Las cartas que subas aparecerán aquí para corregirlas cuando quieras.'}</EmptyState>
              ) : (
                <>
                  <p className="mb-2 text-sm font-semibold text-slate-600">{list.total} {list.total === 1 ? 'carta' : 'cartas'}{view === 'list' ? ', las más nuevas primero' : ''}</p>
                  <ul className="grid gap-2 md:grid-cols-2">{list.cards.map((card) => <CardRow key={card.productId} card={card} onEdit={setEditing} showOrigin={view === 'search'} />)}</ul>
                  {list.pages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-11 rounded-full border-2 border-[#1e40af] px-5 text-sm font-extrabold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-[#e8effc] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Anterior</button>
                      <span className="text-sm font-bold text-slate-600">Página {page} de {list.pages}</span>
                      <button type="button" disabled={page >= list.pages} onClick={() => setPage(page + 1)} className="h-11 rounded-full border-2 border-[#1e40af] px-5 text-sm font-extrabold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-[#e8effc] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Siguiente</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
