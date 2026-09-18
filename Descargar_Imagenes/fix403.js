const fs = require("fs");
let serverCode = fs.readFileSync("server.js", "utf8");

// Change DOWNLOAD_DELAY to 3000
serverCode = serverCode.replace("const DOWNLOAD_DELAY = 1500;", "const DOWNLOAD_DELAY = 3000;");

// Update the inner catch block
const innerCatchTarget = `} catch (err) {
                  console.error(\`Error subiendo \${product.productId}:\`, err.message);
                  errorCount++;`;

const newInnerCatch = `} catch (err) {
                  console.error(\`Error subiendo \${product.productId}:\`, err.message);
                  if (err.message.includes('403') || err.message.includes('429')) {
                      throw new Error("TCGPlayer CDN Bloqueo de IP (403/429). Forzando reposo de 1 hora.");
                  }
                  errorCount++;`;

if (serverCode.includes(innerCatchTarget)) {
    serverCode = serverCode.replace(innerCatchTarget, newInnerCatch);
    fs.writeFileSync("server.js", serverCode);
    console.log("REPLACED");
} else {
    console.log("NOT FOUND OR ALREADY ADDED");
}
