import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, getCountFromServer } from 'firebase/firestore';
import { getFolderFilter } from '../pages/Dashboard';

export default function LazyFolderCard({ folder }) {
  const [details, setDetails] = useState({
    cardsCount: folder.cardsCount || 0,
    user: folder.user || 'Cargando...',
    location: folder.location || '',
    avatarUrl: folder.avatarUrl || null,
    loaded: false
  });
  const cardRef = useRef(null);

  useEffect(() => {
    // If it's already loaded, we don't need to observe
    if (details.loaded) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        // Trigger fetch
        fetchDetails();
        observer.disconnect();
      }
    }, {
      rootMargin: '200px', // start loading slightly before it enters viewport
      threshold: 0.1
    });

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [details.loaded, folder.id]);

  const fetchDetails = async () => {
    try {
      const countSnap = await getCountFromServer(collection(db, `folders/${folder.id}/cards`));
      const cardsCount = countSnap.data().count;

      let userName = 'Usuario';
      let location = '';
      let avatarUrl = null;

      if (folder.userId) {
        const userSnap = await getDoc(doc(db, 'users', folder.userId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          userName = userData.displayName || folder.userId.substring(0, 6);
          
          if (userData.addresses && userData.addresses.length > 0) {
            const defaultAddress = userData.addresses.find(a => a.isDefault) || userData.addresses[0];
            if (defaultAddress.comuna && defaultAddress.region) {
              location = `${defaultAddress.comuna}, ${defaultAddress.region}`;
            }
          }
          avatarUrl = userData.avatarBase64 || userData.photoURL || null;
        }
      }

      setDetails({
        cardsCount,
        user: userName,
        location,
        avatarUrl,
        loaded: true
      });
    } catch (err) {
      console.error("Error loading folder details:", folder.id, err);
      setDetails({
        cardsCount: 0,
        user: 'Usuario',
        location: '',
        avatarUrl: null,
        loaded: true
      });
    }
  };

  return (
    <Link 
      ref={cardRef}
      to={`/c/${folder.id}`} 
      className="@container relative w-full aspect-[32/37] max-w-[320px] mx-auto flex flex-col cursor-pointer group hover:-translate-y-2 transition-transform duration-300 select-none"
    >
      <div 
        className="absolute inset-0 bg-[url('/images/carpeta_v4.png')] bg-[length:100%_100%] bg-no-repeat drop-shadow-md group-hover:drop-shadow-xl transition-all" 
        style={{ filter: getFolderFilter(folder.color) }}
      ></div>
      
      <div className="relative z-10 w-full h-full pt-[5%] pl-[18%] pr-[16%] pb-[15%] flex flex-col justify-between">
        <div className="w-full flex flex-col">
          <div className="flex justify-end w-full">
            <div className="bg-black/30 px-[3cqi] py-[1.5cqi] rounded-[3cqi] text-[4.5cqi] font-bold text-white shadow-sm flex items-center gap-[1.5cqi]" title="Cartas">
              <span translate="no" className="material-symbols-outlined text-[5cqi]">style</span> {details.cardsCount}
            </div>
          </div>
          
          <div className="flex flex-col items-start text-left mt-[2cqi] w-full pr-[2cqi]">
            <h3 className="font-extrabold text-white text-[11cqi] drop-shadow-md leading-tight line-clamp-3 break-words overflow-hidden w-full" title={folder.name}>
              {folder.name}
            </h3>
          </div>
        </div>
        
        <div className="w-full mt-auto flex flex-col">
          <div className="flex justify-start mb-[3cqi]">
            <span className="text-[3.5cqi] font-bold px-[3cqi] py-[1cqi] text-white rounded-[2cqi] border border-white/60 tracking-wider uppercase drop-shadow-sm">
              {folder.tcg}
            </span>
          </div>
          <hr className="border-white/20 mb-[3cqi] w-full" />
          <div className="flex items-center justify-start gap-[3cqi] w-full">
            {details.avatarUrl ? (
              <img 
                src={details.avatarUrl} 
                alt={details.user} 
                className="w-[12cqi] h-[12cqi] rounded-full shadow-md object-cover shrink-0 border border-white/40" 
              />
            ) : (
              <div className="w-[12cqi] h-[12cqi] rounded-full bg-white shadow-md flex items-center justify-center text-[5cqi] font-black text-[#8b1414] shrink-0">
                {details.user.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[5.5cqi] font-bold text-white drop-shadow-md line-clamp-1 leading-tight">{details.user}</span>
              {details.location && (
                <span className="text-[3.8cqi] text-white/80 drop-shadow-sm line-clamp-1 leading-tight">{details.location}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
