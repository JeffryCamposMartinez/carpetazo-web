const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const s3 = new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
    region: 'auto'
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

function deleteFromR2(key) {
    return s3.deleteObject({ Bucket: process.env.R2_BUCKET_NAME, Key: key }).promise().catch(e => console.error('Error delete R2:', e));
}

function uploadToR2(filePath, key) {
    const fileStream = fs.createReadStream(filePath);
    return s3.putObject({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: 'image/webp'
    }).promise().catch(e => console.error('Error upload R2:', e));
}

async function main() {
    let allNonWebpFiles = [];
    console.log("1. Buscando PNG y JPG locales...");
    
    for (const db of dbs) {
        const imagesDirName = db.replace('_DB', '_Images');
        const imagesDir = path.join(basePath, db, imagesDirName);
        if (fs.existsSync(imagesDir)) {
            const files = await getFiles(imagesDir);
            const nonWebp = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
            allNonWebpFiles = allNonWebpFiles.concat(nonWebp);
        }
    }
    
    console.log(`Se encontraron ${allNonWebpFiles.length} archivos para convertir a WebP.`);

    let convertedCount = 0;
    const CONCURRENCY = 10;
    
    console.log("2. Convirtiendo a WebP, borrando originales y subiendo a R2...");
    
    for (let i = 0; i < allNonWebpFiles.length; i += CONCURRENCY) {
        const chunk = allNonWebpFiles.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (file) => {
            const ext = path.extname(file);
            const webpFile = file.substring(0, file.length - ext.length) + '.webp';
            
            // 1. Convert to webp using sharp
            try {
                await sharp(file).webp({ quality: 80 }).toFile(webpFile);
            } catch(e) {
                console.error(`Error convirtiendo ${file}:`, e);
                return;
            }
            
            // 2. Delete local original
            try {
                fs.unlinkSync(file);
            } catch(e) {}
            
            const relativePathOld = file.substring(basePath.length + 1).replace(/\\/g, '/');
            const r2KeyOld = `Carpetazo.cl/Mitos_y_Leyendas/${relativePathOld}`;
            
            const relativePathNew = webpFile.substring(basePath.length + 1).replace(/\\/g, '/');
            const r2KeyNew = `Carpetazo.cl/Mitos_y_Leyendas/${relativePathNew}`;
            
            // 3. Delete from R2 (in case it was uploaded)
            await deleteFromR2(r2KeyOld);
            
            // 4. Upload new .webp to R2
            await uploadToR2(webpFile, r2KeyNew);
            
            convertedCount++;
        }));
        
        console.log(`Progreso conversión y subida: ${convertedCount} / ${allNonWebpFiles.length}`);
    }

    console.log("3. Revirtiendo los URLs en la base de datos a .webp...");
    
    // We can do this very efficiently using raw SQL!
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "TcgProduct"
      SET "imageUrl" = REPLACE(REPLACE("imageUrl", '.png', '.webp'), '.jpg', '.webp')
      WHERE ("imageUrl" LIKE '%.png' OR "imageUrl" LIKE '%.jpg' OR "imageUrl" LIKE '%.jpeg') AND "categoryId" = 99
    `);
    
    console.log(`[OK] Base de datos actualizada con ${result} cartas revertidas a .webp`);
    console.log("¡Todo el catálogo unificado en WebP completado!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
