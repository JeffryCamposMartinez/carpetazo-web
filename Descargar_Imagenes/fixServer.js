const fs = require("fs");
let serverCode = fs.readFileSync("server.js", "utf8");

// 1. Add isWaitingCloudflare global variable
if (!serverCode.includes("let isWaitingCloudflare = false;")) {
    serverCode = serverCode.replace("let isWaitingSync = false;", "let isWaitingSync = false;\nlet isWaitingCloudflare = false;");
}

// 2. Add isWaitingCloudflare to status endpoint
if (!serverCode.includes("isWaitingCloudflare: isWaitingCloudflare")) {
    serverCode = serverCode.replace("isWaitingSync: isWaitingSync", "isWaitingSync: isWaitingSync,\n    isWaitingCloudflare: isWaitingCloudflare");
}

// 3. Reset isWaitingCloudflare at start
if (!serverCode.includes("isWaitingCloudflare = false;")) {
    serverCode = serverCode.replace("isWaitingSync = false;", "isWaitingSync = false;\n    isWaitingCloudflare = false;");
}

// 4. Update the catch block
const oldCatch = `    } catch (err) {
      console.error('Error fatal:', err);
      isDownloading = false;
      sendEmail('⚠️ TCG Master Downloader: Se ha detenido por un error interno: ' + err.message);
    }`;

const newCatch = `    } catch (err) {
      console.error('Error fatal detectado (Posible Cloudflare):', err);
      isDownloading = false;
      isWaitingCloudflare = true;
      sendEmail('TCG Master Downloader: Se detecto un bloqueo largo de seguridad (ej. Cloudflare). El sistema se pondra a dormir y auto-reintentara en 1 hora.');
      
      // Auto-reinicio en 1 hora
      setTimeout(() => {
          console.log("Despertando tras 1 hora de reposo, reintentando extraccion...");
          if (!isDownloading) {
              startDownloadEngine();
          }
      }, 60 * 60 * 1000);
    }`;

serverCode = serverCode.replace(oldCatch, newCatch);

fs.writeFileSync("server.js", serverCode);
