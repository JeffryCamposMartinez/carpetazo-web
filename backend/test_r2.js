import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const r2Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.R2_ACCOUNT_ID ? "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com" : '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED"
});

async function run() {
    try {
        await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: 'Carpetazo.cl/test-direct.txt',
            Body: 'test',
            ContentType: 'text/plain'
        }));
        console.log('Upload success!');
    } catch (e) {
        console.error('Upload failed:', e);
    }
}
run();
