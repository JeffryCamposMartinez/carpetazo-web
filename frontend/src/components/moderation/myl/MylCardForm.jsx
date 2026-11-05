import { useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api';
import { ButtonSpinner } from '../../ui/LoadingState';
import SvgIcon from '../../ui/SvgIcon';
import { ChipInput, Field, INPUT, SECTION, titleCase } from './MylFields';

// Los ejemplos de cada campo salen de una carta que ya existe: Rey Arturo Pendragón (Primer Bloque · Espada Sagrada)
const EXAMPLE = { name: 'Rey Arturo Pendragón', edition: 'Espada Sagrada', product: 'Colección Espada Sagrada', number: 'ES-001-236', race: 'CABALLERO', mechanic: 'Bono Fuerza' };
const NEW = 'new';
export const blankCard = (carry = {}) => ({ name: '', blockId: carry.blockId ?? '', groupId: carry.groupId ?? '', newEdition: '', physicalProductId: carry.physicalProductId ?? '', newProduct: '', type: '', cost: '', force: '', races: [], frequency: carry.frequency ?? '', number: '', mechanics: [], effect: '', imageUrl: '' });

const toBody = (form, allowDuplicate) => ({
  name: form.name.trim(), blockId: Number(form.blockId),
  ...(form.groupId === NEW ? { newEdition: form.newEdition.trim() } : { groupId: Number(form.groupId) }),
  ...(form.physicalProductId === NEW ? { newProduct: form.newProduct.trim() } : form.physicalProductId ? { physicalProductId: Number(form.physicalProductId) } : {}),
  type: form.type, cost: form.cost, force: form.force, races: form.races, frequency: form.frequency, number: form.number.trim(), mechanics: form.mechanics, effect: form.effect, imageUrl: form.imageUrl, allowDuplicate,
});

// Faltantes antes de enviar: el servidor vuelve a validar todo
const missing = (form) => ({
  name: !form.name.trim() && 'Escribe el nombre de la carta.',
  blockId: !form.blockId && 'Elige el bloque.',
  groupId: (!form.groupId && 'Elige la edición.') || (form.groupId === NEW && !form.newEdition.trim() && 'Escribe el nombre de la edición nueva.'),
  newProduct: form.physicalProductId === NEW && !form.newProduct.trim() && 'Escribe el nombre del producto nuevo.',
  type: !form.type && 'Elige el tipo.',
  frequency: !form.frequency && 'Elige la frecuencia.',
});

// Crear una carta nueva o corregir una que se subió desde aquí. `editing` trae la carta; `options` las listas del servidor.
export default function MylCardForm({ options, editing, carry, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (editing ? { ...blankCard(), ...editing, groupId: editing.groupId, physicalProductId: editing.physicalProductId ?? '' } : blankCard(carry)));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [problems, setProblems] = useState({});
  const [duplicates, setDuplicates] = useState(null);
  const fileRef = useRef(null);
  const set = (patch) => { setForm((previous) => ({ ...previous, ...patch })); setProblems({}); setError(''); };

  const editions = useMemo(() => options.editions.filter((item) => item.blockId === Number(form.blockId)), [options, form.blockId]);
  const products = useMemo(() => options.products.filter((item) => item.blockId === Number(form.blockId)), [options, form.blockId]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const data = new FormData();
      data.append('image', file);
      data.append('type', 'card');
      const response = await api.uploadImage(data);
      set({ imageUrl: response.url });
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (event, allowDuplicate = false) => {
    event.preventDefault();
    const found = missing(form);
    if (Object.values(found).some(Boolean)) { setProblems(found); setError('Completa los campos marcados.'); return; }
    setBusy(true); setError(''); setDuplicates(null);
    try {
      const response = editing ? await api.updateMylCard(editing.productId, toBody(form, allowDuplicate)) : await api.createMylCard(toBody(form, allowDuplicate));
      onSaved(response.card, editing ? 'updated' : 'created');
    } catch (err) {
      if (err.code === 'duplicate') setDuplicates(err.duplicates || []); else setError(err.message || 'No se pudo guardar la carta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <section className={`${SECTION} lg:sticky lg:top-4`} aria-label="Imagen de la carta">
        <h3 className="text-base font-extrabold text-[#12315f]">Imagen</h3>
        <div className="mx-auto mt-3 w-full max-w-[8.5rem] lg:max-w-[13rem] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" style={{ aspectRatio: '709 / 1016' }}>
          {form.imageUrl
            ? <img src={form.imageUrl} alt={form.name ? `Imagen de ${form.name}` : 'Imagen de la carta'} className="h-full w-full object-contain" />
            : <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm font-semibold text-slate-500"><SvgIcon name="image" translate="no" aria-hidden="true" className="text-[40px] text-slate-400" />Aún sin imagen</div>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="myl-image" onChange={(event) => upload(event.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#1e40af] text-sm font-extrabold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-[#e8effc] active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          {uploading ? <><ButtonSpinner /> Subiendo…</> : <><SvgIcon name="upload" translate="no" aria-hidden="true" className="text-[20px]" />{form.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}</>}
        </button>
        <p className="mt-2 text-xs text-slate-500">Foto o escaneo de la carta de frente, derecha y completa. Se guarda en la carpeta de su producto, como las demás.</p>
        {!form.imageUrl && <p className="mt-1 text-xs font-bold text-amber-800">Sin imagen la carta se guarda igual, pero nadie la completará sola: súbela cuando la tengas.</p>}
      </section>

      <div className="space-y-4">
        <section className={SECTION} aria-label="Dónde va la carta">
          <h3 className="text-base font-extrabold text-[#12315f]">Dónde va</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" required example={EXAMPLE.name} error={problems.name} htmlFor="myl-name" className="sm:col-span-2">
              <input id="myl-name" value={form.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} className={INPUT} autoComplete="off" />
            </Field>
            <Field label="Bloque" required error={problems.blockId} htmlFor="myl-block" example="Primer Bloque">
              <select id="myl-block" value={form.blockId} onChange={(event) => set({ blockId: event.target.value, groupId: '', physicalProductId: '', newEdition: '', newProduct: '' })} className={INPUT}>
                <option value="">Elige el bloque…</option>
                {options.blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}
              </select>
            </Field>
            <Field label="Edición" required error={problems.groupId} htmlFor="myl-edition" example={EXAMPLE.edition} hint="Las del bloque elegido. Si no existe, créala: el barrido de las 2 am la reconoce por su nombre.">
              <select id="myl-edition" value={form.groupId} disabled={!form.blockId} onChange={(event) => set({ groupId: event.target.value === NEW ? NEW : Number(event.target.value) || '' })} className={INPUT}>
                <option value="">{form.blockId ? 'Elige la edición…' : 'Primero elige el bloque'}</option>
                {editions.map((edition) => <option key={edition.groupId} value={edition.groupId}>{edition.name}</option>)}
                {form.blockId && <option value={NEW}>+ Crear una edición nueva</option>}
              </select>
              {form.groupId === NEW && <input aria-label="Nombre de la edición nueva" value={form.newEdition} maxLength={80} onChange={(event) => set({ newEdition: event.target.value })} placeholder="Nombre de la edición nueva" className={`${INPUT} mt-2`} />}
            </Field>
            <Field label="Producto o colección" error={problems.newProduct} htmlFor="myl-product" example={EXAMPLE.product} hint="El kit, display o colección donde viene. Define la carpeta de la imagen." className="sm:col-span-2">
              <select id="myl-product" value={form.physicalProductId} disabled={!form.blockId} onChange={(event) => set({ physicalProductId: event.target.value === NEW ? NEW : Number(event.target.value) || '' })} className={INPUT}>
                <option value="">Sin producto (usa el nombre de la edición)</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                {form.blockId && <option value={NEW}>+ Crear un producto nuevo</option>}
              </select>
              {form.physicalProductId === NEW && <input aria-label="Nombre del producto nuevo" value={form.newProduct} maxLength={100} onChange={(event) => set({ newProduct: event.target.value })} placeholder="Nombre del producto nuevo" className={`${INPUT} mt-2`} />}
            </Field>
          </div>
        </section>

        <section className={SECTION} aria-label="Datos de la carta">
          <h3 className="text-base font-extrabold text-[#12315f]">Datos de la carta</h3>
          <div className="mt-3 space-y-3">
            <Field label="Tipo" required error={problems.type}>
              <div role="radiogroup" aria-label="Tipo" className="flex flex-wrap gap-2">
                {options.types.map((type) => (
                  <button key={type} type="button" role="radio" aria-checked={form.type === type} onClick={() => set({ type })} className={`h-11 rounded-full px-4 text-sm font-extrabold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${form.type === type ? 'bg-[#12315f] text-white' : 'bg-[#e8effc] text-[#12315f] hover:bg-[#d6e2f8]'}`}>{titleCase(type)}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Coste" htmlFor="myl-cost" example="5">
                <input id="myl-cost" inputMode="numeric" value={form.cost} maxLength={3} onChange={(event) => set({ cost: event.target.value.replace(/\D/g, '') })} className={INPUT} />
              </Field>
              <Field label="Fuerza" htmlFor="myl-force" example="2">
                <input id="myl-force" inputMode="numeric" value={form.force} maxLength={3} onChange={(event) => set({ force: event.target.value.replace(/\D/g, '') })} className={INPUT} />
              </Field>
              <Field label="Frecuencia" required error={problems.frequency} htmlFor="myl-frequency" example="Real" className="col-span-2">
                <select id="myl-frequency" value={form.frequency} onChange={(event) => set({ frequency: event.target.value })} className={INPUT}>
                  <option value="">Elige…</option>
                  {options.frequencies.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Número de colección" htmlFor="myl-number" example={EXAMPLE.number} hint="Tal como está impreso en la carta (sigla, número y total). Sirve para detectar cartas repetidas.">
              <input id="myl-number" value={form.number} maxLength={60} onChange={(event) => set({ number: event.target.value })} className={INPUT} autoComplete="off" />
            </Field>
            <Field label="Razas" htmlFor="myl-race" example={EXAMPLE.race} hint="Hasta 6. Enter o coma para agregar; se sugieren las que ya existen.">
              <ChipInput id="myl-race" values={form.races} onChange={(races) => set({ races })} suggestions={options.races} max={6} placeholder="Escribe una raza" format={(value) => value.toUpperCase()} />
            </Field>
            <Field label="Habilidades" htmlFor="myl-mechanics" example={EXAMPLE.mechanic} hint="Etiquetas de lo que hace la carta (Robar, Anular, Indestructible…). Hasta 12.">
              <ChipInput id="myl-mechanics" values={form.mechanics} onChange={(mechanics) => set({ mechanics })} suggestions={options.mechanics} max={12} placeholder="Escribe una habilidad" />
            </Field>
            <Field label="Efecto" htmlFor="myl-effect" hint={`${form.effect.length}/4000. Cada línea nueva es un párrafo. Escríbelo tal como dice la carta.`}>
              <textarea id="myl-effect" rows={6} value={form.effect} maxLength={4000} onChange={(event) => set({ effect: event.target.value })} placeholder="Solo puedes tener en juego a un Rey Arturo Pendragón. Mientras esté en juego, tus Caballeros ganan +1 a la fuerza…" className="w-full resize-y rounded-xl border-2 border-[#12315f]/15 bg-white px-3 py-2.5 text-[15px] font-semibold text-[#12315f] outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-medium placeholder:text-slate-400 focus:border-[#1e40af] focus:shadow-[0_0_0_3px_rgba(30,64,175,0.15)]" />
            </Field>
          </div>
        </section>

        {duplicates && (
          <div role="alert" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-900">Ya hay {duplicates.length === 1 ? 'una carta parecida' : 'cartas parecidas'} en la base</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">{duplicates.map((item) => <li key={item.productId}><span className="font-bold">{item.name}</span>{[item.edition, item.number].filter(Boolean).length > 0 && ` · ${[item.edition, item.number].filter(Boolean).join(' · ')}`}</li>)}</ul>
            <p className="mt-2 text-sm text-amber-900">Si es otra carta (otra versión o impresión), puedes crearla igual.</p>
            <button type="button" disabled={busy} onClick={(event) => submit(event, true)} className="mt-3 h-11 rounded-full bg-amber-600 px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-amber-700 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">{editing ? 'Guardar igual' : 'Crear igual'}</button>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800 ring-1 ring-red-200">{error}</p>}

        <div className="sticky bottom-0 -mx-1 flex gap-2 bg-gradient-to-t from-[#f3f6fc] via-[#f3f6fc] to-transparent px-1 pb-1 pt-4">
          {onCancel && <button type="button" onClick={onCancel} disabled={busy} className="h-12 rounded-full border-2 border-slate-400 px-5 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Cancelar</button>}
          <button type="submit" disabled={busy || uploading} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#1e40af] px-6 text-[15px] font-extrabold text-white shadow-[0_10px_20px_-12px_rgba(30,64,175,0.9)] transition-[background-color,transform] duration-150 hover:bg-[#12315f] active:scale-[0.98] disabled:bg-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
            {busy ? <><ButtonSpinner /> Guardando…</> : <><SvgIcon name={editing ? 'save' : 'library_add'} translate="no" aria-hidden="true" className="text-[20px]" />{editing ? 'Guardar cambios' : 'Crear carta'}</>}
          </button>
        </div>
      </div>
    </form>
  );
}
