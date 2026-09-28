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
    region: 'auto'
});

const basePath = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas';
const dbsToUpload = ['Primer_Bloque_DB'];

async function getFiles(dir) {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

function uploadFileAsync(filePath) {
    return new Promise((resolve, reject) => {
        const relativePath = filePath.substring(basePath.length + 1).replace(/\\/g, '/');
        const r2Key = `Carpetazo.cl/Mitos_y_Leyendas/${relativePath}`;
        
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
    console.log("Iniciando subida con AWS SDK v2...");
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

    console.log(`Total de imágenes a subir: ${allWebpFiles.length}`);
    
    const CONCURRENCY = 15;
    for (let i = 0; i < allWebpFiles.length; i += CONCURRENCY) {
        const chunk = allWebpFiles.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(f => uploadFileAsync(f).catch(() => {})));
    }
    
    console.log("¡Todas las imágenes han sido subidas a Cloudflare R2!");
}

run().catch(console.error);
