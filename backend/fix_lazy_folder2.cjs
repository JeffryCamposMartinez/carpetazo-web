const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/LazyFolderCard.jsx', 'utf8');

code = code.replace(
  /if\s*\(folder\.user\)\s*\{\s*userName\s*=\s*folder\.user\.name\s*\|\|\s*folder\.user\.username\s*\|\|\s*folder\.userId\.substring\(0,\s*6\);\s*avatarUrl\s*=\s*folder\.user\.photoURL\s*\|\|\s*null;\s*\}/g,
  `      if (typeof folder.user === 'string') {
        userName = folder.user;
        avatarUrl = folder.avatarUrl || null;
      } else if (folder.user) {
        userName = folder.user.name || folder.user.username || (folder.userId ? folder.userId.substring(0, 6) : 'Usuario');
        avatarUrl = folder.user.photoURL || folder.avatarUrl || null;
      }`
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/LazyFolderCard.jsx', code);
console.log("Fixed LazyFolderCard.jsx via regex");
