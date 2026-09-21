const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/<AlbumView\s+cards=\{filteredCards\}/, "<AlbumView tcg={folderData?.tcg} cards={filteredCards}");

fs.writeFileSync(file, code);
console.log("Fixed PublicCatalog");
