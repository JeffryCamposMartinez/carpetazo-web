const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', 'utf8');

const targetStr = `        if (folder.user) {
          setSellerData(folder.user);
        }`;

const replaceStr = `        if (folder.user) {
          let mergedUser = { 
            ...folder.user, 
            displayName: folder.user.name || folder.user.username,
            avatarBase64: folder.user.photoURL
          };
          if (folder.user.firebaseUid) {
            try {
              const { doc, getDoc, getFirestore } = require('firebase/firestore');
              const db = getFirestore();
              const userSnap = await getDoc(doc(db, 'users', folder.user.firebaseUid));
              if (userSnap.exists()) {
                mergedUser = { ...mergedUser, ...userSnap.data() };
              }
            } catch (e) {
              console.error("Error fetching firestore user data:", e);
            }
          }
          setSellerData(mergedUser);
        }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', code);
    console.log("Updated PublicCatalog.jsx");
} else {
    // try regex
    code = code.replace(
      /if \(folder\.user\) \{\s*setSellerData\(folder\.user\);\s*\}/g,
      replaceStr
    );
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', code);
    console.log("Updated PublicCatalog.jsx via regex");
}
