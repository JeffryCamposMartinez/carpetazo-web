const fs = require("fs");
let serverCode = fs.readFileSync("server.js", "utf8");

const target = "async function curlFetch(url, retries = 5) {";
const newTarget = "async function curlFetch(url, retries = 5) {\n    // Freno obligatorio de 3 segundos para evadir a Cloudflare\n    await new Promise(r => setTimeout(r, 3000));";

if (serverCode.includes(target) && !serverCode.includes("Freno obligatorio")) {
    serverCode = serverCode.replace(target, newTarget);
    fs.writeFileSync("server.js", serverCode);
    console.log("REPLACED");
} else {
    console.log("NOT FOUND OR ALREADY ADDED");
}
