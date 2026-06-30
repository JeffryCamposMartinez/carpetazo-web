import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

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

async function check() {
  console.log("Checking email jeffry.campos.martinez@gmail.com...");
  const qEmail = query(collection(db, 'users'), where('email', '==', 'jeffry.campos.martinez@gmail.com'));
  const snapEmail = await getDocs(qEmail);
  console.log(`Found ${snapEmail.size} user(s) with this email:`);
  snapEmail.forEach(doc => console.log(doc.id, doc.data()));

  console.log("\nChecking username jeffry_campos...");
  const qUsername = query(collection(db, 'users'), where('username', '==', 'jeffry_campos'));
  const snapUsername = await getDocs(qUsername);
  console.log(`Found ${snapUsername.size} user(s) with this username:`);
  snapUsername.forEach(doc => console.log(doc.id, doc.data()));

  process.exit(0);
}

check().catch(console.error);
