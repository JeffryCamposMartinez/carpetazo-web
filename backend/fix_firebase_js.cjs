const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/firebase.js', 'utf8');

code = code.replace(/\/\/ import \{ getFirestore \} from "firebase\/firestore";/g, 'import { getFirestore } from "firebase/firestore";');
code = code.replace(/export const db = null;/g, 'export const db = getFirestore(app);');

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/firebase.js', code);
console.log("Fixed firebase.js to export db properly!");
