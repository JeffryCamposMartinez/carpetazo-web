const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const s3 = new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
    region: 'auto',
    maxRetries: 3
});

const basePath = (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Mitos_y_Leyendas' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas');
const dbs = ['Primer_Bloque_DB', 'Primera_Era_DB', 'Imperio_DB', 'Furia_Extendido_DB'];

async function getFiles(dir) {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

function uploadFileAsync(filePath) {
    return new Promise(async (resolve, reject) => {
        const relativePath = filePath.substring(basePath.length + 1).replace(/\\/g, '/');
        const r2Key = `Carpetazo.cl/Mitos_y_Leyendas/${relativePath}`;
        
        try {
            await s3.headObject({ Bucket: process.env.R2_BUCKET_NAME, Key: r2Key }).promise();
            resolve();
            return;
        } catch (err) {
            if (err.code !== 'NotFound') {
                console.error(`[ERROR] Comprobando existencia: ${r2Key} - ${err.message}`);
            }
        }

        const fileStream = fs.createReadStream(filePath);
        let contentType = 'image/webp';
        if (filePath.endsWith('.png')) contentType = 'image/png';
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
        
        s3.putObject({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r2Key,
            Body: fileStream,
            ContentType: contentType
        }, (err, data) => {
            if (err) {
                console.error(`[ERROR] Fallo subida: ${r2Key} - ${err.message}`);
                reject(err);
            } else {
                console.log(`[OK] Subido a R2: ${r2Key}`);
                resolve(data);
            }
        });
    });
}

async function main() {
    let allNonWebpFiles = [];
    
    console.log("Buscando imagenes PNG y JPG en el disco...");
    for (const db of dbs) {
        const imagesDirName = db.replace('_DB', '_Images');
        const imagesDir = path.join(basePath, db, imagesDirName);
        if (fs.existsSync(imagesDir)) {
            const files = await getFiles(imagesDir);
            const nonWebp = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
            allNonWebpFiles = allNonWebpFiles.concat(nonWebp);
        }
    }
    
    console.log(`Encontradas ${allNonWebpFiles.length} imagenes con extensiones incorrectas (PNG/JPG).`);
    
    console.log("Descargando TODAS las cartas de Mitos y Leyendas a memoria...");
    const allCards = await prisma.tcgProduct.findMany({
        where: { categoryId: 99 },
        select: { productId: true, imageUrl: true }
    });
    console.log(`Cargadas ${allCards.length} cartas.`);
    
    console.log("Actualizando la base de datos (in-memory match)...");
    let dbFixCount = 0;
    
    // Crear mapa de url_mala -> url_buena
    const urlMap = new Map();
    for (const file of allNonWebpFiles) {
        const folderName = path.basename(path.dirname(file));
        const correctUrlEnd = encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '/' + encodeURIComponent(path.basename(file)).replace(/%2F/gi, '%252F');
        const wrongUrlEnd = encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '/' + encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '.webp';
        urlMap.set(wrongUrlEnd, correctUrlEnd);
    }
    
    const updates = [];
    for (const card of allCards) {
        if (!card.imageUrl) continue;
        for (const [wrongEnd, rightEnd] of urlMap.entries()) {
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
    
    console.log(`Aplicando ${updates.length} updates a la base de datos...`);
    // Batch the updates!
    for (let i = 0; i < updates.length; i += 100) {
        await Promise.all(updates.slice(i, i + 100));
    }
    console.log(`[DB] Se actualizaron ${dbFixCount} cartas.`);
    
    console.log("Subiendo los archivos faltantes a R2...");
    const CONCURRENCY = 30;
    let uploadedCount = 0;
    for (let i = 0; i < allNonWebpFiles.length; i += CONCURRENCY) {
        const chunk = allNonWebpFiles.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(f => uploadFileAsync(f).catch(() => {})));
        uploadedCount += chunk.length;
        if (uploadedCount % 100 === 0 || uploadedCount === allNonWebpFiles.length) {
            console.log(`Subiendo... ${uploadedCount} / ${allNonWebpFiles.length}`);
        }
    }
    
    console.log("Proceso completado!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
