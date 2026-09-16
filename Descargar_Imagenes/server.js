const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexión directa usando pg
const pool = new Pool({
  connectionString: 'postgresql://postgres:carpetazo2024@185.173.110.158:5432/carpetazo_db'
});

// Variables de estado
let isDownloading = false;
let totalProducts = 0;
let downloadedImages = 0;
let currentImage = null;
let currentProductName = null;
let errorCount = 0;
const DOWNLOAD_DELAY = 1500; // 1.5 segundos entre cada imagen

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const writeStream = fs.createWriteStream(filepath);
        res.pipe(writeStream);
        writeStream.on('finish', () => {
          writeStream.close();
          resolve();
        });
      } else if (res.statusCode === 301 || res.statusCode === 302) {
         https.get(res.headers.location, (res2) => {
             const writeStream = fs.createWriteStream(filepath);
             res2.pipe(writeStream);
             writeStream.on('finish', () => {
               writeStream.close();
               resolve();
             });
         }).on('error', reject);
      } else {
        reject(new Error(`Failed to get url (${res.statusCode})`));
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
};

const startDownloadEngine = async () => {
  if (isDownloading) return;
  isDownloading = true;

  try {
    const { rows: products } = await pool.query('SELECT "productId", "name", "imageUrl" FROM "TcgProduct" WHERE "imageUrl" IS NOT NULL AND "imageUrl" != \'\' ORDER BY "productId" ASC');
    totalProducts = products.length;
    
    const imagesDir = path.join(__dirname, 'public', 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    
    const existingFiles = new Set(fs.readdirSync(imagesDir));
    downloadedImages = existingFiles.size;

    for (const product of products) {
      if (!isDownloading) break;

      const filename = `${product.productId}.jpg`;
      const filepath = path.join(imagesDir, filename);

      if (!existingFiles.has(filename) && !fs.existsSync(filepath)) {
        currentImage = product.imageUrl;
        currentProductName = product.name;
        
        try {
          await downloadImage(product.imageUrl, filepath);
          downloadedImages++;
          await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
        } catch (err) {
          console.error(`Error:`, err.message);
          errorCount++;
        }
      }
    }
    
    if (downloadedImages >= totalProducts) isDownloading = false;
    
  } catch (err) {
    console.error('Error fatal:', err);
    isDownloading = false;
  }
};

app.get('/api/status', async (req, res) => {
  if (totalProducts === 0) {
      try {
        const { rows } = await pool.query('SELECT COUNT(*) FROM "TcgProduct" WHERE "imageUrl" IS NOT NULL AND "imageUrl" != \'\'');
        totalProducts = parseInt(rows[0].count);
        
        const imagesDir = path.join(__dirname, 'public', 'images');
        if (fs.existsSync(imagesDir)) {
           downloadedImages = fs.readdirSync(imagesDir).length;
        }
      } catch (e) {}
  }
  
  const estimatedGb = ((downloadedImages * 25) / 1024 / 1024).toFixed(3);
  
  res.json({
    isDownloading,
    totalProducts,
    downloadedImages,
    currentImage,
    currentProductName,
    errorCount,
    percentage: totalProducts > 0 ? ((downloadedImages / totalProducts) * 100).toFixed(2) : 0,
    estimatedGb
  });
});

app.post('/api/start', (req, res) => {
  if (!isDownloading) {
    startDownloadEngine();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/api/stop', (req, res) => {
  isDownloading = false;
  res.json({ success: true });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Servidor de descargas corriendo en http://localhost:${PORT}`);
});
