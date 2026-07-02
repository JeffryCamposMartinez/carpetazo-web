import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import OrdersTab from '../components/OrdersTab';

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
        const q = query(collection(db, 'folders'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
        const foldersPromises = querySnapshot.docs.map(async (docSnap) => {
          const folder = { id: docSnap.id, ...docSnap.data() };
          folder.validWeeklyVisits = folder.lastVisitWeek === currentWeek ? (folder.weeklyVisits || 0) : 0;
          folder.validTotalVisits = folder.totalVisits || 0;
          try {
            const countSnap = await getCountFromServer(collection(db, `folders/${folder.id}/cards`));
            folder.cardsCount = countSnap.data().count;
          } catch (e) {
            folder.cardsCount = 0;
          }
          return folder;
        });
        const foldersData = await Promise.all(foldersPromises);
        setFolders(foldersData);
      } catch (error) {
        console.error("Error al cargar las carpetas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();

    // Listener de pedidos
    const qOrders = query(collection(db, 'orders'), where('sellerId', '==', currentUser.uid));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      ordersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setOrders(ordersData);
    });

    return () => unsubscribeOrders();
  }, [currentUser, navigate]);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'folders'), {
        name: newFolderName.trim(),
        tcg: newFolderTcg,
        color: newFolderColor,
        userId: currentUser.uid,
        user: currentUser.displayName || 'Usuario Anónimo',
        createdAt: serverTimestamp(),
      });
      
      setFolders([...folders, { id: docRef.id, name: newFolderName, tcg: newFolderTcg, color: newFolderColor, isPublic: false }]);
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
      await deleteDoc(doc(db, 'folders', folderToDelete.id));
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
      await updateDoc(doc(db, 'folders', editingFolder.id), { name: finalName, color: editFolderColor });
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
      await updateDoc(doc(db, 'folders', folder.id), { isPublic: newStatus });
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

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
      <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300 flex flex-col relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
        <div className="flex-1 text-gray-900 px-4 sm:px-8 py-12 flex flex-col relative z-20">
          <div className="flex flex-col mb-8 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-8 gap-6 min-h-[200px] sm:min-h-[180px] lg:min-h-[180px]">
          <div className="max-w-3xl h-auto pt-6 lg:pt-8 flex flex-col justify-start">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#1a2b4b] mb-4 tracking-tight drop-shadow-sm lg:whitespace-nowrap">
              {activeTab === 'carpetas' && 'Tus Carpetas'}
              {activeTab === 'solicitudes' && 'Solicitudes Pendientes'}
              {activeTab === 'historial' && 'Historial de Pedidos'}
            </h1>
            <p className="text-gray-600 text-lg md:text-xl leading-relaxed">
              {activeTab === 'carpetas' && 'Crea catálogos personalizados para empezar a gestionar tus cartas, compartir enlaces con compradores y aumentar tus ventas.'}
              {activeTab === 'solicitudes' && 'Gestiona y confirma los pedidos recientes para descontar el stock automáticamente.'}
              {activeTab === 'historial' && 'Revisa el registro de todas tus ventas completadas.'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 custom-scrollbar">
          <button 
            onClick={() => setActiveTab('carpetas')}
            className={`whitespace-nowrap px-4 py-2.5 md:px-6 md:py-3 font-bold text-sm md:text-lg rounded-t-xl transition-all flex items-center gap-2 ${
              activeTab === 'carpetas' 
                ? 'bg-[#1e40af] text-white border-b-4 border-[#1e40af] shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border-b-4 border-gray-200'
            }`}
          >
            <span translate="no" className="material-symbols-outlined text-lg md:text-xl">folder</span> Carpetas
          </button>
          <button 
            onClick={() => setActiveTab('solicitudes')}
            className={`whitespace-nowrap px-4 py-2.5 md:px-6 md:py-3 font-bold text-sm md:text-lg rounded-t-xl transition-all flex items-center gap-2 relative ${
              activeTab === 'solicitudes' 
                ? 'bg-[#1e40af] text-white border-b-4 border-[#1e40af] shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border-b-4 border-gray-200'
            }`}
          >
            <span translate="no" className="material-symbols-outlined text-lg md:text-xl">notifications</span> Solicitudes
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="absolute top-2 right-2 md:right-4 flex h-2.5 w-2.5 md:h-3 md:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-red-500"></span>
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            className={`whitespace-nowrap px-4 py-2.5 md:px-6 md:py-3 font-bold text-sm md:text-lg rounded-t-xl transition-all flex items-center gap-2 ${
              activeTab === 'historial' 
                ? 'bg-[#1e40af] text-white border-b-4 border-[#1e40af] shadow-md' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border-b-4 border-gray-200'
            }`}
          >
            <span translate="no" className="material-symbols-outlined text-lg md:text-xl">history</span> Historial
          </button>
        </div>
      </div>

      {activeTab === 'carpetas' ? (
      <div className="flex flex-col gap-8 w-full">
        <div className="flex justify-center w-full mt-2 mb-2">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#1e40af] hover:bg-blue-800 text-white font-bold py-3.5 md:py-4 px-8 md:px-12 rounded-full transition-all shadow-lg hover:shadow-[#1e40af]/30 flex items-center justify-center gap-3 shrink-0 hover:-translate-y-1 w-[90%] sm:w-auto"
          >
            <span translate="no" className="material-symbols-outlined text-2xl">add_circle</span>
            <span className="text-lg">Crear Carpeta</span>
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">

        {folders.map(folder => (
          <div 
            key={folder.id} 
            className="relative w-full aspect-[32/37] max-w-[320px] mx-auto flex flex-col cursor-pointer group hover:-translate-y-2 transition-transform duration-300 mb-20 md:mb-0"
          >
            {/* The Background Image */}
            <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-md group-hover:drop-shadow-xl transition-all" style={{ filter: getFolderFilter(folder.color) }}></div>

            {/* Action Buttons: Horizontal on mobile (bottom), Vertical on desktop (right) */}
            <div className="absolute -bottom-10 md:top-2 md:-bottom-auto left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:-right-8 z-20 flex flex-row md:flex-col gap-2">
              <button 
                onClick={(e) => handleTogglePublic(e, folder)}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full shadow-lg transition-all ${folder.isPublic ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                title={folder.isPublic ? "Carpeta Pública (Clic para ocultar)" : "Carpeta Privada (Clic para publicar)"}
              >
                <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]">{folder.isPublic ? 'public' : 'public_off'}</span>
              </button>
              <button 
                onClick={(e) => handleShareFolder(e, folder)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-all"
                title="Compartir enlace"
              >
                <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]" data-icon="share">share</span>
              </button>
              <button 
                onClick={(e) => handleEditFolderClick(e, folder)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg transition-all"
                title="Renombrar carpeta"
              >
                <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]">edit</span>
              </button>
              <button 
                onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg transition-all"
                title="Eliminar carpeta"
              >
                <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]" data-icon="delete">delete</span>
              </button>
            </div>

            {/* Content overlay */}
            <div 
              onClick={() => navigate(`/carpeta/${folder.id}`)}
              className="relative z-10 w-full h-full pt-[5%] pl-[18%] pr-[16%] pb-[15%] flex flex-col justify-between"
            >
              
              {/* TOP SECTION */}
              <div className="w-full flex flex-col">
                {/* Top Badges */}
                <div className="flex justify-between w-full">
                  <div className="bg-black/30 px-3 py-1.5 rounded-lg text-sm font-bold text-white shadow-sm flex items-center gap-1.5" title="Visitas de la semana">
                    <span translate="no" className="material-symbols-outlined text-[16px]">visibility</span> {folder.validWeeklyVisits > 0 ? folder.validWeeklyVisits : (folder.validTotalVisits || 0)}
                  </div>
                  <div className="bg-black/30 px-3 py-1.5 rounded-lg text-sm font-bold text-white shadow-sm flex items-center gap-1.5" title="Cartas">
                    <span translate="no" className="material-symbols-outlined text-[16px]">style</span> {folder.cardsCount || 0}
                  </div>
                </div>
                
                {/* Folder Title */}
                <div className="flex flex-col items-start text-left mt-2 w-full pr-2">
                  <h3 className="font-extrabold text-white text-xl sm:text-2xl md:text-3xl drop-shadow-md leading-tight line-clamp-3 break-words overflow-hidden w-full" title={folder.name}>{folder.name}</h3>
                </div>
              </div>
              
              {/* BOTTOM SECTION */}
              <div className="w-full mt-auto flex flex-col">
                <div className="flex justify-start mb-3">
                  <span className="text-[10px] sm:text-xs font-bold px-3 py-1 text-white rounded-md border border-white/60 tracking-wider uppercase drop-shadow-sm">{folder.tcg}</span>
                </div>
              </div>
              
            </div>
          </div>
        ))}
      </div>
      </div>
      ) : (
        <OrdersTab currentUser={currentUser} showToast={showToast} filter={activeTab} orders={orders} />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl border border-white/10 z-[200] animate-[slideUp_0.3s_ease-out]">
          {toastMessage}
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setIsCreateModalOpen(false)}>
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl animate-[slideIn_0.2s_ease_out] relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-50 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h3 className="text-2xl font-bold text-[#1a2b4b] flex items-center gap-2">
                <span translate="no" className="material-symbols-outlined text-[#1e40af]">create_new_folder</span>
                Nueva Carpeta
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <span translate="no" className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateFolder} className="flex flex-col gap-4 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre de la carpeta</label>
                <input 
                  type="text" 
                  maxLength={22}
                  placeholder="Ej: Base Set" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría (TCG)</label>
                <select 
                  value={newFolderTcg}
                  onChange={(e) => setNewFolderTcg(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all appearance-none cursor-pointer font-medium"
                >
                  <option value="Pokemon">Pokémon TCG</option>
                  <option value="YuGiOh">Yu-Gi-Oh!</option>
                  <option value="Magic">Magic: The Gathering</option>
                  <option value="Mitos y Leyendas">Mitos y Leyendas</option>
                  <option value="OnePiece">One Piece TCG</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color de la carpeta</label>
                <div className="flex gap-3 mt-1">
                  {FOLDER_COLORS.map(c => (
                    <button 
                      key={c.id} type="button" 
                      onClick={() => setNewFolderColor(c.id)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${newFolderColor === c.id ? 'border-[#1e40af] scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'}`}
                      style={{ backgroundColor: c.hex }}
                      title={`Color: ${c.id}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="px-6 py-2 bg-[#1e40af] text-white font-bold rounded-xl hover:bg-blue-800 shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isCreating ? (
                    <span className="animate-pulse">Creando...</span>
                  ) : (
                    <>
                      <span translate="no" className="material-symbols-outlined text-[18px]">add</span>
                      Crear
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {editingFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setEditingFolder(null)}>
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl animate-[slideIn_0.2s_ease_out]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#1a2b4b]">Editar Carpeta</h3>
              <button 
                onClick={() => setEditingFolder(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <span translate="no" className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <form onSubmit={submitEditFolder} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre de la carpeta</label>
                <input 
                  type="text" 
                  maxLength={22}
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#1e40af] focus:border-[#1e40af] transition-all font-medium"
                  required
                />
              </div>
              
              {/* Edit Color Selector */}
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color de la carpeta</label>
                <div className="flex gap-3 mt-1">
                  {FOLDER_COLORS.map(c => (
                    <button 
                      key={c.id} type="button" 
                      onClick={() => setEditFolderColor(c.id)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${editFolderColor === c.id ? 'border-[#1e40af] scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'}`}
                      style={{ backgroundColor: c.hex }}
                      title={`Color: ${c.id}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setEditingFolder(null)}
                  className="px-6 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-[#1e40af] text-white font-bold rounded-xl hover:bg-blue-800 shadow-md transition-all hover:-translate-y-0.5"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span translate="no" className="material-symbols-outlined text-4xl text-red-600">warning</span>
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">¿Eliminar carpeta?</h3>
            <p className="text-center text-gray-600 mb-8">
              Estás a punto de eliminar <strong>"{folderToDelete.name}"</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setFolderToDelete(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors shadow-md"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
      </div>
      </div>
    </>
  );
}
