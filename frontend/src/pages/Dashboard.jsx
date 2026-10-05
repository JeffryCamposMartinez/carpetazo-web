import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import OrdersTab from '../components/orders/OrdersTab';
import WishlistTab from '../components/wishlist/WishlistTab';
import LiquidTabs from '../components/ui/LiquidTabs';
import FlipCounter from '../components/ui/FlipCounter';
import FolderBinder from '../components/folder/FolderBinder';
import FolderStatusChip from '../components/folder/FolderStatusChip';
import { COLOR_NAMES, FOLDER_COLORS, TCG_OPTIONS } from '../config/folderOptions';
// html2canvas + jsPDF pesan mucho: se descargan solo al generar un PDF
const HiddenPDFGenerator = lazy(() => import('../components/folder/HiddenPDFGenerator'));

// Botón redondo de icono: 36 px visibles y 44 px de zona táctil
const ICON_BUTTON = "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.94] active:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] after:absolute after:-inset-1 after:content-['']";

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
  const [searchParams] = useSearchParams();
  const linkedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(['solicitudes', 'historial', 'deseadas'].includes(linkedTab) ? linkedTab : 'carpetas');

  // Enlaces como /dashboard?tab=solicitudes (por ejemplo desde la campana) abren esa pestaña
  useEffect(() => {
    if (['carpetas', 'solicitudes', 'historial', 'deseadas'].includes(linkedTab)) setActiveTab(linkedTab);
  }, [linkedTab]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [generatingPdfFolder, setGeneratingPdfFolder] = useState(null);
  const [pdfProgress, setPdfProgress] = useState({ loaded: 0, total: 1, generating: false });
  const [activeMenuFolderId, setActiveMenuFolderId] = useState(null);
  const [copiedFolderId, setCopiedFolderId] = useState(null);
  const tabsScrollRef = useRef(null);
  const [tabsFade, setTabsFade] = useState({ start: false, end: false });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.folder-menu-container')) {
        setActiveMenuFolderId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Con el menú de una carpeta abierto: el foco pasa al primer elemento y Escape lo cierra devolviendo el foco al botón
  useEffect(() => {
    if (!activeMenuFolderId) return undefined;
    const id = activeMenuFolderId;
    const frame = window.requestAnimationFrame(() => {
      const menus = [document.getElementById(`folder-popover-${id}`), document.getElementById(`folder-sheet-${id}`)];
      const visible = menus.find(menu => menu && menu.getClientRects().length > 0);
      visible?.querySelector('[role="menuitem"]')?.focus();
    });
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setActiveMenuFolderId(null);
      window.requestAnimationFrame(() => document.getElementById(`folder-more-${id}`)?.focus());
    };
    document.addEventListener('keydown', onKey);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); };
  }, [activeMenuFolderId]);

  // Si las pestañas se desplazan (pantallas estrechas), la activa queda siempre a la vista
  useEffect(() => {
    const active = tabsScrollRef.current?.querySelector('[role="tab"][aria-selected="true"]');
    if (!active) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeTab, loading]);

  // Un degradado en el borde avisa de que las pestañas siguen hacia ese lado
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return undefined;
    const update = () => {
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setTabsFade(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', update); observer?.disconnect(); };
  }, [loading]);
  const tabsMask = tabsFade.start || tabsFade.end
    ? `linear-gradient(to right, ${tabsFade.start ? 'transparent 0, #000 36px' : '#000 0'}, ${tabsFade.end ? '#000 calc(100% - 36px), transparent 100%' : '#000 100%'})`
    : undefined;

  const flashCopied = (folderId) => {
    setCopiedFolderId(folderId);
    setTimeout(() => setCopiedFolderId(current => (current === folderId ? null : current)), 1600);
  };

  const toastTimer = useRef(null);
  const [toastAction, setToastAction] = useState(null);
  // `action` ({ label, run }) agrega un botón al aviso (p. ej. Deshacer) y lo mantiene un poco más
  const showToast = (msg, action = null) => {
    window.clearTimeout(toastTimer.current);
    setToastMessage(msg);
    setToastAction(action);
    toastTimer.current = window.setTimeout(() => { setToastMessage(null); setToastAction(null); }, action ? 6000 : 3000);
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
    let lastStatsSignature = '';

    const refreshVisits = async () => {
      if (document.visibilityState !== 'visible') return false;
      try {
        const res = await api.getMyFolderStats();
        if (cancelled || !res?.success) return false;
        const byId = new Map(res.folders.map(f => [f.id, f]));
        const statsSignature = JSON.stringify(res.folders.map(f => [f.id, f.weeklyVisits, f.totalVisits, f.lastVisitWeek]));
        const changedStats = statsSignature !== lastStatsSignature;
        lastStatsSignature = statsSignature;
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
        return changedStats;
      } catch (_error) {
        return false; // se reintenta en el siguiente ciclo
      }
    };

    // 10 s mientras cambian las visitas; si nada cambia en 6 consultas seguidas, cada 30 s
    let timer = null;
    let quiet = 0;
    const loop = async () => {
      const changed = await refreshVisits();
      quiet = changed ? 0 : quiet + 1;
      if (!cancelled) timer = setTimeout(loop, quiet >= 6 ? 30000 : 10000);
    };
    timer = setTimeout(loop, 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshVisits(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser, activeTab]);

  // Al abrir Solicitudes o Historial se recargan los pedidos (pueden haber llegado nuevos)
  useEffect(() => {
    if (!currentUser || !['solicitudes', 'historial'].includes(activeTab)) return;
    api.getMyOrders()
      .then((response) => { if (response.success) setOrders(response.orders); })
      .catch(() => {});
  }, [activeTab, currentUser]);

  // Reemplaza el pedido gestionado conservando el detalle de sus cartas
  const handleOrderUpdated = (updated) => {
    window.dispatchEvent(new Event('carpetazo:orders-updated')); // la campana se actualiza al instante
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
    const newStatus = !folder.isPublic;
    const applyStatus = async (value) => {
      await api.updateFolder(folder.id, { isPublic: value });
      setFolders(prev => prev.map(f => (f.id === folder.id ? { ...f, isPublic: value } : f)));
    };
    try {
      await applyStatus(newStatus);
      showToast(newStatus ? 'Carpeta publicada' : 'Carpeta hecha privada', {
        label: 'Deshacer',
        run: async () => {
          try {
            await applyStatus(!newStatus);
            showToast('Cambio deshecho');
          } catch (undoError) {
            console.error("Error al deshacer el cambio de visibilidad:", undoError);
            showToast(undoError.message || 'No se pudo deshacer');
          }
        }
      });
    } catch (error) {
      console.error("Error al cambiar estado público:", error);
      showToast(error.message || 'Error al cambiar privacidad');
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
            showToast("¡Enlace copiado al portapapeles!"); flashCopied(folder.id);
          });
        }
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        showToast("¡Enlace copiado al portapapeles!"); flashCopied(folder.id);
      }).catch(err => console.error("Error al copiar", err));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col xl:px-12 2xl:px-16">
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-none border-gray-300 bg-[#DBEAFE] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const totalCards = folders.reduce((sum, f) => sum + (f.cardsCount || 0), 0);
  const weeklyVisits = folders.reduce((sum, f) => sum + (f.validWeeklyVisits || 0), 0);
  const publicCount = folders.filter(f => f.isPublic).length;

  const TAB_OPTIONS = [
    { value: 'carpetas', label: <span className="flex items-center justify-center gap-2"><span translate="no" aria-hidden="true" className="material-symbols-outlined hidden text-xl sm:inline">folder</span>Carpetas</span> },
    { value: 'deseadas', label: <span className="flex items-center justify-center gap-2"><span translate="no" aria-hidden="true" className="material-symbols-outlined hidden text-xl sm:inline">favorite</span>Deseadas</span> },
    {
      value: 'solicitudes',
      label: (
        <span className="flex items-center justify-center gap-2">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined hidden text-xl sm:inline">inbox</span>
          {/* El contador flota sobre la esquina del texto: así la etiqueta nunca cambia de ancho ni de lugar */}
          <span className="relative whitespace-nowrap">
            Solicitudes
            {pendingCount > 0 && (
              <span className="absolute -right-4 -top-3 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#ffcb05] px-1 font-['Space_Grotesk'] text-[11px] font-extrabold leading-none tabular-nums text-[#1a2b4b] shadow-sm ring-2 ring-white" aria-label={`${pendingCount} pedidos por atender`}>
                {pendingCount}
              </span>
            )}
          </span>
        </span>
      )
    },
    { value: 'historial', label: <span className="flex items-center justify-center gap-2"><span translate="no" aria-hidden="true" className="material-symbols-outlined hidden text-xl sm:inline">history</span>Historial</span> }
  ];

  // Menú de cada carpeta: se comparte el contenido entre la hoja inferior (móvil) y el menú anclado (pantallas anchas)
  const closeFolderMenu = (restoreFocus = false) => {
    const id = activeMenuFolderId;
    setActiveMenuFolderId(null);
    if (restoreFocus && id) window.requestAnimationFrame(() => document.getElementById(`folder-more-${id}`)?.focus());
  };
  const onFolderMenuKeyDown = (event) => {
    const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    const moves = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    items[moves[event.key]]?.focus();
  };
  const renderFolderMenuItems = (folder, itemClass) => (
    <>
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
          className={`${itemClass} text-[#1a2b4b] hover:bg-slate-50 active:bg-slate-100`}
        >
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-xl text-slate-500">{icon}</span>{label}
        </button>
      ))}
      <hr className="mx-3 my-1 border-slate-100" />
      <button
        type="button"
        role="menuitem"
        onClick={(e) => { setActiveMenuFolderId(null); handleDeleteFolder(e, folder.id, folder.name); }}
        className={`${itemClass} text-[#b91c1c] hover:bg-red-50 active:bg-red-100`}
      >
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-xl">delete</span>Eliminar carpeta
      </button>
    </>
  );
  const MENU_ITEM = 'flex w-full items-center gap-3 rounded-lg px-4 text-left text-sm font-semibold transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e40af]';


  return (
    <>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col xl:px-12 2xl:px-16">
      <div className="relative z-20 flex w-full flex-1 flex-col overflow-x-clip rounded-none bg-[#DBEAFE] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300">
        <div className="relative z-20 flex flex-1 flex-col px-4 pb-10 pt-5 text-gray-900 sm:px-8 md:pb-14 md:pt-10">

          {/* Encabezado: la sección se llama «Mis carpetas»; «Carpetas» es solo su primera pestaña */}
          <header className="mb-4 flex flex-col gap-6 md:mb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-[#1a2b4b] md:mb-3 md:text-5xl lg:text-6xl">Mis carpetas</h1>
              <p className="hidden text-lg leading-relaxed text-slate-600 md:block md:min-h-[3.7rem]">
                {activeTab === 'carpetas' && 'Arma catálogos con tus cartas, publícalos y comparte el enlace con quien quiera comprarte.'}
                {activeTab === 'solicitudes' && 'Pedidos que llegaron desde tus carpetas públicas. Al confirmar una venta, el stock se descuenta solo.'}
                {activeTab === 'historial' && 'Tus ventas confirmadas y pedidos rechazados, con cada carta, monto y fecha.'}
                {activeTab === 'deseadas' && 'Las cartas que buscas. Quien vea tus carpetas las verá y podrá ofrecértelas.'}
              </p>
            </div>
            {activeTab === 'carpetas' && folders.length > 0 && (
              <dl className="hidden gap-8 md:flex lg:gap-10">
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

          {/* Pestañas: cada una con su ancho natural; si no caben, se desplazan sin comprimir el texto */}
          <div ref={tabsScrollRef} style={{ maskImage: tabsMask, WebkitMaskImage: tabsMask }} className="hide-scrollbar -mx-4 mb-5 overflow-x-auto px-4 py-1 sm:mx-0 sm:mb-8 sm:flex sm:justify-start sm:overflow-visible sm:px-0 md:mb-10">
            <LiquidTabs
              ariaLabel="Secciones de Mis carpetas"
              tabs
              idPrefix="mis-carpetas-tab"
              layout="inline"
              options={TAB_OPTIONS}
              value={activeTab}
              onChange={setActiveTab}
              className="w-max min-w-full rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 sm:min-w-0"
              buttonClassName="h-11 flex-auto shrink-0 whitespace-nowrap rounded-xl px-3 text-sm font-bold sm:h-12 sm:px-6 sm:text-base focus-visible:ring-2 focus-visible:ring-[#1e40af]"
              indicatorClassName="rounded-xl bg-[#1e40af]"
              indicatorStyle={{ top: 6, bottom: 6 }}
              activeTextClassName="text-white"
              inactiveTextClassName="text-slate-600 hover:text-[#1a2b4b]"
            />
          </div>

      <div key={activeTab} role="tabpanel" aria-labelledby={`mis-carpetas-tab-${activeTab}`} className="tab-panel flex-1">
      {activeTab === 'carpetas' ? (
        <>
          {/* Móvil: la acción primaria es un botón, no un banner; junto al resumen de lo que ya hay */}
          <div className="mb-5 flex items-center justify-between gap-3 sm:hidden">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-600">
              {folders.length === 0 ? 'Aún no tienes carpetas' : `${folders.length} ${folders.length === 1 ? 'carpeta' : 'carpetas'}`}
              {folders.length > 0 && <span className="max-[359px]:hidden"> · {publicCount} {publicCount === 1 ? 'pública' : 'públicas'}</span>}
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#1e40af] pl-1.5 pr-4 text-sm font-extrabold text-white shadow-[0_1px_2px_rgba(8,18,42,0.35),0_6px_14px_-6px_rgba(30,64,175,0.7)] transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#DBEAFE]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]">
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px] font-bold">add</span>
              </span>
              Nueva carpeta
            </button>
          </div>
          {folders.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-[#1e40af]/30 bg-white/50 px-4 py-8 text-center text-sm font-medium text-slate-600 sm:hidden">Crea la primera para empezar a subir cartas.</p>
          )}

        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(11.75rem,1fr))] sm:gap-x-6 sm:gap-y-10">
          {/* Pantallas anchas: el hueco de la próxima carpeta, con el mismo tamaño que las demás */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="group mx-auto hidden aspect-[32/37] w-full max-w-[260px] flex-col items-center justify-center gap-3 self-start rounded-[22px] border-[3px] border-dashed border-[#1e40af]/35 bg-white/40 text-[#1e40af] transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-[#1e40af] hover:bg-white/80 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e40af]/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-md transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none">
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-3xl">add</span>
            </span>
            <span className="text-lg font-extrabold">Nueva carpeta</span>
            {folders.length === 0 && <span className="max-w-[80%] text-center text-sm text-slate-600">Crea la primera para empezar a subir cartas</span>}
          </button>

          {folders.map(folder => (
            <div key={folder.id} className={`@container relative mx-auto flex w-full max-w-[260px] flex-col ${activeMenuFolderId === folder.id ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                onClick={() => navigate(`/carpeta/${folder.id}`)}
                className="group block w-full rounded-2xl text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e40af]/40"
                aria-label={`Abrir carpeta ${folder.name}`}
              >
                <FolderBinder folder={folder} />
              </button>

              {folder.moderationState && folder.moderationState !== 'visible' && (
                <p role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200">Moderación ocultó esta carpeta. Si crees que fue un error, escríbenos a carpetazo.soporte@gmail.com.</p>
              )}

              {/* Acciones bajo la carpeta: visibilidad, compartir y más opciones */}
              <div className="folder-menu-container relative mt-3 flex items-center justify-between gap-0.5">
                <FolderStatusChip folder={folder} onToggle={handleTogglePublic} />
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={(e) => handleShareFolder(e, folder)}
                    title="Compartir enlace"
                    aria-label={`Compartir ${folder.name}`}
                    className={`${ICON_BUTTON} text-[#1e40af]`}
                  >
                    <span translate="no" aria-hidden="true" className="material-symbols-outlined text-xl">{copiedFolderId === folder.id ? 'check' : 'share'}</span>
                  </button>
                  <button
                    type="button"
                    id={`folder-more-${folder.id}`}
                    onClick={(e) => { e.stopPropagation(); setActiveMenuFolderId(activeMenuFolderId === folder.id ? null : folder.id); }}
                    aria-haspopup="menu"
                    aria-expanded={activeMenuFolderId === folder.id}
                    aria-label={`Más opciones de ${folder.name}`}
                    className={`${ICON_BUTTON} text-slate-600`}
                  >
                    <span translate="no" aria-hidden="true" className="material-symbols-outlined text-xl">more_horiz</span>
                  </button>
                </div>

                {activeMenuFolderId === folder.id && (
                  <>
                    {/* Pantallas anchas: menú anclado al botón, abre hacia arriba */}
                    <div
                      id={`folder-popover-${folder.id}`}
                      role="menu"
                      aria-label={`Opciones de ${folder.name}`}
                      onKeyDown={onFolderMenuKeyDown}
                      className="folder-popover absolute bottom-full right-0 z-[100] mb-2 hidden w-56 rounded-2xl bg-white p-1.5 shadow-[0_20px_40px_-12px_rgba(26,43,75,0.35)] ring-1 ring-slate-200 sm:block"
                    >
                      {renderFolderMenuItems(folder, `${MENU_ITEM} min-h-10 py-2`)}
                    </div>
                    {/* Móvil: hoja inferior a pantalla completa, con zonas táctiles de 48 px; va al <body> para quedar sobre el encabezado */}
                    {createPortal(
                      <div className="folder-menu-container sm:hidden">
                        <div className="sheet-backdrop fixed inset-0 z-[90] bg-[#0b1d3d]/50" onClick={() => closeFolderMenu(true)} aria-hidden="true" />
                        <div
                          id={`folder-sheet-${folder.id}`}
                          role="menu"
                          aria-label={`Opciones de ${folder.name}`}
                          onKeyDown={onFolderMenuKeyDown}
                          className="folder-sheet fixed inset-x-0 bottom-0 z-[100] rounded-t-3xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-12px_rgba(8,18,42,0.5)]"
                        >
                          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
                          <p className="truncate px-4 pb-2 text-sm font-extrabold text-[#1a2b4b]">{folder.name}</p>
                          {renderFolderMenuItems(folder, `${MENU_ITEM} min-h-12 py-3 text-[15px]`)}
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      ) : activeTab === 'deseadas' ? (
          <WishlistTab showToast={showToast} />
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
  </div>

      {toastMessage && (
        <div role="status" aria-live="polite" className={`toast-in fixed inset-x-0 top-4 z-[9999] mx-auto flex w-max max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-[#1a2b4b] py-3 text-white shadow-2xl ${toastAction ? 'pl-6 pr-2' : 'px-6'}`}>
          <span>{toastMessage}</span>
          {toastAction && (
            <button
              type="button"
              onClick={() => { const { run } = toastAction; setToastMessage(null); setToastAction(null); run(); }}
              className="flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-extrabold text-[#facc15] transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]"
            >
              {toastAction.label}
            </button>
          )}
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