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

const basePath = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas';
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
    
    // 1. Encontrar todos los PNG y JPG
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
    
    // 2. Arreglar la base de datos
    console.log("Actualizando la base de datos...");
    let dbFixCount = 0;
    
    for (const file of allNonWebpFiles) {
        const ext = path.extname(file); // .png o .jpg
        const folderName = path.basename(path.dirname(file));
        const relativePath = file.substring(basePath.length + 1).replace(/\\/g, '/');
        const correctUrlEnd = encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '/' + encodeURIComponent(path.basename(file)).replace(/%2F/gi, '%252F');
        const wrongUrlEnd = encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '/' + encodeURIComponent(folderName).replace(/%2F/gi, '%252F') + '.webp';
        
        // El nombre de archivo a veces es distinto a la carpeta, por ejemplo "47 Ronin.png", carpeta "47 Ronin"
        // Update product where imageUrl ends with folderName/folderName.webp to point to the correct URL.
        const products = await prisma.tcgProduct.findMany({
            where: {
                categoryId: 99,
                imageUrl: { endsWith: wrongUrlEnd }
            }
        });
        
        for (const p of products) {
            const newUrl = p.imageUrl.replace(wrongUrlEnd, correctUrlEnd);
            await prisma.tcgProduct.update({
                where: { productId: p.productId },
                data: { imageUrl: newUrl }
            });
            dbFixCount++;
        }
    }
    
    console.log(`[DB] Se actualizaron ${dbFixCount} cartas con extensiones arregladas.`);
    
    // 3. Subir a R2
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
