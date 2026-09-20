const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/LazyFolderCard.jsx', 'utf8');

const targetStr = `      if (folder.user) {
        userName = folder.user.name || folder.user.username || folder.userId.substring(0, 6);
        avatarUrl = folder.user.photoURL || null;
      }`;

const replacementStr = `      if (typeof folder.user === 'string') {
        userName = folder.user;
        avatarUrl = folder.avatarUrl || null;
      } else if (folder.user) {
        userName = folder.user.name || folder.user.username || (folder.userId ? folder.userId.substring(0, 6) : 'Usuario');
        avatarUrl = folder.user.photoURL || folder.avatarUrl || null;
      }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/LazyFolderCard.jsx', code);
    console.log("Fixed LazyFolderCard.jsx");
} else {
    console.log("Could not find exact target string in LazyFolderCard.jsx");
}
