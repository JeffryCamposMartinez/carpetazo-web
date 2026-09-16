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

let tcgToken = null;
let tokenExpires = 0;

// Estado persistente
let progress = {
  categories: [1, 2, 3, 71, 63, 62], // 1=Magic, 2=Yugioh, 3=Pokemon, 71=OnePiece, 63=FleshAndBlood, 62=Digimon
  catIdx: 0,
  groupIdx: 0,
  offset: 0,
  downloadedCount: 0,
  groupsCache: []
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

// TCGPlayer API Helpers
const getTcgToken = async () => {
  if (tcgToken && Date.now() < tokenExpires) return tcgToken;
  const publicKey = process.env.TCGPLAYER_PUBLIC_KEY;
  const privateKey = process.env.TCGPLAYER_PRIVATE_KEY;
  if(!publicKey || !privateKey) throw new Error("Faltan llaves de TCGPlayer");
  
  const response = await fetch('https://api.tcgplayer.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${publicKey}&client_secret=${privateKey}`
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);
  
  tcgToken = data.access_token;
  tokenExpires = Date.now() + ((data.expires_in - 300) * 1000);
  return tcgToken;
};

const fetchCategory = async (categoryId) => {
  const token = await getTcgToken();
  const res = await fetch(`https://api.tcgplayer.com/catalog/categories/${categoryId}`, {
    headers: { 'Authorization': `bearer ${token}` }
  });
  const json = await res.json();
  return json.results[0];
};

const fetchGroups = async (categoryId) => {
  const token = await getTcgToken();
  let offset = 0;
  const limit = 100;
  let allGroups = [];
  while(true) {
    const res = await fetch(`https://api.tcgplayer.com/catalog/categories/${categoryId}/groups?offset=${offset}&limit=${limit}`, {
      headers: { 'Authorization': `bearer ${token}` }
    });
    const json = await res.json();
    if(!json.results || json.results.length === 0) break;
    allGroups = allGroups.concat(json.results);
    offset += limit;
    if (allGroups.length >= json.totalItems) break;
  }
  return allGroups;
};

const fetchProducts = async (groupId, offset) => {
  const token = await getTcgToken();
  const res = await fetch(`https://api.tcgplayer.com/catalog/products?groupId=${groupId}&offset=${offset}&limit=100&getExtendedFields=false`, {
    headers: { 'Authorization': `bearer ${token}` }
  });
  return await res.json();
};

const startDownloadEngine = async () => {
  if (isDownloading) return;
  if (!oauth2Client.credentials || !oauth2Client.credentials.refresh_token) return;
  if (!process.env.TCGPLAYER_PUBLIC_KEY || !process.env.TCGPLAYER_PRIVATE_KEY) {
      console.log('No TCGPlayer keys found!');
      return;
  }
  isDownloading = true;

  try {
    while (isDownloading && progress.catIdx < progress.categories.length) {
      const categoryId = progress.categories[progress.catIdx];
      const categoryInfo = await fetchCategory(categoryId);
      currentCategoryName = categoryInfo ? categoryInfo.name : `Categoría ${categoryId}`;

      if (progress.groupsCache.length === 0) {
        progress.groupsCache = await fetchGroups(categoryId);
        saveProgress();
      }

      while (isDownloading && progress.groupIdx < progress.groupsCache.length) {
        const group = progress.groupsCache[progress.groupIdx];
        currentGroupName = group.name;

        let hasMoreProducts = true;
        while (isDownloading && hasMoreProducts) {
          const productsRes = await fetchProducts(group.groupId, progress.offset);
          
          if (!productsRes.results || productsRes.results.length === 0) {
             hasMoreProducts = false;
             break;
          }

          for (const product of productsRes.results) {
            if (!isDownloading) break;
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
          }

          if (isDownloading && hasMoreProducts) {
             progress.offset += 100;
             if (progress.offset >= productsRes.totalItems) {
                hasMoreProducts = false;
             }
             saveProgress();
          }
        }
        
        if (isDownloading) {
           progress.groupIdx++;
           progress.offset = 0;
           saveProgress();
        }
      }

      if (isDownloading) {
         progress.catIdx++;
         progress.groupIdx = 0;
         progress.offset = 0;
         progress.groupsCache = [];
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
    res.send('<h3>Autenticación Exitosa!</h3><p>Puedes cerrar esta ventana y volver al panel.</p><script>setTimeout(() => window.location.href = "/", 3000)</script>');
  } catch (err) {
    res.status(500).send('Error de autenticación: ' + err.message);
  }
});

app.get('/api/status', (req, res) => {
  const estimatedGb = ((progress.downloadedCount * 25) / 1024 / 1024).toFixed(3);
  const isGoogleAuth = !!(oauth2Client.credentials && oauth2Client.credentials.refresh_token);
  const hasTcgKeys = !!(process.env.TCGPLAYER_PUBLIC_KEY && process.env.TCGPLAYER_PRIVATE_KEY);
  
  res.json({
    isDownloading,
    isGoogleAuth,
    hasTcgKeys,
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
  if (!process.env.TCGPLAYER_PUBLIC_KEY) return res.status(401).json({ success: false, message: 'Llaves de TCGPlayer Faltantes en Coolify' });
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
