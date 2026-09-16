require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());

// Logger de debug
app.use((req, res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`);
  next();
});

app.use(express.static('public'));

const tokensPath = path.join(__dirname, 'tokens.json');
const progressPath = path.join(__dirname, 'progress.json');

// Variables de estado
let isDownloading = false;
let currentImage = null;
let currentProductName = null;
let currentCategoryName = 'Iniciando...';
let currentGroupName = 'Iniciando...';
let errorCount = 0;
const DOWNLOAD_DELAY = 1500;
let driveFolderId = null;

// Estado persistente
let progress = {
  categories: [1, 2, 3, 71, 63, 62],
  catIdx: 0,
  groupIdx: 0,
  productIdx: 0,
  downloadedCount: 0,
  groupsCache: [],
  productsCache: []
};

if (fs.existsSync(progressPath)) {
  try {
    progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  } catch(e) {}
}

const saveProgress = () => {
  fs.writeFileSync(progressPath, JSON.stringify(progress));
};

// Configuración de Google OAuth2
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'PENDIENTE_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'PENDIENTE_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
);

if (fs.existsSync(tokensPath)) {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    oauth2Client.setCredentials(tokens);
  } catch (e) { }
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

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
    const folder = await drive.files.create({
      resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id'
    });
    driveFolderId = folder.data.id;
    return driveFolderId;
  }
};

const uploadToDrive = (url, product, catName, groupName) => {
  return new Promise((resolve, reject) => {
    https.get(url, async (res) => {
      if (res.statusCode === 200) {
        try {
          const folderId = await getOrCreateDriveFolder();
          const fileMetadata = {
            name: `${product.productId}.jpg`,
            parents: [folderId],
            description: `TCG Card: ${product.name}\nJuego: ${catName}\nExpansión: ${groupName}\nID: ${product.productId}`
          };
          const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: { mimeType: 'image/jpeg', body: res },
            fields: 'id'
          });
          resolve(uploadedFile.data.id);
        } catch (e) { reject(e); }
      } else if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, async (res2) => {
             try {
                const folderId = await getOrCreateDriveFolder();
                const uploadedFile = await drive.files.create({
                  resource: {
                    name: `${product.productId}.jpg`,
                    parents: [folderId],
                    description: `TCG Card: ${product.name}\nJuego: ${catName}\nExpansión: ${groupName}\nID: ${product.productId}`
                  },
                  media: { mimeType: 'image/jpeg', body: res2 },
                  fields: 'id'
                });
                resolve(uploadedFile.data.id);
              } catch (e) { reject(e); }
        }).on('error', reject);
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
};

// TCGCSV API Helpers
const fetchCategory = async (categoryId) => {
  const res = await fetch(`https://tcgcsv.com/categories`);
  const json = await res.json();
  const cat = json.results.find(c => c.categoryId === categoryId);
  return cat ? cat.name : `Categoría ${categoryId}`;
};

const fetchGroups = async (categoryId) => {
  const res = await fetch(`https://tcgcsv.com/${categoryId}/groups`);
  const json = await res.json();
  return json.results || [];
};

const fetchProducts = async (categoryId, groupId) => {
  const res = await fetch(`https://tcgcsv.com/${categoryId}/${groupId}/products`);
  const json = await res.json();
  return json.results || [];
};

const startDownloadEngine = async () => {
  if (isDownloading) return;
  if (!oauth2Client.credentials || !oauth2Client.credentials.refresh_token) return;
  isDownloading = true;

  try {
    while (isDownloading && progress.catIdx < progress.categories.length) {
      const categoryId = progress.categories[progress.catIdx];
      currentCategoryName = await fetchCategory(categoryId);

      if (!progress.groupsCache || progress.groupsCache.length === 0) {
        progress.groupsCache = await fetchGroups(categoryId);
        saveProgress();
      }

      while (isDownloading && progress.groupIdx < progress.groupsCache.length) {
        const group = progress.groupsCache[progress.groupIdx];
        currentGroupName = group.name;

        if (!progress.productsCache || progress.productsCache.length === 0) {
            progress.productsCache = await fetchProducts(categoryId, group.groupId);
            saveProgress();
        }
        
        while (isDownloading && progress.productIdx < progress.productsCache.length) {
            const product = progress.productsCache[progress.productIdx];
            
            if (product.imageUrl) {
              currentImage = product.imageUrl;
              currentProductName = product.name;
              
              try {
                await uploadToDrive(product.imageUrl, product, currentCategoryName, currentGroupName);
                progress.downloadedCount++;
                saveProgress();
                await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
              } catch (err) {
                console.error(`Error subiendo ${product.productId}:`, err.message);
                errorCount++;
              }
            }
            
            if (isDownloading) {
                progress.productIdx++;
                saveProgress();
            }
        }
        
        if (isDownloading) {
           progress.groupIdx++;
           progress.productIdx = 0;
           progress.productsCache = [];
           saveProgress();
        }
      }

      if (isDownloading) {
         progress.catIdx++;
         progress.groupIdx = 0;
         progress.productIdx = 0;
         progress.groupsCache = [];
         progress.productsCache = [];
         saveProgress();
      }
    }
    
    if (progress.catIdx >= progress.categories.length) isDownloading = false;
    
  } catch (err) {
    console.error('Error fatal:', err);
    isDownloading = false;
  }
};

// Autenticación Google
app.get('/api/auth/google', (req, res) => {
  console.log('Generating Google Auth URL...');
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file']
  });
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  console.log('Google Auth Callback hit!', req.query);
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(tokensPath, JSON.stringify(tokens));
    res.send('<h3>Autenticación Exitosa!</h3><p>Puedes cerrar esta ventana y volver al panel.</p><script>setTimeout(() => window.location.href = "/", 3000)</script>');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Error de autenticación: ' + err.message);
  }
});

app.get('/api/status', (req, res) => {
  const estimatedGb = ((progress.downloadedCount * 25) / 1024 / 1024).toFixed(3);
  const isGoogleAuth = !!(oauth2Client.credentials && oauth2Client.credentials.refresh_token);
  
  res.json({
    isDownloading,
    isGoogleAuth,
    downloadedImages: progress.downloadedCount,
    currentImage,
    currentProductName,
    currentCategoryName,
    currentGroupName,
    errorCount,
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

// Capturar errores 404 para todo lo demás
app.use((req, res) => {
  console.log(`[404 NOT FOUND IN EXPRESS] ${req.method} ${req.url}`);
  res.status(404).send('No se encontró la ruta en Express');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de descargas corriendo en http://0.0.0.0:${PORT}`);
});


