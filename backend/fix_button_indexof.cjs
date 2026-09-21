const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/Dashboard.jsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = '<button \n                  onClick={(e) => handleEditFolderClick(e, folder)}\n                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-yellow-500 \ntext-white hover:bg-yellow-600 shadow-lg transition-all"\n                  title="Renombrar carpeta"';

// Let's just find "title="Renombrar carpeta"" and inject the button before its parent <button>
const indexOfTitle = code.indexOf('title="Renombrar carpeta"');
if (indexOfTitle !== -1) {
  const indexOfButton = code.lastIndexOf('<button', indexOfTitle);
  
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
              </button>
              `;
              
  code = code.substring(0, indexOfButton) + replaceButton + code.substring(indexOfButton);
  fs.writeFileSync(file, code);
  console.log("Successfully injected PDF button using indexOf!");
} else {
  console.log("Could not find Renombrar carpeta");
}
