const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const regex1 = /absolute top-1 right-1 md:top-1\.5 md:right-1\.5 bg-black\/80 text-white text-\[10px\] md:text-xs font-bold px-2 py-\[2px\] rounded-full shadow-lg border border-white\/20 z-\[120\] pointer-events-none transition-all backdrop-blur-sm">\s*x\{card\.stock \|\| 0\}/g;
code = code.replace(regex1, `absolute top-1 right-1 md:top-1.5 md:right-1.5 bg-black/80 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 md:py-1 leading-none rounded-full shadow-lg border border-white/20 z-[120] flex items-center justify-center pointer-events-none transition-all backdrop-blur-sm">\n                              <span className="mt-[1px]">x{card.stock || 0}</span>`);

const regex2 = /absolute -bottom-2 left-1\/2 -translate-x-1\/2 bg-black\/80 text-yellow-400 text-\[10px\] md:text-xs font-bold px-2 py-0\.5 rounded-full shadow-md z-\[120\] whitespace-nowrap pointer-events-none transition-opacity duration-300 \$\{cardIsActive \? 'opacity-0' : 'opacity-100'\}">\s*\{card\.price \? `\$\$\{card\.price\}` : 'Sin precio'\}/g;
code = code.replace(regex2, `absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-yellow-400 text-[10px] md:text-xs font-bold px-2.5 py-0.5 md:py-1 leading-none rounded-full shadow-md z-[120] flex items-center justify-center border border-white/10 whitespace-nowrap pointer-events-none transition-opacity duration-300 \${cardIsActive ? 'opacity-0' : 'opacity-100'}">\n                              <span className="mt-[1px]">{card.price ? '$' + Number(card.price).toLocaleString('es-CL') : 'Sin precio'}</span>`);

const regex3 = /\{previewCard\.price \? '\$' \+ previewCard\.price : 'Sin precio'\}/g;
code = code.replace(regex3, `{previewCard.price ? '$' + Number(previewCard.price).toLocaleString('es-CL') : 'Sin precio'}`);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("AlbumView regex fixed!");
