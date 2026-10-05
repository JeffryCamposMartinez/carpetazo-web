// Imagen de carta con respaldo si no carga.
import React from 'react';

export const SafeImage = React.memo(({ src, alt, className, fallbackType = 'grid' }) => {
  const [error, setError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  if (!src || error) {
    if (fallbackType === 'queue') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded p-1 text-center border border-gray-200">
          <img src="/images/logos/logo_completo.webp" className="w-3/4 max-h-[50%] opacity-40 grayscale object-contain" alt="Logo" />
        </div>
      );
    }
    if (fallbackType === 'zoom-main') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4 text-center border-2 border-gray-200 relative z-50">
          <img src="/images/logos/logo_completo.webp" className="w-2/3 max-w-[120px] max-h-[50%] opacity-40 grayscale object-contain mb-3" alt="Logo" />
          <span className="text-base font-bold text-gray-400 leading-tight">SIN IMAGEN</span>
        </div>
      );
    }
    // grid default
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-lg p-2 text-center border-2 border-gray-200">
        <img src="/images/logos/logo_completo.webp" className="w-3/4 max-w-[80px] max-h-[50%] opacity-40 grayscale object-contain mb-1.5" alt="Logo" />
        <span className="text-[11px] sm:text-xs font-bold text-gray-400 leading-tight">SIN<br/>IMAGEN</span>
      </div>
    );
  }
  
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/images/logos/logo_completo.webp" className="w-10 h-10 opacity-40 animate-pulse object-contain filter grayscale" alt="Cargando..." />
        </div>
      )}
      <img 
        src={src} 
        alt={alt} 
        referrerPolicy="no-referrer" 
        loading="lazy" 
        className={`${className} ${loaded ? '' : 'opacity-0'}`} 
        onLoad={() => setLoaded(true)} 
        onError={() => setError(true)} 
      />
    </>
  );
});
