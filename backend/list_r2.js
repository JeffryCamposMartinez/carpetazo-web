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

s3.listObjectsV2({ Bucket: process.env.R2_BUCKET_NAME, MaxKeys: 5 }, (err, data) => {
    if (err) console.error("LIST ERROR:", err);
    else console.log("FILES:", data.Contents.map(c => c.Key));
});
