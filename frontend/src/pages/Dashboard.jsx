import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import OrdersTab from '../components/OrdersTab';
import LiquidTabs from '../components/LiquidTabs';
import FlipCounter from '../components/FlipCounter';
// html2canvas + jsPDF pesan mucho: se descargan solo al generar un PDF
const HiddenPDFGenerator = lazy(() => import('../components/HiddenPDFGenerator'));

export const FOLDER_COLORS = [
  { id: 'red', hex: '#d32f2f' },
  { id: 'blue', hex: '#1976d2' },
  { id: 'pink', hex: '#d81b60' },
  { id: 'green', hex: '#2e7d32' },
  { id: 'yellow', hex: '#fbc02d' },
  { id: 'black', hex: '#424242' }
];

export const getFolderFilter = (color) => {
  switch (color) {
    case 'blue': return 'hue-rotate(220deg) brightness(0.9)';
    case 'pink': return 'hue-rotate(320deg) brightness(1.1) saturate(0.8)';
    case 'green': return 'hue-rotate(110deg) brightness(0.85) saturate(0.9)';
    case 'yellow': return 'hue-rotate(55deg) brightness(1.2) saturate(0.9)';
    case 'black': return 'grayscale(100%) brightness(0.55) contrast(1.1)';
    case 'red':
    default: return 'none';
  }
};

const TCG_OPTIONS = [
  ['Pokemon', 'Pokémon'],
  ['Mitos y Leyendas', 'Mitos y Leyendas'],
  ['Magic', 'Magic'],
  ['YuGiOh', 'Yu-Gi-Oh!'],
  ['OnePiece', 'One Piece']
];
const TCG_LABELS = Object.fromEntries(TCG_OPTIONS);
const COLOR_NAMES = { red: 'rojo', blue: 'azul', pink: 'rosado', green: 'verde', yellow: 'amarillo', black: 'negro' };

