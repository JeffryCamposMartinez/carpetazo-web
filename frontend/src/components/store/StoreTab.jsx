import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LiquidTabs from '../ui/LiquidTabs';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import { useToast } from '../ui/ToastProvider';
import StoreHoursEditor from './StoreHoursEditor';
import StorePhotosEditor from './StorePhotosEditor';
import { AddressFields, PolicyField, TradeFields } from './StoreProfileForm';
import { STORE_DAYS, isOpenAt, openLabel } from '../../utils/storeHours';

const EMPTY = { enabled: false, address: '', reference: '', comuna: '', hours: Object.fromEntries(STORE_DAYS.map((d) => [d, []])), exceptions: [], paymentMethods: [], buyGames: [], sellGames: [], buyNote: '', photos: [], policy: '', pickupHours: 48 };
const SECTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'horario', label: 'Horario' },
  { value: 'comercio', label: 'Compra y venta' },
  { value: 'fotos', label: 'Fotos' },
  { value: 'politica', label: 'Política' }
];
const PERKS = ['Tu local en tu perfil: dirección, horario y «Abierto ahora»', 'Botones para llegar con Google Maps y Waze', 'Aparecer en «Tiendas» y «Abiertas ahora»', 'Medios de pago, juegos que compras y vendes, fotos y política de cambios'];

const fromServer = (store) => {
  if (!store) return EMPTY;
  const { openNow: _o, region: _r, ...rest } = store;
  return { ...EMPTY, ...rest, hours: { ...EMPTY.hours, ...(store.hours || {}) } };
};

function Upsell({ saved }) {
  return (
    <section className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-[#12315f] to-[#1e40af] p-6 text-white shadow-lg sm:p-8">
      <SvgIcon name="storefront" className="text-4xl text-[#facc15]" />
      <h2 className="mt-3 text-2xl font-extrabold">Muestra tu tienda física</h2>
      <p className="mt-1 text-blue-100">{saved ? 'Tu ficha sigue guardada, pero está oculta: vuelve a verse al activar el plan Tienda.' : 'Con el plan Tienda tu local aparece en Carpetazo para que te encuentren y te visiten.'}</p>
      <ul className="mt-4 space-y-2">
        {PERKS.map((p) => <li key={p} className="flex gap-2 text-sm"><SvgIcon name="check" className="mt-0.5 shrink-0 text-lg text-[#facc15]" />{p}</li>)}
      </ul>
      <Link to="/planes" className="mt-6 inline-flex h-12 items-center rounded-full bg-[#facc15] px-6 font-black text-[#12315f] shadow transition hover:bg-yellow-300 active:scale-[0.97]">Ver plan Tienda</Link>
    </section>
  );
}

// Pestaña «Mi tienda» del panel (plan Tienda)
export default function StoreTab() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, allowed: false, saved: false });
  const [form, setForm] = useState(EMPTY);
  const [section, setSection] = useState('local');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getMyStore()
      .then((r) => { if (alive) { setState({ loading: false, allowed: r.allowed, saved: Boolean(r.store) }); setForm(fromServer(r.store)); } })
      .catch(() => { if (alive) setState({ loading: false, allowed: false, saved: false, error: true }); });
    return () => { alive = false; };
  }, []);

  const change = (next) => { setForm(next); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try {
      const r = await api.saveMyStore(form);
      setForm(fromServer(r.store));
      setDirty(false);
      showToast('Ficha del local guardada', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo guardar la ficha', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <LoadingState label="Cargando tu tienda" />;
  if (state.error) return <p className="text-center text-slate-600">No se pudo cargar tu tienda. Recarga la página.</p>;
  if (!state.allowed) return <Upsell saved={state.saved} />;

  const status = isOpenAt(form.hours, form.exceptions);
  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={form.enabled} onChange={(e) => change({ ...form, enabled: e.target.checked })} className="h-5 w-5 accent-[#1e40af]" />
          <span>
            <span className="block font-black text-[#1a2b4b]">Mostrar mi local en mi perfil</span>
            <span className="block text-sm text-slate-600">{form.enabled ? 'Visible en tu perfil y en «Tiendas».' : 'Oculto: solo tú lo ves.'}</span>
          </span>
        </label>
        <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-black sm:self-auto ${status.open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
          <span className={`h-2 w-2 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-slate-400'}`} />{openLabel(status)}
        </span>
      </div>

      <div className="hide-scrollbar -mx-4 mb-4 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
        <LiquidTabs
          ariaLabel="Secciones de Mi tienda"
          tabs
          idPrefix="mi-tienda-tab"
          layout="inline"
          options={SECTIONS}
          value={section}
          onChange={setSection}
          className="w-max min-w-full rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:min-w-0"
          buttonClassName="h-10 flex-auto shrink-0 whitespace-nowrap rounded-xl px-3 text-sm font-bold sm:px-5"
          indicatorClassName="rounded-xl bg-[#1e40af]"
          indicatorStyle={{ top: 4, bottom: 4 }}
          activeTextClassName="text-white"
          inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]"
        />
      </div>

      <div role="tabpanel" aria-labelledby={`mi-tienda-tab-${section}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
        {section === 'local' && <AddressFields value={form} onChange={change} />}
        {section === 'horario' && <StoreHoursEditor value={form.hours} onChange={(hours) => change({ ...form, hours })} exceptions={form.exceptions} onExceptionsChange={(exceptions) => change({ ...form, exceptions })} />}
        {section === 'comercio' && <TradeFields value={form} onChange={change} />}
        {section === 'fotos' && <StorePhotosEditor value={form.photos} onChange={(photos) => change({ ...form, photos })} onError={(m) => showToast(m, 'error')} />}
        {section === 'politica' && <PolicyField value={form} onChange={change} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          {dirty && <span className="text-sm font-semibold text-amber-700">Cambios sin guardar</span>}
          <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1e40af] px-6 font-black text-white shadow transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">
            {saving && <ButtonSpinner tone="dark" />}Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
