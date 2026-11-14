import { useMemo } from 'react';
import { chileData } from '../../config/chileData';
import ThemedSelect from '../ui/ThemedSelect';
import { PAYMENT_NAMES, STORE_GAMES } from '../../utils/storeHours';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';
const label = 'mb-1 block text-sm font-bold text-[#1a2b4b]';

export function Chips({ options, value = [], onChange, names = {} }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((v) => {
        const on = value.includes(v);
        return (
          <button key={v} type="button" aria-pressed={on} onClick={() => toggle(v)} className={`h-9 rounded-full px-3.5 text-sm font-bold transition active:scale-[0.97] ${on ? 'bg-[#1e40af] text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-[#1e40af]'}`}>
            {names[v] || v}
          </button>
        );
      })}
    </div>
  );
}

// Campos de la ficha: dirección, medios de pago, juegos que compra y vende, y política de cambios
export function AddressFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const comunas = useMemo(() => [
    { value: '', label: 'Elige tu comuna' },
    ...chileData.flatMap(({ region, comunas: list }) => list.map((c) => ({ value: c, label: c, group: region })))
  ], []);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className={label}>Dirección del local</span>
        <input type="text" maxLength={150} value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="Calle y número, local" className={`${field} h-11`} />
      </label>
      <label>
        <span className={label}>Referencia (opcional)</span>
        <input type="text" maxLength={150} value={value.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Segundo piso, frente a la plaza" className={`${field} h-11`} />
      </label>
      <div>
        <span className={label}>Comuna</span>
        <ThemedSelect value={value.comuna} onChange={(c) => set({ comuna: c })} options={comunas} searchable searchPlaceholder="Escribe una comuna…" icon="location_on" ariaLabel="Comuna del local" buttonClassName="!min-h-11 !rounded-xl" />
      </div>
    </div>
  );
}

export function TradeFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Medios de pago</span>
        <Chips options={Object.keys(PAYMENT_NAMES)} names={PAYMENT_NAMES} value={value.paymentMethods} onChange={(v) => set({ paymentMethods: v })} />
      </div>
      <div>
        <span className={label}>Juegos que vendes</span>
        <Chips options={STORE_GAMES} value={value.sellGames} onChange={(v) => set({ sellGames: v })} />
      </div>
      <div>
        <span className={label}>Juegos que compras</span>
        <Chips options={STORE_GAMES} value={value.buyGames} onChange={(v) => set({ buyGames: v })} />
      </div>
      <label className="block">
        <span className={label}>Nota de compra (opcional)</span>
        <input type="text" maxLength={300} value={value.buyNote} onChange={(e) => set({ buyNote: e.target.value })} placeholder="Compramos colecciones completas y cartas sueltas en buen estado" className={`${field} h-11`} />
      </label>
    </div>
  );
}

export function PolicyField({ value, onChange }) {
  return (
    <label className="block">
      <span className={label}>Política de cambios y garantías</span>
      <textarea rows={6} maxLength={2000} value={value.policy} onChange={(e) => onChange({ ...value, policy: e.target.value })} placeholder="Ej.: cambios dentro de 7 días con la carta en el mismo estado y su boleta." className={`${field} py-2.5 leading-relaxed`} />
      <span className="mt-1 block text-right text-xs text-slate-500">{value.policy.length}/2000</span>
    </label>
  );
}
