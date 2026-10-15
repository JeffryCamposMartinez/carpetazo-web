import { useState } from 'react';
import { ButtonSpinner } from '../ui/LoadingState';

const chip = 'flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-50';
const textButton = 'flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-50';
const Icon = ({ name, className = '' }) => <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[18px] ${className}`}>{name}</span>;

// Listas de deseos: elegir cuál se ve, crear, renombrar, borrar y dejar una como activa (la que se muestra en el perfil)
export default function WishlistLists({ lists, selectedId, onSelect, onCreate, onRename, onActivate, onDelete, busy, maxLists }) {
  const [mode, setMode] = useState(''); // '' | 'new' | 'rename' | 'delete'
  const [text, setText] = useState('');
  const current = lists.find((list) => list.id === selectedId);
  if (!current) return null;

  const open = (next) => { setMode(next); setText(next === 'rename' ? current.name : ''); };
  const submit = async (event) => {
    event.preventDefault();
    const name = text.trim();
    if (!name) return;
    const ok = mode === 'new' ? await onCreate(name) : await onRename(current.id, name);
    if (ok) setMode('');
  };

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Mis listas de deseos" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            aria-pressed={list.id === current.id}
            onClick={() => { setMode(''); onSelect(list.id); }}
            className={`${chip} ${list.id === current.id ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-200 [@media(hover:hover)]:hover:bg-slate-50 lg:bg-slate-50'}`}
          >
            {list.isActive && <Icon name="star" className={list.id === current.id ? 'text-[#facc15]' : 'text-[#d97706]'} />}
            <span className="max-w-[10rem] truncate">{list.name}</span>
            <span className={`text-xs tabular-nums ${list.id === current.id ? 'text-[#facc15]' : 'text-slate-500'}`}>{list.count}</span>
          </button>
        ))}
        {lists.length < maxLists && (
          <button type="button" onClick={() => open('new')} disabled={busy} className={`${chip} border border-dashed border-[#1e40af]/40 bg-transparent text-[#1e40af] hover:bg-blue-50`}>
            <Icon name="add" />Nueva lista
          </button>
        )}
      </div>

      {mode === 'new' || mode === 'rename' ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={40}
            aria-label={mode === 'new' ? 'Nombre de la nueva lista' : 'Nuevo nombre de la lista'}
            placeholder={mode === 'new' ? 'Nombre de la lista (ej: Para el torneo)' : 'Nombre de la lista'}
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
          />
          <button type="submit" disabled={busy || !text.trim()} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#facc15] px-5 text-sm font-extrabold text-[#12315f] transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.97] disabled:opacity-50">
            {busy && <ButtonSpinner tone="dark" />}{mode === 'new' ? 'Crear' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setMode('')} className="h-11 shrink-0 rounded-full px-3 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
        </form>
      ) : mode === 'delete' ? (
        <div role="alertdialog" aria-label="Confirmar borrado de la lista" className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">
          <span className="min-w-0 flex-1 font-semibold">¿Borrar “{current.name}” y sus {current.count} {current.count === 1 ? 'carta' : 'cartas'}?</span>
          <button type="button" disabled={busy} onClick={async () => { if (await onDelete(current.id)) setMode(''); }} className="flex h-9 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-extrabold text-white transition-transform duration-150 active:scale-[0.97] disabled:opacity-50">{busy && <ButtonSpinner />}Sí, borrar</button>
          <button type="button" onClick={() => setMode('')} className="h-9 rounded-full px-3 text-sm font-bold text-slate-700 hover:bg-white/70">No</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {current.isActive
            ? <span className="flex h-9 items-center gap-1.5 rounded-full bg-[#fef3c7] px-3 text-sm font-bold text-[#92400e]"><Icon name="star" />Activa: se ve en tu perfil</span>
            : <button type="button" onClick={() => onActivate(current.id)} disabled={busy} className={textButton}><Icon name="star" />Mostrar esta en mi perfil</button>}
          <button type="button" onClick={() => open('rename')} disabled={busy} className={textButton}><Icon name="edit" />Renombrar</button>
          {lists.length > 1 && <button type="button" onClick={() => open('delete')} disabled={busy} className={`${textButton} !text-red-700 hover:!bg-red-50`}><Icon name="delete" />Borrar lista</button>}
        </div>
      )}
    </div>
  );
}
