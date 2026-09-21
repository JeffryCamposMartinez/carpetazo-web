const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const targetStr = "{previewCard.set} • {previewCard.supertype || (tcg === 'Mitos y Leyendas' ? 'Carta' : 'Pokémon')} {tcg !== 'Mitos y Leyendas' && ` • #${(() => {";

const replaceStr = "{previewCard.set} • {(previewCard.supertype === 'Unknown' || !previewCard.supertype) ? (tcg === 'Mitos y Leyendas' ? 'Carta' : 'Pokémon') : previewCard.supertype} {tcg !== 'Mitos y Leyendas' && ` • #${(() => {";

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Fixed supertype unknown");
