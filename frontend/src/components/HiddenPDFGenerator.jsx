import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api, { apiUrl } from '../utils/api';

// Mismo orden que ve el usuario en su carpeta: primero catalogOrder, luego fecha de creación
const sortCatalogCards = (cardArray = []) => {
  const orderOf = (card) => {
    const value = Number(card?.catalogOrder);
    return Number.isFinite(value) ? value : 100000;
  };
  return [...cardArray].sort((a, b) => (orderOf(a) - orderOf(b)) || (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
};

// Proporción de la carta según el origen de su imagen (Pokémon 63:88, Mitos y Leyendas 709:1016)
const getCardAspectRatio = (card) => {
  const url = String(card?.imageUrl || '');
  return /tcgplayer|pokemontcg\.io|tcgdex/i.test(url) ? '63 / 88' : '709 / 1016';
};

const LANGUAGE_CODES = { English: 'EN', Spanish: 'ES', Japanese: 'JP' };

const getPdfImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) return imageUrl;
  return apiUrl('/proxy-image?url=' + encodeURIComponent(imageUrl));
};

const imageUrlToDataUrl = async (imageUrl) => {
  const sourceUrl = getPdfImageUrl(imageUrl);
  if (!sourceUrl) return '';

  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('No se pudo cargar la imagen para PDF: ' + response.status);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function HiddenPDFGenerator({ folderId, onComplete, onProgress }) {
  const [cards, setCards] = useState([]);
  const [folder, setFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [generating, setGenerating] = useState(false);
  const imageRefs = useRef([]);
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const generationStartedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onProgressRef.current = onProgress;
  }, [onComplete, onProgress]);

  useEffect(() => {
    if (!folderId) return;
    const fetchFolderData = async () => {
      setLoading(true);
      setImagesLoaded(0);
      setCards([]);
      imageRefs.current = [];
      generationStartedRef.current = false;
      try {
        const res = await api.getFolder(folderId);
        if (res.success && res.folder) {
            setFolder(res.folder);
        }
        
        const cardsData = sortCatalogCards((res?.folder?.cards || []).map(c => ({ ...c, ...(c.data || {}) })));
        const totalCards = cardsData.length;
        
        let loadedCount = 0;
        onProgressRef.current?.(0, totalCards, false);
        
        // Convert all images to Base64 to guarantee html2canvas can render them
        const cardsWithBase64 = await Promise.all(cardsData.map(async (card) => {
          try {
            const b64 = await imageUrlToDataUrl(card.imageUrl);
            loadedCount++;
            onProgressRef.current?.(loadedCount, totalCards, false);
            return { ...card, base64: b64 || getPdfImageUrl(card.imageUrl) };
          } catch (e) {
            console.error("Base64 fetch failed for", card.imageUrl, e);
            loadedCount++;
            onProgressRef.current?.(loadedCount, totalCards, false);
            return { ...card, base64: getPdfImageUrl(card.imageUrl) || card.imageUrl };
          }
        }));

        setCards(cardsWithBase64);
      } catch (error) {
        console.error("Error fetching folder data for print:", error);
        onCompleteRef.current?.();
      } finally {
        setLoading(false);
      }
    };
    fetchFolderData();
  }, [folderId]);

  // Note: We handled progress above, so we don't need this useEffect
  // However, we can keep it to update 'generating' state
  useEffect(() => {
    if (cards.length > 0) {
      onProgressRef.current?.(cards.length, cards.length, generating);
    }
  }, [generating, cards.length]);

  const generatePDF = async () => {
    if (generating) return;
    generationStartedRef.current = true;
    setGenerating(true);
    try {
      // Force decoding of all images before capturing to fix the "blank images" issue
      const decodePromises = imageRefs.current
        .filter(img => img && img.src)
        .map(img => {
          if (img.decode) {
            return img.decode().catch(() => Promise.resolve()); // Ignore decode errors
          }
          return Promise.resolve();
        });
      
      await Promise.all(decodePromises);
      
      // Wait just a bit more for the browser compositor
      await new Promise(r => setTimeout(r, 1000));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pagesToPrint = document.querySelectorAll('.hidden-print-page');

      for (let i = 0; i < pagesToPrint.length; i++) {
        const page = pagesToPrint[i];
        
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#111111',
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

        // Add clickable watermark link over the logo
        const isRightPage = (i % 2 === 0);
        const linkW = 34;
        const linkH = 45;
        const bottomOffset = 4;
        const sideOffset = 5;
        const linkY = 297 - bottomOffset - linkH;
        const linkX = isRightPage ? (210 - sideOffset - linkW) : sideOffset;
        pdf.link(linkX, linkY, linkW, linkH, { url: 'https://carpetazo.cl' });
      }

      pdf.save(`Carpeta_${folder?.name || 'Pokemon'}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    } finally {
      setGenerating(false);
      onCompleteRef.current?.();
    }
  };

  useEffect(() => {
    if (loading || !folderId) return;
    if (generationStartedRef.current) return;

    if (cards.length > 0) {
      if (imagesLoaded >= cards.length) {
        // Extra timeout ensures images are flushed to screen
        generationStartedRef.current = true;
        setTimeout(() => generatePDF(), 1500);
      }
    } else {
      generationStartedRef.current = true;
      setTimeout(() => generatePDF(), 1000);
    }
  }, [loading, imagesLoaded, cards.length]);

  const chunkArray = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  if (!folderId || loading) return null;

  const pages = chunkArray(cards, 9);
  const binderColor = folder?.color || '#1e40af';
  const showLanguage = folder?.tcg !== 'Mitos y Leyendas'; // en Mitos y Leyendas no se muestra el idioma

  // Render absolutely hidden from view by placing it under the solid modal
  // We stack all pages exactly on top of each other (absolute top-0 left-0)
  // so that none of them fall out of the viewport. This fixes the html2canvas
  // bug where off-screen/scrolled elements get darkened or clipped.
  return (
    <div className="fixed inset-0 z-[9998] overflow-hidden pointer-events-none opacity-0">
      <div className="relative w-full h-full">
        {pages.map((pageCards, pageIndex) => {
          const isRightPage = pageIndex % 2 === 0;

          return (
            <div 
              key={pageIndex} 
              className={`hidden-print-page absolute top-0 left-0 w-[210mm] h-[297mm] flex flex-col p-[6mm] ${isRightPage ? 'rounded-r-3xl pl-0' : 'rounded-l-3xl pr-0'} shadow-2xl`}
              style={{ backgroundColor: binderColor, zIndex: pageIndex }}
            >
              {/* Binder Cover Leather Texture */}
              <div className="absolute inset-0 bg-black/30 z-0" />
              <div className="absolute inset-0 opacity-40 mix-blend-multiply bg-[url('/images/leather.png')] z-0" />
              <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.6)] z-0" />
              
              {/* Stitched Edge */}
              <div className={`absolute inset-[6px] rounded-[16px] border-[2px] border-dashed border-black/60 z-10 pointer-events-none ${isRightPage ? 'border-l-0 rounded-l-none' : 'border-r-0 rounded-r-none'}`} />
              <div className={`absolute inset-[6px] rounded-[16px] border-[2px] border-dashed border-white/20 z-10 pointer-events-none translate-y-[1px] ${isRightPage ? 'border-l-0 rounded-l-none' : 'border-r-0 rounded-r-none'}`} />

              {/* Watermark Logo */}
              <img 
                src="/images/logos/logo_completo.webp" 
                alt="Carpetazo" 
                className={`absolute bottom-[16px] z-[50] opacity-60 w-[130px] h-auto object-contain filter drop-shadow-xl ${isRightPage ? 'right-[20px]' : 'left-[20px]'}`} 
              />

              {/* Inner Black Page (where cards live) */}
              <div className={`relative flex-1 bg-[#151515] flex flex-col p-[5mm] shadow-[inset_0_0_10px_rgba(0,0,0,0.5),-5px_5px_15px_rgba(0,0,0,0.8)] z-20 overflow-hidden ${isRightPage ? 'rounded-r-[1.5rem] rounded-l-none mt-[4mm] mb-[4mm] mr-[4mm] ml-0' : 'rounded-l-[1.5rem] rounded-r-none mt-[4mm] mb-[4mm] ml-[4mm] mr-0'}`}>
                 
                 {/* Subtle texture for the black page */}
                 <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[url('/images/cubes.png')] z-0" />
                 
                 {/* Spine shadow on the inner black page */}
                 <div className={`absolute top-0 bottom-0 w-28 pointer-events-none z-10 bg-gradient-to-${isRightPage ? 'r' : 'l'} from-black/90 to-transparent ${isRightPage ? 'left-0' : 'right-0'}`} />

                 {/* Pockets Grid */}
                 <div className={`flex-1 grid grid-cols-3 grid-rows-3 gap-3 w-full h-full relative z-20 ${isRightPage ? 'pl-4' : 'pr-4'}`}>
                  {Array.from({ length: 9 }).map((_, pocketIndex) => {
                    const card = pageCards[pocketIndex];
                    const globalIndex = pageIndex * 9 + pocketIndex;
                    return (
                      <div key={pocketIndex} className="flex min-h-0 min-w-0 items-center justify-center">
                      <div
                        className="bg-[#222] rounded-xl border border-white/10 shadow-[inset_0_4px_15px_rgba(0,0,0,0.6)] flex items-center justify-center p-1 relative w-full max-h-full"
                        style={{ aspectRatio: card ? getCardAspectRatio(card) : '63 / 88' }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none z-10 rounded-xl" />
                        {card ? (
                          <div className="w-full h-full relative flex items-center justify-center z-30">
                            <img 
                              ref={el => imageRefs.current[globalIndex] = el}
                              src={card.base64 || card.imageUrl} 
                              alt={card.name} 
                              crossOrigin="anonymous"
                              className="w-full h-full object-contain rounded-[4%]"
                              onLoad={() => setImagesLoaded(prev => prev + 1)}
                              onError={() => setImagesLoaded(prev => prev + 1)} 
                            />
                            <div className="absolute top-1.5 right-1.5 bg-black/80 text-white font-bold text-[13px] px-3 py-1 rounded-full shadow-lg border border-white/20 z-[120] inline-block text-center backdrop-blur-sm whitespace-nowrap">
                              <span className="relative -top-[5px]">
                                {showLanguage && card.language ? <span className="text-yellow-400">{LANGUAGE_CODES[card.language] || card.language} · </span> : null}x{card.stock || 0}
                              </span>
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-400 font-bold text-[13px] px-4 py-1.5 rounded-full shadow-md whitespace-nowrap z-[120] inline-block text-center border border-white/10">
                              <span className="relative -top-[5px]">{card.price ? '$' + Number(card.price).toLocaleString('es-CL') : 'Sin precio'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-white/5 rounded-lg flex items-center justify-center z-30">
                            <span translate="no" className="material-symbols-outlined text-white/10 text-4xl">style</span>
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}




