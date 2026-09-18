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
const newCatch = `  } catch (err) {
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

serverCode = serverCode.replace(/} catch \(err\) {[\s\S]*?sendEmail\([^)]+\);\s*}/g, newCatch);

fs.writeFileSync("server.js", serverCode);

// Modificando index.html
let htmlCode = fs.readFileSync("public/index.html", "utf8");

const oldIfRegex = /if \(data\.isWaitingSync\) \{[\s\S]*?\} else if \(isDownloading\) \{/;
const newIfStr = `if (data.isWaitingSync) {
                      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span> CICLO 24H (Sincronizado)';
                      badge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-blue-900/50 text-blue-300 border border-blue-700/50 flex items-center gap-2';
                      document.getElementById('btnStart').disabled = true;
                      document.getElementById('btnStop').disabled = false;
                  } else if (data.isWaitingCloudflare) {
                      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span> BLOQUEO IP (Reintento en 1H)';
                      badge.className = 'px-4 py-1.5 rounded-full text-sm font-bold bg-red-900/50 text-red-300 border border-red-700/50 flex items-center gap-2';
                      document.getElementById('btnStart').disabled = true;
                      document.getElementById('btnStop').disabled = false;
                  } else if (isDownloading) {`;

if (htmlCode.match(oldIfRegex) && !htmlCode.includes("data.isWaitingCloudflare")) {
    htmlCode = htmlCode.replace(oldIfRegex, newIfStr);
    fs.writeFileSync("public/index.html", htmlCode);
}
