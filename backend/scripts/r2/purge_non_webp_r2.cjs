const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
    region: 'auto'
});

async function main() {
    console.log("Escaneando TODO el bucket R2 en busca de basura (.png y .jpg)...");
    
    let isTruncated = true;
    let continuationToken = undefined;
    const bucket = process.env.R2_BUCKET_NAME;
    let totalScanned = 0;
    
    const keysToDelete = [];

    while (isTruncated) {
        const params = {
            Bucket: bucket,
            MaxKeys: 1000,
            ContinuationToken: continuationToken
        };
        const response = await s3.listObjectsV2(params).promise();
        
        for (const item of response.Contents) {
            totalScanned++;
            const key = item.Key.toLowerCase();
            if (key.endsWith('.png') || key.endsWith('.jpg') || key.endsWith('.jpeg')) {
                keysToDelete.push(item.Key);
            }
        }
        
        isTruncated = response.IsTruncated;
        continuationToken = response.NextContinuationToken;
    }
    
    console.log(`Se escanearon ${totalScanned} archivos en R2.`);
    console.log(`Se encontraron ${keysToDelete.length} archivos PNG/JPG para eliminar permanentemente.`);
    
    if (keysToDelete.length === 0) {
        console.log("No hay nada que borrar.");
        return;
    }

    // R2 DeleteObjects allows up to 1000 keys per request
    for (let i = 0; i < keysToDelete.length; i += 1000) {
        const chunk = keysToDelete.slice(i, i + 1000);
        const deleteParams = {
            Bucket: bucket,
            Delete: {
                Objects: chunk.map(key => ({ Key: key }))
            }
        };
        try {
            await s3.deleteObjects(deleteParams).promise();
            console.log(`Borrados ${chunk.length} archivos de R2.`);
        } catch (err) {
            console.error("Error borrando lote:", err);
        }
    }
    
    console.log("¡Limpieza profunda de Cloudflare R2 completada!");
}

main().catch(console.error);
