import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import Filters from '../components/Filters';
import PokemonCard from '../components/PokemonCard';
import Toast from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

function PublicCatalog() {
  const { folderId } = useParams();
  const { currentUser } = useAuth();
  
  const [cards, setCards] = useState([]);
  const [folderData, setFolderData] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  

  
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const showToast = (message, type = 'info') => setToast({ message, type });
  
  const [selectedSupertype, setSelectedSupertype] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSet, setSearchSet] = useState('');
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  
  const [appliedFilters, setAppliedFilters] = useState({
    query: '', set: '', supertype: '', type: ''
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchCatalogData = async () => {
      try {
        const folderRef = doc(db, 'folders', folderId);
        const folderSnap = await getDoc(folderRef);
        
        if (!folderSnap.exists()) {
          setErrorMsg("La carpeta no existe o fue eliminada.");
          setLoading(false);
          return;
        }
        
        const folder = folderSnap.data();
        setFolderData(folder);

        // Track folder visits
        if (!currentUser || currentUser.uid !== folder.userId) {
          const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
          if (folder.lastVisitWeek !== currentWeek) {
            updateDoc(folderRef, { 
              weeklyVisits: 1, 
              lastVisitWeek: currentWeek, 
              totalVisits: increment(1) 
            }).catch(err => console.error("Error updating visits", err));
          } else {
            updateDoc(folderRef, { 
              weeklyVisits: increment(1), 
              totalVisits: increment(1) 
            }).catch(err => console.error("Error updating visits", err));
          }
        }

        if (folder.userId) {
          const sellerRef = doc(db, 'users', folder.userId);
          const sellerSnap = await getDoc(sellerRef);
          if (sellerSnap.exists()) {
            setSellerData(sellerSnap.data());
          }
        }

        const cardsRef = collection(db, 'folders', folderId, 'cards');
        const cardsSnap = await getDocs(cardsRef);
        const cardsList = cardsSnap.docs.map(d => ({ ...d.data(), apiId: d.data().id, id: d.id }));
        setCards(cardsList);
        
      } catch (error) {
        console.error("Error fetching catalog:", error);
        setErrorMsg("Hubo un error al cargar el catálogo.");
      } finally {
        setLoading(false);
      }
    };
    
    if (folderId) fetchCatalogData();
  }, [folderId]);

  const addToCart = (card) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === card.id);
      if (existing) {
        if (existing.quantity < existing.stock) {
            return prev.map(item => 
              item.id === card.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        }
        return prev;
      }
      return [...prev, { ...card, quantity: 1 }];
    });
  };

  const removeFromCart = (cardId) => setCart(prev => prev.filter(item => item.id !== cardId));

  const decrementCart = (cardId) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === cardId);
      if (existing) {
        if (existing.quantity > 1) {
          return prev.map(item => item.id === cardId ? { ...item, quantity: item.quantity - 1 } : item);
        } else {
          return prev.filter(item => item.id !== cardId);
        }
      }
      return prev;
    });
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartItemsCount = cart.reduce((count, item) => count + item.quantity, 0);

  const formatCLP = (price) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const handleWhatsAppCheckout = async () => {
    if (cart.length === 0) return;
    
    const phone = sellerData?.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      alert("El vendedor no tiene un número de contacto configurado.");
      return;
    }
    
    const formattedPhone = phone.startsWith('56') ? phone : `56${phone}`;
    
    // Abrir ventana síncronamente para evitar bloqueo de pop-ups
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('Generando tu pedido, por favor espera...');
    }
    
    setIsProcessingCheckout(true);
    try {
      // 1. Guardar la orden en Firestore para que el vendedor pueda gestionar el stock
      await addDoc(collection(db, 'orders'), {
        sellerId: folderData.userId,
        buyerName: 'Cliente por WhatsApp',
        createdAt: serverTimestamp(),
        folderId: folderId,
        folderName: folderData.name || 'Catálogo',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: cartTotal,
        status: 'pending'
      });

      // 2. Generar el mensaje y redirigir
      let message = `¡Hola! Vengo de Carpetazo. Me interesa comprar estas cartas de la carpeta "${folderData?.name || 'Catálogo'}":\n\n`;
      cart.forEach(item => {
        message += `• ${item.quantity}x ${item.name} (${item.set}) - ${formatCLP(item.price * item.quantity)}\n`;
      });
      message += `\nTotal: ${formatCLP(cartTotal)}\n\n¿Tienes disponibilidad?`;
      
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      
      if (newWindow) {
        newWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl; // fallback si el navegador bloquea incluso el window.open síncrono
      }

      setCart([]);
      setIsCartOpen(false);
      showToast("Pedido generado correctamente", "success");
    } catch (error) {
      console.error("Error al generar pedido:", error);
      if (newWindow) newWindow.close();
      showToast("Hubo un error al procesar el pedido.", "error");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const counts = {
    pokemon: cards.filter(c => c.supertype === 'Pokémon').length,
    trainers: cards.filter(c => c.supertype === 'Trainer').length,
    energy: cards.filter(c => c.supertype === 'Energy').length
  };

  const availableSets = [...new Set(cards.map(c => c.set).filter(Boolean))].sort();

  const handleSearch = (e) => {
    e.preventDefault();
    setAppliedFilters({ query: searchQuery, set: searchSet, supertype: selectedSupertype, type: selectedType });
  };

  const filteredCards = cards
    .filter(card => appliedFilters.supertype === '' || card.supertype === appliedFilters.supertype)
    .filter(card => appliedFilters.type === '' || (card.types && card.types.includes(appliedFilters.type)))
    .filter(card => appliedFilters.set === '' || card.set === appliedFilters.set)
    .filter(card => {
      if (!appliedFilters.query) return true;
      const query = appliedFilters.query.toLowerCase();
      return card.name.toLowerCase().includes(query) || (card.id && card.id.toLowerCase().includes(query));
    });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div></div>;
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <h2 className="text-2xl font-bold mb-4">{errorMsg}</h2>
        <Link to="/" className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-[1500px] mx-auto xl:px-12 2xl:px-16 animate-[fadeIn_0.5s_ease-out]">
      {/* Seller info banner */}
      <div className="bg-white rounded-t-xl border-b border-gray-200 py-4 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1a2b4b]">{folderData.name}</h1>
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">storefront</span>
            Vendido por: <strong className="text-gray-900">{sellerData?.displayName || 'Vendedor Anónimo'}</strong>
          </p>
        </div>
        {sellerData?.bio && (
          <p className="text-sm text-gray-700 max-w-md italic border-l-2 border-[#1e40af]/30 pl-3">
            "{sellerData.bio}"
          </p>
        )}
      </div>

      <button 
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-[80px] right-4 md:bottom-8 md:right-8 bg-primary text-on-primary p-4 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.3)] z-30 flex items-center gap-2 hover:scale-105 transition-transform"
      >
        <span className="material-symbols-outlined" data-icon="shopping_cart">shopping_cart</span>
        {cartItemsCount > 0 && <span className="font-bold bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs">{cartItemsCount}</span>}
      </button>
        <div className="w-full rounded-b-xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-b border-gray-300 flex flex-col relative z-10 min-h-[calc(100vh-200px)] bg-[#DBEAFE]">
          <main className="flex-1 text-gray-900 px-4 sm:px-8 py-8 flex flex-col relative z-20">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 mb-2">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nombre de carta o número..."
                  className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] transition-all"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <Filters 
                selectedSupertype={selectedSupertype}
                onSupertypeChange={setSelectedSupertype}
                selectedType={selectedType} 
                onTypeChange={setSelectedType} 
                counts={counts}
                showCounts={false}
                segmentedControlAddon={
                  <div className="relative w-full h-full">
                    <div 
                      className="w-full h-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 cursor-pointer flex justify-between items-center transition-all hover:border-[#1e40af] hover:bg-blue-50/30"
                      onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
                    >
                      <span className="truncate font-bold text-sm">{searchSet === '' ? 'Todas las ediciones' : searchSet}</span>
                      <span className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
                    </div>
                    {isSetDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setIsSetDropdownOpen(false)}></div>
                        <div className="absolute z-[110] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                          <div className={`px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${searchSet === '' ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`} onClick={() => { setSearchSet(''); setIsSetDropdownOpen(false); }}>
                            {searchSet === '' && <span className="material-symbols-outlined text-sm">check</span>}
                            <span className={searchSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
                          </div>
                          {availableSets.map(setName => (
                            <div key={setName} className={`px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${searchSet === setName ? 'text-[#1e40af] font-bold' : 'text-gray-700'}`} onClick={() => { setSearchSet(setName); setIsSetDropdownOpen(false); }}>
                              {searchSet === setName && <span className="material-symbols-outlined text-sm">check</span>}
                              <span className={searchSet !== setName ? 'ml-6' : ''}>{setName}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                }
              />
            </div>

            <div className="flex justify-center mt-2">
              <button type="submit" className="bg-[#1e40af] hover:bg-blue-800 text-white font-bold px-12 py-3 rounded-full transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                <span className="material-symbols-outlined">search</span> Buscar
              </button>
            </div>
          </form>
        </div>

        {filteredCards.length === 0 ? (
          <div className="py-12 text-center text-gray-500 flex flex-col items-center">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-30">inventory_2</span>
              <p>Este catálogo aún no tiene cartas o no coinciden con tu búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredCards.map(card => {
              const cartItem = cart.find(i => i.id === card.id);
              const availableStock = card.stock - (cartItem ? cartItem.quantity : 0);
              return (
                <PokemonCard 
                  key={card.id} 
                  card={card} 
                  availableStock={availableStock}
                  cartQuantity={cartItem ? cartItem.quantity : 0}
                  onAddToCart={addToCart}
                  onRemoveFromCart={() => decrementCart(card.id)}
                />
              );
            })}
          </div>
        )}
      </main>
        </div>
      </div>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-end" onClick={() => setIsCartOpen(false)}>
          <div className="bg-white border-l border-gray-200 w-full max-w-md h-full p-6 flex flex-col shadow-2xl animate-[slideIn_0.3s_ease_forwards]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
              <h2 className="font-headline-md text-2xl font-bold flex items-center gap-2 text-gray-900">
                <span className="material-symbols-outlined">shopping_cart</span> Tu Pedido
              </h2>
              <button className="text-gray-500 hover:text-gray-900 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100" onClick={() => setIsCartOpen(false)}>
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 custom-scrollbar pr-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-70">
                  <span className="material-symbols-outlined text-6xl mb-2">shopping_bag</span>
                  <p>Tu carrito está vacío.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                    <img src={item.imageUrl} alt={item.name} className="w-14 h-20 object-cover rounded-md shadow-sm" />
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="font-bold text-sm text-gray-900 leading-tight mb-1 line-clamp-2">{item.name}</p>
                      <p className="text-gray-500 text-xs mb-1">{item.set}</p>
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs font-bold text-gray-700">{item.quantity}x</span>
                        <span className="text-[#1e40af] font-bold text-sm">{formatCLP(item.price)} c/u</span>
                      </div>
                    </div>
                    <button className="absolute top-2 right-2 text-error/50 hover:text-error w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/10 transition-colors" onClick={() => removeFromCart(item.id)}>
                        <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-xl font-bold text-gray-900 mb-4">
                <span>Total a pagar:</span>
                <span className="text-[#1e40af] text-2xl">{formatCLP(cartTotal)}</span>
              </div>
              
              <button 
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-xl font-extrabold flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] shadow-[0_4px_15px_rgba(37,211,102,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                disabled={cart.length === 0 || isProcessingCheckout}
                onClick={handleWhatsAppCheckout}
              >
                <span className="material-symbols-outlined text-2xl">
                  {isProcessingCheckout ? 'hourglass_empty' : 'chat'}
                </span>
                {isProcessingCheckout ? 'Procesando...' : 'Generar Pedido por WhatsApp'}
              </button>
              <p className="text-[10px] text-center text-gray-500 mt-3">Al presionar, se abrirá WhatsApp con el detalle de tu pedido para coordinar el pago y envío directamente con el vendedor.</p>
            </div>
          </div>
        </div>
      )}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
    </>
  );
}

export default PublicCatalog;
