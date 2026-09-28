import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

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
const dbsToUpload = ['Primer_Bloque_DB', 'Primera_Era_DB', 'Imperio_DB', 'Furia_Extendido_DB'];

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
            // console.log(`[SKIP] Ya existe: ${r2Key}`);
            resolve();
            return;
        } catch (err) {
            if (err.code !== 'NotFound') {
                console.error(`[ERROR] Comprobando existencia: ${r2Key} - ${err.message}`);
            }
        }

        const fileStream = fs.createReadStream(filePath);
        
        s3.putObject({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r2Key,
            Body: fileStream,
            ContentType: 'image/webp'
        }, (err, data) => {
            if (err) {
                console.error(`[ERROR] Fallo subida: ${r2Key} - ${err.message}`);
                reject(err);
            } else {
                console.log(`[OK] Subido: ${r2Key}`);
                resolve(data);
            }
        });
    });
}

async function run() {
    console.log("Iniciando subida con AWS SDK v2 (modo Skip)...");
    let allWebpFiles = [];

    for (const db of dbsToUpload) {
        const imagesDirName = db.replace('_DB', '_Images');
        const imagesDir = path.join(basePath, db, imagesDirName);
        if (fs.existsSync(imagesDir)) {
            console.log(`Escaneando directorio: ${imagesDir}`);
            const files = await getFiles(imagesDir);
            const webpFiles = files.filter(f => f.endsWith('.webp'));
            allWebpFiles = allWebpFiles.concat(webpFiles);
        }
    }

    console.log(`Total de imǭgenes a revisar: ${allWebpFiles.length}`);
    
    const CONCURRENCY = 30;
    let uploadedCount = 0;
    for (let i = 0; i < allWebpFiles.length; i += CONCURRENCY) {
        const chunk = allWebpFiles.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(f => uploadFileAsync(f).catch(() => {})));
        uploadedCount += chunk.length;
        if (uploadedCount % 1000 === 0 || uploadedCount === allWebpFiles.length) {
            console.log(`Progreso: ${uploadedCount} / ${allWebpFiles.length}`);
        }
    }
    
    console.log("Todas las imǭgenes han sido subidas o verificadas en Cloudflare R2!");
}

run().catch(console.error);
