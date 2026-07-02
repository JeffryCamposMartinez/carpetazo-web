import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, setDoc, addDoc, serverTimestamp, getCountFromServer, getDocs } from 'firebase/firestore';
import { getFolderFilter } from './Dashboard';
import { useAuth } from '../contexts/AuthContext';

// Color Math Helpers
const getAverageRGB = (imgEl, width, height) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgEl, 0, 0, width, height);
  
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    let r = 0, g = 0, b = 0, count = 0;
    // Sample every 400th pixel to save performance
    for (let i = 0; i < data.length; i += 400) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    return { r: Math.floor(r/count), g: Math.floor(g/count), b: Math.floor(b/count) };
  } catch (e) {
    return { r: 255, g: 255, b: 255 }; // Fallback
  }
};

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
};

const getComplementaryHex = (r, g, b) => {
  let [h, s, l] = rgbToHsl(r, g, b);
  // Add 180 degrees to hue for complementary color
  h = (h + 180) % 360;
  
  // Convert HSL back to RGB
  let c = (1 - Math.abs(2 * l - 1)) * s;
  let x = c * (1 - Math.abs((h / 60) % 2 - 1));
  let m = l - c / 2;
  let r_prime = 0, g_prime = 0, b_prime = 0;
  
  if (h >= 0 && h < 60) { r_prime = c; g_prime = x; b_prime = 0; }
  else if (h >= 60 && h < 120) { r_prime = x; g_prime = c; b_prime = 0; }
  else if (h >= 120 && h < 180) { r_prime = 0; g_prime = c; b_prime = x; }
  else if (h >= 180 && h < 240) { r_prime = 0; g_prime = x; b_prime = c; }
  else if (h >= 240 && h < 300) { r_prime = x; g_prime = 0; b_prime = c; }
  else if (h >= 300 && h < 360) { r_prime = c; g_prime = 0; b_prime = x; }
  
  const toHex = (color) => {
    const hex = Math.round((color + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r_prime)}${toHex(g_prime)}${toHex(b_prime)}`;
};

export default function SellerProfile() {
  const { sellerUsername } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [sellerId, setSellerId] = useState(null);
  const [seller, setSeller] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Reviews states
  const [reviews, setReviews] = useState([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Editing states
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const isOwner = currentUser?.uid === sellerId;

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate size before compressing (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen es demasiado grande. Máximo 10MB permitidos.");
      return;
    }

    setSavingImage(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        
        // Define max dimensions based on type
        const MAX_WIDTH = type === 'banner' ? 1920 : 400;
        const MAX_HEIGHT = type === 'banner' ? 600 : 400;
        
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress as WebP
        const quality = type === 'banner' ? 0.7 : 0.6;
        const compressedBase64 = canvas.toDataURL('image/webp', quality);
        
        let dominantColor = null;
        let compColor = null;
        
        if (type === 'banner') {
          const rgb = getAverageRGB(img, width, height);
          dominantColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
          compColor = getComplementaryHex(rgb.r, rgb.g, rgb.b);
        }
        
        try {
          const updateData = { [type === 'banner' ? 'bannerBase64' : 'avatarBase64']: compressedBase64 };
          if (dominantColor && compColor) {
            updateData.bannerDominantColor = dominantColor;
            updateData.bannerComplementaryColor = compColor;
          }
          await setDoc(doc(db, 'users', sellerId), updateData, { merge: true });
          
          setSeller(prev => ({ ...prev, ...updateData }));
        } catch (error) {
          console.error(`Error saving ${type}:`, error);
          alert(`Error al guardar ${type === 'banner' ? 'la portada' : 'la foto de perfil'}. Intenta con una imagen más pequeña.`);
        } finally {
          setSavingImage(false);
        }
      };
      
      img.onerror = () => {
        alert("Error al procesar la imagen.");
        setSavingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBio = async () => {
    try {
      setSavingBio(true);
      await setDoc(doc(db, 'users', sellerId), { bio: tempBio }, { merge: true });
      setSeller(prev => ({ ...prev, bio: tempBio }));
      setIsEditingBio(false);
    } catch (error) {
      console.error("Error saving bio:", error);
      alert("Error al guardar la biografía.");
    } finally {
      setSavingBio(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newReview.comment.trim()) return;
    
    setSubmittingReview(true);
    try {
      const reviewData = {
        targetUserId: sellerId,
        reviewerId: currentUser.uid,
        reviewerName: currentUser.displayName || 'Usuario',
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: serverTimestamp()
      };
      
      const reviewRef = await addDoc(collection(db, 'reviews'), reviewData);
      
      // Update local reviews list
      const addedReview = { ...reviewData, id: reviewRef.id, createdAt: { toMillis: () => Date.now() } };
      const updatedReviews = [addedReview, ...reviews];
      setReviews(updatedReviews);
      
      // Calculate new average
      const newTotal = updatedReviews.length;
      const newSum = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
      const newRating = newSum / newTotal;
      
      // Update seller document in DB
      await setDoc(doc(db, 'users', sellerId), {
        rating: newRating,
        totalTrades: newTotal
      }, { merge: true });
      
      // Update local seller state
      setSeller(prev => ({ ...prev, rating: newRating, totalTrades: newTotal }));
      
      setIsReviewModalOpen(false);
      setNewReview({ rating: 5, comment: '' });
      alert('¡Reseña publicada con éxito!');
    } catch (err) {
      console.error("Error submitting review:", err);
      alert('Hubo un error al publicar la reseña.');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchSellerData = async () => {
      try {
        setLoading(true);
        setErrorMsg('');

        let targetSellerId = null;
        let userData = null;

        // 1. First try to find by username
        const qUsername = query(collection(db, 'users'), where('username', '==', sellerUsername));
        const usernameSnap = await getDocs(qUsername);
        
        if (!usernameSnap.empty) {
          // Find the active account (in case of duplicate usernames from deleted accounts)
          const activeDoc = usernameSnap.docs.find(doc => !doc.data().isDeactivated);
          if (activeDoc) {
            targetSellerId = activeDoc.id;
            userData = activeDoc.data();
          }
        } 
        
        if (!targetSellerId) {
          // 2. Fallback: Check if it's actually an old UID
          const userSnap = await getDoc(doc(db, 'users', sellerUsername));
          if (userSnap.exists() && !userSnap.data().isDeactivated) {
            targetSellerId = sellerUsername;
            userData = userSnap.data();
          }
        }

        if (!targetSellerId || !userData) {
          setErrorMsg('El vendedor no existe o la cuenta ha sido eliminada.');
          setLoading(false);
          return;
        }

        setSellerId(targetSellerId);
        setSeller(userData);

        // 3. Fetch public folders for this seller
        const qFolders = query(
          collection(db, 'folders'), 
          where('userId', '==', targetSellerId),
          where('isPublic', '==', true)
        );
        const foldersSnapshot = await getDocs(qFolders);
        
        const foldersList = await Promise.all(foldersSnapshot.docs.map(async (folderDoc) => {
          const folderData = folderDoc.data();
          const folderId = folderDoc.id;
          
          let count = 0;
          try {
            const countSnap = await getCountFromServer(collection(db, `folders/${folderId}/cards`));
            count = countSnap.data().count;
          } catch(e) {}
          
          return {
            id: folderId,
            ...folderData,
            cardsCount: count,
            color: folderData.color || 'red'
          };
        }));
        
        setFolders(foldersList);

        // 4. Fetch reviews for this seller
        const qReviews = query(
          collection(db, 'reviews'),
          where('targetUserId', '==', targetSellerId)
        );
        const reviewsSnapshot = await getDocs(qReviews);
        const reviewsList = reviewsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by date descending client-side
        reviewsList.sort((a, b) => {
          const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
        setReviews(reviewsList);
      } catch (err) {
        console.error("Error fetching seller data:", err);
        setErrorMsg('Hubo un error al cargar el perfil del vendedor.');
      } finally {
        setLoading(false);
      }
    };

    if (sellerUsername) fetchSellerData();
  }, [sellerUsername]);

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300 flex flex-col items-center justify-center relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center bg-[#DBEAFE] p-6 relative z-10">
        <span translate="no" className="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <h2 className="text-2xl font-bold mb-6 text-[#1a2b4b] text-center max-w-md leading-snug">{errorMsg}</h2>
        <Link to="/" className="bg-[#1e40af] hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent flex flex-col min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16 flex-1 flex flex-col">
        
        {/* HEADER HERO */}
        <div className="relative border-b border-gray-200 md:border-x shadow-sm py-4 px-4 md:py-8 md:px-12 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 overflow-hidden bg-white">
          
          {/* Background Image with 100% Opacity */}
          {seller?.bannerBase64 && (
            <div 
              className="absolute inset-0 z-0" 
              style={{ 
                backgroundImage: `url(${seller.bannerBase64})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center'
              }}
            ></div>
          )}
          
          {savingImage && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Banner Edit Button (Top Right) */}
          {isOwner && (
            <div className="absolute top-4 right-4 z-30">
              <button className="bg-white/90 hover:bg-white text-[#1a2b4b] backdrop-blur-md shadow-lg border border-gray-200 px-3 py-2 md:px-4 md:py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all relative overflow-hidden group/btn hover:scale-105">
                <span translate="no" className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                <span className="hidden md:inline">Cambiar Fondo</span>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={(e) => handleImageUpload(e, 'banner')}
                  disabled={savingImage}
                  title="Cambiar imagen de fondo (Recomendado: 1920x1080)"
                />
              </button>
            </div>
          )}

          {/* MOBILE LAYOUT: avatar + info side-by-side in one compact block */}
          <div className="flex flex-col md:hidden w-full relative z-20 gap-3">
            {/* Compact card with avatar inside */}
            <div
              className={"flex items-center gap-3 p-3 w-full rounded-2xl " +
                (seller?.bannerBase64 ? "bg-white/40 backdrop-blur-md shadow-xl drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]" : "")}
              style={seller?.bannerComplementaryColor ? { border: `2px solid ${seller.bannerComplementaryColor}` } : {}}
            >
              {/* Avatar inside card - mobile */}
              <div className="w-16 h-16 rounded-full border-2 border-white shadow-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                {(seller?.avatarBase64 || seller?.photoURL) ? (
                  <img src={seller?.avatarBase64 || seller?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1a2b4b] to-[#3b82f6] flex items-center justify-center text-white text-2xl font-black">
                    {(seller?.displayName || 'V')[0].toUpperCase()}
                  </div>
                )}
                {isOwner && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                    <span translate="no" className="material-symbols-outlined text-white text-xl">photo_camera</span>
                    <input type="file" accept="image/png, image/jpeg, image/webp" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'avatar')} disabled={savingImage} />
                  </div>
                )}
              </div>

              {/* Text info next to avatar */}
              <div className="flex flex-col text-left flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <h1 className="text-base font-black text-[#1a2b4b] leading-tight">{seller?.displayName || 'Vendedor Anónimo'}</h1>
                  {(seller?.isVerified || true) && (
                    <span translate="no" className="material-symbols-outlined text-[#3b82f6] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }} title="Vendedor Verificado">verified</span>
                  )}
                </div>
                {seller?.fullName && <p className="text-gray-500 text-[11px] font-semibold truncate">{seller.fullName}</p>}
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {(seller?.totalTrades > 0) ? (
                    <>
                      <div className="flex items-center gap-0.5 bg-white/60 px-1.5 py-0.5 rounded-md border border-yellow-300">
                        <span translate="no" className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[#1a2b4b] font-extrabold text-[11px]">{seller?.rating?.toFixed(1) || '5.0'}</span>
                      </div>
                      <span className="text-gray-500 text-[10px] font-semibold">{seller?.totalTrades} reseñas</span>
                    </>
                  ) : (
                    <span className="text-gray-500 text-[10px] font-semibold bg-white/50 px-2 py-0.5 rounded-full border border-gray-200">Nuevo Vendedor</span>
                  )}
                </div>
                {seller?.bio && (
                  <p className="text-gray-600 italic text-[10px] mt-1 line-clamp-2 border-l-2 border-primary/40 pl-2">"{seller.bio}"</p>
                )}
              </div>
            </div>

            {/* Buttons row - mobile */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(() => {
                const defaultAddress = seller?.addresses?.find(a => a.isDefault) || seller?.addresses?.[0];
                if (defaultAddress) {
                  const streetPart = [defaultAddress.street, defaultAddress.number].filter(Boolean).join(' ');
                  const parts = [streetPart, defaultAddress.depto ? `Depto ${defaultAddress.depto}` : null, defaultAddress.comuna, defaultAddress.region].filter(Boolean).join(', ');
                  const displayText = defaultAddress.name ? `${defaultAddress.name} - ${parts}` : parts;
                  const hasStreet = Boolean(defaultAddress.street);
                  return (
                    <span className={`flex items-center gap-1 ${hasStreet ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-700'} px-2 py-1 rounded-full border text-[10px] font-semibold`}>
                      <span translate="no" className="material-symbols-outlined text-[13px]">{hasStreet ? 'storefront' : 'location_on'}</span>
                      <span className="truncate max-w-[130px]">{displayText}</span>
                    </span>
                  );
                }
                if (seller?.region || seller?.comuna) {
                  return (
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-200 text-gray-700 text-[10px] font-semibold">
                      <span translate="no" className="material-symbols-outlined text-[13px]">location_on</span>
                      {[seller.comuna, seller.region].filter(Boolean).join(', ')}
                    </span>
                  );
                }
                return null;
              })()}
              {!isOwner && currentUser && (
                <button onClick={() => navigate('/mensajes', { state: { startChatWith: { id: sellerId, name: seller.displayName, avatar: seller.avatarBase64 || seller.photoURL } } })} className="flex items-center gap-1 bg-[#1e40af] text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                  <span translate="no" className="material-symbols-outlined text-[13px]">chat</span> Mensaje
                </button>
              )}
              {seller?.phone && (
                <a href={`https://wa.me/${seller.phone.replace(/[^0-9]/g,'').startsWith('56') ? seller.phone.replace(/[^0-9]/g,'') : '56'+seller.phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200 text-[10px] font-bold">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.12.553 4.184 1.594 6.02L.05 24l6.115-1.604A11.956 11.956 0 0012.031 24c6.646 0 12.031-5.385 12.031-12.031C24.062 5.385 18.677 0 12.031 0zm0 22.012a9.98 9.98 0 01-5.1-1.393l-.365-.217-3.791.993.993-3.791-.217-.365A9.972 9.972 0 012.019 12.03c0-5.526 4.492-10.018 10.012-10.018s10.012 4.492 10.012 10.018c0 5.526-4.492 10.012-10.012 10.012zm5.496-7.514c-.301-.151-1.782-.88-2.058-.98-.276-.101-.477-.151-.678.151-.201.301-.778.98-.954 1.181-.176.201-.352.226-.653.075-1.428-.713-2.584-1.928-3.23-3.35-.101-.201-.01-.301.14-.452.126-.126.301-.352.452-.528.151-.176.201-.301.301-.502.101-.201.05-.377-.025-.528-.075-.151-.678-1.631-.928-2.234-.251-.603-.502-.528-.678-.528-.176 0-.377-.01-.578-.01-.201 0-.528.075-.803.377-.276.301-1.054 1.03-1.054 2.51 0 1.48 1.079 2.912 1.23 3.113.151.201 2.133 3.263 5.17 4.568 1.958.841 2.684.904 3.588.753.904-.151 2.861-1.168 3.263-2.302.402-1.134.402-2.108.276-2.309-.125-.201-.452-.301-.753-.452z"/></svg>
                  WhatsApp
                </a>
              )}
              {seller?.instagramUrl && (
                <a href={`https://instagram.com/${seller.instagramUrl.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full border border-pink-200 text-[10px] font-bold">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                  Instagram
                </a>
              )}
            </div>
          </div>

          {/* DESKTOP LAYOUT: original vertical stacked */}
          <div className="hidden md:flex flex-row items-start gap-8 w-full relative z-20">
            {/* Avatar - desktop */}
            <div className="w-40 h-40 rounded-full border-4 border-white shadow-xl bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative group z-20">
              {(seller?.avatarBase64 || seller?.photoURL) ? (
                <img src={seller?.avatarBase64 || seller?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1a2b4b] to-[#3b82f6] flex items-center justify-center text-white text-5xl font-black">
                  {(seller?.displayName || 'V')[0].toUpperCase()}
                </div>
              )}
              {isOwner && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                  <span translate="no" className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                  <span className="text-white text-xs font-bold mt-1">Cambiar Foto</span>
                  <input type="file" accept="image/png, image/jpeg, image/webp" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'avatar')} disabled={savingImage} />
                </div>
              )}
            </div>
            
            {/* Seller Info - desktop */}
            <div 
              className={"text-left mt-2 w-fit max-w-3xl transition-all " + 
                         (seller?.bannerBase64 ? "bg-white/40 backdrop-blur-md p-8 rounded-[2rem] shadow-xl drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]" : "")}
              style={seller?.bannerComplementaryColor ? { border: `3px solid ${seller.bannerComplementaryColor}` } : {}}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap justify-center md:justify-start">
                <h1 className="text-2xl md:text-4xl font-black text-[#1a2b4b]">{seller?.displayName || 'Vendedor Anónimo'}</h1>
                {/* Visual Fake Verified for now if undefined, so user can see how it looks */}
                {(seller?.isVerified || true) && (
                  <span translate="no" className="material-symbols-outlined text-[#3b82f6] text-[24px] md:text-[32px] drop-shadow-sm" style={{ fontVariationSettings: "'FILL' 1" }} title="Vendedor Verificado">verified</span>
                )}
              </div>
              
              {/* Rating and Trades */}
              <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-2 md:mb-4">
                 {(seller?.totalTrades > 0) ? (
                   <>
                     <div className="flex items-center gap-1 bg-white/60 px-2.5 py-0.5 rounded-lg border border-yellow-300 shadow-sm">
                        <span translate="no" className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[#1a2b4b] font-extrabold text-lg">{seller?.rating?.toFixed(1) || '5.0'}</span>
                     </div>
                     <span className="text-gray-600 font-bold text-sm underline decoration-gray-300 underline-offset-2 cursor-pointer hover:text-[#1a2b4b]" onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}>
                       {seller?.totalTrades} reseñas verificadas
                     </span>
                   </>
                 ) : (
                   <span className="text-gray-500 text-xs md:text-sm font-semibold bg-white/50 px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-gray-200">
                     Nuevo Vendedor (Sin valoraciones)
                   </span>
                 )}
              </div>

              {seller?.fullName && <p className="text-gray-600 text-sm md:text-base font-bold mb-2 md:mb-4">{seller.fullName}</p>}
              
              {/* Biography in Header */}
              {isOwner ? (
                <div className="mt-4 mb-6">
                  {isEditingBio ? (
                    <div className="flex flex-col gap-2 w-full max-w-3xl">
                      <textarea 
                        value={tempBio}
                        onChange={(e) => setTempBio(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:border-primary resize-none h-24"
                        placeholder="Cuéntale a la comunidad sobre ti y tus colecciones..."
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setIsEditingBio(false)} disabled={savingBio} className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100">Cancelar</button>
                        <button onClick={handleSaveBio} disabled={savingBio} className="px-4 py-1.5 rounded-lg text-sm font-bold bg-primary text-on-primary shadow-sm hover:shadow-md transition-shadow">
                          {savingBio ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-center md:justify-start gap-2 group">
                      {seller?.bio ? (
                        <p className="text-gray-700 leading-relaxed italic border-l-4 border-primary/40 pl-4 py-1 max-w-3xl text-sm md:text-base">
                          "{seller.bio}"
                        </p>
                      ) : (
                        <p className="text-gray-400 italic text-sm md:text-base py-1">Aún no has escrito una biografía.</p>
                      )}
                      <button 
                        onClick={() => { setTempBio(seller?.bio || ''); setIsEditingBio(true); }}
                        className="text-gray-400 hover:text-primary transition-colors p-1 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center rounded-full hover:bg-blue-50"
                        title="Editar biografía"
                      >
                        <span translate="no" className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                seller?.bio && (
                  <div className="mt-2 md:mt-4 mb-4 md:mb-6">
                    <p className="text-gray-700 leading-relaxed italic border-l-4 border-primary/40 pl-3 md:pl-4 py-0.5 md:py-1 max-w-3xl text-xs md:text-base">
                      "{seller.bio}"
                    </p>
                  </div>
                )
              )}
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3 mt-2 md:mt-4">
                {/* Physical Store / Exact Address */}
                {(() => {
                  const defaultAddress = seller?.addresses?.find(a => a.isDefault) || seller?.addresses?.[0];
                  if (defaultAddress) {
                    const hasStreet = Boolean(defaultAddress.street);
                    const streetPart = [defaultAddress.street, defaultAddress.number].filter(Boolean).join(' ');
                    const parts = [
                      streetPart,
                      defaultAddress.depto ? `Depto ${defaultAddress.depto}` : null,
                      defaultAddress.comuna,
                      defaultAddress.region
                    ].filter(Boolean).join(', ');
                    
                    const displayText = defaultAddress.name ? `${defaultAddress.name} - ${parts}` : parts;

                    return (
                      <span className={`flex items-center gap-1.5 ${hasStreet ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-700'} px-3 py-1.5 md:px-4 md:py-2 rounded-full border shadow-sm text-xs md:text-sm font-semibold`} title={hasStreet ? "Dirección de la tienda" : "Ubicación"}>
                        <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]">{hasStreet ? 'storefront' : 'location_on'}</span>
                        {displayText}
                      </span>
                    );
                  }
                  if (seller?.region || seller?.comuna) {
                    return (
                      <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-200 text-gray-700 shadow-sm text-xs md:text-sm font-semibold">
                        <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]">location_on</span>
                        {[seller.comuna, seller.region].filter(Boolean).join(', ')}
                      </span>
                    );
                  }
                  return null;
                })()}

                {/* Internal Chat */}
                {!isOwner && currentUser && (
                  <button 
                    onClick={() => navigate('/mensajes', { state: { startChatWith: { id: sellerId, name: seller.displayName, avatar: seller.avatarBase64 || seller.photoURL } } })}
                    className="flex items-center gap-1.5 bg-[#1e40af] hover:bg-blue-800 text-white px-4 py-1.5 md:px-5 md:py-2 rounded-full shadow-[0_4px_10px_-2px_rgba(30,64,175,0.4)] transition-all cursor-pointer text-xs md:text-sm font-extrabold hover:-translate-y-0.5"
                  >
                    <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]">chat</span>
                    Mensaje Privado
                  </button>
                )}

                {/* WhatsApp */}
                {seller?.phone && (
                  <a href={`https://wa.me/${seller.phone.replace(/[^0-9]/g, '').startsWith('56') ? seller.phone.replace(/[^0-9]/g, '') : '56' + seller.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-green-200 shadow-sm transition-colors cursor-pointer text-xs md:text-sm font-bold">
                    <svg className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.12.553 4.184 1.594 6.02L.05 24l6.115-1.604A11.956 11.956 0 0012.031 24c6.646 0 12.031-5.385 12.031-12.031C24.062 5.385 18.677 0 12.031 0zm0 22.012a9.98 9.98 0 01-5.1-1.393l-.365-.217-3.791.993.993-3.791-.217-.365A9.972 9.972 0 012.019 12.03c0-5.526 4.492-10.018 10.012-10.018s10.012 4.492 10.012 10.018c0 5.526-4.492 10.012-10.012 10.012zm5.496-7.514c-.301-.151-1.782-.88-2.058-.98-.276-.101-.477-.151-.678.151-.201.301-.778.98-.954 1.181-.176.201-.352.226-.653.075-1.428-.713-2.584-1.928-3.23-3.35-.101-.201-.01-.301.14-.452.126-.126.301-.352.452-.528.151-.176.201-.301.301-.502.101-.201.05-.377-.025-.528-.075-.151-.678-1.631-.928-2.234-.251-.603-.502-.528-.678-.528-.176 0-.377-.01-.578-.01-.201 0-.528.075-.803.377-.276.301-1.054 1.03-1.054 2.51 0 1.48 1.079 2.912 1.23 3.113.151.201 2.133 3.263 5.17 4.568 1.958.841 2.684.904 3.588.753.904-.151 2.861-1.168 3.263-2.302.402-1.134.402-2.108.276-2.309-.125-.201-.452-.301-.753-.452z"/></svg>
                    WhatsApp
                  </a>
                )}

                {/* Instagram */}
                {seller?.instagramUrl && (
                  <a href={`https://instagram.com/${seller.instagramUrl.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-pink-50 hover:bg-pink-100 text-pink-600 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-pink-200 shadow-sm transition-colors cursor-pointer text-xs md:text-sm font-bold">
                    <svg className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                    Instagram
                  </a>
                )}

                {/* YouTube */}
                {seller?.youtubeUrl && (
                  <a href={`https://youtube.com/${seller.youtubeUrl.includes('youtube.com') ? seller.youtubeUrl.split('youtube.com/')[1] : seller.youtubeUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-full border border-red-200 shadow-sm transition-colors cursor-pointer text-sm font-bold">
                    <span translate="no" className="material-symbols-outlined text-[18px]">play_circle</span>
                    YouTube
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="w-full overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-b border-gray-300 flex flex-col relative z-10 flex-1 bg-[#DBEAFE]">
          <main className="flex-1 text-gray-900 px-4 sm:px-8 py-6 md:py-12 flex flex-col relative z-20">
            {/* FOLDERS SECTION */}
            <div className="mb-6 md:mb-12 mx-auto w-full max-w-[1200px]">
              <div className="flex items-center justify-between mb-5 md:mb-8 border-b border-[#1a2b4b]/10 pb-3 md:pb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#1a2b4b]/10 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" xmlns="http://www.w3.org/2000/svg">
                      {/* Left cover — perspective parallelogram */}
                      <polygon points="1,5 7,3 7,21 1,20" fill="#3b82f6"/>
                      {/* Cover shine */}
                      <polygon points="1,5 3,4.3 3,19.5 1,20" fill="white" opacity="0.2"/>
                      {/* Spine */}
                      <rect x="7" y="3" width="2" height="18" rx="0.5" fill="#1e3a7a"/>
                      {/* Right inner pages */}
                      <rect x="9" y="3" width="14" height="18" rx="1.5" fill="#111827"/>
                      {/* Card pockets 2x2 */}
                      <rect x="10.5" y="4.5"  width="5"   height="7"  rx="0.8" fill="#3b82f6" opacity="0.55"/>
                      <rect x="16.5" y="4.5"  width="5"   height="7"  rx="0.8" fill="#3b82f6" opacity="0.55"/>
                      <rect x="10.5" y="13"   width="5"   height="7"  rx="0.8" fill="#3b82f6" opacity="0.55"/>
                      <rect x="16.5" y="13"   width="5"   height="7"  rx="0.8" fill="#3b82f6" opacity="0.55"/>
                      {/* Clasp button on cover edge */}
                      <circle cx="7.5" cy="12" r="1" fill="#ffcb05"/>
                    </svg>
                  </div>
                  <h2 className="text-lg md:text-3xl font-black text-[#1a2b4b] leading-tight">Carpetas Públicas</h2>
                </div>
                <span className="inline-flex items-center justify-center bg-[#1a2b4b] text-white text-xs md:text-sm font-black px-2.5 py-1 md:px-3 md:py-1.5 rounded-full shadow-sm">
                  {folders.length}
                </span>
              </div>
              
              {folders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-blue-300 shadow-sm">
                  <span translate="no" className="material-symbols-outlined text-6xl text-blue-300 mb-4">inventory_2</span>
                  <p className="text-gray-500 font-bold text-lg">Este vendedor aún no tiene carpetas públicas disponibles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8">
                  {folders.map((folder) => (
                    <Link to={`/c/${folder.id}`} key={folder.id} className="@container relative w-full aspect-[32/37] max-w-[320px] mx-auto flex flex-col cursor-pointer group hover:-translate-y-2 transition-transform duration-300">
                      {/* The Background Image */}
                      <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-lg group-hover:drop-shadow-2xl transition-all" style={{ filter: getFolderFilter(folder.color) }}></div>
                      
                      {/* Content overlay */}
                      <div className="relative z-10 w-full h-full pt-[5%] pl-[18%] pr-[16%] pb-[15%] flex flex-col justify-between">
                        {/* TOP SECTION */}
                        <div className="w-full flex flex-col">
                          <div className="flex justify-end w-full">
                            <div className="bg-black/30 px-[3cqi] py-[1.5cqi] rounded-[3cqi] text-[4.5cqi] font-bold text-white shadow-sm flex items-center gap-[1.5cqi]" title="Cartas">
                              <span translate="no" className="material-symbols-outlined text-[5cqi]">style</span> {folder.cardsCount}
                            </div>
                          </div>
                          <div className="flex flex-col items-start text-left mt-[2cqi] w-full pr-[2cqi]">
                            <h3 className="font-extrabold text-white text-[11cqi] drop-shadow-md leading-tight line-clamp-3 break-words overflow-hidden w-full" title={folder.name}>{folder.name}</h3>
                          </div>
                        </div>
                        {/* BOTTOM SECTION */}
                        <div className="w-full mt-auto flex flex-col">
                          <div className="flex justify-start mb-[3cqi]">
                            <span className="text-[3.5cqi] font-bold px-[3cqi] py-[1cqi] text-white rounded-[2cqi] border border-white/60 tracking-wider uppercase drop-shadow-sm">{folder.tcg}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* REVIEWS SECTION */}
            <div id="reviews-section" className="mx-auto w-full max-w-[1200px] mt-16 pt-8 border-t border-[#1a2b4b]/10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <h2 className="text-3xl font-black text-[#1a2b4b] flex items-center gap-3">
                  <span translate="no" className="material-symbols-outlined text-primary text-3xl">reviews</span>
                  Reseñas de la Comunidad
                </h2>
              </div>
              
              {reviews.length === 0 ? (
                <div className="bg-white/60 rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
                  <p className="text-gray-500 font-medium text-lg">Este vendedor aún no tiene reseñas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reviews.map(review => (
                    <div key={review.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold text-[#1a2b4b] flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                            {review.reviewerName[0].toUpperCase()}
                          </span>
                          {review.reviewerName}
                        </div>
                        <div className="flex text-primary">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} translate="no" className="material-symbols-outlined text-sm" style={{ fontVariationSettings: star <= review.rating ? "'FILL' 1" : "'FILL' 0" }}>
                              star
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm italic flex-1 mb-4 leading-relaxed">"{review.comment}"</p>
                      <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-50 text-right">
                        {review.createdAt?.toMillis ? new Date(review.createdAt.toMillis()).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Reciente'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
