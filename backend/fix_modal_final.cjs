const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/Dashboard.jsx';
let code = fs.readFileSync(file, 'utf8');

const modalHTML = `
      {/* PDF Generator Components */}
      {generatingPdfFolder && (
        <HiddenPDFGenerator 
          folderId={generatingPdfFolder} 
          onProgress={(loaded, total, isGenerating) => setPdfProgress({ loaded, total, generating: isGenerating })}
          onComplete={() => setGeneratingPdfFolder(null)} 
        />
      )}
      
      {generatingPdfFolder && (
        <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full flex flex-col items-center">
            {/* Spinning Icon */}
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
                style={{ width: pdfProgress.generating ? '100%' : \`\${Math.min(100, (pdfProgress.loaded / Math.max(1, pdfProgress.total)) * 100)}%\` }}
              >
                <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }}></div>
              </div>
            </div>
            <div className="flex justify-between w-full text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <span>Progreso</span>
              <span>
                {pdfProgress.generating ? '100%' : \`\${Math.round(Math.min(100, (pdfProgress.loaded / Math.max(1, pdfProgress.total)) * 100))}%\`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Folder Deletion Modal */}`;

if (!code.includes("HiddenPDFGenerator folderId")) {
  code = code.replace(/\{\/\*\s*Folder Deletion Modal\s*\*\/\}/, modalHTML);
  fs.writeFileSync(file, code);
  console.log("Successfully injected PDF modal!");
}
