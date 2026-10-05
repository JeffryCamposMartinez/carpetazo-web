import { TCG_LABELS, getFolderFilter } from '../../config/folderOptions';

// La carpeta física: imagen de la carpeta teñida con su color, nombre, juego y cifras.
// Es un contenedor de consulta: el tamaño del texto sigue al ancho de la propia carpeta (en una columna estrecha, en la vista previa del formulario o en un monitor grande)
export default function FolderBinder({ folder }) {
  return (
    <div className="@container relative aspect-[32/37] w-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-1 group-active:scale-[0.985] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-active:scale-100">
      <div
        className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat drop-shadow-md"
        style={{ filter: getFolderFilter(folder.color) }}
      />
      <div className="relative z-10 flex h-full w-full flex-col justify-between pb-[15%] pl-[18%] pr-[16%] pt-[5%]">
        <div className="flex flex-col">
          {/* Cifras: secundarias, para que el nombre mande */}
          <div className="flex justify-between gap-1" style={{ fontSize: 'clamp(0.6875rem, 6.4cqw, 0.8125rem)' }}>
            <span className="flex items-center gap-[0.3em] rounded-md bg-black/25 px-[0.55em] py-[0.25em] font-semibold tabular-nums text-white/90" title="Visitas esta semana">
              <span translate="no" aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '1.25em' }}>visibility</span>
              <span className="sr-only">Visitas esta semana: </span>{folder.validWeeklyVisits || 0}
            </span>
            <span className="flex items-center gap-[0.3em] rounded-md bg-black/25 px-[0.55em] py-[0.25em] font-semibold tabular-nums text-white/90" title="Cartas en la carpeta">
              <span translate="no" aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '1.25em' }}>style</span>
              <span className="sr-only">Cartas en la carpeta: </span>{folder.cardsCount || 0}
            </span>
          </div>
          <h3
            className="mt-2 line-clamp-3 w-full break-words pr-1 font-extrabold leading-[1.08] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]"
            style={{ fontSize: 'clamp(1.0625rem, 11.5cqw, 1.625rem)' }}
            title={folder.name}
          >
            {folder.name}
          </h3>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="min-w-0 truncate whitespace-nowrap rounded-md border border-white/70 px-[0.6em] py-[0.3em] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]"
            style={{ fontSize: 'clamp(0.625rem, 5.2cqw, 0.75rem)' }}
          >
            {TCG_LABELS[folder.tcg] || folder.tcg}
          </span>
          {!folder.isPublic && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/35 text-white" title="Carpeta privada">
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[15px]">lock</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
