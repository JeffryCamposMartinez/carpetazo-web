const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// Replace 'Sin habilidad registrada' with JSON stringified previewCard
const target = `{previewCard.data?.ability || previewCard.ability || previewCard.extData?.ability || previewCard.data?.efecto || previewCard.efecto || previewCard.data?.text || previewCard.text || 'Sin habilidad registrada'}`;
const replace = `{previewCard.data?.ability || previewCard.ability || previewCard.extData?.ability || previewCard.data?.efecto || previewCard.efecto || previewCard.data?.text || previewCard.text || JSON.stringify(previewCard).substring(0, 500)}`;

code = code.replace(target, replace);
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Injected JSON visualizer");
