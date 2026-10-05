import { useMemo, useState } from 'react';
import { api } from '../../services/api';
import LiquidTabs from '../ui/LiquidTabs';

// Solicitudes (pedidos pendientes) e historial de ventas del vendedor.
// Los datos vienen de GET /api/orders/mine; las acciones de POST /api/orders/mine/:id/status.

const NUM = "font-['Space_Grotesk'] tabular-nums";
// Superficie común de las tarjetas del panel (misma en Carpetas, Deseadas, Solicitudes e Historial)
const SURFACE = 'rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.35)]';
const clp = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
const fullDate = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');
const shortDate = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(iso)) : '');
const timeAgo = (iso) => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Recién llegado';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
};
const LANG = { english: 'EN', spanish: 'ES', japanese: 'JP', 'inglés': 'EN', 'español': 'ES', 'japonés': 'JP' };
const langCode = (value = '') => LANG[String(value).toLowerCase()] || (value ? String(value).slice(0, 2).toUpperCase() : '');
const cardCount = (order) => (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const Icon = ({ name, className = '' }) => (
  <span translate="no" aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>
);

const Thumb = ({ item, className = 'h-14 w-10' }) => (
  <div className={`${className} shrink-0 overflow-hidden rounded-[5px] bg-slate-200 ring-1 ring-black/10`}>
    {item.imageUrl ? (
      <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-slate-400"><Icon name="style" className="text-base" /></div>
    )}
  </div>
);

const Select = ({ value, onChange, children, label }) => (
  <label className="relative flex items-center">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3 pr-9 text-sm font-semibold text-[#1a2b4b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
    >
      {children}
    </select>
    <Icon name="expand_more" className="pointer-events-none absolute right-2 text-lg text-slate-500" />
  </label>
);

const SearchBox = ({ value, onChange, placeholder }) => (
  <label className="relative flex min-w-0 flex-1 items-center">
    <span className="sr-only">{placeholder}</span>
    <Icon name="search" className="pointer-events-none absolute left-3 text-lg text-slate-400" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-[#1a2b4b] placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
    />
  </label>
);

const EmptyState = ({ icon, title, text, action }) => (
  <div className="flex flex-col items-center px-6 py-20 text-center">
    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
      <Icon name={icon} className="text-4xl text-[#1e40af]" />
    </div>
    <h3 className="mb-2 text-xl font-extrabold text-[#1a2b4b]">{title}</h3>
    <p className="max-w-md text-slate-600">{text}</p>
    {action}
  </div>
);

const matchesSearch = (order, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return String(order.code || '').toLowerCase().includes(q)
    || (order.items || []).some((item) => String(item.name || '').toLowerCase().includes(q));
};

/* ---------------------------------- Solicitudes ---------------------------------- */

function OrderSlip({ order, busy, onDecide, showToast }) {
  const [confirming, setConfirming] = useState(null); // 'completed' | 'rejected' | null
  const units = cardCount(order);
  const lowStock = (order.items || []).filter((item) => item.stockNow !== null && item.stockNow < item.quantity);

  const copyCode = () => {
    navigator.clipboard?.writeText(order.code).then(() => showToast(`Código ${order.code} copiado`, 'success')).catch(() => {});
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_rgba(26,43,75,0.08),0_12px_28px_-18px_rgba(26,43,75,0.45)] ring-1 ring-slate-200 md:flex-row">
      {/* Cuerpo del comprobante */}
      <div className="min-w-0 flex-1 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DBEAFE] px-3 py-1 text-sm font-bold text-[#1e40af]">
            <Icon name="folder" className="text-base" /> {order.folderName}
          </span>
          <span className="text-sm text-slate-500" title={fullDate(order.createdAt)}>{timeAgo(order.createdAt)}</span>
          <span className="text-sm text-slate-500">{order.buyerName || 'Cliente por WhatsApp'}</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {(order.items || []).map((item, index) => {
            const short = item.stockNow !== null && item.stockNow < item.quantity;
            return (
              <li key={`${item.id}-${index}`} className="flex items-center gap-3 py-2.5">
                <Thumb item={item} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#1a2b4b]">{item.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[item.set, item.number, langCode(item.language)].filter(Boolean).join(' / ')}
                  </p>
                  {short && (
                    <p className="mt-0.5 text-xs font-semibold text-[#b91c1c]">
                      {item.stockNow === 0 ? 'Sin stock en la carpeta' : `Solo te quedan ${item.stockNow}`}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`${NUM} font-bold text-[#1a2b4b]`}>{clp(item.price * item.quantity)}</p>
                  <p className={`${NUM} text-xs text-slate-500`}>{item.quantity} × {clp(item.price)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Talón: perforación + código + total + acciones */}
      <div className="relative flex shrink-0 flex-col justify-between gap-5 border-t-2 border-dashed border-slate-300 bg-[#F8FAFC] p-5 sm:p-6 md:w-72 md:border-l-2 md:border-t-0">
        <span aria-hidden="true" className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full bg-[#DBEAFE] md:block" />
        <span aria-hidden="true" className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-[#DBEAFE] md:block" />

        <div>
          <p className="text-sm font-semibold text-slate-500">Pedido</p>
          <button
            type="button"
            onClick={copyCode}
            title="Copiar código"
            className={`${NUM} group -ml-1 flex min-h-11 items-center gap-2 rounded-lg px-1 text-4xl font-bold tracking-[0.12em] text-[#1a2b4b] transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]`}
          >
            {order.code}
            <Icon name="content_copy" className="text-lg text-slate-400 group-hover:text-[#1e40af]" />
          </button>
          <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
            <span className="text-sm text-slate-600">{plural(units, 'carta', 'cartas')}</span>
            <span className={`${NUM} text-2xl font-bold text-[#1a2b4b]`}>{clp(order.total)}</span>
          </div>
        </div>

        {confirming ? (
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200" role="alertdialog" aria-label="Confirmar acción">
            <p className="mb-3 text-sm text-[#1a2b4b]">
              {confirming === 'completed'
                ? `Se descontarán ${plural(units, 'carta', 'cartas')} del stock de "${order.folderName}".`
                : 'El pedido pasará al historial como rechazado. El stock no cambia.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(order, confirming)}
                className={`h-11 flex-1 rounded-lg text-sm font-bold text-white transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${confirming === 'completed' ? 'bg-[#047857] hover:bg-[#065f46]' : 'bg-[#b91c1c] hover:bg-[#991b1b]'}`}
              >
                {busy ? 'Guardando…' : confirming === 'completed' ? 'Sí, confirmar venta' : 'Sí, rechazar'}
              </button>
              <button type="button" onClick={() => setConfirming(null)} className="h-11 rounded-lg px-4 text-sm font-semibold text-slate-600 transition-[background-color,transform] duration-150 hover:bg-slate-100 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                Volver
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lowStock.length > 0 && (
              <p className="text-xs text-[#b91c1c]">Revisa el stock antes de confirmar.</p>
            )}
            <button
              type="button"
              onClick={() => setConfirming('completed')}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#047857] font-bold text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-[#065f46] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#047857]"
            >
              <Icon name="check_circle" className="text-xl" /> Confirmar venta
            </button>
            <button
              type="button"
              onClick={() => setConfirming('rejected')}
              className="h-11 rounded-xl text-sm font-semibold text-slate-600 transition-[background-color,color,transform] duration-150 hover:bg-slate-200/60 hover:text-[#b91c1c] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c]"
            >
              Rechazar pedido
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Requests({ orders, onDecide, busyId, showToast, onGoToFolders, emptyActionLabel = 'Compartir mis carpetas' }) {
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [sort, setSort] = useState('recent');

  const pending = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders]);
  const folders = useMemo(() => [...new Set(pending.map((o) => o.folderName))].sort(), [pending]);
  const visible = useMemo(() => {
    const list = pending.filter((o) => (folder === 'all' || o.folderName === folder) && matchesSearch(o, query));
    if (sort === 'amount') return [...list].sort((a, b) => b.total - a.total);
    if (sort === 'oldest') return [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return list;
  }, [pending, folder, query, sort]);

  if (!pending.length) {
    const steps = [
      ['Comparte una carpeta pública', 'Solo las carpetas públicas reciben pedidos.'],
      ['El comprador arma su carrito', 'Y te lo envía por WhatsApp o por mensaje.'],
      ['Confirma la venta aquí', 'El stock se descuenta solo.']
    ];
    return (
      <section className={`${SURFACE} w-full max-w-3xl p-5 sm:p-8`} aria-labelledby="requests-empty-title">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1e40af]">
            <Icon name="inbox" className="text-3xl" />
          </span>
          <div className="min-w-0">
            <h3 id="requests-empty-title" className="text-xl font-extrabold text-[#1a2b4b]">No tienes pedidos por atender</h3>
            <p className="mt-1 text-slate-600">Cuando alguien te escriba desde una de tus carpetas públicas, su pedido aparecerá aquí.</p>
          </div>
        </div>
        <ol className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
          {steps.map(([title, text], index) => (
            <li key={title} className="flex items-center gap-4 py-4">
              <span className={`${NUM} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a2b4b] text-sm font-bold text-[#ffcb05]`}>{index + 1}</span>
              <p className="min-w-0 text-sm text-slate-600 sm:text-base"><span className="font-bold text-[#1a2b4b]">{title}.</span> {text}</p>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onGoToFolders} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] px-6 font-bold text-white shadow-[0_1px_2px_rgba(8,18,42,0.35),0_6px_14px_-6px_rgba(30,64,175,0.7)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto">
          <Icon name="share" className="text-lg" /> {emptyActionLabel}
        </button>
      </section>
    );
  }

  const owed = pending.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const units = pending.reduce((sum, o) => sum + cardCount(o), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-[#1a2b4b] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm text-blue-200">Por cobrar si confirmas todo</p>
          <p className={`${NUM} text-4xl font-bold text-[#ffcb05] sm:text-5xl`}>{clp(owed)}</p>
        </div>
        <div className="flex gap-8 sm:gap-10">
          <div>
            <p className={`${NUM} text-3xl font-bold`}>{pending.length}</p>
            <p className="text-sm text-blue-200">{pending.length === 1 ? 'pedido' : 'pedidos'}</p>
          </div>
          <div>
            <p className={`${NUM} text-3xl font-bold`}>{units}</p>
            <p className="text-sm text-blue-200">{units === 1 ? 'carta reservada' : 'cartas reservadas'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar por código o carta" />
        <div className="flex gap-3">
          {folders.length > 1 && (
            <Select label="Carpeta" value={folder} onChange={setFolder}>
              <option value="all">Todas las carpetas</option>
              {folders.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          )}
          <Select label="Orden" value={sort} onChange={setSort}>
            <option value="recent">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="amount">Mayor monto</option>
          </Select>
        </div>
      </div>

      {visible.length ? (
        <div className="flex flex-col gap-5">
          {visible.map((order) => (
            <OrderSlip key={order.id} order={order} busy={busyId === order.id} onDecide={onDecide} showToast={showToast} />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-slate-600">Ningún pedido coincide con la búsqueda.</p>
      )}
    </div>
  );
}

/* ----------------------------------- Historial ----------------------------------- */

const RANGES = [
  { id: '30', label: '30 días', days: 30 },
  { id: '90', label: '3 meses', days: 90 },
  { id: '365', label: '12 meses', days: 365 },
  { id: 'all', label: 'Todo', days: null }
];

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(new Date(`${key}-15T12:00:00`)).replace('.', '');

function RevenueChart({ sales, rangeDays }) {
  // 30 días: barras diarias; resto: barras mensuales (máximo 12)
  const bars = useMemo(() => {
    const now = new Date();
    if (rangeDays === 30) {
      return Array.from({ length: 30 }, (_, i) => {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
        const key = day.toDateString();
        const total = sales.filter((o) => new Date(o.updatedAt).toDateString() === key).reduce((s, o) => s + o.total, 0);
        return { key, label: String(day.getDate()), title: shortDate(day.toISOString()), total, current: i === 29 };
      });
    }
    if (rangeDays === 90) {
      // 13 semanas, terminando hoy
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      return Array.from({ length: 13 }, (_, i) => {
        const end = today - (12 - i) * 7 * 86400000;
        const start = end - 7 * 86400000;
        const total = sales.filter((o) => { const t = new Date(o.updatedAt).getTime(); return t >= start && t < end; }).reduce((s, o) => s + o.total, 0);
        const label = shortDate(new Date(start).toISOString());
        return { key: String(start), label, title: `Semana del ${label}`, total, current: i === 12 };
      });
    }
    const months = 12;
    return Array.from({ length: months }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = monthKey(date);
      const total = sales.filter((o) => monthKey(new Date(o.updatedAt)) === key).reduce((s, o) => s + o.total, 0);
      return { key, label: monthLabel(key), title: `${monthLabel(key)} ${date.getFullYear()}`, total, current: i === months - 1 };
    });
  }, [sales, rangeDays]);

  const max = Math.max(1, ...bars.map((b) => b.total));
  const dense = bars.length > 13;
  const unit = rangeDays === 30 ? 'por día' : rangeDays === 90 ? 'por semana' : 'por mes';

  return (
    <div className={`flex flex-col ${SURFACE} p-5 sm:p-6`}>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-extrabold text-[#1a2b4b]">Ingresos {unit}</h3>
        <span className="text-sm text-slate-500">Mejor periodo: <span className={`${NUM} font-bold text-[#1a2b4b]`}>{clp(max === 1 ? 0 : max)}</span></span>
      </div>
      <div className={`flex min-h-[12rem] flex-1 items-end ${dense ? 'gap-[3px]' : 'gap-2 sm:gap-3'}`} role="img" aria-label={`Gráfico de ingresos ${unit}`}>
        {bars.map((bar) => (
          <div key={bar.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <div
              className={`w-full max-w-[44px] rounded-t-md transition-colors ${bar.total ? (bar.current ? 'bg-[#ffcb05]' : 'bg-[#1e40af] group-hover:bg-[#1a2b4b]') : 'bg-slate-100'}`}
              style={{ height: `${bar.total ? Math.max(4, (bar.total / max) * 100) : 2}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#1a2b4b] px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
              {bar.title}: <span className={`${NUM} font-bold`}>{clp(bar.total)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-2 flex ${dense ? 'gap-[3px]' : 'gap-2 sm:gap-3'}`}>
        {bars.map((bar, i) => (
          <span key={bar.key} className="flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap text-[11px] text-slate-500">
            {dense ? (i % 5 === 4 ? bar.label : '') : bars.length === 13 ? (i % 3 === 0 ? bar.label : '') : bar.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ order, open, onToggle }) {
  const done = order.status === 'completed';
  return (
    <li className="bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 sm:px-6 md:grid-cols-[110px_90px_1fr_90px_130px_120px_24px]"
      >
        <span className="text-sm text-slate-600 md:order-none">{shortDate(order.updatedAt)}</span>
        <span className={`${NUM} font-bold tracking-[0.08em] text-[#1a2b4b] max-md:row-start-1 max-md:col-start-1 max-md:text-lg`}>{order.code}</span>
        <span className="truncate text-sm text-slate-600 max-md:col-span-2">{order.folderName}</span>
        <span className="hidden text-sm text-slate-600 md:block">{plural(cardCount(order), 'carta', 'cartas')}</span>
        <span className={`${NUM} text-right font-bold max-md:row-start-1 max-md:col-start-2 ${done ? 'text-[#1a2b4b]' : 'text-slate-400 line-through'}`}>{clp(order.total)}</span>
        <span className="max-md:col-span-2 md:text-right">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${done ? 'bg-emerald-50 text-[#047857]' : 'bg-red-50 text-[#b91c1c]'}`}>
            <Icon name={done ? 'check_circle' : 'block'} className="text-sm" /> {done ? 'Vendido' : 'Rechazado'}
          </span>
        </span>
        <Icon name="expand_more" className={`hidden text-slate-400 transition-transform md:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-[#F8FAFC] px-4 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>Recibido: {fullDate(order.createdAt)}</span>
            <span>{done ? 'Venta confirmada' : 'Rechazado'}: {fullDate(order.updatedAt)}</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(order.items || []).map((item, index) => (
              <li key={`${item.id}-${index}`} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-slate-200">
                <Thumb item={item} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#1a2b4b]">{item.name}</p>
                  <p className="truncate text-xs text-slate-500">{[item.set, item.number, langCode(item.language)].filter(Boolean).join(' / ')}</p>
                </div>
                <p className={`${NUM} shrink-0 text-right text-sm font-bold text-[#1a2b4b]`}>
                  {item.quantity} × {clp(item.price)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

const downloadCsv = (orders) => {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Fecha', 'Código', 'Estado', 'Carpeta', 'Carta', 'Edición', 'Número', 'Idioma', 'Cantidad', 'Precio unitario', 'Subtotal']];
  for (const order of orders) {
    for (const item of order.items || []) {
      rows.push([
        new Date(order.updatedAt).toLocaleString('es-CL'), order.code, order.status === 'completed' ? 'Vendido' : 'Rechazado', order.folderName,
        item.name, item.set, item.number, langCode(item.language), item.quantity, item.price, item.price * item.quantity
      ]);
    }
  }
  const blob = new Blob([`﻿${rows.map((row) => row.map(escape).join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ventas-carpetazo-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

function History({ orders }) {
  const [range, setRange] = useState('90');
  const [status, setStatus] = useState('completed');
  const [folder, setFolder] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [limit, setLimit] = useState(25);

  const closed = useMemo(() => orders.filter((o) => o.status !== 'pending'), [orders]);
  const rangeDays = RANGES.find((r) => r.id === range)?.days ?? null;
  const inRange = useMemo(() => {
    if (!rangeDays) return closed;
    const from = Date.now() - rangeDays * 86400000;
    return closed.filter((o) => new Date(o.updatedAt).getTime() >= from);
  }, [closed, rangeDays]);
  const scoped = useMemo(() => inRange.filter((o) => folder === 'all' || o.folderName === folder), [inRange, folder]);
  const sales = useMemo(() => scoped.filter((o) => o.status === 'completed'), [scoped]);
  const folders = useMemo(() => [...new Set(closed.map((o) => o.folderName))].sort(), [closed]);

  const stats = useMemo(() => {
    const revenue = sales.reduce((s, o) => s + Number(o.total || 0), 0);
    const units = sales.reduce((s, o) => s + cardCount(o), 0);
    const rejected = scoped.length - sales.length;
    return {
      revenue, units, count: sales.length,
      average: sales.length ? revenue / sales.length : 0,
      closeRate: scoped.length ? Math.round((sales.length / scoped.length) * 100) : null,
      rejected
    };
  }, [sales, scoped]);

  const topCards = useMemo(() => {
    const byCard = new Map();
    for (const order of sales) {
      for (const item of order.items || []) {
        const key = item.id || item.name;
        const entry = byCard.get(key) || { ...item, units: 0, revenue: 0 };
        entry.units += Number(item.quantity || 1);
        entry.revenue += Number(item.price || 0) * Number(item.quantity || 1);
        byCard.set(key, entry);
      }
    }
    return [...byCard.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  const byFolder = useMemo(() => {
    const map = new Map();
    for (const order of sales) map.set(order.folderName, (map.get(order.folderName) || 0) + Number(order.total || 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);

  const ledger = useMemo(() => scoped
    .filter((o) => (status === 'all' || o.status === status || (status === 'rejected' && o.status !== 'completed')) && matchesSearch(o, query))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), [scoped, status, query]);

  if (!closed.length) {
    return (
      <EmptyState
        icon="receipt_long"
        title="Aún no tienes ventas registradas"
        text="Cada pedido que confirmes o rechaces en Solicitudes quedará aquí, con sus cartas, montos y fechas."
      />
    );
  }

  const figures = [
    { label: 'Ingresos', value: clp(stats.revenue), strong: true },
    { label: 'Ventas', value: stats.count },
    { label: 'Cartas vendidas', value: stats.units },
    { label: 'Venta promedio', value: clp(stats.average) },
    { label: 'Pedidos confirmados', value: stats.closeRate === null ? '—' : `${stats.closeRate}%` }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LiquidTabs
          ariaLabel="Periodo"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
          className="w-full rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:w-max"
          buttonClassName="h-10 whitespace-nowrap rounded-lg px-2 text-sm font-bold sm:px-4 focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          indicatorClassName="rounded-lg bg-[#1e40af]"
          indicatorStyle={{ top: 4, bottom: 4 }}
          activeTextClassName="text-white"
          inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]"
        />
        <div className="flex gap-3">
          {folders.length > 1 && (
            <Select label="Carpeta" value={folder} onChange={setFolder}>
              <option value="all">Todas las carpetas</option>
              {folders.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          )}
          <button
            type="button"
            onClick={() => downloadCsv(ledger)}
            disabled={!ledger.length}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#1e40af] ring-1 ring-slate-300 transition-[background-color,transform] duration-150 hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-50"
          >
            <Icon name="download" className="text-lg" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Cifras del periodo */}
      <dl className={`grid grid-cols-2 gap-y-5 ${SURFACE} p-5 sm:p-6 lg:grid-cols-5 lg:divide-x lg:divide-slate-100`}>
        {figures.map((f, i) => (
          <div key={f.label} className={`${i === 0 ? 'col-span-2 lg:col-span-1' : ''} lg:px-6 lg:first:pl-0`}>
            <dt className="text-sm text-slate-500">{f.label}</dt>
            <dd className={`${NUM} mt-1 font-bold ${f.strong ? 'text-4xl text-[#1e40af]' : 'text-2xl text-[#1a2b4b]'}`}>{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <RevenueChart sales={sales} rangeDays={rangeDays === 30 ? 30 : rangeDays === 90 ? 90 : 365} />

        <div className={`${SURFACE} p-5 sm:p-6`}>
          <h3 className="mb-4 text-lg font-extrabold text-[#1a2b4b]">Cartas más vendidas</h3>
          {topCards.length ? (
            <ol className="flex flex-col gap-3">
              {topCards.map((card, index) => (
                <li key={card.id || card.name} className="flex items-center gap-3">
                  <span className={`${NUM} w-5 text-center text-sm font-bold text-slate-400`}>{index + 1}</span>
                  <Thumb item={card} className="h-12 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2b4b]">{card.name}</p>
                    <p className="truncate text-xs text-slate-500">{card.set}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`${NUM} text-sm font-bold text-[#1a2b4b]`}>{plural(card.units, 'unidad', 'unidades')}</p>
                    <p className={`${NUM} text-xs text-slate-500`}>{clp(card.revenue)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">Sin ventas confirmadas en este periodo.</p>
          )}

          {byFolder.length > 1 && (
            <>
              <h3 className="mb-3 mt-6 text-lg font-extrabold text-[#1a2b4b]">Ingresos por carpeta</h3>
              <ul className="flex flex-col gap-3">
                {byFolder.map(([name, total]) => (
                  <li key={name}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700">{name}</span>
                      <span className={`${NUM} font-bold text-[#1a2b4b]`}>{clp(total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#1e40af]" style={{ width: `${(total / byFolder[0][1]) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Libro de ventas */}
      <div className={`overflow-hidden ${SURFACE.replace("bg-white ","")}`}>
        <div className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
          <h3 className="shrink-0 text-lg font-extrabold text-[#1a2b4b]">Registro de pedidos</h3>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
            <div className="sm:max-w-xs sm:flex-1"><SearchBox value={query} onChange={setQuery} placeholder="Buscar por código o carta" /></div>
            <Select label="Estado" value={status} onChange={setStatus}>
              <option value="completed">Vendidos</option>
              <option value="rejected">Rechazados{stats.rejected ? ` (${stats.rejected})` : ''}</option>
              <option value="all">Todos</option>
            </Select>
          </div>
        </div>
        <div className="hidden grid-cols-[110px_90px_1fr_90px_130px_120px_24px] gap-x-4 border-y border-slate-200 bg-[#F8FAFC] px-6 py-2.5 text-xs font-semibold text-slate-500 md:grid">
          <span>Fecha</span><span>Código</span><span>Carpeta</span><span>Cartas</span><span className="text-right">Total</span><span className="text-right">Estado</span><span />
        </div>
        {ledger.length ? (
          <ul className="divide-y divide-slate-100">
            {ledger.slice(0, limit).map((order) => (
              <HistoryRow key={order.id} order={order} open={openId === order.id} onToggle={() => setOpenId(openId === order.id ? null : order.id)} />
            ))}
          </ul>
        ) : (
          <p className="bg-white px-6 py-10 text-center text-slate-600">No hay pedidos con estos filtros.</p>
        )}
        {ledger.length > limit && (
          <button type="button" onClick={() => setLimit(limit + 25)} className="w-full border-t border-slate-200 bg-white py-3.5 text-sm font-bold text-[#1e40af] hover:bg-slate-50">
            Ver {Math.min(25, ledger.length - limit)} pedidos más
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------- Contenedor ----------------------------------- */

export default function OrdersTab({ showToast, filter = 'solicitudes', orders = [], loading = false, onOrderUpdated, onGoToFolders, emptyActionLabel }) {
  const [busyId, setBusyId] = useState(null);

  const decide = async (order, status) => {
    setBusyId(order.id);
    try {
      const response = await api.setMyOrderStatus(order.id, status);
      if (!response.success) throw new Error(response.message);
      onOrderUpdated?.(response.order);
      showToast(status === 'completed' ? `Venta ${order.code} confirmada. Stock actualizado.` : `Pedido ${order.code} rechazado.`, status === 'completed' ? 'success' : 'info');
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      showToast(error?.message?.includes('409') ? 'Este pedido ya fue gestionado.' : 'No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent motion-reduce:animate-none" />
      </div>
    );
  }

  return filter === 'historial'
    ? <History orders={orders} />
    : <Requests orders={orders} onDecide={decide} busyId={busyId} showToast={showToast} onGoToFolders={onGoToFolders} emptyActionLabel={emptyActionLabel} />;
}
