const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx', 'utf8');

const oldSync = `        try {
          await api.post('/api/users/sync', {
            displayName: profileData.displayName || profileData.fullName,
            username: cleanUsername,
            photoURL: profileData.avatarBase64 || profileData.photoURL || currentUser.photoURL
          });
        }`;

const newSync = `        try {
          await api.post('/api/users/sync', {
            displayName: profileData.displayName || profileData.fullName || currentUser.displayName,
            username: profileData.username || profileData.displayName?.toLowerCase().replace(/\\s+/g, '_') || '',
            photoURL: profileData.avatarBase64 || profileData.photoURL || currentUser.photoURL || ''
          });
        }`;

code = code.replace(oldSync, newSync);
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx', code);
console.log("Fixed scope error!");
