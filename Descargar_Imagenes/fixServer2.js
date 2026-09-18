const fs = require("fs");
let serverCode = fs.readFileSync("server.js", "utf8");

// Usamos split o index of para estar seguros.
const catchHeader = "    } catch (err) {";
const consoleErr = "console.error('Error fatal:', err);";

let parts = serverCode.split(catchHeader);
// El ltimo 'catch (err)' (antes del de auth) es el de startDownloadEngine.
// Mejor lo encontramos as:
let replaceStartIndex = serverCode.lastIndexOf("} catch (err) {", serverCode.indexOf("app.get('/api/auth/google'"));

if (replaceStartIndex !== -1) {
    let replaceEndIndex = serverCode.indexOf("};", replaceStartIndex);
    
    const newCatch = `} catch (err) {
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
    
    serverCode = serverCode.substring(0, replaceStartIndex) + newCatch + "\n  " + serverCode.substring(replaceEndIndex);
    fs.writeFileSync("server.js", serverCode);
    console.log("SUCCESS");
} else {
    console.log("No se pudo encontrar el punto de reemplazo.");
}
