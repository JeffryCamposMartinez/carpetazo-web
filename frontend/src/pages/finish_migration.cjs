const fs = require('fs');

function finishMigration(path) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');

    // Replace addDoc with api.addCard
    content = content.replace(
      /await addDoc\(collection\(db, 'folders', id, 'cards'\), cardData\);/g,
      "await api.addCard(id, cardData);"
    );

    // Some places might still have firebase stuff if the regex missed it. Let's make sure.
    // E.g., `import { doc, getDoc, ...`
    content = content.replace(/import \{ doc, getDoc, updateDoc, deleteDoc, collection, getDocs, addDoc \} from 'firebase\/firestore';\n?/g, '');

    fs.writeFileSync(path, content, 'utf8');
    console.log(`Finished migration in ${path}`);
  }
}

finishMigration('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx');
finishMigration('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/AdminPanel.jsx');
