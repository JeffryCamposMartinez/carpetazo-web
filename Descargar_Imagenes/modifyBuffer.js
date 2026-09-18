const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

code = code.replace(
  'const { stdout } = await execPromise(`curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "` + url + `"` );',
  'const { stdout } = await execPromise(`curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "` + url + `"`, { maxBuffer: 1024 * 1024 * 50 });'
);

fs.writeFileSync("server.js", code);
