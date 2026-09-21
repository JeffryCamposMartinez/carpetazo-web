const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// I will add a console.log(previewCard) when previewCard is set
code = code.replace(
  "setPreviewCard(card);",
  "setPreviewCard(card);\n                        console.log('PreviewCard Data:', card);"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Added console.log for previewCard");
