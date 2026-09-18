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

code = code.replace("app.get('/api/failed'", resetRoute + "\napp.get('/api/failed'");
fs.writeFileSync("server.js", code);
