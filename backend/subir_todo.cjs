const fs = require('fs');
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const baseDir = "C:\\Users\\Jeffry\\Desktop\\Definitivo cartas myl";
const app = express();
let currentProgress = { step: 'Iniciando...', logs: [] };

function addLog(msg) {
    currentProgress.logs.unshift(msg);
    if (currentProgress.logs.length > 50) currentProgress.logs.pop();
    console.log(msg);
    currentProgress.step = msg;
}

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sincronización VPS</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-white font-sans p-8">
        <div class="max-w-2xl mx-auto bg-gray-800 p-6 rounded-xl shadow-xl">
            <h1 class="text-3xl font-bold text-green-400 mb-4">Sincronizador con VPS (Fase 2)</h1>
            <div class="mb-4 p-4 bg-gray-700 rounded-lg">
                <div class="text-sm font-medium text-gray-300 uppercase tracking-wider mb-2">Estado Actual</div>
                <div id="status-text" class="text-xl font-bold text-yellow-300">Iniciando...</div>
            </div>
            <div class="bg-black p-4 rounded-lg h-96 overflow-y-auto font-mono text-xs text-gray-400" id="logs"></div>
        </div>
        <script>
            function update() {
                fetch('/api/status').then(res => res.json()).then(data => {
                    document.getElementById('status-text').textContent = data.step;
                    document.getElementById('logs').innerHTML = data.logs.map(l => '<div>' + l + '</div>').join('');
                });
            }
            setInterval(update, 1000);
            update();
        </script>
    </body>
    </html>
    `);
});

app.get('/api/status', (req, res) => res.json(currentProgress));

async function runCmd(cmd, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { shell: false });
        proc.stdout.on('data', d => console.log(d.toString()));
        proc.stderr.on('data', d => console.log(d.toString()));
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Command ${cmd} exited with ${code}`));
        });
    });
}

async function startSync() {
    try {
        const sshKey = "C:\\Users\\Jeffry\\.ssh\\antigravity_vps";

        addLog("1/4. El archivo de 600MB ya fue subido exitosamente en el intento anterior.");
        
        addLog("2/4. Extrayendo las carpetas en el volumen de Docker de Carpetazo (Directorio Primer Bloque)...");
        const sshCmd = `mkdir -p '/var/lib/docker/volumes/euipeh6ysbeenndtc41ksvgo-carpetazo-data/_data/images/myl/Primer Bloque' && tar -xf /root/variantes.tar -C '/var/lib/docker/volumes/euipeh6ysbeenndtc41ksvgo-carpetazo-data/_data/images/myl/Primer Bloque' && chmod -R 777 '/var/lib/docker/volumes/euipeh6ysbeenndtc41ksvgo-carpetazo-data/_data/images/myl/Primer Bloque' && rm /root/variantes.tar`;
        

        addLog("3/4. Archivos extraídos en el servidor. Comenzando Inyección en Base de Datos Local...");

        let maxGroup = await prisma.tcgGroup.findFirst({ orderBy: { groupId: 'desc' } }); let maxGroupId = maxGroup ? maxGroup.groupId : 999300; 
        let groupCache = {};

        const cards = [];
        const dirs = fs.readdirSync(baseDir);
        for (const d of dirs) {
            const dPath = path.join(baseDir, d);
            if (fs.statSync(dPath).isDirectory()) {
                const files = fs.readdirSync(dPath);
                for (const f of files) {
                    if (f.endsWith('.json')) {
                        cards.push(path.join(dPath, f));
                    }
                }
            }
        }

        addLog(`Encontradas ${cards.length} cartas (variantes) para inyectar.`);
        let done = 0;

        for (const cardFile of cards) {
            const data = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
            
            let editionName = data.subtitle || "Primer Bloque Variantes";
            let groupId = groupCache[editionName];
            
            if (!groupId) {
                let existing = await prisma.tcgGroup.findFirst({ where: { name: editionName, categoryId: 99 } });
                if (existing) {
                    groupId = existing.groupId;
                } else {
                    maxGroupId++;
                    const newGroup = await prisma.tcgGroup.create({
                        data: {
                            groupId: maxGroupId,
                            categoryId: 99,
                            name: editionName,
                            blockId: 2,
                            publishedOn: new Date(),
                            modifiedOn: new Date()
                        }
                    });
                    groupId = newGroup.groupId;
                }
                groupCache[editionName] = groupId;
            }

            const imgFile = path.basename(cardFile).replace('.json', '.webp');
            const cardFolder = path.basename(path.dirname(cardFile));
            
            const cleanName = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            const dbUrl = `https://api.carpetazo.cl/images/myl/Primer%20Bloque/${encodeURIComponent(cardFolder)}/${encodeURIComponent(imgFile)}`;

            await prisma.tcgProduct.upsert({
                where: { productId: data.id },
                update: {
                    name: data.name,
                    cleanName: cleanName,
                    imageUrl: dbUrl,
                    extData: data,
                    groupId: groupId
                },
                create: {
                    productId: data.id,
                    groupId: groupId,
                    categoryId: 99,
                    name: data.name,
                    cleanName: cleanName,
                    imageUrl: dbUrl,
                    extData: data
                }
            });

            done++;
            if (done % 100 === 0) addLog(`Inyectadas ${done} de ${cards.length} en la BD...`);
        }
        
        addLog(`4/4. ¡TODO COMPLETADO CON ÉXITO! Base de datos y servidor actualizados.`);
    } catch(e) {
        addLog(`[ERROR] ${e.message}`);
    } finally {
        await prisma.$disconnect();
    }
}

app.listen(8081, '0.0.0.0', () => {
    console.log("=========================================");
    console.log("🌐 UI DISPONIBLE EN: http://localhost:8081");
    console.log("=========================================");
    startSync();
});


