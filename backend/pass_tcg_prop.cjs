const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', 'utf8');

// We need to pass tcg={folderData?.tcg} to AlbumView
if (!code.includes("tcg={folderData?.tcg}")) {
  code = code.replace("<AlbumView \n                cards={filteredCards}", "<AlbumView \n                tcg={folderData?.tcg}\n                cards={filteredCards}");
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', code);
  console.log("Added tcg prop to AlbumView in PublicCatalog");
} else {
  console.log("tcg prop already present in PublicCatalog");
}
