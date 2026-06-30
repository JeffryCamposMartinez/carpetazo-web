import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9g1X-PTEoO7B-U8wT7Vltthr2UKbQPYE",
  authDomain: "carpetazo.cl",
  projectId: "carpetazo-db9d7",
  storageBucket: "carpetazo-db9d7.firebasestorage.app",
  messagingSenderId: "276744200057",
  appId: "1:276744200057:web:f51adf5e81b88d71e059a8",
  measurementId: "G-RTX48JMXHH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fix() {
  console.log("Fetching users with username jeffry_campos...");
  const qUsername = query(collection(db, 'users'), where('username', '==', 'jeffry_campos'));
  const snapUsername = await getDocs(qUsername);
  
  let count = 0;
  for (const doc of snapUsername.docs) {
    const data = doc.data();
    if (data.isDeactivated) {
      const newUsername = `jeffry_campos_deleted_${doc.id}`;
      console.log(`Renaming deactivated account ${doc.id} to ${newUsername}...`);
      await updateDoc(doc.ref, { username: newUsername });
      count++;
    }
  }
  
  console.log(`Fixed ${count} deactivated accounts.`);
  process.exit(0);
}

fix().catch(console.error);
