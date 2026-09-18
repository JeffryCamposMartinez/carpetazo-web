const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

html = html.replace(
  '<body class="min-h-screen flex items-center justify-center p-4">\n    <div class="max-w-4xl w-full bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700">',
  `<body class="min-h-screen flex items-center justify-center p-4">
    <!-- Modal Fallos -->
    <div id="modalFailed" class="hidden fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-50">
        <div class="bg-[#1e293b] max-w-3xl w-full max-h-[80vh] rounded-3xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
            <div class="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                <h2 class="text-xl font-bold text-rose-400 flex items-center gap-2">⚠️ Registro de Cartas Fallidas</h2>
                <button onclick="document.getElementById('modalFailed').classList.add('hidden')" class="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-xl text-sm font-bold transition-colors">Volver</button>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
                <div id="failedList" class="space-y-3">
                    <p class="text-slate-400 text-center py-8">Cargando...</p>
                </div>
            </div>
        </div>
    </div>

    <div class="max-w-4xl w-full bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700">`
);

html = html.replace(
  '<p class="text-sm font-bold text-slate-400 mb-6">Errores de Red: <span id="valErrors" class="text-rose-400">0</span></p>',
  `<p class="text-sm font-bold text-slate-400 mb-6 flex items-center gap-3">
                        Errores de Red: <span id="valErrors" class="text-rose-400">0</span>
                        <button onclick="showFailed()" class="bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 px-3 py-1 rounded text-xs transition-colors">Ver Detalles</button>
                    </p>`
);

html = html.replace(
  '        setInterval(fetchStatus, 2000);\n        fetchStatus();\n    </script>',
  `        async function showFailed() {
            document.getElementById('modalFailed').classList.remove('hidden');
            document.getElementById('failedList').innerHTML = '<p class="text-slate-400 text-center py-8">Cargando...</p>';
            try {
                const res = await fetch('/api/failed');
                const data = await res.json();
                if (data.length === 0) {
                    document.getElementById('failedList').innerHTML = '<p class="text-emerald-400 text-center py-8 font-bold">🎉 ¡Todo perfecto! No hay cartas fallidas.</p>';
                    return;
                }
                let htmlStr = '';
                data.forEach(item => {
                    htmlStr += \`
                    <div class="bg-slate-800 p-4 rounded-xl border border-rose-900/30">
                        <p class="font-bold text-white">\${item.name} <span class="text-xs text-slate-500 font-normal">(\${item.id})</span></p>
                        <p class="text-sm text-slate-400">\${item.category} > \${item.group}</p>
                        <p class="text-xs text-rose-400 mt-2 p-2 bg-rose-950/30 rounded border border-rose-900/50 font-mono break-all">\${item.error}</p>
                    </div>\`;
                });
                document.getElementById('failedList').innerHTML = htmlStr;
            } catch(err) {
                document.getElementById('failedList').innerHTML = '<p class="text-rose-400 text-center py-8">Error cargando lista</p>';
            }
        }

        setInterval(fetchStatus, 2000);
        fetchStatus();
    </script>`
);

fs.writeFileSync("public/index.html", html);
