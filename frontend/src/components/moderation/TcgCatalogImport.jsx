import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { ErrorBox, ListSkeleton } from './shared';
import { ConfirmDialog, Stepper, sizeLabel } from './CatalogImportParts';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

const fmt = (value) => Number(value || 0).toLocaleString('es-CL');

const Fact = ({ value, label, tone = 'text-[#12315f]' }) => (
  <div className="bg-white px-4 py-3">
    <dd className={`text-2xl font-extrabold tabular-nums leading-none ${tone}`}>{value}</dd>
    <dt className="mt-1.5 text-xs font-semibold text-slate-600">{label}</dt>
  </div>
);

const readJson = async (file) => {
  try { return JSON.parse(await file.text()); } catch { return null; }
};

// Carga del catálogo de TCGplayer: uno o varios archivos cartas_incrementales_tcg_*.json (los exporta TcgplayerUpdate).
// Cada archivo se revisa y se carga por separado; si algo falla a medias, se vuelve a elegir la misma carpeta y lo ya cargado figura como "sin cambios".
export default function TcgCatalogImport({ files, onReset }) {
  const [stage, setStage] = useState('reviewing'); // reviewing | review | applying | done
  const [progress, setProgress] = useState({ done: 0, total: files.length, name: '' });
  const [results, setResults] = useState([]); // { name, size, plan?, error?, applied? }
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const runId = useRef(0);

  const review = useCallback(async () => {
    const id = ++runId.current;
    setStage('reviewing');
    setError('');
    const collected = [];
    for (const [index, file] of files.entries()) {
      if (id !== runId.current) return;
      setProgress({ done: index, total: files.length, name: file.name });
      const data = await readJson(file);
      if (!data) { collected.push({ name: file.name, size: file.size, error: 'No es un JSON válido.' }); continue; }
      try {
        const plan = await api.previewTcgCatalogImport(file.name, data);
        collected.push({ name: file.name, size: file.size, plan });
      } catch (err) {
        collected.push({ name: file.name, size: file.size, error: err.message || 'No se pudo revisar el archivo.' });
      }
    }
    if (id !== runId.current) return;
    setResults(collected);
    setStage('review');
  }, [files]);

  useEffect(() => { review(); return () => { runId.current += 1; }; }, [review]);

  const plans = results.filter((item) => item.plan).map((item) => item.plan);
  const total = (field) => plans.reduce((sum, plan) => sum + (plan.counts[field] || 0), 0);
  const failedFiles = results.filter((item) => item.error);
  const fileErrors = results.flatMap((item) => (item.plan?.errors || []).map((entry) => ({ ...entry, file: item.name })));
  const hasProblems = failedFiles.length > 0 || fileErrors.length > 0;
  const pending = total('new') + total('updated') + total('newSets') + total('changedSets') + total('newGames');
  const loadable = stage === 'review' && !hasProblems && pending > 0;
  const games = [...plans.flatMap((plan) => plan.games).reduce((map, game) => {
    const row = map.get(game.categoryId) || { ...game, new: 0, updated: 0, exists: 0 };
    row.new += game.new; row.updated += game.updated; row.exists += game.exists;
    return map.set(game.categoryId, row);
  }, new Map()).values()];
  const missingImages = plans.reduce((sum, plan) => sum + (plan.images?.missing?.length || 0), 0);
  const checkedImages = plans.reduce((sum, plan) => sum + (plan.images?.checked || 0), 0);
  const samples = (plans.find((plan) => plan.cards.some((card) => card.status !== 'exists'))?.cards || []).filter((card) => card.status !== 'exists').slice(0, 12);

  const apply = async () => {
    setConfirming(false);
    setStage('applying');
    setError('');
    const id = ++runId.current;
    const todo = results.filter((item) => item.plan?.canApply);
    const totals = { created: 0, updated: 0, existing: 0, newGames: 0, newSets: 0 };
    for (const [index, item] of todo.entries()) {
      if (id !== runId.current) return;
      setProgress({ done: index, total: todo.length, name: item.name });
      const file = files.find((candidate) => candidate.name === item.name);
      const data = file && await readJson(file);
      try {
        if (!data) throw new Error('No se pudo leer el archivo.');
        const res = await api.applyTcgCatalogImport(item.name, data, item.plan.digest);
        totals.created += res.created; totals.updated += res.updated; totals.existing += res.existing; totals.newGames += res.newGames; totals.newSets += res.newSets;
      } catch (err) {
        setSummary({ ...totals, filesDone: index, filesTotal: todo.length });
        setError(`Se detuvo en ${item.name}: ${err.message || 'no se pudo cargar'}. Lo anterior ya quedó cargado; vuelve a elegir los archivos para continuar.`);
        setStage('done');
        return;
      }
    }
    setSummary({ ...totals, filesDone: todo.length, filesTotal: todo.length });
    setStage('done');
  };

  const step = stage === 'reviewing' ? 1 : stage === 'review' ? 1 : stage === 'applying' ? 2 : 3;
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const shownErrors = showErrors ? fileErrors : fileErrors.slice(0, 5);

  return (
    <section aria-label="Carga del catálogo de TCGplayer" className="mx-auto max-w-3xl">
      <Stepper current={step} />
      <ErrorBox>{error}</ErrorBox>

      {(stage === 'reviewing' || stage === 'applying') && (
        <div>
          <div role="status" className="mb-4 rounded-2xl border border-[#dbe3f0] bg-white p-4">
            <div className="flex items-center gap-3">
              <ButtonSpinner tone="dark" className="!h-5 !w-5 !border-[#1e40af]/25 !border-t-[#1e40af]" />
              <p className="text-sm font-bold text-slate-700">{stage === 'reviewing' ? 'Revisando' : 'Cargando'} {progress.done + 1} de {progress.total}: <span className="font-semibold text-slate-500">{progress.name}</span></p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1e40af] transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
          </div>
          <ListSkeleton rows={3} label="Procesando archivos" />
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-4 pb-24 sm:pb-0">
          <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 ${hasProblems ? 'border-red-200 bg-red-50 text-red-900' : pending > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-[#dbe3f0] bg-white text-[#12315f]'}`}>
            <SvgIcon name={hasProblems ? 'error' : pending > 0 ? 'check_circle' : 'task_alt'} translate="no" aria-hidden="true" className="mt-0.5 text-[26px]" />
            <div className="min-w-0">
              <p className="text-base font-extrabold leading-snug">
                {hasProblems ? `Hay ${fileErrors.length + failedFiles.length} ${fileErrors.length + failedFiles.length === 1 ? 'problema' : 'problemas'} en los archivos` : pending > 0 ? `Listo para cargar: ${[total('new') > 0 && `${fmt(total('new'))} nuevas`, total('updated') > 0 && `${fmt(total('updated'))} correcciones`].filter(Boolean).join(' y ') || 'ediciones y juegos nuevos'}` : 'No hay nada nuevo que cargar'}
              </p>
              <p className="mt-0.5 text-sm leading-snug opacity-90">{hasProblems ? 'No se puede cargar hasta corregir los archivos. Nada se guardó.' : pending > 0 ? 'Las cartas nuevas se agregan al catálogo; las correcciones cambian los datos de cartas que ya existen.' : 'Todo lo de estos archivos ya está en la base.'}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#dbe3f0] bg-[#dbe3f0] sm:grid-cols-5">
            <Fact value={fmt(total('new'))} label="Nuevas" tone={total('new') > 0 ? 'text-[#1e40af]' : 'text-slate-500'} />
            <Fact value={fmt(total('updated'))} label={total('updated') === 1 ? 'Se corrige' : 'Se corrigen'} tone={total('updated') > 0 ? 'text-[#92400e]' : 'text-slate-500'} />
            <Fact value={fmt(total('exists'))} label="Sin cambios" tone="text-slate-600" />
            <Fact value={fmt(total('newSets'))} label="Ediciones nuevas" />
            <Fact value={games.length} label={games.length === 1 ? 'Juego' : 'Juegos'} />
          </dl>

          {hasProblems && (
            <section aria-label="Problemas de los archivos" className="rounded-2xl border border-red-200 bg-white p-4">
              <h3 className="text-sm font-extrabold text-red-800">Qué hay que corregir</h3>
              <ul className="mt-2 space-y-2">
                {failedFiles.map((item) => <li key={item.name} className="text-sm"><b className="break-words text-slate-800">{item.name}</b><span className="block text-slate-700">{item.error}</span></li>)}
                {shownErrors.map((entry, index) => (
                  <li key={`${entry.file}-${entry.productId}-${index}`} className="text-sm"><b className="break-words text-slate-800">{entry.name}</b>{entry.productId ? <span className="text-slate-500"> · ID {entry.productId}</span> : null}<span className="text-slate-500"> · {entry.file}</span><span className="block text-slate-700">{entry.message}</span></li>
                ))}
              </ul>
              {fileErrors.length > 5 && <button type="button" onClick={() => setShowErrors((value) => !value)} className="mt-3 h-10 rounded-full px-4 text-sm font-bold text-[#1e40af] transition-colors hover:bg-blue-50">{showErrors ? 'Ver menos' : `Ver los ${fileErrors.length} problemas`}</button>}
            </section>
          )}

          {games.length > 0 && (
            <section aria-label="Juegos del catálogo" className="rounded-2xl border border-[#dbe3f0] bg-white">
              <h3 className="border-b border-[#dbe3f0] px-4 py-3 text-sm font-extrabold text-[#12315f]">Juegos</h3>
              <ul className="divide-y divide-[#eef2fa]">
                {games.map((game) => (
                  <li key={game.categoryId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <p className="flex items-center gap-2 text-[15px] font-bold text-slate-800"><span className="truncate">{game.name}</span>{game.isNew && <span className="shrink-0 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-bold text-[#92400e]">Juego nuevo</span>}</p>
                    <p className="text-sm tabular-nums text-slate-600"><b className={game.new > 0 ? 'text-[#1e40af]' : 'text-slate-500'}>{fmt(game.new)} nuevas</b>{game.updated > 0 ? <span className="text-[#92400e]"> · {fmt(game.updated)} se corrigen</span> : null}{game.exists > 0 ? <span className="text-slate-500"> · {fmt(game.exists)} sin cambios</span> : null}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {checkedImages > 0 && (
            <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${missingImages ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-[#dbe3f0] bg-white text-slate-700'}`}>
              <SvgIcon name={missingImages ? 'image_not_supported' : 'imagesmode'} translate="no" aria-hidden="true" className={`mt-px text-[22px] ${missingImages ? 'text-amber-600' : 'text-emerald-600'}`} />
              <p className="font-semibold">{missingImages ? `${fmt(missingImages)} de ${fmt(checkedImages)} imágenes comprobadas todavía no están en R2. Puedes cargar igual, pero esas cartas se verán sin foto hasta subirlas.` : `Las ${fmt(checkedImages)} imágenes comprobadas (una muestra de las nuevas) ya están disponibles en R2.`}</p>
            </div>
          )}

          {samples.length > 0 && (
            <section aria-label="Algunas cartas del archivo" className="rounded-2xl border border-[#dbe3f0] bg-white p-4">
              <h3 className="text-sm font-extrabold text-[#12315f]">Algunas de las cartas</h3>
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {samples.map((card) => (
                  <li key={card.productId} className="min-w-0">
                    <span className="flex aspect-[5/7] items-center justify-center overflow-hidden rounded-lg bg-[#e6ecf7]">
                      {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <SvgIcon name="image_not_supported" translate="no" aria-hidden="true" className="text-[22px] text-slate-400" />}
                    </span>
                    <p className="mt-1 truncate text-xs font-bold text-slate-800" title={card.name}>{card.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{card.edition}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Archivos revisados" className="rounded-2xl border border-[#dbe3f0] bg-white">
            <h3 className="border-b border-[#dbe3f0] px-4 py-3 text-sm font-extrabold text-[#12315f]">{results.length} {results.length === 1 ? 'archivo' : 'archivos'}</h3>
            <ul className="max-h-72 divide-y divide-[#eef2fa] overflow-y-auto overscroll-contain">
              {results.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{item.name}</span><span className="text-xs text-slate-500">{sizeLabel(item.size)}</span></span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600">
                    {item.error ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">Con problemas</span> : item.plan.errors.length ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{item.plan.errors.length} errores</span> : `${fmt(item.plan.counts.new)} nuevas · ${fmt(item.plan.counts.updated)} correcciones · ${fmt(item.plan.counts.exists)} sin cambios`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe3f0] bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-3xl gap-2 sm:justify-end">
              <button type="button" onClick={onReset} className="h-12 flex-1 rounded-full border-2 border-slate-300 bg-white px-6 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 sm:flex-none">Cancelar</button>
              <button type="button" disabled={!loadable} onClick={() => setConfirming(true)} className="h-12 flex-[1.6] rounded-full bg-[#facc15] px-7 text-sm font-extrabold text-[#12315f] transition-[filter,transform,opacity] duration-150 active:scale-[0.97] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none">
                {loadable ? `Cargar ${fmt(total('new') + total('updated'))} ${total('new') + total('updated') === 1 ? 'cambio' : 'cambios'}` : 'Nada que cargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && summary && (
        <div className="mod-row-in rounded-3xl border border-emerald-200 bg-white p-8 text-center">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${error ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}><SvgIcon name={error ? 'warning' : 'check_circle'} translate="no" aria-hidden="true" className="text-[36px]" /></span>
          <h3 className="mt-4 text-xl font-extrabold text-[#12315f]">{[summary.created > 0 && `${fmt(summary.created)} cartas nuevas`, summary.updated > 0 && `${fmt(summary.updated)} correcciones`].filter(Boolean).join(' y ') || 'No había cambios'} {error ? 'cargadas hasta aquí' : 'cargadas'}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{summary.filesDone} de {summary.filesTotal} archivos procesados{summary.newSets ? ` · ${fmt(summary.newSets)} ediciones nuevas` : ''}. La carga quedó registrada en la auditoría.</p>
          <button type="button" onClick={onReset} className="mt-6 h-12 rounded-full bg-[#12315f] px-7 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af]">{error ? 'Volver a elegir archivos' : 'Cargar otros archivos'}</button>
        </div>
      )}

      {confirming && <ConfirmDialog count={total('new')} updates={total('updated')} busy={false} onCancel={() => setConfirming(false)} onConfirm={apply} />}
    </section>
  );
}
