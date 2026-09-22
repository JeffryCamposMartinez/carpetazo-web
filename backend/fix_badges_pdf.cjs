const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/HiddenPDFGenerator.jsx', 'utf8');

// 1. Fix quantity badge
code = code.replace(
  `px-2 py-[2px] rounded-full shadow-lg border border-white/20 z-[120] flex items-center justify-center backdrop-blur-sm">\n                                x{card.stock || 0}`,
  `px-2 py-0.5 leading-none rounded-full shadow-lg border border-white/20 z-[120] flex items-center justify-center backdrop-blur-sm">\n                                <span className="mt-[1px]">x{card.stock || 0}</span>`
);

// 2. Fix price badge and format CLP
code = code.replace(
  `absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-400 font-bold text-[11px] h-[22px] leading-[22px] px-3 rounded-full shadow-md whitespace-nowrap z-[120] text-center inline-block">\n                                \${card.price}`,
  `absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-400 font-bold text-[11px] px-3 py-1 leading-none rounded-full shadow-md whitespace-nowrap z-[120] flex items-center justify-center border border-white/10">\n                                <span className="mt-[1px]">{card.price ? '$' + Number(card.price).toLocaleString('es-CL') : 'Sin precio'}</span>`
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/HiddenPDFGenerator.jsx', code);
console.log("HiddenPDFGenerator badges fixed!");