// La carpeta física: imagen de la carpeta teñida con su color, nombre, juego y cifras
function FolderBinder({ folder }) {
  return (
    <div className="relative aspect-[32/37] w-full transition-transform duration-300 group-hover:-translate-y-1.5 motion-reduce:transition-none">
      <div
        className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat drop-shadow-md transition-[filter] group-hover:drop-shadow-xl"
        style={{ filter: getFolderFilter(folder.color) }}
      />
      <div className="relative z-10 flex h-full w-full flex-col justify-between pb-[15%] pl-[18%] pr-[16%] pt-[5%]">
        <div className="flex flex-col">
          <div className="flex justify-between gap-1">
            <span className="flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold text-white" title="Visitas esta semana">
              <span translate="no" className="material-symbols-outlined text-[16px]">visibility</span>{folder.validWeeklyVisits || 0}
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold text-white" title="Cartas en la carpeta">
              <span translate="no" className="material-symbols-outlined text-[16px]">style</span>{folder.cardsCount || 0}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-3 w-full break-words pr-1 text-xl font-extrabold leading-tight text-white drop-shadow-md sm:text-2xl" title={folder.name}>
            {folder.name}
          </h3>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate whitespace-nowrap rounded-md border border-white/70 px-2 py-1 text-[11px] font-bold text-white drop-shadow-sm sm:text-xs">
            {TCG_LABELS[folder.tcg] || folder.tcg}
          </span>
          {!folder.isPublic && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-white" title="Carpeta privada">
              <span translate="no" className="material-symbols-outlined text-[15px]">lock</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderTcg, setNewFolderTcg] = useState('Pokemon');
  const [newFolderColor, setNewFolderColor] = useState('red');
  const [toastMessage, setToastMessage] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('red');
  const [activeTab, setActiveTab] = useState('carpetas');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [generatingPdfFolder, setGeneratingPdfFolder] = useState(null);
  const [pdfProgress, setPdfProgress] = useState({ loaded: 0, total: 1, generating: false });
  const [activeMenuFolderId, setActiveMenuFolderId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.folder-menu-container')) {
        setActiveMenuFolderId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    const fetchFolders = async () => {
      try {
        const response = await api.getMyFolders();
        if (response.success) {
          // Las visitas semanales solo cuentan si corresponden a la semana actual
          const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
          const formattedFolders = response.folders.map(f => ({
            ...f,
            cardsCount: f._count?.cards || 0,
            validWeeklyVisits: f.lastVisitWeek === currentWeek ? (f.weeklyVisits || 0) : 0
          }));
          setFolders(formattedFolders);
        }
      } catch (error) {
        console.error("Error al cargar las carpetas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();

    // Pedidos recibidos en las carpetas del usuario
    const fetchOrders = async () => {
      try {
        const response = await api.getMyOrders();
        if (response.success) {
          setOrders(response.orders);
        }
      } catch (e) {
        console.error("Error al cargar pedidos", e);
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [currentUser, navigate]);

  // Visitas en tiempo real: mientras la pestaña de carpetas está visible se consulta cada 10 s (ETag: sin cambios responde 304 sin cuerpo)
  useEffect(() => {
    if (!currentUser || activeTab !== 'carpetas') return undefined;
    let cancelled = false;

    const refreshVisits = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await api.getMyFolderStats();
        if (cancelled || !res?.success) return;
        const byId = new Map(res.folders.map(f => [f.id, f]));
        setFolders(prev => {
          let changed = false;
          const next = prev.map(folder => {
            const fresh = byId.get(folder.id);
            if (!fresh) return folder;
            const validWeeklyVisits = fresh.lastVisitWeek === res.week ? (fresh.weeklyVisits || 0) : 0;
            if (validWeeklyVisits === folder.validWeeklyVisits && fresh.totalVisits === folder.totalVisits) return folder;
            changed = true;
            return { ...folder, weeklyVisits: fresh.weeklyVisits, totalVisits: fresh.totalVisits, lastVisitWeek: fresh.lastVisitWeek, validWeeklyVisits };
          });
          return changed ? next : prev; // sin cambios no se vuelve a renderizar
        });
      } catch (_error) {
        // se reintenta en el siguiente ciclo
      }
    };

    const timer = setInterval(refreshVisits, 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshVisits(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser, activeTab]);

  // Reemplaza el pedido gestionado conservando el detalle de sus cartas
  const handleOrderUpdated = (updated) => {
    setOrders(prev => prev.map(o => (o.id === updated.id ? { ...o, status: updated.status, updatedAt: updated.updatedAt } : o)));
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreating(true);
    try {
      const response = await api.createFolder({
        name: newFolderName.trim(),
        tcg: newFolderTcg,
        color: newFolderColor
      });
      
      setFolders([...folders, response.folder]);
      setNewFolderName('');
      setIsCreateModalOpen(false);
      showToast("Carpeta creada exitosamente", "success");
    } catch (error) {
      console.error("Error al crear la carpeta:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteFolder = (e, folderId, folderName) => {
    e.stopPropagation();
    setFolderToDelete({ id: folderId, name: folderName });
  };

  const confirmDelete = async () => {
    if (!folderToDelete) return;
    try {
      await api.deleteFolder(folderToDelete.id);
      setFolders(folders.filter(f => f.id !== folderToDelete.id));
      showToast("¡Carpeta eliminada con éxito!");
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Error al eliminar la carpeta:", error);
    }
    setFolderToDelete(null);
  };

  const handleEditFolderClick = (e, folder) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderColor(folder.color || 'red');
  };

  const submitEditFolder = async (e) => {
    e.preventDefault();
    if (!editFolderName || !editFolderName.trim()) return;
    
    const finalName = editFolderName.trim().substring(0, 22);
    try {
      await api.updateFolder(editingFolder.id, { name: finalName, color: editFolderColor });
      setFolders(folders.map(f => f.id === editingFolder.id ? { ...f, name: finalName, color: editFolderColor } : f));
      setEditingFolder(null);
      showToast("Nombre de carpeta actualizado");
    } catch (err) {
      console.error("Error al editar carpeta:", err);
      showToast("Error al editar la carpeta");
    }
  };

  const handleTogglePublic = async (e, folder) => {
    e.stopPropagation();
    try {
      const newStatus = !folder.isPublic;
      await api.updateFolder(folder.id, { isPublic: newStatus });
      setFolders(folders.map(f => f.id === folder.id ? { ...f, isPublic: newStatus } : f));
      showToast(newStatus ? 'Carpeta publicada' : 'Carpeta hecha privada');
    } catch (error) {
      console.error("Error al cambiar estado público:", error);
      showToast('Error al cambiar privacidad');
    }
  };

  const handleShareFolder = (e, folder) => {
    e.stopPropagation();
    const url = `${window.location.origin}/c/${folder.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Catálogo de ${folder.name}`,
        text: `¡Mira mi catálogo de cartas en Carpetazo!`,
        url: url
      }).catch(err => {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(url).then(() => {
            showToast("¡Enlace copiado al portapapeles!");
          });
        }
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        showToast("¡Enlace copiado al portapapeles!");
      }).catch(err => console.error("Error al copiar", err));
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300 flex flex-col items-center justify-center relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const totalCards = folders.reduce((sum, f) => sum + (f.cardsCount || 0), 0);
  const weeklyVisits = folders.reduce((sum, f) => sum + (f.validWeeklyVisits || 0), 0);
  const publicCount = folders.filter(f => f.isPublic).length;

  const TAB_OPTIONS = [
    { value: 'carpetas', label: <span className="flex items-center justify-center gap-1.5 sm:gap-2"><span translate="no" className="material-symbols-outlined hidden text-xl min-[400px]:inline">folder</span>Carpetas</span> },
    {
      value: 'solicitudes',
      label: (
        <span className="flex items-center justify-center gap-1.5 sm:gap-2">
          <span translate="no" className="material-symbols-outlined hidden text-xl min-[400px]:inline">inbox</span>Solicitudes
          {pendingCount > 0 && (
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#ffcb05] px-1.5 font-['Space_Grotesk'] text-xs font-extrabold tabular-nums text-[#1a2b4b]" aria-label={`${pendingCount} pedidos por atender`}>
              {pendingCount}
            </span>
          )}
        </span>
      )
    },
    { value: 'historial', label: <span className="flex items-center justify-center gap-1.5 sm:gap-2"><span translate="no" className="material-symbols-outlined hidden text-xl min-[400px]:inline">history</span>Historial</span> }
  ];

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
      <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300 flex flex-col relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
        <div className="flex-1 text-gray-900 px-4 sm:px-8 pt-6 pb-16 md:pt-12 flex flex-col relative z-20">

          {/* Encabezado */}
          <header className="mb-8 hidden flex-col gap-6 md:flex lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-[#1a2b4b] md:text-5xl lg:text-6xl">
                {activeTab === 'carpetas' && 'Tus carpetas'}
                {activeTab === 'solicitudes' && 'Solicitudes'}
                {activeTab === 'historial' && 'Historial de ventas'}
              </h1>
              <p className="text-lg leading-relaxed text-slate-600 md:min-h-[3.7rem]">
                {activeTab === 'carpetas' && 'Arma catálogos con tus cartas, publícalos y comparte el enlace con quien quiera comprarte.'}
                {activeTab === 'solicitudes' && 'Pedidos que llegaron desde tus carpetas públicas. Al confirmar una venta, el stock se descuenta solo.'}
                {activeTab === 'historial' && 'Tus ventas confirmadas y pedidos rechazados, con cada carta, monto y fecha.'}
              </p>
            </div>
            {activeTab === 'carpetas' && folders.length > 0 && (
              <dl className="flex gap-8 lg:gap-10">
                {[
                  ['Carpetas', folders.length, `${publicCount} ${publicCount === 1 ? 'pública' : 'públicas'}`, false],
                  ['Cartas', totalCards, 'en total', false],
                  ['Visitas', weeklyVisits, 'esta semana', true]
                ].map(([label, value, hint, live]) => (
                  <div key={label} className="flex flex-col items-start gap-1.5">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      {label}
                      {live && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700" title="Se actualiza sola, sin recargar la página">
                          <span aria-hidden="true" className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          en vivo
                        </span>
                      )}
                    </dt>
                    <dd><FlipCounter value={value} label={label} /></dd>
                    <dd className="text-xs text-slate-500">{hint}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <div className="mb-8 flex justify-center md:mb-10">
            <LiquidTabs
              ariaLabel="Secciones del panel"
              options={TAB_OPTIONS}
              value={activeTab}
              onChange={setActiveTab}
              className="w-full sm:w-max rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200"
              buttonClassName="h-12 whitespace-nowrap rounded-xl px-2 text-sm font-bold sm:px-6 sm:text-base focus-visible:ring-2 focus-visible:ring-[#1e40af]"
              indicatorClassName="rounded-xl bg-[#1e40af]"
              indicatorStyle={{ top: 6, bottom: 6 }}
              activeTextClassName="text-white"
              inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]"
            />
          </div>

      {activeTab === 'carpetas' ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Nueva carpeta: siempre primera para no tener que bajar hasta el final */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="group col-span-2 -mb-5 flex h-14 w-full flex-row items-center justify-center gap-3 rounded-2xl border-2 border-dashed sm:col-span-1 sm:mx-auto sm:mb-0 sm:aspect-[32/37] sm:h-auto sm:max-w-[260px] sm:flex-col sm:rounded-[22px] sm:border-[3px] border-[#1e40af]/35 bg-white/40 text-[#1e40af] transition-colors hover:border-[#1e40af] hover:bg-white/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e40af]/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-md transition-transform group-hover:scale-110 motion-reduce:transition-none sm:h-14 sm:w-14">
              <span translate="no" className="material-symbols-outlined text-2xl sm:text-3xl">add</span>
            </span>
            <span className="text-base font-extrabold sm:text-lg">Nueva carpeta</span>
            {folders.length === 0 && <span className="hidden max-w-[80%] text-center text-sm text-slate-600 sm:block">Crea la primera para empezar a subir cartas</span>}
          </button>
          {folders.map(folder => (
            <div key={folder.id} className={`relative mx-auto flex w-full max-w-[260px] flex-col ${activeMenuFolderId === folder.id ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => navigate(`/carpeta/${folder.id}`)}
                className="group block w-full rounded-2xl text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e40af]/40"
                aria-label={`Abrir carpeta ${folder.name}`}
              >
                <FolderBinder folder={folder} />
              </button>

              {/* Acciones rápidas bajo la carpeta */}
              <div className="mt-3 flex items-center justify-between gap-2 px-1">
                <button
                  type="button"
                  onClick={(e) => handleTogglePublic(e, folder)}
                  aria-pressed={folder.isPublic}
                  title={folder.isPublic ? 'Visible para compradores. Toca para hacerla privada.' : 'Solo tú la ves. Toca para publicarla.'}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full pl-2 pr-3 text-sm font-bold ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${folder.isPublic ? 'bg-emerald-50 text-[#047857] ring-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}
                >
                  <span translate="no" className="material-symbols-outlined text-lg">{folder.isPublic ? 'public' : 'lock'}</span>
                  {folder.isPublic ? 'Pública' : 'Privada'}
                </button>
                <div className="flex items-center gap-1 folder-menu-container">
                  <button
                    type="button"
                    onClick={(e) => handleShareFolder(e, folder)}
                    title="Compartir enlace"
                    aria-label={`Compartir ${folder.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#1e40af] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
                  >
                    <span translate="no" className="material-symbols-outlined text-xl">share</span>
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveMenuFolderId(activeMenuFolderId === folder.id ? null : folder.id); }}
                      aria-haspopup="menu"
                      aria-expanded={activeMenuFolderId === folder.id}
                      aria-label={`Más opciones de ${folder.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
                    >
                      <span translate="no" className="material-symbols-outlined text-xl">more_horiz</span>
                    </button>
                    <div
                      role="menu"
                      className={`absolute bottom-11 right-0 z-[100] w-52 origin-bottom-right rounded-2xl bg-white py-2 shadow-[0_20px_40px_-12px_rgba(26,43,75,0.35)] ring-1 ring-slate-200 transition duration-150 motion-reduce:transition-none ${activeMenuFolderId === folder.id ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
                    >
                      {[
                        ['open_in_new', 'Ver como comprador', (e) => { e.stopPropagation(); window.open(`/c/${folder.id}`, '_blank', 'noopener'); }],
                        ['picture_as_pdf', 'Descargar PDF', (e) => { e.stopPropagation(); setGeneratingPdfFolder(folder.id); setPdfProgress({ loaded: 0, total: 1, generating: false }); }],
                        ['edit', 'Editar nombre y color', (e) => handleEditFolderClick(e, folder)]
                      ].map(([icon, label, action]) => (
                        <button
                          key={label}
                          type="button"
                          role="menuitem"
                          onClick={(e) => { setActiveMenuFolderId(null); action(e); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[#1a2b4b] hover:bg-slate-50"
                        >
                          <span translate="no" className="material-symbols-outlined text-lg text-slate-500">{icon}</span>{label}
                        </button>
                      ))}
                      <hr className="mx-3 my-1 border-slate-100" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => { setActiveMenuFolderId(null); handleDeleteFolder(e, folder.id, folder.name); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[#b91c1c] hover:bg-red-50"
                      >
                        <span translate="no" className="material-symbols-outlined text-lg">delete</span>Eliminar carpeta
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>
      ) : (
          <OrdersTab
            showToast={showToast}
            filter={activeTab}
            orders={orders}
            loading={ordersLoading}
            onOrderUpdated={handleOrderUpdated}
            onGoToFolders={() => setActiveTab('carpetas')}
          />
        )}
      </div>
    </div>
  </div>

      {toastMessage && (
        <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#1a2b4b] text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-[slideUp_0.3s_ease-out]">
          {toastMessage}
        </div>
      )}

      {/* Crear / editar carpeta: formulario con vista previa en vivo */}
      {(isCreateModalOpen || editingFolder) && (() => {
        const isEdit = Boolean(editingFolder);
        const name = isEdit ? editFolderName : newFolderName;
        const color = isEdit ? editFolderColor : newFolderColor;
        const close = () => (isEdit ? setEditingFolder(null) : setIsCreateModalOpen(false));
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a2b4b]/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="folder-dialog-title"
              className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[1fr_1.15fr]"
              onClick={e => e.stopPropagation()}
            >
              <div className="hidden items-center justify-center bg-[#DBEAFE] p-8 md:flex">
                <div className="w-full max-w-[230px]">
                  <FolderBinder folder={{
                    name: name.trim() || 'Nombre de tu carpeta',
                    color,
                    tcg: isEdit ? editingFolder.tcg : newFolderTcg,
                    cardsCount: isEdit ? editingFolder.cardsCount : 0,
                    validWeeklyVisits: isEdit ? editingFolder.validWeeklyVisits : 0,
                    isPublic: isEdit ? editingFolder.isPublic : false
                  }} />
                </div>
              </div>

              <form onSubmit={isEdit ? submitEditFolder : handleCreateFolder} className="flex flex-col gap-5 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <h3 id="folder-dialog-title" className="text-2xl font-extrabold text-[#1a2b4b]">{isEdit ? 'Editar carpeta' : 'Nueva carpeta'}</h3>
                  <button type="button" onClick={close} aria-label="Cerrar" className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                    <span translate="no" className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="flex justify-between text-sm font-bold text-[#1a2b4b]">
                    Nombre <span className="font-normal text-slate-400 tabular-nums">{name.length}/22</span>
                  </span>
                  <input
                    type="text"
                    maxLength={22}
                    placeholder="Ej: Ventas de la semana"
                    value={name}
                    onChange={(e) => (isEdit ? setEditFolderName(e.target.value) : setNewFolderName(e.target.value))}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-semibold text-[#1a2b4b] focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30"
                    autoFocus
                    required
                  />
                </label>

                {!isEdit && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-bold text-[#1a2b4b]">Juego</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {TCG_OPTIONS.map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={newFolderTcg === value}
                          onClick={() => setNewFolderTcg(value)}
                          className={`h-11 rounded-xl px-3 text-sm font-bold ring-1 transition-colors ${newFolderTcg === value ? 'bg-[#1e40af] text-white ring-[#1e40af]' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">El juego no se puede cambiar después.</p>
                  </fieldset>
                )}

                <fieldset>
                  <legend className="mb-3 text-sm font-bold text-[#1a2b4b]">Color</legend>
                  <div className="flex flex-wrap gap-3">
                    {FOLDER_COLORS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => (isEdit ? setEditFolderColor(c.id) : setNewFolderColor(c.id))}
                        aria-pressed={color === c.id}
                        aria-label={`Color ${COLOR_NAMES[c.id] || c.id}`}
                        className={`h-10 w-10 rounded-full ring-offset-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${color === c.id ? 'scale-110 ring-2 ring-[#1a2b4b]' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </fieldset>

                <div className="mt-auto flex justify-end gap-3 pt-2">
                  <button type="button" onClick={close} className="h-11 rounded-xl px-5 font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex h-11 items-center gap-2 rounded-xl bg-[#1e40af] px-6 font-bold text-white shadow-md hover:bg-[#1e3a8a] disabled:opacity-60"
                  >
                    {isEdit ? 'Guardar cambios' : isCreating ? 'Creando…' : 'Crear carpeta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Confirmación de borrado */}
      {folderToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a2b4b]/60 p-4 backdrop-blur-sm" onClick={() => setFolderToDelete(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-[fadeIn_0.2s_ease-out] sm:p-8" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <span translate="no" className="material-symbols-outlined text-3xl text-[#b91c1c]">delete</span>
            </div>
            <h3 id="delete-title" className="mb-2 text-2xl font-extrabold text-[#1a2b4b]">¿Eliminar "{folderToDelete.name}"?</h3>
            <p className="mb-8 text-slate-600">Se borrarán la carpeta y todas sus cartas. Los compradores dejarán de verla y no se puede recuperar.</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setFolderToDelete(null)} className="h-11 rounded-xl px-5 font-bold text-slate-600 hover:bg-slate-100">Conservar carpeta</button>
              <button onClick={confirmDelete} className="h-11 rounded-xl bg-[#b91c1c] px-6 font-bold text-white hover:bg-[#991b1b]">Eliminar carpeta</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Generator Components */}
      {generatingPdfFolder && (
        <Suspense fallback={null}>
          <HiddenPDFGenerator 
            folderId={generatingPdfFolder} 
            onProgress={(loaded, total, isGenerating) => setPdfProgress({ loaded, total, generating: isGenerating })}
            onComplete={() => setGeneratingPdfFolder(null)} 
          />
        </Suspense>
      )}
      
      {generatingPdfFolder && (
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-[#1e40af] rounded-full animate-spin mb-6"></div>
            
            <h2 className="text-2xl font-bold text-[#1a2b4b] mb-2 text-center">
              {pdfProgress.generating ? 'Generando PDF...' : 'Preparando Carpeta...'}
            </h2>
            <p className="text-gray-500 mb-8 text-center text-sm px-4 leading-relaxed">
              {pdfProgress.generating 
                ? 'Dibujando la carpeta y descargando. Esto puede tardar unos segundos...' 
                : 'Cargando imágenes en alta resolución. Por favor espera...'}
            </p>
            <div className="w-full bg-gray-100 rounded-full h-4 mb-4 overflow-hidden shadow-inner relative">
              <div 
                className="bg-gradient-to-r from-blue-500 to-[#1e40af] h-full rounded-full transition-all duration-300 ease-out absolute left-0 top-0" 
                style={{ width: pdfProgress.generating ? '100%' : `${Math.min(100, (pdfProgress.loaded / Math.max(1, pdfProgress.total)) * 100)}%` }}
              >
                <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }}></div>
              </div>
            </div>
            <div className="flex justify-between w-full text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <span>Progreso</span>
              <span>
                {pdfProgress.generating ? '100%' : `${Math.round(Math.min(100, (pdfProgress.loaded / Math.max(1, pdfProgress.total)) * 100))}%`}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}