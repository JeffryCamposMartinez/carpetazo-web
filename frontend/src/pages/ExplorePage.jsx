import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { getFolderFilter } from './Dashboard';
import HeroCarousel from '../components/HeroCarousel';

export default function ExplorePage() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  const tcgCategories = [
    { name: 'One Piece', logo: '/images/logos/onepiece.webp', scaleClass: 'scale-150' },
    { name: 'Magic', logo: '/images/logos/magic.png', scaleClass: 'scale-150' },
    { name: 'Riftbound', logo: '/images/logos/riftbound.png', scaleClass: 'scale-100' },
    { name: 'Pokémon', logo: '/images/logos/pokemon.png', scaleClass: 'scale-100' },
    { name: 'Yu-Gi-Oh!', logo: '/images/logos/yugioh.png', scaleClass: 'scale-[2.25]' },
    { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp', scaleClass: 'scale-[1.3]' }
  ];

  const mousePos = useRef({ x: -1, y: -1 });

  useEffect(() => {
    // Hook para detectar hover en el carrusel cuando el mouse está quieto y las cartas se mueven debajo
    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    let animationFrameId;
    let lastHoveredCard = null;

    const checkHover = () => {
      if (mousePos.current.x >= 0 && mousePos.current.y >= 0) {
        const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
        const card = el ? el.closest('.tcg-explore-card') : null;
        if (card !== lastHoveredCard) {
          if (lastHoveredCard) lastHoveredCard.classList.remove('force-hover');
          if (card) card.classList.add('force-hover');
          lastHoveredCard = card;
        }
      }
      animationFrameId = requestAnimationFrame(checkHover);
    };
    checkHover();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (lastHoveredCard) lastHoveredCard.classList.remove('force-hover');
    };
  }, []);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
        const q = query(collection(db, 'folders'), where('isPublic', '==', true));
        const foldersSnapshot = await getDocs(q);
        
        let allFolders = [];
        for (const folderDoc of foldersSnapshot.docs) {
          const folder = { id: folderDoc.id, ...folderDoc.data() };
          folder.validWeeklyVisits = folder.lastVisitWeek === currentWeek ? (folder.weeklyVisits || 0) : 0;
          folder.validTotalVisits = folder.totalVisits || 0;
          allFolders.push(folder);
        }

        allFolders.sort((a, b) => {
          if (b.validWeeklyVisits !== a.validWeeklyVisits) {
            return b.validWeeklyVisits - a.validWeeklyVisits;
          }
          return b.validTotalVisits - a.validTotalVisits;
        });

        const top10 = allFolders.slice(0, 10);
        
        const folderPromises = top10.map(async (folder) => {
          try {
            // Get cards to calculate count and value
            const cardsSnapshot = await getDocs(collection(db, `folders/${folder.id}/cards`));
            let totalValue = 0;
            cardsSnapshot.forEach(cardDoc => {
              const card = cardDoc.data();
              totalValue += (parseFloat(card.price) || 0) * (parseInt(card.stock) || 1);
            });
            
            folder.cardsCount = cardsSnapshot.size;
            folder.value = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalValue);
            
            // Keep original color from database
            if (!folder.color) folder.color = 'red';
            let userName = 'Usuario';
            let location = '';
            
            if (folder.userId) {
              const userSnap = await getDoc(doc(db, 'users', folder.userId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.displayName) {
                  userName = userData.displayName;
                } else {
                  userName = folder.userId.substring(0, 6);
                }
                
                // Get location from default address
                if (userData.addresses && userData.addresses.length > 0) {
                  const defaultAddress = userData.addresses.find(a => a.isDefault) || userData.addresses[0];
                  if (defaultAddress.comuna && defaultAddress.region) {
                    location = `${defaultAddress.comuna}, ${defaultAddress.region}`;
                  }
                }
                
                if (userData.avatarBase64) {
                  folder.avatarUrl = userData.avatarBase64;
                } else if (userData.photoURL) {
                  folder.avatarUrl = userData.photoURL;
                }
              } else {
                userName = folder.userId.substring(0, 6);
              }
            }
            folder.user = userName;
            folder.location = location;
            return folder;
          } catch (err) {
            console.error("Error fetching details for folder:", folder.id, err);
            // Fallbacks in case of error
            folder.cardsCount = folder.cardsCount || 0;
            folder.user = folder.user || 'Usuario';
            return folder;
          }
        });
        
        const foldersData = await Promise.all(folderPromises);
        
        setFolders(foldersData);
      } catch (error) {
        console.error("Error fetching folders:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFolders();
  }, []);

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
        <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-outline-variant/30 flex flex-col relative z-10 min-h-[calc(100vh-80px)]">
          <div className="flex-1 bg-[#DBEAFE] text-surface p-4 md:p-8 flex flex-col items-center justify-start pt-8 relative z-20">
            
            {/* Hero Section Carousel */}
            <HeroCarousel />

            {/* TCG Categories Marquee */}
            <div className="w-full max-w-[1200px] mb-8 overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-12 md:w-24 h-full bg-gradient-to-r from-blue-100 to-transparent z-10 pointer-events-none"></div>
              <div className="absolute top-0 right-0 w-12 md:w-24 h-full bg-gradient-to-l from-blue-100 to-transparent z-10 pointer-events-none"></div>
              
              <div className="flex flex-nowrap gap-6 w-max animate-marquee py-6">
                {[...tcgCategories, ...tcgCategories, ...tcgCategories, ...tcgCategories].map((tcg, idx) => (
                  <div key={idx} className="tcg-explore-card flex-shrink-0 w-32 h-20 md:w-40 md:h-24 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center p-4 cursor-pointer transition-all duration-300 [&.force-hover]:shadow-xl [&.force-hover]:-translate-y-2 [&.force-hover]:scale-110">
                    <img src={tcg.logo} alt={tcg.name} className={`max-w-full max-h-full object-contain filter drop-shadow-sm ${tcg.scaleClass || 'scale-100'}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Featured Folders Section */}
            <div className="w-full max-w-[1200px] mb-16">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-[#1a2b4b]">Carpetas Destacadas de la semana</h2>
                <button className="text-blue-600 font-semibold hover:underline text-sm">Ver más carpetas →</button>
              </div>
              
              {loading ? (
                <div className="w-full flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                  {folders.map((folder) => (
                    <Link to={`/c/${folder.id}`} key={folder.id} className="@container relative w-full aspect-[32/37] max-w-[320px] mx-auto flex flex-col cursor-pointer group hover:-translate-y-2 transition-transform duration-300">
                      {/* The Background Image */}
                      <div className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-md group-hover:drop-shadow-xl transition-all" style={{ filter: getFolderFilter(folder.color) }}></div>
                      
                      {/* Content overlay */}
                      <div className="relative z-10 w-full h-full pt-[5%] pl-[18%] pr-[16%] pb-[15%] flex flex-col justify-between">
                        
                        {/* TOP SECTION */}
                        <div className="w-full flex flex-col">
                          {/* Cards Count */}
                          <div className="flex justify-end w-full">
                            <div className="bg-black/30 px-[3cqi] py-[1.5cqi] rounded-[3cqi] text-[4.5cqi] font-bold text-white shadow-sm flex items-center gap-[1.5cqi]" title="Cartas">
                              <span className="material-symbols-outlined text-[5cqi]">style</span> {folder.cardsCount}
                            </div>
                          </div>
                          
                          {/* Folder Title */}
                          <div className="flex flex-col items-start text-left mt-[2cqi] w-full pr-[2cqi]">
                            <h3 className="font-extrabold text-white text-[11cqi] drop-shadow-md leading-tight line-clamp-3 break-words overflow-hidden w-full" title={folder.name}>{folder.name}</h3>
                          </div>
                        </div>
                        
                        {/* BOTTOM SECTION */}
                        <div className="w-full mt-auto flex flex-col">
                          <div className="flex justify-start mb-[3cqi]">
                            <span className="text-[3.5cqi] font-bold px-[3cqi] py-[1cqi] text-white rounded-[2cqi] border border-white/60 tracking-wider uppercase drop-shadow-sm">{folder.tcg}</span>
                          </div>
                          <hr className="border-white/20 mb-[3cqi] w-full" />
                          <div className="flex items-center justify-start gap-[3cqi] w-full">
                            {folder.avatarUrl ? (
                              <img 
                                src={folder.avatarUrl} 
                                alt={folder.user} 
                                className="w-[12cqi] h-[12cqi] rounded-full shadow-md object-cover shrink-0 border border-white/40" 
                              />
                            ) : (
                              <div className="w-[12cqi] h-[12cqi] rounded-full bg-white shadow-md flex items-center justify-center text-[5cqi] font-black text-[#8b1414] shrink-0">
                                {folder.user.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-[5.5cqi] font-bold text-white drop-shadow-md line-clamp-1 leading-tight">{folder.user}</span>
                              {folder.location && (
                                <span className="text-[3.8cqi] text-white/80 drop-shadow-sm line-clamp-1 leading-tight">{folder.location}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>

                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </>
  );
}
