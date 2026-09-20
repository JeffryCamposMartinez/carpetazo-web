const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx', 'utf8');

code = code.replace(
  /photoURL: profileData\.photoURL \|\| currentUser\.photoURL/g,
  "photoURL: profileData.avatarBase64 || profileData.photoURL || currentUser.photoURL"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx', code);
console.log("Updated photoURL logic");
