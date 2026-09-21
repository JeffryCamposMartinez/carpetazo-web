const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/Dashboard.jsx';
let code = fs.readFileSync(file, 'utf8');

const replaceButton = `<button 
                onClick={(e) => {
                  e.stopPropagation();
                  setGeneratingPdfFolder(folder.id);
                  setPdfProgress({ loaded: 0, total: 1, generating: false });
                }}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700 shadow-lg transition-all"
                title="Generar PDF"
              >
                <span translate="no" className="material-symbols-outlined text-[16px] md:text-[18px]">picture_as_pdf</span>
              </button>\n                `;

if (!code.includes("picture_as_pdf")) {
  code = code.replace(/<button[^>]*title="Renombrar carpeta"[^>]*>[\s\S]*?<\/button>/, match => replaceButton + match);
  fs.writeFileSync(file, code);
  console.log("Successfully injected PDF button!");
} else {
  console.log("PDF button already exists");
}
