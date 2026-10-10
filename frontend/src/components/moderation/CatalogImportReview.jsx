import { useMemo, useState } from 'react';
import { Dot } from './shared';

const Thumb = ({ src, name }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#e6ecf7]">
      {!failed && src
        ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <span translate="no" aria-hidden="true" title={`Sin imagen: ${name}`} className="material-symbols-outlined text-[20px] text-slate-400">image_not_supported</span>}
    </span>
  );
};

const Fact = ({ value, label, tone = 'text-[#12315f]' }) => (
  <div className="bg-white px-4 py-3">
    <dd className={`text-2xl font-extrabold tabular-nums leading-none ${tone}`}>{value}</dd>
    <dt className="mt-1.5 text-xs font-semibold text-slate-600">{label}</dt>
  </div>
);

// Resultado de la revisión del archivo: qué se agregaría, qué ya existe y qué impide cargarlo
export default function CatalogImportReview({ plan }) {
  const [onlyNew, setOnlyNew] = useState(true);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const { counts } = plan;
  const hasErrors = plan.errors.length > 0;
  const missingImages = plan.images?.missing?.length || 0;
  const names = useMemo(() => new Map(plan.cards.map((card) => [card.productId, card.name])), [plan.cards]);
  const visible = useMemo(() => (onlyNew ? plan.cards.filter((card) => card.status !== 'exists') : plan.cards), [plan.cards, onlyNew]);
  const errors = showAllErrors ? plan.errors : plan.errors.slice(0, 4);

  const verdict = hasErrors
    ? { tone: 'border-red-200 bg-red-50 text-red-900', icon: 'error', title: `Hay ${plan.errors.length} ${plan.errors.length === 1 ? 'carta con problemas' : 'cartas con problemas'}`, text: 'No se puede cargar hasta corregir el archivo. Nada se guardó.' }
    : counts.new === 0 && counts.updated === 0 && !plan.canApply
      ? { tone: 'border-[#dbe3f0] bg-white text-[#12315f]', icon: 'task_alt', title: 'No hay cartas nuevas', text: 'Todas las cartas del archivo ya están en la base.' }
      : { tone: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: 'check_circle', title: counts.new > 0 || counts.updated > 0 ? `Listo para cargar: ${[counts.new > 0 && `${counts.new} ${counts.new === 1 ? 'carta nueva' : 'cartas nuevas'}`, counts.updated > 0 && `${counts.updated} ${counts.updated === 1 ? 'corrección' : 'correcciones'}`].filter(Boolean).join(' y ')}` : 'Solo faltan enlaces a productos', text: counts.newGroups || counts.newProducts ? `Se crearán también ${[counts.newGroups && `${counts.newGroups} ${counts.newGroups === 1 ? 'edición' : 'ediciones'}`, counts.newProducts && `${counts.newProducts} ${counts.newProducts === 1 ? 'producto' : 'productos'}`].filter(Boolean).join(' y ')} que aún no están en la base. Las cartas que ya existen no se modifican.` : counts.updated > 0 ? 'Las correcciones cambian el nombre, la imagen, los datos y, si corresponde, la edición de cartas que ya existen.' : 'Las cartas que ya existen no se modifican.' };

  return (
    <div className="space-y-4">
      <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 ${verdict.tone}`}>
        <span translate="no" aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[26px]">{verdict.icon}</span>
        <div className="min-w-0">
          <p className="text-base font-extrabold leading-snug">{verdict.title}</p>
          <p className="mt-0.5 text-sm leading-snug opacity-90">{verdict.text}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#dbe3f0] bg-[#dbe3f0] sm:grid-cols-5">
        <Fact value={counts.new} label="Nuevas" tone={counts.new > 0 ? 'text-[#1e40af]' : 'text-slate-500'} />
        <Fact value={counts.updated} label={counts.updated === 1 ? 'Se corrige' : 'Se corrigen'} tone={counts.updated > 0 ? 'text-[#92400e]' : 'text-slate-500'} />
        <Fact value={counts.exists} label="Sin cambios" tone="text-slate-600" />
        <Fact value={plan.editions.length} label={plan.editions.length === 1 ? 'Edición' : 'Ediciones'} />
        <Fact value={plan.physicalProducts.length} label={plan.physicalProducts.length === 1 ? 'Producto' : 'Productos'} />
      </dl>

      {hasErrors && (
        <section aria-label="Problemas del archivo" className="rounded-2xl border border-red-200 bg-white p-4">
          <h3 className="text-sm font-extrabold text-red-800">Qué hay que corregir</h3>
          <ul className="mt-2 space-y-2">
            {errors.map((error, index) => (
              <li key={`${error.productId}-${index}`} className="flex items-start gap-2.5 text-sm">
                <Dot tone="bg-red-600" className="!mt-[7px]" />
                <span className="min-w-0"><b className="break-words text-slate-800">{error.name}</b>{error.productId ? <span className="text-slate-500"> · ID {error.productId}</span> : null}<span className="block text-slate-700">{error.message}</span></span>
              </li>
            ))}
          </ul>
          {plan.errors.length > 4 && <button type="button" onClick={() => setShowAllErrors((value) => !value)} className="mt-3 h-10 rounded-full px-4 text-sm font-bold text-[#1e40af] transition-colors hover:bg-blue-50">{showAllErrors ? 'Ver menos' : `Ver los ${plan.errors.length} problemas`}</button>}
        </section>
      )}

      {plan.editions.length > 0 && (
        <section aria-label="Ediciones del archivo" className="rounded-2xl border border-[#dbe3f0] bg-white">
          <h3 className="border-b border-[#dbe3f0] px-4 py-3 text-sm font-extrabold text-[#12315f]">Dónde entran las cartas</h3>
          <ul className="divide-y divide-[#eef2fa]">
            {plan.editions.map((edition) => (
              <li key={edition.groupId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-bold text-slate-800"><span className="truncate">{edition.name}</span>{edition.isNew && <span className="shrink-0 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-bold text-[#92400e]">Edición nueva</span>}</p>
                  <p className="text-xs text-slate-500">{edition.block}</p>
                </div>
                <p className="text-sm tabular-nums text-slate-600"><b className={edition.new > 0 ? 'text-[#1e40af]' : 'text-slate-500'}>{edition.new} {edition.new === 1 ? 'nueva' : 'nuevas'}</b>{edition.updated > 0 ? <span className="text-[#92400e]"> · {edition.updated} {edition.updated === 1 ? 'se corrige' : 'se corrigen'}</span> : null}{edition.exists > 0 ? <span className="text-slate-500"> · {edition.exists} sin cambios</span> : null}</p>
              </li>
            ))}
          </ul>
          {plan.physicalProducts.length > 0 && (
            <p className="border-t border-[#dbe3f0] px-4 py-3 text-sm text-slate-600">
              Se enlazan a: {plan.physicalProducts.map((product) => `${product.name}${product.isNew ? ' (producto nuevo)' : ''} (${product.block}, ${product.cards} ${product.cards === 1 ? 'carta' : 'cartas'})`).join(' · ')}
            </p>
          )}
        </section>
      )}

      {plan.images && !plan.images.skipped && (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${missingImages ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-[#dbe3f0] bg-white text-slate-700'}`}>
          <span translate="no" aria-hidden="true" className={`material-symbols-outlined mt-px text-[22px] ${missingImages ? 'text-amber-600' : 'text-emerald-600'}`}>{missingImages ? 'image_not_supported' : 'imagesmode'}</span>
          <div className="min-w-0">
            {missingImages
              ? <>
                <p className="font-bold">{missingImages} {missingImages === 1 ? 'imagen todavía no está' : 'imágenes todavía no están'} en el almacenamiento</p>
                <p className="mt-0.5">Puedes cargar igual, pero esas cartas se verán sin foto hasta que se suban: {plan.images.missing.slice(0, 6).map((id) => names.get(id) || id).join(', ')}{missingImages > 6 ? ` y ${missingImages - 6} más` : ''}.</p>
              </>
              : <p className="font-semibold">Las {plan.images.checked} imágenes de las cartas nuevas ya están disponibles.</p>}
          </div>
        </div>
      )}

      {plan.cards.length > 0 && (
        <section aria-label="Cartas del archivo" className="rounded-2xl border border-[#dbe3f0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbe3f0] px-4 py-3">
            <h3 className="text-sm font-extrabold text-[#12315f]">Cartas del archivo</h3>
            {counts.exists > 0 && counts.new + counts.updated > 0 && (
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} className="h-5 w-5 rounded border-slate-400" />
                Solo las que cambian
              </label>
            )}
          </div>
          <ul className="max-h-[32rem] divide-y divide-[#eef2fa] overflow-y-auto overscroll-contain">
            {visible.map((card) => (
              <li key={card.productId} className="flex items-center gap-3 px-4 py-2.5 [contain-intrinsic-size:auto_72px] [content-visibility:auto]">
                <Thumb src={card.imageUrl} name={card.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-slate-800">{card.name}</p>
                  <p className="truncate text-xs text-slate-500">{[card.type, card.cost && `Coste ${card.cost}`, card.force && `Fuerza ${card.force}`, card.race, card.frequency].filter(Boolean).join(' · ')}</p>
                  <p className="truncate text-xs text-slate-500">{card.edition}{card.number ? ` · ${card.number}` : ''}</p>
                  {card.previousName && card.previousName !== card.name && <p className="truncate text-xs font-semibold text-[#92400e]">Antes: {card.previousName}</p>}
                  {card.previousEdition && <p className="truncate text-xs font-semibold text-[#92400e]">Cambia de edición: {card.previousEdition} → {card.edition}</p>}
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${card.status === 'new' ? 'bg-[#e8effc] text-[#1e40af]' : card.status === 'update' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-slate-100 text-slate-600'}`}>
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${card.status === 'new' ? 'bg-[#1e40af]' : card.status === 'update' ? 'bg-[#d97706]' : 'bg-slate-400'}`} />
                  {card.status === 'new' ? 'Nueva' : card.status === 'update' ? 'Se corrige' : 'Sin cambios'}
                </span>
              </li>
            ))}
          </ul>
          {plan.truncated && <p className="border-t border-[#dbe3f0] px-4 py-3 text-xs text-slate-500">Se muestran las primeras {plan.cards.length}. La carga incluye todas las del archivo.</p>}
        </section>
      )}
    </div>
  );
}

