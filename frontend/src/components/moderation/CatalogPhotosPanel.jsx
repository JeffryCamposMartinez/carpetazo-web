import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { ButtonSpinner } from '../ui/LoadingState';
import { EmptyState, ErrorBox, ListSkeleton, ROW, relativeTime } from './shared';

function ProposalRow({ proposal, onDecided, setError }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const { showToast } = useToast();
  const { card } = proposal;

  const decide = async (action) => {
    setBusy(action);
    setError('');
    try {
      if (action === 'approve') await api.approveCatalogPhoto(proposal.id); else await api.rejectCatalogPhoto(proposal.id, note.trim());
      showToast(action === 'approve' ? 'Foto aprobada: la carta ya tiene imagen' : 'Foto rechazada', 'success');
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
    } finally {
      setBusy('');
      onDecided(); // la lista se recarga: otra persona pudo decidir antes
    }
  };

  return (
    <li className={`${ROW} mod-row-in flex flex-col gap-4 p-4 sm:flex-row`}>
      <a href={proposal.imageUrl} target="_blank" rel="noreferrer" className="mx-auto block w-48 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 sm:mx-0" aria-label="Abrir la foto en tamaño completo">
        <img src={proposal.imageUrl} alt={`Foto propuesta para ${card?.name || 'la carta'}`} loading="lazy" className="aspect-[5/7] w-full object-contain" />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-snug text-[#12315f]">{card?.name || 'Carta que ya no está en el catálogo'}</p>
            {card && <p className="mt-0.5 text-sm text-slate-600">{[card.game, card.edition, card.number, card.rarity].filter(Boolean).join(' · ')}</p>}
          </div>
          <time dateTime={proposal.createdAt} className="shrink-0 pt-0.5 text-xs text-slate-500">{relativeTime(proposal.createdAt)}</time>
        </div>
        <p className="mt-2 text-sm text-slate-600">La subió <span className="font-bold">@{proposal.username || 'cuenta eliminada'}</span> en su carpeta. Si la apruebas, será la imagen de esta carta para todas las personas.</p>
        {proposal.samePending > 1 && <p className="mt-1 text-sm font-semibold text-amber-800">Hay {proposal.samePending} fotos propuestas para esta carta: al aprobar una, se cierran las demás.</p>}
        {proposal.hasImage && <p className="mt-1 text-sm font-semibold text-slate-600">Esta carta ya tiene imagen; no se podrá aprobar.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
          <button type="button" disabled={Boolean(busy) || proposal.hasImage || !card} onClick={() => decide('approve')} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-50">{busy === 'approve' && <ButtonSpinner />}Aprobar</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => setRejecting((open) => !open)} aria-expanded={rejecting} className="h-11 rounded-full border-2 border-slate-500 px-4 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 hover:bg-slate-100 active:scale-[0.97] disabled:opacity-50">Rechazar</button>
        </div>
        {rejecting && (
          <div className="mt-3 space-y-2 sm:max-w-sm">
            <label className="block text-sm font-bold text-slate-700">Motivo (opcional, queda en el registro)
              <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-normal text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]" />
            </label>
            <button type="button" disabled={Boolean(busy)} onClick={() => decide('reject')} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white transition-transform duration-150 active:scale-[0.97] disabled:opacity-50">{busy === 'reject' && <ButtonSpinner />}Confirmar rechazo</button>
          </div>
        )}
      </div>
    </li>
  );
}

// Fotos que la comunidad subió a cartas del catálogo sin imagen: si se aprueban, pasan a ser la imagen de esa carta para todos
export default function CatalogPhotosPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.getCatalogPhotos().then(setData).catch((err) => { setData({ proposals: [], total: 0 }); setError(err.message || 'No se pudo cargar las fotos.'); });
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section aria-label="Fotos de cartas" className="mx-auto max-w-3xl">
      <ErrorBox>{error}</ErrorBox>
      {data === null ? <ListSkeleton rows={3} label="Cargando fotos" /> : data.proposals.length === 0 ? (
        <EmptyState icon="photo_library" title="No hay fotos por revisar">Cuando alguien suba una foto a una carta del catálogo que no tiene imagen, aparecerá aquí.</EmptyState>
      ) : (
        <>
          {data.total > data.proposals.length && <p className="mb-3 text-sm font-semibold text-slate-600">Mostrando las {data.proposals.length} más antiguas de {data.total}.</p>}
          <ul className="space-y-3">{data.proposals.map((proposal) => <ProposalRow key={proposal.id} proposal={proposal} onDecided={load} setError={setError} />)}</ul>
        </>
      )}
    </section>
  );
}
