const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const styleBlock = `
          {/* Custom styles to enlarge the external cart controls without breaking them */}
          <style>{\`
            .modal-actions > div > button.w-full {
              padding-top: 12px !important;
              padding-bottom: 12px !important;
              font-size: 16px !important;
            }
            .modal-actions > div > button.w-full span {
              font-size: 20px !important;
            }
            .modal-actions .bg-slate-100 {
              padding: 8px !important;
            }
            .modal-actions .bg-slate-100 span.font-bold {
              font-size: 18px !important;
              padding-left: 16px !important;
              padding-right: 16px !important;
            }
            .modal-actions .bg-slate-100 button {
              width: 32px !important;
              height: 32px !important;
            }
          \`}</style>
          
          <div 
            className="relative flex flex-col md:flex-row gap-4 md:gap-8 max-w-5xl w-full`;

code = code.replace(
  /<div\s+className="relative flex flex-col md:flex-row gap-4 md:gap-8 max-w-5xl w-full/,
  styleBlock
);

code = code.replace(
  /className="w-full max-w-\[250px\] md:max-w-\[300px\]"/,
  'className="w-full max-w-[250px] md:max-w-[300px] modal-actions"'
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Added scoped CSS styles for the modal cart actions");
