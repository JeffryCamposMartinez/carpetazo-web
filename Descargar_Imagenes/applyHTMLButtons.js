const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

const newButtons = `                    <div class="flex gap-4 mt-4">
                        <button id="btnReset" onclick="resetProgress()" class="flex-1 bg-red-900/50 border border-red-500/50 hover:bg-red-800 text-red-100 font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-95">
                            RESET TOTAL
                        </button>
                        <button id="btnExport" onclick="exportErrors()" class="flex-1 bg-amber-900/50 border border-amber-500/50 hover:bg-amber-800 text-amber-100 font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-900/20 active:scale-95">
                            EXPORTAR ERRORES
                        </button>
                    </div>`;

if (!html.includes("btnReset")) {
    let hook = 'id="btnStop"';
    let endIndex = html.indexOf('</div>', html.indexOf(hook)) + 6;
    html = html.substring(0, endIndex) + "\n" + newButtons + html.substring(endIndex);
    fs.writeFileSync("public/index.html", html);
    console.log("HTML BUTTONS INJECTED");
}
