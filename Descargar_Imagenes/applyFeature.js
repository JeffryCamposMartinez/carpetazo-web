const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

const resetRoute = `
  app.post('/api/reset', (req, res) => {
    isDownloading = false;
    isWaitingCloudflare = false;
    isWaitingSync = false;
    progress = {
      categories: [1, 2, 3, 71, 63, 62],
      catIdx: 0,
      groupsCache: [],
      groupIdx: 0,
      productsCache: [],
      productIdx: 0,
      downloadedCount: 0,
      downloadPhase: false,
      groupPhase: false
    };
    saveProgress();
    downloadedIds.clear();
    saveDownloadedIds();
    failedDownloads = [];
    saveFailed();
    res.json({ message: 'Sistema reiniciado a cero exitosamente' });
  });

  app.get('/api/failed/export', (req, res) => {
    const csvHeader = "ID,Nombre,Categoria,Grupo,Error,Fecha\\n";
    const csvRows = failedDownloads.map(f => \`\${f.id},"\${f.name}","\${f.category}","\${f.group}","\${f.error}",\${f.timestamp}\`).join("\\n");
    res.header('Content-Type', 'text/csv');
    res.attachment('failed_cards.csv');
    res.send(csvHeader + csvRows);
  });
`;

if (!code.includes("app.post('/api/reset'")) {
    const insertPoint = code.indexOf("app.post('/api/stop'");
    if (insertPoint !== -1) {
        const endOfStop = code.indexOf("});", insertPoint) + 3;
        code = code.substring(0, endOfStop) + resetRoute + code.substring(endOfStop);
        fs.writeFileSync("server.js", code);
        console.log("SERVER MODIFIED");
    }
}
