const fs = require("fs");

// -------- EDIT SERVER.JS --------
let serverCode = fs.readFileSync("server.js", "utf8");

// Add downloaded_ids state
const downloadedIdsLogic = `
const downloadedIdsPath = path.join(__dirname, 'downloaded_ids.json');
let downloadedIds = new Set();
if (fs.existsSync(downloadedIdsPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(downloadedIdsPath, 'utf8'));
    downloadedIds = new Set(data);
  } catch(e) {}
}
const saveDownloadedIds = () => {
  fs.writeFileSync(downloadedIdsPath, JSON.stringify(Array.from(downloadedIds)));
};
let isWaitingSync = false;
`;

if (!serverCode.includes("downloadedIdsPath")) {
  serverCode = serverCode.replace("let isDownloading = false;", "let isDownloading = false;\n" + downloadedIdsLogic);
}

// Modify product loop to check downloadedIds
serverCode = serverCode.replace(
  'try {\n                await uploadToDrive(product.imageUrl, product, currentCategoryName, currentGroupName);\n                progress.downloadedCount++;\n                saveProgress();\n                await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));\n              } catch (err) {',
  `try {
                if (!downloadedIds.has(product.productId)) {
                    await uploadToDrive(product.imageUrl, product, currentCategoryName, currentGroupName);
                    downloadedIds.add(product.productId);
                    saveDownloadedIds();
                    progress.downloadedCount++;
                    saveProgress();
                    await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
                }
              } catch (err) {`
);

// Modify loop completion for 24h cycle
const oldCompletion = `if (progress.catIdx >= progress.categories.length) {
      isDownloading = false;
      sendEmail('? TCG Master Downloader: Descarga completada al 100%!');
    }`;
    
const newCompletion = `if (progress.catIdx >= progress.categories.length) {
      isDownloading = false;
      isWaitingSync = true;
      sendEmail('✅ TCG Master Downloader: ¡Sincronización diaria completada! El sistema entrará en pausa y buscará cartas nuevas automáticamente en 24 horas.');
      
      progress.catIdx = 0;
      progress.groupIdx = 0;
      progress.productIdx = 0;
      progress.groupsCache = [];
      progress.productsCache = [];
      saveProgress();

      setTimeout(() => {
          console.log("Despertando para ciclo de sincronización diaria de 24h...");
          startDownloadEngine();
      }, 24 * 60 * 60 * 1000);
    }`;

// Try replacing both encoding variants just in case
serverCode = serverCode.replace(oldCompletion, newCompletion);
serverCode = serverCode.replace(`if (progress.catIdx >= progress.categories.length) {
      isDownloading = false;
      sendEmail('? TCG Master Downloader: Descarga completada al 100%!');
    }`, newCompletion);
    
// We also need to add isWaitingSync to /api/status
serverCode = serverCode.replace(
  'isDownloading,\n    isGoogleAuth,',
  'isDownloading,\n    isWaitingSync,\n    isGoogleAuth,'
);

// When startDownloadEngine begins, clear isWaitingSync
serverCode = serverCode.replace(
  'isDownloading = true;\n  sendEmail',
  'isDownloading = true;\n  isWaitingSync = false;\n  sendEmail'
);

fs.writeFileSync("server.js", serverCode);

// -------- EDIT INDEX.HTML --------
let htmlCode = fs.readFileSync("public/index.html", "utf8");

const oldStatusLogic = `if (isDownloading) {
                    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> EXTRALLENDO';
                    badge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 flex items-center gap-2';
                    document.getElementById('btnStart').disabled = true;
                    document.getElementById('btnStop').disabled = false;
                } else {`;
                
const newStatusLogic = `if (data.isWaitingSync) {
                    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span> CICLO 24H (Sincronizado)';
                    badge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-blue-900/50 text-blue-300 border border-blue-700/50 flex items-center gap-2';
                    document.getElementById('btnStart').disabled = true;
                    document.getElementById('btnStop').disabled = false;
                } else if (isDownloading) {
                    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> EXTRALLENDO';
                    badge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 flex items-center gap-2';
                    document.getElementById('btnStart').disabled = true;
                    document.getElementById('btnStop').disabled = false;
                } else {`;

if (!htmlCode.includes("data.isWaitingSync")) {
  htmlCode = htmlCode.replace(oldStatusLogic, newStatusLogic);
}

fs.writeFileSync("public/index.html", htmlCode);
