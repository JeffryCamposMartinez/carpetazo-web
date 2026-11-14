import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCLP } from '../../utils/orderMessage';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import PriceLabels from './PriceLabels';

const input = 'h-10 w-20 rounded-xl border border-slate-300 px-2 text-center text-sm font-bold focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';

function CardList({ cards, empty, detail }) {
  if (!cards.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {cards.map((c) => (
        <li key={c.id}>
          <Link to={`/carpeta/${c.folderId}`} className="flex items-center gap-3 px-3 py-2 transition hover:bg-slate-50">
            {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover" /> : <span className="h-12 w-9 shrink-0 rounded bg-slate-100" />}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#1a2b4b]">{c.name}</span><span className="block truncate text-xs text-slate-500">{c.folderName}</span></span>
            <span className="shrink-0 text-right text-xs font-bold text-slate-700">{detail(c)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Alertas de stock (poco stock, sin movimiento), sus umbrales y las etiquetas de precio con QR
export default function StoreStockPanel({ showToast }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({ lowStockAt: 1, staleDays: 60 });
  const [saving, setSaving] = useState(false);
  const load = () => api.getStockAlerts().then((r) => { setData(r); setSettings({ lowStockAt: r.lowStockAt, staleDays: r.staleDays }); }).catch(() => setData({ low: [], stale: [], error: true }));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveStockSettings({ lowStockAt: Number(settings.lowStockAt), staleDays: Number(settings.staleDays) });
      showToast('Alertas actualizadas', 'success');
      load();
    } catch (error) { showToast(error.message || 'No se pudo guardar', 'error'); } finally { setSaving(false); }
  };

  if (!data) return <LoadingState variant="compact" label="Revisando tu stock" />;
  const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="text-sm font-bold text-[#1a2b4b]">Avisar con <input type="number" min={0} max={50} value={settings.lowStockAt} onChange={(e) => setSettings({ ...settings, lowStockAt: e.target.value })} className={input} /> unidades o menos</label>
        <label className="text-sm font-bold text-[#1a2b4b]">Sin movimiento hace <input type="number" min={7} max={365} value={settings.staleDays} onChange={(e) => setSettings({ ...settings, staleDays: e.target.value })} className={input} /> días</label>
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1e40af] px-4 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-60">{saving && <ButtonSpinner tone="dark" />}Guardar</button>
      </div>
      <section>
        <h4 className="mb-2 text-sm font-black text-[#1a2b4b]">Poco stock ({data.low.length})</h4>
        <CardList cards={data.low} empty="Ninguna carta bajo el mínimo." detail={(c) => <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{c.stock} {c.stock === 1 ? 'unidad' : 'unidades'}</span>} />
      </section>
      <section>
        <h4 className="mb-2 text-sm font-black text-[#1a2b4b]">Sin movimiento ({data.stale.length})</h4>
        <CardList cards={data.stale} empty="Todas tus cartas se movieron hace poco." detail={(c) => <>{c.price ? formatCLP(c.price) : 'Sin precio'}<br /><span className="font-normal text-slate-500">hace {daysAgo(c.updatedAt)} días</span></>} />
      </section>
      <PriceLabels showToast={showToast} />
    </div>
  );
}
