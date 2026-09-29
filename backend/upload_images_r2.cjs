const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config();

const dbArg = process.argv.find(a => a.startsWith('--db='));
const selectedFolders = dbArg ? dbArg.split('=')[1].split(',') : [];
const tcgType = process.argv.find(a => a === 'Pokemon' || a === 'Myl') || 'Myl';

if (selectedFolders.length === 0) {
    console.error('Uso: node upload_images_r2.cjs --db=Folder1,Folder2 [Pokemon|Myl]');
    process.exit(1);
}

const s3 = new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
    region: 'auto',
    maxRetries: 3
});

const basePath = tcgType === 'Pokemon' 
    ? 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Pokemon'
    : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas';

const tcgPathPart = tcgType === 'Pokemon' ? 'Pokemon' : 'Mitos_y_Leyendas';

async function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

const imageExtensions = ['.webp', '.jpg', '.jpeg', '.png'];

async function uploadFileAsync(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!imageExtensions.includes(ext)) return;

    const relativePath = filePath.substring(basePath.length + 1).replace(/\\/g, '/');
    const r2Key = `Carpetazo.cl/${tcgPathPart}/${relativePath}`;
    
    try {
        await s3.headObject({ Bucket: process.env.R2_BUCKET_NAME, Key: r2Key }).promise();
        return; // Ya existe
    } catch (err) {
        if (err.code !== 'NotFound') {
            console.error(`[ERROR] Comprobando existencia: ${r2Key} - ${err.message}`);
            return;
        }
    }

    const fileStream = fs.createReadStream(filePath);
    let contentType = 'image/webp';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

    console.log(`Subiendo: ${r2Key}`);
    try {
        await s3.putObject({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r2Key,
            Body: fileStream,
            ContentType: contentType
        }).promise();
    } catch (err) {
        console.error(`[ERROR] Subiendo: ${r2Key} - ${err.message}`);
    }
}

async function run() {
    console.log(`Iniciando subida a R2 para ${tcgType}. Carpetas: ${selectedFolders.join(', ')}`);
    
    for (const folder of selectedFolders) {
        const folderPath = path.join(basePath, folder);
        console.log(`Escaneando ${folderPath}...`);
        
        let targetDir = folderPath;
        if (tcgType === 'Pokemon') {
            targetDir = path.join(folderPath, 'Images');
        } else {
            targetDir = path.join(folderPath, folder.replace('_DB', '_Images'));
        }

        const files = await getFiles(targetDir);
        console.log(`Encontrados ${files.length} archivos en total.`);
        
        const limit = 10;
        for (let i = 0; i < files.length; i += limit) {
            const chunk = files.slice(i, i + limit);
            await Promise.all(chunk.map(uploadFileAsync));
            if ((i + limit) % 500 === 0) {
                console.log(`Progreso: ${Math.min(i + limit, files.length)} / ${files.length}`);
            }
        }
    }
    console.log('¡Subida a R2 completada!');
}

run();
