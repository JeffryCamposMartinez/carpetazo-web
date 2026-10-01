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

const basePath = (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Mitos_y_Leyendas' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas');
const dbsToUpload = ['Primer_Bloque_DB', 'Imperio_DB', 'Furia_Extendido_DB', 'Primera_Era_DB'];

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
            ContentType: 'application/json'
        }, (err, data) => {
            if (err) {
                console.error(`[ERROR] Fallo subida: ${r2Key} - ${err.message}`);
                reject(err);
            } else {
                console.log(`[OK] JSON Subido: ${r2Key}`);
                resolve(data);
            }
        });
    });
}

async function run() {
    console.log("Iniciando subida de JSONs con AWS SDK v2...");
    let allJsonFiles = [];

    for (const db of dbsToUpload) {
        const dataDirName = db.replace('_DB', '_Data');
        const dataDir = path.join(basePath, db, dataDirName);
        if (fs.existsSync(dataDir)) {
            console.log(`Escaneando directorio de datos: ${dataDir}`);
            const files = await getFiles(dataDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            allJsonFiles = allJsonFiles.concat(jsonFiles);
        }
    }

    console.log(`Total de JSONs a subir: ${allJsonFiles.length}`);
    
    const CONCURRENCY = 20; // Fast upload for tiny JSONs
    for (let i = 0; i < allJsonFiles.length; i += CONCURRENCY) {
        const chunk = allJsonFiles.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(f => uploadFileAsync(f).catch(() => {})));
    }
    
    console.log("¡Todos los JSON han sido subidos a Cloudflare R2!");
}

run().catch(console.error);
