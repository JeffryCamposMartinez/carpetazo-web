const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const regex2 = /absolute -bottom-2 left-1\/2 -translate-x-1\/2 bg-black\/80 text-yellow-400 text-\[10px\] md:text-xs font-bold px-2 py-0\.5 rounded-full shadow-md z-\[120\] whitespace-nowrap pointer-events-none transition-opacity duration-300[\s\S]*?<\/div>/g;

const replacement2 = `absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-yellow-400 text-[10px] md:text-xs font-bold px-2.5 py-0.5 md:py-1 leading-none rounded-full shadow-md z-[120] flex items-center justify-center border border-white/10 whitespace-nowrap pointer-events-none transition-opacity duration-300 \${cardIsActive ? 'opacity-0' : 'opacity-100'}">\n                              <span className="mt-[1px]">{card.price ? '$' + Number(card.price).toLocaleString('es-CL') : 'Sin precio'}</span>\n                            </div>`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("AlbumView price badge fixed!");
