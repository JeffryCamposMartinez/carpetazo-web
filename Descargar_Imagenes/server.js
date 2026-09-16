require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: 'postgresql://postgres:carpetazo2024@185.173.110.158:5432/carpetazo_db'
});

const tokensPath = path.join(__dirname, 'tokens.json');

// Variables de estado
let isDownloading = false;
let totalProducts = 0;
let downloadedImages = 0;
let currentImage = null;
let currentProductName = null;
let errorCount = 0;
const DOWNLOAD_DELAY = 1500;
let driveFolderId = null;

// Configuraci?n de Google OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'PENDIENTE_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'PENDIENTE_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
);

if (fs.existsSync(tokensPath)) {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    oauth2Client.setCredentials(tokens);
  } catch (e) { console.error('Error leyendo tokens.json', e); }
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Crear tabla de registro si no existe
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "TcgDriveUpload" (
      "productId" INTEGER PRIMARY KEY,
      "driveFileId" TEXT NOT NULL,
      "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};
initDb();

const getOrCreateDriveFolder = async () => {
  if (driveFolderId) return driveFolderId;
  const folderName = 'TCG_Master_Backup';
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
    fields: 'files(id, name)',
  });
  if (res.data.files.length > 0) {
    driveFolderId = res.data.files[0].id;
    return driveFolderId;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    driveFolderId = folder.data.id;
    return driveFolderId;
  }
};

const uploadToDrive = (url, product) => {
  return new Promise((resolve, reject) => {
    https.get(url, async (res) => {
      if (res.statusCode === 200) {
        try {
          const folderId = await getOrCreateDriveFolder();
          const fileMetadata = {
            name: `${product.productId}.jpg`,
            parents: [folderId],
            description: `TCG Card: ${product.name} (ID: ${product.productId})`
          };
          const media = {
            mimeType: 'image/jpeg',
            body: res
          };
          const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
          });
          resolve(uploadedFile.data.id);
        } catch (e) {
          reject(e);
        }
      } else if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, async (res2) => {
             try {
                const folderId = await getOrCreateDriveFolder();
                const uploadedFile = await drive.files.create({
                  resource: {
                    name: `${product.productId}.jpg`,
                    parents: [folderId],
                    description: `TCG Card: ${product.name} (ID: ${product.productId})`
                  },
                  media: { mimeType: 'image/jpeg', body: res2 },
                  fields: 'id'
                });
                resolve(uploadedFile.data.id);
              } catch (e) { reject(e); }
        }).on('error', reject);
      } else {
        reject(new Error(`Failed with status ${res.statusCode}`));
      }
    }).on('error', reject);
  });
};

const startDownloadEngine = async () => {
  if (isDownloading) return;
  if (!oauth2Client.credentials || !oauth2Client.credentials.refresh_token) {
    console.log('No Google credentials found!');
    return;
  }
  isDownloading = true;

  try {
    const { rows: products } = await pool.query('SELECT "productId", "name", "imageUrl" FROM "TcgProduct" WHERE "imageUrl" IS NOT NULL AND "imageUrl" != \'\' ORDER BY "productId" ASC');
    totalProducts = products.length;
    
    // Contar descargados desde la tabla
    const { rows: uploadedRows } = await pool.query('SELECT "productId" FROM "TcgDriveUpload"');
    const uploadedIds = new Set(uploadedRows.map(r => r.productId));
    downloadedImages = uploadedIds.size;

    for (const product of products) {
      if (!isDownloading) break;

      if (!uploadedIds.has(product.productId)) {
        currentImage = product.imageUrl;
        currentProductName = product.name;
        
        try {
          const driveFileId = await uploadToDrive(product.imageUrl, product);
          await pool.query('INSERT INTO "TcgDriveUpload" ("productId", "driveFileId") VALUES ($1, $2)', [product.productId, driveFileId]);
          downloadedImages++;
          await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
        } catch (err) {
          console.error(`Error subiendo ${product.productId}:`, err.message);
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

// Autenticaci?n Google
app.get('/api/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file']
  });
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(tokensPath, JSON.stringify(tokens));
    res.send('<h3>Autenticaci?n Exitosa!</h3><p>Puedes cerrar esta ventana y volver al panel.</p><script>setTimeout(() => window.location.href = "/", 3000)</script>');
  } catch (err) {
    res.status(500).send('Error de autenticaci?n: ' + err.message);
  }
});

app.get('/api/status', async (req, res) => {
  if (totalProducts === 0) {
      try {
        const { rows } = await pool.query('SELECT COUNT(*) FROM "TcgProduct" WHERE "imageUrl" IS NOT NULL AND "imageUrl" != \'\'');
        totalProducts = parseInt(rows[0].count);
        
        const { rows: uploaded } = await pool.query('SELECT COUNT(*) FROM "TcgDriveUpload"');
        downloadedImages = parseInt(uploaded[0].count);
      } catch (e) {}
  }
  
  const estimatedGb = ((downloadedImages * 25) / 1024 / 1024).toFixed(3);
  const isGoogleAuth = !!(oauth2Client.credentials && oauth2Client.credentials.refresh_token);
  
  res.json({
    isDownloading,
    isGoogleAuth,
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
  if (!oauth2Client.credentials) return res.status(401).json({ success: false, message: 'Google No Autorizado' });
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
