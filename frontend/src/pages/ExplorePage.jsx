import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, query, where, getCountFromServer } from 'firebase/firestore';
import { getFolderFilter } from './Dashboard';
import HeroCarousel from '../components/HeroCarousel';
import LazyFolderCard from '../components/LazyFolderCard';

export default function ExplorePage() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Sync URL param with search query when navigating from header
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchQuery(q);
  }, [searchParams]);

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
        setFolders(top10);
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
                    <LazyFolderCard key={folder.id} folder={folder} />
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
