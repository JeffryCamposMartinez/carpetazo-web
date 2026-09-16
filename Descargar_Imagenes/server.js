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

const failedPath = path.join(__dirname, 'failed.json');
let failedDownloads = [];
if (fs.existsSync(failedPath)) {
  try { failedDownloads = JSON.parse(fs.readFileSync(failedPath, 'utf8')); } catch(e) {}
}
const saveFailed = () => fs.writeFileSync(failedPath, JSON.stringify(failedDownloads, null, 2));

const sendEmail = (message) => {
  const email = process.env.EMAIL_USER || 'jeffry.campos.martinez@gmail.com';
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!pass) {
    console.log("EMAIL_APP_PASSWORD no configurada. Mensaje:", message);
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: pass }
  });
  transporter.sendMail({
    from: email,
    to: 'jeffry.campos.martinez@gmail.com',
    subject: '🤖 Alerta: TCG Master Downloader',
    text: message
  }, (err) => {
    if (err) console.error("Error enviando correo:", err.message);
  });
};


// Variables de estado
let isDownloading = false;

const downloadedIdsPath = path.join(__dirname, 'downloaded_ids.json');
let downloadedIds = new Set();
if (fs.existsSync(downloadedIdsPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(downloadedIdsPath, 'utf8'));
    downloadedIds = new Set(data);
  } catch(e) {}
}
const saveDownloadedIds = () => {
  fs.writeFileSync(downloadedIdsPath, JSON.stringify(Array.from(downloadedIds)));
};
let isWaitingSync = false;

let currentImage = null;
let currentProductName = null;
let currentCategoryName = 'Iniciando...';
let currentGroupName = 'Iniciando...';
let errorCount = 0;
const DOWNLOAD_DELAY = 1500;
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
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  console.log('Usando GOOGLE_REFRESH_TOKEN de las variables de entorno');
} else if (fs.existsSync(tokensPath)) {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    oauth2Client.setCredentials(tokens);
  } catch (e) { }
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

let driveFolderId = null;
const driveFolderCache = {};

const getOrCreateDriveFolder = async () => {
  if (driveFolderId) return driveFolderId;
  const folderName = process.env.DRIVE_FOLDER_NAME || 'TCG_Master_Backup';
  const safeName = folderName.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`,
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

const getOrCreateSubFolder = async (folderName, parentId) => {
  const cacheKey = parentId + '_' + folderName;
  if (driveFolderCache[cacheKey]) return driveFolderCache[cacheKey];
  
  const safeName = folderName.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });
  
  if (res.data.files.length > 0) {
    driveFolderCache[cacheKey] = res.data.files[0].id;
    return driveFolderCache[cacheKey];
  } else {
    const folder = await drive.files.create({
      resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id'
    });
    driveFolderCache[cacheKey] = folder.data.id;
    return driveFolderCache[cacheKey];
  }
};

const uploadToDrive = (url, product, catName, groupName) => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, async (res) => {
      if (res.statusCode === 200) {
        try {
          const isSealed = checkIfSealed(product);
          const subFolderName = isSealed ? 'Sellados' : 'Cartas';
          const rootFolderId = await getOrCreateDriveFolder();
          const catFolderId = await getOrCreateSubFolder(catName, rootFolderId);
          const groupFolderId = await getOrCreateSubFolder(groupName, catFolderId);
          const finalFolderId = await getOrCreateSubFolder(subFolderName, groupFolderId);
          
          const fileMetadata = {
            name: product.productId + '.jpg',
            parents: [finalFolderId],
            description: `TCG Card: ` + product.name + `\nJuego: ` + catName + `\nExpansión: ` + groupName + `\nID: ` + product.productId
          };
          const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: { mimeType: 'image/jpeg', body: res },
            fields: 'id'
          });
          resolve(uploadedFile.data.id);
        } catch (e) { reject(e); }
      } else if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, async (res2) => {
             try {
                const isSealed = checkIfSealed(product);
                const subFolderName = isSealed ? 'Sellados' : 'Cartas';
                const rootFolderId = await getOrCreateDriveFolder();
                const catFolderId = await getOrCreateSubFolder(catName, rootFolderId);
                const groupFolderId = await getOrCreateSubFolder(groupName, catFolderId);
                const finalFolderId = await getOrCreateSubFolder(subFolderName, groupFolderId);

                const uploadedFile = await drive.files.create({
                  resource: {
                    name: product.productId + '.jpg',
                    parents: [finalFolderId],
                    description: `TCG Card: ` + product.name + `\nJuego: ` + catName + `\nExpansión: ` + groupName + `\nID: ` + product.productId
                  },
                  media: { mimeType: 'image/jpeg', body: res2 },
                  fields: 'id'
                });
                resolve(uploadedFile.data.id);
              } catch (e) { reject(e); }
        }).on('error', reject);
      } else {
        reject(new Error(`HTTP ` + res.statusCode));
      }
    }).on('error', reject);
  });
};
// TCGCSV API Helpers
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function curlFetch(url) {
  try {
    const { stdout } = await execPromise(`curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "` + url + `"`, { maxBuffer: 1024 * 1024 * 50 });
    return JSON.parse(stdout);
  } catch (err) {
    console.error("curlFetch error: ", err);
    throw err;
  }
}
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json"
};
const fetchCategory = async (categoryId) => {
  const json = await curlFetch(`https://tcgcsv.com/tcgplayer/categories`);
  const cat = json.results.find(c => c.categoryId === categoryId);
  return cat ? cat.name : `Categoría ${categoryId}`;
};

