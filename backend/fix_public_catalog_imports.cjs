const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', 'utf8');

// Replace the bad require code
code = code.replace(
  /const \{ doc, getDoc, getFirestore \} = require\('firebase\/firestore'\);\s*const db = getFirestore\(\);/g,
  ""
);

// Add imports
if (!code.includes("from 'firebase/firestore'")) {
    code = code.replace(
      "import { useAuth } from '../contexts/AuthContext';",
      "import { useAuth } from '../contexts/AuthContext';\nimport { doc, getDoc } from 'firebase/firestore';\nimport { db } from '../firebase';"
    );
}

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', code);
console.log("Fixed require error in PublicCatalog.jsx");
