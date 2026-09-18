const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

if (!code.includes("/api/failed")) {
  code = code.replace("app.listen(PORT", "app.get('/api/failed', (req, res) => {\n  res.json(failedDownloads);\n});\n\napp.listen(PORT");
  fs.writeFileSync("server.js", code);
}
