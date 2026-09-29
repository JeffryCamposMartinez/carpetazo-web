const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imagesDir = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Pokemon\\Pokemon_DB_ES\\Images';

async function convertPngToWebp() {
    let count = 0;
    
    function scanDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                scanDir(fullPath);
            } else if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.jpg')) {
                const webpPath = fullPath.replace(/\.(png|jpg)$/i, '.webp');
                
                // Convert
                sharp(fullPath)
                    .webp({ quality: 80 })
                    .toFile(webpPath)
                    .then(() => {
                        // Delete original
                        fs.unlinkSync(fullPath);
                        console.log(`Convertido: ${file} -> ${path.basename(webpPath)}`);
                    })
                    .catch(err => {
                        console.error(`Error convirtiendo ${file}:`, err);
                    });
                count++;
            }
        }
    }

    console.log('Escaneando en busca de PNGs y JPGs en:', imagesDir);
    scanDir(imagesDir);
    // Give it a moment to finish async conversions
    setTimeout(() => {
        console.log(`\n¡Finalizado! Se encontraron y convirtieron ${count} imágenes.`);
    }, 2000);
}

convertPngToWebp();
