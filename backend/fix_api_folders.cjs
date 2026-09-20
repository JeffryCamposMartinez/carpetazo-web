const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', 'utf8');

// Fix /api/folders
code = code.replace(
  /include: \{ user: \{ select: \{ name: true \} \}, _count: \{ select: \{ cards: true \} \} \},/g,
  "include: { user: { select: { name: true, username: true, photoURL: true, firebaseUid: true } }, _count: { select: { cards: true } } },"
);

// Fix /api/folders/:id
code = code.replace(
  /include: \{ cards: true, user: \{ select: \{ name: true, email: true \} \} \}/g,
  "include: { cards: true, user: { select: { name: true, email: true, username: true, photoURL: true, firebaseUid: true } } }"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', code);
console.log("Updated server.js");
