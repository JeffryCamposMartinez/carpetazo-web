const fs = require('fs');
function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes('firebase/firestore')) {
    content = content.replace("import { db } from '../firebase';", "import { db } from '../firebase';\nimport { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, addDoc } from 'firebase/firestore';");
    fs.writeFileSync(path, content, 'utf8');
    console.log(`Fixed imports in ${path}`);
  } else {
    console.log(`Imports already exist in ${path}`);
  }
}
fixFile('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx');
fixFile('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/AdminPanel.jsx');
