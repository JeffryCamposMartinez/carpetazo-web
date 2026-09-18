const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

const buttonsToReplace = `<button id="btnStop" onclick="toggleDownload(false)" class="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            PAUSAR
                        </button>
                    </div>`;

const newButtons = `<button id="btnStop" onclick="toggleDownload(false)" class="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            PAUSAR
                        </button>
                    </div>
                    <div class="flex gap-4 mt-4">
                        <button id="btnReset" onclick="resetProgress()" class="flex-1 bg-red-900/50 border border-red-500/50 hover:bg-red-800 text-red-100 font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-95">
                            RESET TOTAL
                        </button>
                        <button id="btnExport" onclick="exportErrors()" class="flex-1 bg-amber-900/50 border border-amber-500/50 hover:bg-amber-800 text-amber-100 font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-900/20 active:scale-95">
                            EXPORTAR ERRORES
                        </button>
                    </div>`;

const newScripts = `
        async function resetProgress() {
            if (confirm("¿Estás 100% seguro de que quieres BORRAR todo el progreso y volver a la carta 0? Esto no borrará las imágenes de Drive, pero el bot empezará desde el principio.")) {
                await fetch('/api/reset', { method: 'POST' });
                alert("Sistema reiniciado a 0. La página se recargará.");
                window.location.reload();
            }
        }

        function exportErrors() {
            window.location.href = '/api/failed/export';
        }

        async function toggleDownload(start) {`;

html = html.replace(buttonsToReplace, newButtons);
html = html.replace("async function toggleDownload(start) {", newScripts);
fs.writeFileSync("public/index.html", html);
