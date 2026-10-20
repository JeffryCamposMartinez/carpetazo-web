import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import { EmptyState, ErrorBox, ListSkeleton, Pills, ROW, dateTime } from './shared';

const STATUS = { ok: ['Completa', 'bg-emerald-600'], partial: ['Incompleta (sigue la próxima noche)', 'bg-amber-500'], failed: ['Fallida', 'bg-red-600'] };
const SECTIONS = [['cards', 'Cartas nuevas'], ['products', 'Productos nuevos'], ['filled', 'Imágenes completadas'], ['changes', 'Correcciones']];
const EMPTY = {
  cards: 'En esta corrida no entraron cartas nuevas.', products: 'En esta corrida no entraron productos nuevos (sobres, cajas, mazos).',
  filled: 'En esta corrida no se completó ninguna imagen que faltaba.', changes: 'TCGplayer no corrigió ninguna carta que ya estaba en el catálogo.',
};
const FIELD = { name: 'Nombre', number: 'Número', rarity: 'Rareza', kind: 'Tipo', attributes: 'Datos', sourceImageUrl: 'Imagen de origen', tcgplayerUrl: 'Enlace' };
const show = (value) => (value && typeof value === 'object' ? 'cambió' : value === null || value === undefined || value === '' ? '—' : String(value));

const duration = (seconds) => (seconds === undefined ? '' : seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`);

function CardTile({ item }) {
  return (
    <li className="min-w-0">
      <div className="aspect-[5/7] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
          : <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-semibold text-slate-500"><SvgIcon name="image_not_supported" translate="no" aria-hidden="true" className="text-[28px]" />Sin imagen todavía</div>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-extrabold leading-tight text-[#12315f]">{item.name}</p>
      <p className="line-clamp-2 text-xs text-slate-600">{[item.game, item.edition, item.number].filter(Boolean).join(' · ')}</p>
    </li>
  );
}

function ChangeRow({ item }) {
  const fields = Object.keys(item.after || {});
  return (
    <li className={`${ROW} p-3`}>
      <p className="text-[15px] font-extrabold text-[#12315f]">{item.card?.name || 'Carta'}<span className="ml-2 text-xs font-semibold text-slate-500">{[item.card?.game, item.card?.edition].filter(Boolean).join(' · ')}</span></p>
      <dl className="mt-1.5 space-y-1 text-sm">
        {fields.map((field) => (
          <div key={field} className="flex flex-wrap gap-x-2"><dt className="font-bold text-slate-600">{FIELD[field] || field}:</dt><dd className="min-w-0 break-words text-slate-700"><span className="text-slate-500 line-through">{show(item.before?.[field])}</span> → <span className="font-semibold text-slate-900">{show(item.after[field])}</span></dd></div>
        ))}
      </dl>
    </li>
  );
}

// Reporte (solo lectura) de lo que entró en cada corrida de la sincronización nocturna con TCGplayer
export default function CatalogSyncPanel() {
  const [overview, setOverview] = useState(null);
  const [runId, setRunId] = useState('');
  const [section, setSection] = useState('cards');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api.getCatalogSync(runId).then((res) => { setOverview(res); if (!runId && res.selectedId) setRunId(res.selectedId); }).catch((err) => { setOverview({ runs: [], counts: null }); setError(err.message || 'No se pudo cargar el reporte.'); });
  }, [runId]);

  const load = useCallback((page, append) => {
    if (!runId) return Promise.resolve();
    return api.getCatalogSyncItems(runId, section, page).then((res) => setList((prev) => (append && prev ? { ...res, items: [...prev.items, ...res.items] } : res))).catch((err) => { setError(err.message || 'No se pudo cargar la lista.'); setList({ items: [], total: 0, page: 1, pages: 1 }); });
  }, [runId, section]);
  useEffect(() => { setList(null); load(1, false); }, [load]);

  const run = overview?.runs?.find((item) => item.id === runId);
  const summary = run?.summary || {};
  const counts = overview?.counts;
  const [statusLabel, statusDot] = STATUS[run?.status] || ['', 'bg-slate-300'];
  const tiles = [['Cartas nuevas', counts?.cards], ['Productos nuevos', counts?.products], ['Imágenes subidas', summary.imagesUploaded], ['Correcciones por revisar', counts?.changes]];

  if (overview && overview.runs.length === 0) {
    return <EmptyState icon="sync" title="Todavía no hay corridas">{overview.running ? 'La primera sincronización está en curso. Cuando termine, aparecerá aquí.' : 'Cuando la tarea nocturna de Coolify corra por primera vez, aquí verás lo que entró.'}</EmptyState>;
  }

  return (
    <section aria-label="Sincronización con TCGplayer" className="mx-auto max-w-5xl">
      <ErrorBox>{error}</ErrorBox>
      {!overview ? <ListSkeleton rows={3} label="Cargando el reporte" /> : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm font-bold text-slate-700">Corrida
              <select value={runId} onChange={(event) => setRunId(event.target.value)} className="mt-1 block h-11 rounded-xl border border-slate-300 bg-white px-3 text-[15px] font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                {overview.runs.map((item) => <option key={item.id} value={item.id}>{dateTime(item.startedAt)}</option>)}
              </select>
            </label>
            {run && <p className="flex items-center gap-2 pb-2.5 text-sm font-bold text-slate-700"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />{statusLabel}{summary.seconds !== undefined && <span className="font-semibold text-slate-500">· {duration(summary.seconds)}</span>}</p>}
            {overview.running && <p className="pb-2.5 text-sm font-bold text-[#1e40af]">Hay una corrida en curso ahora.</p>}
          </div>
          <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#dbe3f0] bg-white p-3"><dd className="text-2xl font-black tabular-nums text-[#12315f]">{(value ?? 0).toLocaleString('es-CL')}</dd><dt className="text-xs font-semibold text-slate-600">{label}</dt></div>
            ))}
          </dl>
          <Pills label="Qué entró" value={section} onChange={setSection} options={SECTIONS} counts={counts ? { cards: counts.cards, products: counts.products, filled: counts.filled, changes: counts.changes } : undefined} />
          {list === null ? <ListSkeleton rows={3} label="Cargando" /> : list.items.length === 0 ? (
            <EmptyState icon="inventory_2" title="Nada en esta sección">{EMPTY[section]}</EmptyState>
          ) : (
            <>
              {section === 'changes'
                ? <ul className="space-y-2">{list.items.map((item) => <ChangeRow key={item.id} item={item} />)}</ul>
                : <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{list.items.map((item) => <CardTile key={item.productId} item={item} />)}</ul>}
              {list.page < list.pages && (
                <div className="mt-4 flex justify-center">
                  <button type="button" disabled={loadingMore} onClick={async () => { setLoadingMore(true); await load(list.page + 1, true); setLoadingMore(false); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-[#12315f] px-6 text-sm font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-[#e8effc] active:scale-[0.97] disabled:opacity-60">{loadingMore && <ButtonSpinner tone="dark" />}Mostrar más ({list.items.length} de {list.total})</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
