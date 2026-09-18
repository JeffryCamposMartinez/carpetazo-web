const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

const topAdditions = `
const failedPath = path.join(__dirname, 'failed.json');
let failedDownloads = [];
if (fs.existsSync(failedPath)) {
  try { failedDownloads = JSON.parse(fs.readFileSync(failedPath, 'utf8')); } catch(e) {}
}
const saveFailed = () => fs.writeFileSync(failedPath, JSON.stringify(failedDownloads, null, 2));

const sendWhatsApp = (message) => {
  const phone = process.env.WSP_PHONE || '+56933105415';
  const apikey = process.env.CALLMEBOT_API_KEY;
  if (!apikey) {
    console.log("WhatsApp API Key no configurada. Mensaje:", message);
    return;
  }
  const url = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(phone) + "&text=" + encodeURIComponent(message) + "&apikey=" + apikey;
  https.get(url, (res) => {
    res.on('data', () => {});
  }).on('error', (err) => console.error("Error WSP:", err.message));
};
`;

code = code.replace("const progressPath = path.join(__dirname, 'progress.json');", "const progressPath = path.join(__dirname, 'progress.json');\n" + topAdditions);

code = code.replace(
  "isDownloading = true;",
  "isDownloading = true;\n  sendWhatsApp('🚀 TCG Master Downloader: La extracción ha iniciado.');"
);

code = code.replace(
  "if (progress.catIdx >= progress.categories.length) isDownloading = false;",
  "if (progress.catIdx >= progress.categories.length) {\n      isDownloading = false;\n      sendWhatsApp('✅ TCG Master Downloader: ¡Descarga completada al 100%!');\n    }"
);

code = code.replace(
  "console.error('Error fatal:', err);\n    isDownloading = false;",
  "console.error('Error fatal:', err);\n    isDownloading = false;\n    sendWhatsApp('⚠️ TCG Master Downloader: Se ha detenido por un error interno: ' + err.message);"
);

code = code.replace(
  "errorCount++;",
  `errorCount++;
                failedDownloads.push({
                  id: product.productId,
                  name: product.name,
                  category: currentCategoryName,
                  group: currentGroupName,
                  error: err.message,
                  timestamp: new Date().toISOString()
                });
                saveFailed();`
);

code = code.replace(
  "app.post('/api/stop', (req, res) => {",
  "app.post('/api/stop', (req, res) => {\n  if (isDownloading) sendWhatsApp('🛑 TCG Master Downloader: La extracción ha sido pausada.');"
);

// We need an endpoint to view failed downloads!
code = code.replace(
  "// Capturar errores 404 para todo lo dems",
  "app.get('/api/failed', (req, res) => {\n  res.json(failedDownloads);\n});\n\n// Capturar errores 404 para todo lo dems"
);

fs.writeFileSync("server.js", code);
