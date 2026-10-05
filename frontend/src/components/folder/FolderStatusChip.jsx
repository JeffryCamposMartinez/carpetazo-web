// Estado de visibilidad: un solo componente para Pública y Privada (pensado para sumar otros estados sin rediseñar la fila)
const FOLDER_STATUS = {
  public: {
    label: 'Pública',
    icon: 'public',
    action: 'Pulsa para hacerla privada',
    className: 'bg-emerald-50 text-[#047857] ring-emerald-200 hover:bg-emerald-100'
  },
  private: {
    label: 'Privada',
    icon: 'lock',
    action: 'Pulsa para publicarla',
    className: 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
  }
};

export default function FolderStatusChip({ folder, onToggle }) {
  const status = FOLDER_STATUS[folder.isPublic ? 'public' : 'private'];
  return (
    <button
      type="button"
      onClick={(e) => onToggle(e, folder)}
      aria-label={`${folder.name}: carpeta ${status.label.toLowerCase()}. ${status.action}`}
      title={folder.isPublic ? 'Visible para compradores. Toca para hacerla privada.' : 'Solo tú la ves. Toca para publicarla.'}
      className={`relative inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-2 text-[13px] font-bold ring-1 @[10.75rem]:pr-2.5 transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] after:absolute after:-inset-x-0.5 after:-inset-y-1 after:content-[''] ${status.className}`}
    >
      <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">{status.icon}</span>
      <span className="hidden @[10.75rem]:inline">{status.label}</span>
    </button>
  );
}
