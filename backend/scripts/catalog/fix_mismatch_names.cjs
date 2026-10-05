const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const basePath = (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Mitos_y_Leyendas' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas');
const dbs = ['Primer_Bloque_DB', 'Primera_Era_DB', 'Imperio_DB', 'Furia_Extendido_DB'];

async function main() {
    let mismatchCount = 0;
    const urlFixes = new Map();

    function scanDir(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                scanDir(path.join(dir, item.name));
            } else {
                const folderName = path.basename(dir);
                const fileName = path.basename(item.name, path.extname(item.name));
                const ext = path.extname(item.name);
                
                // Si la carpeta se llama "47 Ronin 2" pero el archivo es "47 Ronin.webp"
                if (folderName !== fileName && ext === '.webp') {
                    // El URL malo que esta en la DB (basado en el bug de Codex):
                    // folderName + "/" + folderName + ".webp"
                    const wrongUrlEnd = encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '/' + encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '.webp';
                    
                    // El URL bueno que realmente subimos a R2:
                    // folderName + "/" + fileName + ".webp"
                    const correctUrlEnd = encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '/' + encodeURIComponent(item.name).replace(/%2F/gi, '%252F');
                    
                    urlFixes.set(wrongUrlEnd, correctUrlEnd);
                    mismatchCount++;
                }
            }
        }
    }

    console.log("Escaneando disco para encontrar discrepancias entre carpeta y archivo...");
    for (const db of dbs) {
        const imgDir = path.join(basePath, db, db.replace('_DB', '_Images'));
        if (fs.existsSync(imgDir)) scanDir(imgDir);
    }

    console.log(`Encontradas ${mismatchCount} discrepancias. Buscando en BD...`);

    const allCards = await prisma.tcgProduct.findMany({
        where: { categoryId: 99 },
        select: { productId: true, imageUrl: true }
    });

    let dbFixCount = 0;
    const updates = [];

    for (const card of allCards) {
        if (!card.imageUrl) continue;
        for (const [wrongEnd, rightEnd] of urlFixes.entries()) {
            if (card.imageUrl.endsWith(wrongEnd)) {
                const newUrl = card.imageUrl.replace(wrongEnd, rightEnd);
                updates.push(prisma.tcgProduct.update({
                    where: { productId: card.productId },
                    data: { imageUrl: newUrl }
                }));
                dbFixCount++;
                break;
            }
        }
    }

    console.log(`Aplicando ${updates.length} fixes a la base de datos...`);
    for (let i = 0; i < updates.length; i += 200) {
        await Promise.all(updates.slice(i, i + 200));
    }

    console.log(`¡Corregidos ${dbFixCount} URLs en la base de datos!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
