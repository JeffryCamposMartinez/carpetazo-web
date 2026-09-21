import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "dummy",
  projectId: "carpetazo-cl"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCards() {
  const foldersRef = collection(db, 'folders');
  const foldersSnap = await getDocs(query(foldersRef, limit(10)));
  for (const f of foldersSnap.docs) {
    const data = f.data();
    if (data.tcg === 'Mitos y Leyendas') {
      console.log(`Found MyL folder: ${f.id}`);
      const cardsSnap = await getDocs(collection(db, `folders/${f.id}/cards`));
      for (const c of cardsSnap.docs) {
        console.log(JSON.stringify(c.data(), null, 2));
        return;
      }
    }
  }
}
checkCards().catch(console.error);
