import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LiquidTabs from '../ui/LiquidTabs';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import Switch from '../ui/Switch';
import { useToast } from '../ui/ToastProvider';
import StoreHoursEditor from './StoreHoursEditor';
import StorePhotosEditor from './StorePhotosEditor';
import StoreEventsEditor from './StoreEventsEditor';
import BuyRequestsInbox from './BuyRequestsInbox';
import PickupsPanel from './PickupsPanel';
import StoreCashPanel from './StoreCashPanel';
import StoreStockPanel from './StoreStockPanel';
import StoreClientsPanel from './StoreClientsPanel';
import StoreVerificationPanel from './StoreVerificationPanel';
import { AddressFields, PolicyField, TradeFields } from './StoreProfileForm';
import { STORE_DAYS, isOpenAt, openLabel } from '../../utils/storeHours';

const EMPTY = { enabled: false, address: '', reference: '', comuna: '', hours: Object.fromEntries(STORE_DAYS.map((d) => [d, []])), exceptions: [], paymentMethods: [], buyGames: [], sellGames: [], buyNote: '', photos: [], policy: '', pickupHours: 48 };
// Tres grupos (selector segmentado) y, dentro de cada uno, sus secciones: en el celular no caben 12 pestañas en una fila
const GROUPS = [
  { value: 'local', label: 'Mi local', sections: [{ value: 'local', label: 'Dirección' }, { value: 'horario', label: 'Horario' }, { value: 'comercio', label: 'Compra y venta' }, { value: 'fotos', label: 'Fotos' }, { value: 'politica', label: 'Política' }, { value: 'verificacion', label: 'Verificación' }] },
  { value: 'ventas', label: 'Ventas', sections: [{ value: 'retiros', label: 'Retiros' }, { value: 'caja', label: 'Caja' }, { value: 'stock', label: 'Stock' }, { value: 'compras', label: 'Colecciones' }] },
  { value: 'clientes', label: 'Clientes', sections: [{ value: 'eventos', label: 'Eventos' }, { value: 'clientes', label: 'Avisos y cupones' }] }
];
// Las que se ven sobre una tarjeta blanca (las otras ya traen sus propias tarjetas)
const CARDED = ['local', 'comercio', 'fotos', 'politica', 'verificacion', 'caja'];
const CARD = 'rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.45)] ring-1 ring-slate-900/5 sm:p-5';
const EASE_OUT = [0.23, 1, 0.32, 1];
const BAR_SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 };
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
  const [saved, setSaved] = useState(EMPTY); // última versión guardada: «Descartar» vuelve a ella
  const [group, setGroup] = useState('local');
  const [section, setSection] = useState('local');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getMyStore()
      .then((r) => { if (alive) { setState({ loading: false, allowed: r.allowed, saved: Boolean(r.store) }); setForm(fromServer(r.store)); setSaved(fromServer(r.store)); } })
      .catch(() => { if (alive) setState({ loading: false, allowed: false, saved: false, error: true }); });
    return () => { alive = false; };
  }, []);

  // La sección elegida se desliza al centro de su fila (en el celular la fila es más ancha que la pantalla)
  useEffect(() => {
    document.getElementById(`mi-tienda-tab-${section}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [section, group]);

  const change = (next) => { setForm(next); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try {
      const r = await api.saveMyStore(form);
      setForm(fromServer(r.store));
      setSaved(fromServer(r.store));
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
  const mySales = <div className="mx-auto mb-5 max-w-3xl space-y-5"><PickupsPanel role="buyer" showToast={showToast} hideWhenEmpty title="Mis reservas para retirar" /><BuyRequestsInbox role="seller" showToast={showToast} hideWhenEmpty title="Colecciones que ofreciste a tiendas" /></div>;
  if (!state.allowed) return <>{mySales}<Upsell saved={state.saved} /></>;

  const status = isOpenAt(form.hours, form.exceptions);
  const current = GROUPS.find((g) => g.value === group);
  const pickGroup = (value) => { setGroup(value); setSection(GROUPS.find((g) => g.value === value).sections[0].value); };
  const panel = {
    local: <AddressFields value={form} onChange={change} />,
    horario: <StoreHoursEditor value={form.hours} onChange={(hours) => change({ ...form, hours })} exceptions={form.exceptions} onExceptionsChange={(exceptions) => change({ ...form, exceptions })} />,
    comercio: <TradeFields value={form} onChange={change} />,
    fotos: <StorePhotosEditor value={form.photos} onChange={(photos) => change({ ...form, photos })} onError={(m) => showToast(m, 'error')} />,
    politica: <PolicyField value={form} onChange={change} />,
    verificacion: <StoreVerificationPanel showToast={showToast} />,
    retiros: <PickupsPanel role="store" showToast={showToast} />,
    caja: <StoreCashPanel />,
    stock: <StoreStockPanel showToast={showToast} />,
    compras: <BuyRequestsInbox role="store" showToast={showToast} />,
    eventos: <StoreEventsEditor showToast={showToast} />,
    clientes: <StoreClientsPanel showToast={showToast} />
  }[section];
  const showBar = dirty; // también fuera de la ficha: así no se pierden cambios al cambiar de sección
  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto max-w-3xl pb-28">
      {mySales}
      <div className={`${CARD} mb-5 flex items-center gap-4`}>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${form.enabled ? 'bg-[#12315f] text-[#facc15]' : 'bg-slate-100 text-slate-400'} transition-colors duration-200`}><SvgIcon name="storefront" className="text-2xl" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-black leading-tight text-[#1a2b4b]">Mostrar mi local</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-slate-600">
            <span>{form.enabled ? 'Visible en tu perfil y en «Tiendas»' : 'Oculto, solo tú lo ves'}</span>
            <span className={`inline-flex items-center gap-1 font-bold ${status.open ? 'text-emerald-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-slate-400'}`} />{openLabel(status)}</span>
          </p>
        </div>
        <Switch checked={form.enabled} onChange={(enabled) => change({ ...form, enabled })} label="Mostrar mi local en mi perfil" />
      </div>

      <LiquidTabs
        ariaLabel="Áreas de Mi tienda"
        tabs
        idPrefix="mi-tienda-grupo"
        layout="inline"
        options={GROUPS}
        value={group}
        onChange={pickGroup}
        className="mb-3 flex w-full rounded-[14px] bg-slate-900/[0.06] p-[3px]"
        buttonClassName="h-9 flex-1 rounded-[11px] px-2 text-[14px] font-bold"
        indicatorClassName="rounded-[11px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]"
        indicatorStyle={{ top: 3, bottom: 3 }}
        activeTextClassName="text-[#12315f]"
        inactiveTextClassName="text-slate-600"
      />
      <div className="hide-scrollbar -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <LiquidTabs
          key={group}
          ariaLabel={`Secciones de ${current.label}`}
          tabs
          idPrefix="mi-tienda-tab"
          layout="inline"
          options={current.sections}
          value={section}
          onChange={setSection}
          className="flex w-max gap-1.5"
          buttonClassName="h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-bold"
          indicatorClassName="rounded-full bg-[#1e40af]"
          indicatorStyle={{ top: 0, bottom: 0 }}
          activeTextClassName="text-white"
          inactiveTextClassName="text-slate-600 bg-white/70 ring-1 ring-slate-900/[0.06] hover:text-[#1a2b4b]"
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          role="tabpanel"
          aria-labelledby={`mi-tienda-tab-${section}`}
          initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.26, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12, ease: EASE_OUT } }}
          className={CARDED.includes(section) ? CARD : ''}
        >
          {panel}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showBar && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: BAR_SPRING }}
            exit={{ y: 96, opacity: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
            className="fixed inset-x-0 z-40 mx-auto flex w-[calc(100%-24px)] max-w-md items-center gap-2 rounded-full bg-[#12315f]/95 p-1.5 pl-5 text-white shadow-[0_18px_40px_-12px_rgba(18,49,95,0.6)] backdrop-blur-md"
            style={{ bottom: 'max(14px, env(safe-area-inset-bottom))' }}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-blue-100">Sin guardar</span>
            <button type="button" onClick={() => { setForm(saved); setDirty(false); }} disabled={saving} className="h-10 shrink-0 rounded-full px-3 text-sm font-bold text-blue-100 transition hover:text-white active:scale-[0.97]">Descartar</button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#facc15] px-5 text-sm font-black text-[#12315f] transition hover:bg-yellow-300 active:scale-[0.96] disabled:opacity-60">
              {saving && <ButtonSpinner />}Guardar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
