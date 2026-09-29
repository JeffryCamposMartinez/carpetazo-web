import React, { useEffect, useState } from 'react';

const AdminCardEdit = React.memo(({ card, onUpdate, onDelete, dragHandleProps = {}, compact = false, showDetails = false, dense = false }) => {
  const [price, setPrice] = useState(card.price);
  const [stock, setStock] = useState(card.stock);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(card.price);
    setStock(card.stock);
  }, [card.price, card.stock]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(card.id, price, stock);
    setSaving(false);
  };

  const hasChanges = price != card.price || stock != card.stock;

  return (
    <div className="bg-blue-50 rounded-2xl border border-gray-200 flex flex-col shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
      <div
        {...dragHandleProps}
        className={`${compact ? 'top-1.5 left-1.5 w-8 h-8' : 'top-2 left-2 w-9 h-9'} absolute z-10 rounded-full bg-white/90 text-[#1e40af] shadow-sm border border-blue-100 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-100 transition-opacity`}
        style={{ touchAction: 'none' }}
        title="Mantén y arrastra para ordenar"
      >
        <span translate="no" className="material-symbols-outlined text-[21px]">drag_indicator</span>
      </div>
      <button
        onClick={() => onDelete(card.id)}
        className={`${compact ? 'top-1.5 right-1.5 w-7 h-7' : 'top-2 right-2 w-8 h-8'} absolute z-10 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm`}
        title="Eliminar carta"
      >
        <span translate="no" className="material-symbols-outlined text-[18px]">delete</span>
      </button>
      <div className={`${compact && !showDetails ? 'p-1.5' : compact ? (dense ? 'p-1.5' : 'p-2.5') : 'p-4'} flex flex-col items-center flex-1`}>
        <div className={`w-full relative pt-[140%] ${showDetails ? (compact ? 'mb-2' : 'mb-3') : 'mb-0'}`}>
          {imgError || !card.imageUrl ? (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg p-2 text-center border-2 border-gray-200">
                <img src="/images/logos/logo_completo.webp" className="w-3/4 max-w-[100px] max-h-[50%] opacity-40 grayscale object-contain mb-1.5" alt="Logo" />
                <span className="text-[11px] sm:text-xs font-bold text-gray-400 leading-tight">SIN<br/>IMAGEN</span>
              </div>
            ) : (
              <img 
                src={card.imageUrl} 
                referrerPolicy="no-referrer" 
                alt={card.name} 
                className="absolute inset-0 w-full h-full object-fill filter drop-shadow-md transition-transform duration-300" 
                onError={() => setImgError(true)} 
              />
            )}
          {showDetails && (Number(card.stock || 0) <= 0 || Number(card.price || 0) <= 0) && (
            <div className="absolute bottom-1 left-1 right-1 z-10 flex flex-wrap justify-center gap-1">
              {Number(card.stock || 0) <= 0 && (
                <span className="rounded-full bg-red-600/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">Sin stock</span>
              )}
              {Number(card.price || 0) <= 0 && (
                <span className="rounded-full bg-amber-500/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">Sin precio</span>
              )}
            </div>
          )}
        </div>
        {showDetails && (
          <>
            <p className={`font-bold text-gray-900 text-center line-clamp-1 w-full ${dense ? 'text-[11px]' : compact ? 'text-xs' : 'text-sm'}`}>{card.name}</p>
            <p className={`${dense ? 'text-[9px] mb-1.5' : `text-[10px] ${compact ? 'mb-2' : 'mb-4'}`} text-gray-500 text-center truncate w-full`}>
              {compact ? card.set : (
                <>
                  {card.set} • {card.supertype} • #{(() => {
                    let numStr = (card.number || card.apiId?.split('-')[1] || card.id?.split('-')[1] || '').toString();
                    let totalStr = (card.total || '---').toString();
                    if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
                    if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
                    return `${numStr}/${totalStr}`;
                  })()}
                </>
              )}
            </p>
          </>
        )}

        {showDetails && <div className={`${dense ? 'gap-1' : compact ? 'gap-1.5' : 'gap-2'} flex flex-col w-full mt-auto`}>
          <div className={`w-full bg-gray-50 ${dense ? 'px-1.5 py-1' : 'px-2 py-1.5'} rounded-lg border border-gray-200 shadow-sm ${compact ? 'flex flex-col gap-1' : 'flex justify-between items-center'}`}>
            <label className={`${dense ? 'text-[9px]' : 'text-[10px]'} text-gray-500 uppercase tracking-wider font-bold`}>Stock</label>
            <div className={`${dense ? 'grid grid-cols-[1.35rem_minmax(2rem,1fr)_1.35rem]' : `${compact ? 'w-full' : ''} flex items-center`} shadow-sm rounded-md overflow-hidden border border-gray-300`}>
              <button type="button" onClick={() => setStock(Math.max(0, parseInt(stock) - 1))} className={`${dense ? 'w-full text-xs' : compact ? 'w-8 text-sm' : 'w-6 text-sm'} h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors font-black text-gray-700`}>-</button>
              <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className={`${dense ? 'w-full min-w-[32px] text-[11px]' : compact ? 'flex-1 min-w-0 text-xs' : 'w-10 text-xs'} h-7 text-center bg-white focus:outline-none px-0 font-black border-x border-gray-300 text-gray-950 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
              <button type="button" onClick={() => setStock(parseInt(stock) + 1)} className={`${dense ? 'w-full text-xs' : compact ? 'w-8 text-sm' : 'w-6 text-sm'} h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors font-black text-gray-700`}>+</button>
            </div>
          </div>
          <div className={`w-full bg-gray-50 ${dense ? 'px-1.5 py-1' : 'px-2 py-1.5'} rounded-lg border border-gray-200 shadow-sm ${compact ? 'flex flex-col gap-1' : 'flex justify-between items-center'}`}>
            <label className={`${dense ? 'text-[9px]' : 'text-[10px]'} text-gray-500 uppercase tracking-wider font-bold`}>Precio</label>
            <div className={`relative ${compact ? 'w-full' : 'w-24'}`}>
              <span className={`absolute ${dense ? 'left-1.5 text-[11px]' : 'left-2 text-xs'} top-1/2 -translate-y-1/2 text-gray-500 font-bold`}>$</span>
              <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} className={`w-full h-7 ${dense ? 'pl-4 pr-1 text-[11px]' : 'pl-6 pr-2 text-xs'} bg-white focus:outline-none font-bold rounded-md border border-gray-300 shadow-sm text-right text-gray-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
            </div>
          </div>
        </div>}
      </div>

      {showDetails && (
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`w-full ${compact ? 'py-2' : 'py-3'} font-bold text-xs tracking-wide transition-colors border-t border-gray-200 flex items-center justify-center gap-1.5 ` + (hasChanges ? 'bg-[#1e40af] text-white hover:bg-blue-800' : 'bg-gray-100 text-gray-500 opacity-60')}
        >
          <span translate="no" className="material-symbols-outlined text-[16px]">{saving ? 'hourglass_empty' : 'save'}</span>
          {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado'}
        </button>
      )}
    </div>
  );
}, (prev, next) => (
  prev.card === next.card
  && prev.compact === next.compact
  && prev.showDetails === next.showDetails
  && prev.dense === next.dense
  && prev.onUpdate === next.onUpdate
  && prev.onDelete === next.onDelete
  && prev.dragHandleProps === next.dragHandleProps
));

AdminCardEdit.displayName = 'AdminCardEdit';

export default AdminCardEdit;
