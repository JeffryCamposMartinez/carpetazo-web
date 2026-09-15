const fs = require('fs');

function refactorFirebaseToApi(path) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');

    // Remove firestore imports
    content = content.replace(/import \{ doc, getDoc, updateDoc, deleteDoc, collection, getDocs, addDoc \} from 'firebase\/firestore';\n?/g, '');
    
    // 1. Refactor init / fetchCards
    content = content.replace(
      /const docRef = doc\(db, 'folders', id\);\s*const docSnap = await getDoc\(docRef\);\s*if \(docSnap\.exists\(\)\) \{\s*setFolderData\(docSnap\.data\(\)\);\s*fetchCards\(\);\s*\}/g,
      "const res = await api.getFolder(id);\n        if (res.success && res.folder) {\n          setFolderData(res.folder);\n          setCards(res.folder.cards || []);\n        }"
    );

    // 2. Refactor fetchCards 
    content = content.replace(
      /const querySnapshot = await getDocs\(collection\(db, 'folders', id, 'cards'\)\);\s*const cardsData = querySnapshot\.docs\.map\(doc => \(\{ \.\.\.doc\.data\(\), apiId: doc\.data\(\)\.id, id: doc\.id \}\)\);\s*setCards\(cardsData\);/g,
      "const res = await api.getFolder(id);\n      if(res.success && res.folder) setCards(res.folder.cards || []);"
    );

    // 3. Refactor executeDeleteCard
    content = content.replace(
      /await deleteDoc\(doc\(db, 'folders', id, 'cards', cardIdToDelete\)\);/g,
      "await api.deleteCard(id, cardIdToDelete);"
    );

    // 4. Refactor handleUpdateCard
    content = content.replace(
      /await updateDoc\(doc\(db, 'folders', id, 'cards', cardId\), \{ price, stock \}\);/g,
      "await api.updateCard(id, cardId, { price, stock });"
    );

    // 5. Refactor addCard
    // Wait, let's see if there's addDoc inside the file.
    content = content.replace(
      /const cardRef = await addDoc\(collection\(db, 'folders', id, 'cards'\), \{/g,
      "const result = await api.addCard(id, {"
    );
    
    // Update the end of addCard to handle API result instead of doc.id
    content = content.replace(
      /showToast\('Carta agregada al cat?logo', 'success'\);\s*fetchCards\(\);/g,
      "showToast('Carta agregada al cat?logo', 'success');\n      fetchCards();"
    );

    fs.writeFileSync(path, content, 'utf8');
    console.log(`Refactored Firebase to API in ${path}`);
  }
}

refactorFirebaseToApi('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx');
refactorFirebaseToApi('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/AdminPanel.jsx');
