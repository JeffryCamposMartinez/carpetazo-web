import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

export default function HiddenPDFGenerator({ folderId, onComplete, onProgress }) {
  const [cards, setCards] = useState([]);
  const [folder, setFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const imageRefs = useRef([]);

  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js")
    ]).then(() => setScriptsLoaded(true)).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!folderId) return;
    const fetchFolderData = async () => {
      setLoading(true);
      try {
        const res = await api.getFolder(folderId);
        if (res.success && res.folder) {
            setFolder(res.folder);
        }
        
        const cardsData = (res?.folder?.cards || []).map(c => ({ ...c, ...(c.data || {}) }));
        const totalCards = cardsData.length;
        
        let loadedCount = 0;
        if (onProgress) onProgress(0, totalCards, false);
        
        // Convert all images to Base64 to guarantee html2canvas can render them
        const cardsWithBase64 = await Promise.all(cardsData.map(async (card) => {
          try {
            // Bypass browser cache to ensure CORS headers are received from CDN
            const resp = await fetch(card.imageUrl + '?t=' + new Date().getTime());
            const blob = await resp.blob();
            const b64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            loadedCount++;
            if (onProgress) onProgress(loadedCount, totalCards, false);
            return { ...card, base64: b64 };
          } catch (e) {
            console.error("Base64 fetch failed for", card.imageUrl, e);
            loadedCount++;
            if (onProgress) onProgress(loadedCount, totalCards, false);
            return { ...card, base64: card.imageUrl };
          }
        }));

        setCards(cardsWithBase64);
      } catch (error) {
        console.error("Error fetching folder data for print:", error);
        onComplete();
      } finally {
        setLoading(false);
      }
    };
    fetchFolderData();
  }, [folderId]);

  // Note: We handled progress above, so we don't need this useEffect
  // However, we can keep it to update 'generating' state
  useEffect(() => {
    if (onProgress && cards.length > 0) {
      onProgress(cards.length, cards.length, generating);
    }
  }, [generating, cards.length, onProgress]);

  const generatePDF = async () => {
    if (generating) return;
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

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pagesToPrint = document.querySelectorAll('.hidden-print-page');

      for (let i = 0; i < pagesToPrint.length; i++) {
        const page = pagesToPrint[i];
        
        const canvas = await window.html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#111111',
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      pdf.save(`Carpeta_${folder?.name || 'Pokemon'}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    } finally {
      setGenerating(false);
      onComplete();
    }
  };

  useEffect(() => {
    if (!scriptsLoaded || loading || !folderId) return;

    if (cards.length > 0) {
      if (imagesLoaded >= cards.length) {
        // Extra timeout ensures images are flushed to screen
        setTimeout(() => generatePDF(), 1500);
      }
    } else {
      setTimeout(() => generatePDF(), 1000);
    }
  }, [loading, imagesLoaded, cards.length, scriptsLoaded]);

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

              {/* Inner Black Page (where cards live) */}
              <div className={`relative flex-1 bg-[#151515] flex flex-col p-[12mm] shadow-[inset_0_0_10px_rgba(0,0,0,0.5),-5px_5px_15px_rgba(0,0,0,0.8)] z-20 overflow-hidden ${isRightPage ? 'rounded-r-[1.5rem] rounded-l-none mt-[4mm] mb-[4mm] mr-[4mm] ml-0' : 'rounded-l-[1.5rem] rounded-r-none mt-[4mm] mb-[4mm] ml-[4mm] mr-0'}`}>
                 
                 {/* Subtle texture for the black page */}
                 <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[url('/images/cubes.png')] z-0" />
                 
                 {/* Spine shadow on the inner black page */}
                 <div className={`absolute top-0 bottom-0 w-28 pointer-events-none z-10 bg-gradient-to-${isRightPage ? 'r' : 'l'} from-black/90 to-transparent ${isRightPage ? 'left-0' : 'right-0'}`} />

                 {/* Pockets Grid */}
                 <div className={`flex-1 grid grid-cols-3 grid-rows-3 gap-4 w-full h-full relative z-20 ${isRightPage ? 'pl-6' : 'pr-6'}`}>
                  {Array.from({ length: 9 }).map((_, pocketIndex) => {
                    const card = pageCards[pocketIndex];
                    const globalIndex = pageIndex * 9 + pocketIndex;
                    return (
                      <div 
                        key={pocketIndex} 
                        className="bg-[#222] rounded-xl border border-white/10 shadow-[inset_0_4px_15px_rgba(0,0,0,0.6)] flex items-center justify-center p-2 relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none z-10 rounded-xl" />
                        {card ? (
                          <div className="w-[95%] h-[95%] relative flex items-center justify-center z-30">
                            <img 
                              ref={el => imageRefs.current[globalIndex] = el}
                              src={card.base64 || card.imageUrl} 
                              alt={card.name} 
                              className="w-full h-full object-contain rounded-[4%]"
                              onLoad={() => setImagesLoaded(prev => prev + 1)}
                              onError={() => setImagesLoaded(prev => prev + 1)} 
                            />
                            <div className="absolute top-1.5 right-1.5 bg-black/80 text-white font-bold text-[13px] px-3 py-1 rounded-full shadow-lg border border-white/20 z-[120] inline-block text-center backdrop-blur-sm">
                              <span className="relative -top-[5px]">x{card.stock || 0}</span>
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
                    );
                  })}
               </div>
            </div>
            
            {/* Page Number */}
            <div className={`absolute bottom-[10mm] text-white/40 text-xs font-bold font-mono z-30 ${isRightPage ? 'right-[15mm]' : 'left-[15mm]'}`}>
              {pageIndex + 1}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}




