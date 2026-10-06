import { formatClp } from '../../services/tcgcsvPrices';

// Precio referencial en la lista de resultados: el más bajo de los que hay ("Desde" si hay varios distintos)
export function ReferencePriceLine({ variants, className = '' }) {
  if (!variants?.length) return null;
  const from = variants[0].clp;
  return (
    <p className={`truncate font-bold text-[#1e40af] ${className}`} title="Precio referencial">
      {variants.length > 1 && variants[variants.length - 1].clp !== from ? 'Desde ' : 'Ref. '}{formatClp(from)}
    </p>
  );
}

const SOURCE_NOTE = {
  tcgplayer: <>Precio de mercado en <strong className="font-extrabold text-[#1e40af]">TCGplayer</strong>, en pesos. Es solo una guía.</>,
  carpetazoSales: <>Mediana de las ventas recientes en <strong className="font-extrabold text-[#1e40af]">Carpetazo</strong>. Es solo una guía.</>,
  carpetazoSellers: <>Mediana de lo que piden los vendedores en <strong className="font-extrabold text-[#1e40af]">Carpetazo</strong>. Es solo una guía.</>,
};

// Al agregar una carta: precio referencial (uno por acabado en Pokémon); tocarlo lo copia al campo de precio
export function ReferencePriceBox({ variants, source, currentPrice, onUse }) {
  if (variants === null) return <p className="text-xs text-gray-400">Buscando precio referencial…</p>;
  if (!variants.length) return <p className="text-xs text-gray-400">{source === 'carpetazo' ? 'Aún no hay suficientes ventas ni vendedores para una referencia.' : 'Sin precio de mercado para esta carta.'}</p>;
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2" aria-label="Precio referencial">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Precio referencial de mercado</p>
      <ul className="mt-1 space-y-1">
        {variants.map((variant) => {
          const used = String(variant.clp) === String(currentPrice);
          return (
            <li key={variant.name} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-gray-600">{variant.name}{variant.note && <span className="text-xs text-gray-400"> · {variant.note}</span>}</span>
              <span className="flex shrink-0 items-center gap-2 font-bold text-gray-900 tabular-nums">
                {formatClp(variant.clp)}
                <button type="button" onClick={() => onUse(variant.clp)} disabled={used} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[#1e40af] ring-1 ring-[#1e40af]/30 transition-colors hover:bg-[#1e40af] hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#1e40af]">
                  {used ? 'Usado' : 'Usar'}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-gray-500">{SOURCE_NOTE[source === 'carpetazo' ? (variants[0].from === 'sales' ? 'carpetazoSales' : 'carpetazoSellers') : source]}</p>
    </div>
  );
}
