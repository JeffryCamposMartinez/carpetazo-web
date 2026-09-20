const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx', 'utf8');

// Replace the onChange for NOMBRE COMPLETO to update both fullName and displayName
code = code.replace(
  /onChange=\{\(e\) => handleInputChange\('fullName', e\.target\.value\)\}/g,
  "onChange={(e) => { handleInputChange('fullName', e.target.value); handleInputChange('displayName', e.target.value); }}"
);

// Replace the onChange for NOMBRE DE USUARIO to only update username
code = code.replace(
  /handleInputChange\('displayName', val\);\s*handleInputChange\('username', val\.toLowerCase\(\)\);/g,
  "handleInputChange('username', val.toLowerCase());"
);

// Fix the Firestore query for displayName uniqueness. If it's undefined or empty, we shouldn't query it or just skip the check.
// We only want to check if the *username* is unique! Not the displayName (which is just their real full name now and can be duplicated like "Juan Perez")
code = code.replace(
  /const qDisplayName = query\(collection\(db, 'users'\), where\('displayName', '==', profileData\.displayName\)\);\s*const displayNameSnap = await getDocs\(qDisplayName\);\s*const existingDisplayNameDoc = displayNameSnap\.docs\.find\(doc => doc\.id !== currentUser\.uid\);/g,
  "const existingDisplayNameDoc = false;"
);

// Make sure after Firestore save, we call the backend sync so Postgres is updated!
const targetSync = `        const docRef = doc(db, 'users', currentUser.uid);
        await setDoc(docRef, profileData, { merge: true });

        // Update Firebase Auth profile`;

const replacementSync = `        const docRef = doc(db, 'users', currentUser.uid);
        await setDoc(docRef, profileData, { merge: true });

        // Update Postgres DB
        try {
          await api.post('/api/users/sync', {
            displayName: profileData.displayName || profileData.fullName,
            username: cleanUsername,
            photoURL: profileData.photoURL || currentUser.photoURL
          });
        } catch(e) {
          console.error("Error syncing to postgres:", e);
        }

        // Update Firebase Auth profile`;

code = code.replace(targetSync, replacementSync);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx', code);
console.log("Updated ProfilePage.jsx successfully!");
