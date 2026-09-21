const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/Dashboard.jsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import HiddenPDFGenerator")) {
  code = code.replace("import api from '../utils/api';", "import api from '../utils/api';\nimport HiddenPDFGenerator from '../components/HiddenPDFGenerator';");
}

if (!code.includes("generatingPdfFolder")) {
  code = code.replace("const [orders, setOrders] = useState([]);", "const [orders, setOrders] = useState([]);\n  const [generatingPdfFolder, setGeneratingPdfFolder] = useState(null);\n  const [pdfProgress, setPdfProgress] = useState({ loaded: 0, total: 1, generating: false });");
}

fs.writeFileSync(file, code);
console.log("Injected imports and states");
