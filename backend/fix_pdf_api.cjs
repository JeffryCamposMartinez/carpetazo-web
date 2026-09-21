const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/HiddenPDFGenerator.jsx', 'utf8');

// 1. Remove firebase imports
code = code.replace(/import \{ db \} from '\.\.\/firebase';\n/, "");
code = code.replace(/import \{ collection, getDocs, doc, getDoc \} from 'firebase\/firestore';\n/, "import api from '../utils/api';\n");

// 2. Replace fetching logic
const targetFetch = `const folderSnap = await getDoc(doc(db, 'folders', folderId));
        if (folderSnap.exists()) setFolder(folderSnap.data());

        const cardsSnap = await getDocs(collection(db, 'folders', folderId, 'cards'));
        const cardsData = cardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));`;

const replaceFetch = `const res = await api.getFolder(folderId);
        if (res.success && res.folder) {
            setFolder(res.folder);
        }
        
        const cardsData = (res?.folder?.cards || []).map(c => ({ ...c, ...(c.data || {}) }));`;

code = code.replace(targetFetch, replaceFetch);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/HiddenPDFGenerator.jsx', code);
console.log("Migrated HiddenPDFGenerator to Prisma API!");
