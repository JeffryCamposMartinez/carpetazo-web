const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FoldersPage.jsx', 'utf8');

code = code.replace(
  /folder\.user = folder\.user\?\.name \|\| folder\.user\?\.username \|\| 'Usuario';\s*folder\.location = '';\s*folder\.avatarUrl = null;/g,
  "folder.avatarUrl = folder.user?.photoURL || null;\n          folder.user = folder.user?.name || folder.user?.username || 'Vendedor Anónimo';\n          folder.location = '';"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FoldersPage.jsx', code);
console.log("Updated FoldersPage.jsx");
