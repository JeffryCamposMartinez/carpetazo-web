const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// Rename BinderView to AlbumView
code = code.replace(/export default function BinderView/g, "export default function AlbumView");

// Replace card.imageUrl with card.image
code = code.replace(/card\.imageUrl/g, "card.image");

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Updated AlbumView.jsx!");