const fetchGroups = async (categoryId) => {
  const json = await curlFetch(`https://tcgcsv.com/tcgplayer/${categoryId}/groups`);
  return json.results || [];
};

const fetchProducts = async (categoryId, groupId) => {
  const json = await curlFetch(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/products`);
  return json.results || [];
};

const startDownloadEngine = async () => {
  if (isDownloading) return;
  if (!oauth2Client.credentials || !oauth2Client.credentials.refresh_token) return;
  isDownloading = true;
  isWaitingSync = false;
  sendEmail('🚀 TCG Master Downloader: La extracción ha iniciado.');

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
                if (!downloadedIds.has(product.productId)) {
                    await uploadToDrive(product.imageUrl, product, currentCategoryName, currentGroupName);
                    downloadedIds.add(product.productId);
                    saveDownloadedIds();
                    progress.downloadedCount++;
                    saveProgress();
                    await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
                }
              } catch (err) {
                console.error(`Error subiendo ${product.productId}:`, err.message);
                errorCount++;
                failedDownloads.push({
                  id: product.productId,
                  name: product.name,
                  category: currentCategoryName,
                  group: currentGroupName,
                  error: err.message,
                  timestamp: new Date().toISOString()
                });
                saveFailed();
              }
            }
            
            if (isDownloading) {
                progress.productIdx++;
                saveProgress();
            }
        }
        
        if (isDownloading && progress.productIdx >= progress.productsCache.length && progress.productsCache.length > 0) {
           try {
             const rootFolderId = await getOrCreateDriveFolder();
             const catFolderId = await getOrCreateSubFolder(currentCategoryName, rootFolderId);
             const groupFolderId = await getOrCreateSubFolder(currentGroupName, catFolderId);
             
             const existing = await drive.files.list({
               q: "name='datos_expansion.json' and '" + groupFolderId + "' in parents and trashed=false",
               fields: 'files(id)'
             });
             
             if (existing.data.files.length === 0) {
                 await drive.files.create({
                   resource: { name: 'datos_expansion.json', parents: [groupFolderId] },
                   media: { mimeType: 'application/json', body: JSON.stringify(progress.productsCache, null, 2) },
                   fields: 'id'
                 });
                 console.log("Subido datos_expansion.json para " + currentGroupName);
             }
           } catch (e) {
             console.error("Error subiendo datos_expansion.json para " + currentGroupName, e);
           }

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
    
    if (progress.catIdx >= progress.categories.length) {
      isDownloading = false;
      sendEmail('✅ TCG Master Downloader: ¡Descarga completada al 100%!');
    }
    
  } catch (err) {
    console.error('Error fatal:', err);
    isDownloading = false;
    sendEmail('⚠️ TCG Master Downloader: Se ha detenido por un error interno: ' + err.message);
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
    isWaitingSync,
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
  if (isDownloading) sendEmail('🛑 TCG Master Downloader: La extracción ha sido pausada.');
  isDownloading = false;
  res.json({ success: true });
});

app.get('/api/failed', (req, res) => {
  res.json(failedDownloads);
});

// Capturar errores 404 para todo lo demas
app.use((req, res) => {
  console.log(`[404 NOT FOUND IN EXPRESS] ${req.method} ${req.url}`);
  res.status(404).send('No se encontró la ruta en Express');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de descargas corriendo en http://0.0.0.0:${PORT}`);
});

















