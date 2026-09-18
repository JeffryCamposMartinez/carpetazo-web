const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

const oldFetch = `async function curlFetch(url) {
  try {
    const { stdout } = await execPromise(\`curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "\` + url + \`"\`, { maxBuffer: 1024 * 1024 * 50 });
    return JSON.parse(stdout);
  } catch (err) {
    console.error("curlFetch error: ", err);
    throw err;
  }
}`;

const newFetch = `async function curlFetch(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const { stdout } = await execPromise(\`curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "\` + url + \`"\`, { maxBuffer: 1024 * 1024 * 50 });
      return JSON.parse(stdout);
    } catch (err) {
      console.error(\`curlFetch intento \${i+1} falló para \${url}:\`, err.message);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 10000)); // Esperar 10s si Cloudflare nos bloquea
    }
  }
}`;

if (code.includes('async function curlFetch(url) {') && !code.includes('retries = 5')) {
  code = code.replace(oldFetch, newFetch);
  fs.writeFileSync("server.js", code);
}
