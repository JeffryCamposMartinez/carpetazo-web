import { useState } from 'react';
import LiquidTabs from '../ui/LiquidTabs';
import SvgIcon from '../ui/SvgIcon';
import { PAYMENT_NAMES, chileToday, formatException, formatHours, isOpenAt, mapLinks, openLabel } from '../../utils/storeHours';

const STORE_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const todayKey = () => STORE_DAY_KEYS[new Date(`${chileToday()}T12:00:00Z`).getUTCDay()];
const mapBtn = 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition active:scale-[0.97]';

function OpenPill({ store }) {
  const state = isOpenAt(store.hours, store.exceptions);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${state.open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
      <span className={`h-2 w-2 rounded-full ${state.open ? 'bg-emerald-500' : 'bg-slate-400'}`} />{openLabel(state)}
    </span>
  );
}

function Directions({ store }) {
  const links = mapLinks(store);
  return (
    <div className="flex flex-wrap gap-2">
      <a href={links.google} target="_blank" rel="noopener noreferrer" className={`${mapBtn} bg-[#1e40af] text-white hover:bg-[#12315f]`}><SvgIcon name="map" className="text-lg" />Google Maps</a>
      <a href={links.waze} target="_blank" rel="noopener noreferrer" className={`${mapBtn} bg-white text-[#1e40af] ring-1 ring-[#1e40af]/30 hover:ring-[#1e40af]`}><SvgIcon name="near_me" className="text-lg" />Waze</a>
    </div>
  );
}

// Bloque «Tienda física» del perfil público. compact: solo estado, dirección y cómo llegar (catálogo)
export default function StorePublicCard({ store, compact = false }) {
  const [tab, setTab] = useState('local');
  const [photo, setPhoto] = useState(null);
  if (!store) return null;
  const today = todayKey();
  const address = (
    <div>
      <p className="font-bold text-[#1a2b4b]">{store.address}</p>
      <p className="text-sm text-slate-600">{[store.reference, store.comuna].filter(Boolean).join(' · ')}</p>
    </div>
  );

  if (compact) {
    return (
      <section aria-label="Tienda física" className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><SvgIcon name="storefront" className="mt-0.5 text-2xl text-[#1e40af]" /><div>{address}<div className="mt-1"><OpenPill store={store} /></div></div></div>
        <Directions store={store} />
      </section>
    );
  }

  const tabs = [{ value: 'local', label: 'Tienda física' }, ...(store.policy ? [{ value: 'politica', label: 'Política de cambios' }] : [])];
  return (
    <section aria-label="Tienda física" className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pt-5 sm:px-6 md:px-8">
      <div className="rounded-3xl border border-blue-100 bg-white p-4 text-slate-800 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#12315f]"><SvgIcon name="storefront" className="text-2xl text-[#1e40af]" />Tienda física</h2>
          <OpenPill store={store} />
        </div>
        {tabs.length > 1 && (
          <LiquidTabs ariaLabel="Información de la tienda" tabs idPrefix="tienda-publica-tab" layout="inline" options={tabs} value={tab} onChange={setTab}
            className="mb-4 inline-flex rounded-2xl bg-slate-100 p-1" buttonClassName="h-9 rounded-xl px-4 text-sm font-bold" indicatorClassName="rounded-xl bg-[#1e40af]" indicatorStyle={{ top: 4, bottom: 4 }}
            activeTextClassName="text-white" inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]" />
        )}
        {tab === 'politica' ? (
          <p className="whitespace-pre-line leading-relaxed text-slate-700">{store.policy}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              {address}
              <Directions store={store} />
              {store.paymentMethods?.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-sm font-black text-[#1a2b4b]">Medios de pago</h3>
                  <div className="flex flex-wrap gap-1.5">{store.paymentMethods.map((p) => <span key={p} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1e40af]">{PAYMENT_NAMES[p] || p}</span>)}</div>
                </div>
              )}
              {(store.sellGames?.length > 0 || store.buyGames?.length > 0) && (
                <dl className="space-y-1.5 text-sm">
                  {store.sellGames?.length > 0 && <div><dt className="inline font-black text-[#1a2b4b]">Vende: </dt><dd className="inline text-slate-700">{store.sellGames.join(', ')}</dd></div>}
                  {store.buyGames?.length > 0 && <div><dt className="inline font-black text-[#1a2b4b]">Compra: </dt><dd className="inline text-slate-700">{store.buyGames.join(', ')}</dd></div>}
                  {store.buyNote && <p className="text-slate-600">{store.buyNote}</p>}
                </dl>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-black text-[#1a2b4b]">Horario</h3>
              {store.hours ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {formatHours(store.hours).map((row) => (
                    <li key={row.key} className={`flex justify-between gap-3 py-1.5 ${row.key === today ? 'font-black text-[#12315f]' : 'text-slate-700'}`}>
                      <span>{row.day}</span><span>{row.text}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">La tienda no ha publicado su horario.</p>}
              {store.exceptions?.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  {store.exceptions.slice(0, 5).map((e) => <li key={e.date}><span className="font-bold">{new Date(`${e.date}T12:00:00Z`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}:</span> {formatException(e)}</li>)}
                </ul>
              )}
            </div>
            {store.photos?.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 md:col-span-2 sm:grid-cols-6">
                {store.photos.map((url) => (
                  <li key={url}><button type="button" onClick={() => setPhoto(url)} className="block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 transition hover:opacity-90 active:scale-[0.98]"><img src={url} alt="Foto del local" loading="lazy" className="h-full w-full object-cover" /></button></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {photo && (
        <div role="dialog" aria-modal="true" aria-label="Foto del local" className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4" onClick={() => setPhoto(null)}>
          <img src={photo} alt="Foto del local" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-slate-800"><SvgIcon name="close" className="text-xl" /></button>
        </div>
      )}
    </section>
  );
}
