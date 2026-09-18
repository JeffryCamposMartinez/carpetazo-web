const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  // Compress Promos
  const promosDir = path.join(__dirname, 'public/images/promos');
  const promoFiles = fs.readdirSync(promosDir).filter(f => f.endsWith('.png'));
  for (const file of promoFiles) {
    const input = path.join(promosDir, file);
    const output = path.join(promosDir, file.replace('.png', '.webp'));
    console.log(`Compressing ${file}...`);
    await sharp(input).resize(800, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(output);
  }

  // Compress Favicon
  const faviconInput = path.join(__dirname, 'public/favicon.png');
  const faviconOutput = path.join(__dirname, 'public/favicon.ico');
  console.log(`Compressing favicon...`);
  await sharp(faviconInput).resize(64, 64).toFormat('png').toFile(faviconOutput); // Rename to ico but format is png/ico compatible usually. Wait, better to just save as tiny png.
  
  const faviconSmall = path.join(__dirname, 'public/favicon_small.png');
  await sharp(faviconInput).resize(64, 64).png({ quality: 80, compressionLevel: 9 }).toFile(faviconSmall);
  
  // Replace the original huge favicon
  fs.copyFileSync(faviconSmall, faviconInput);
  fs.unlinkSync(faviconSmall);
  
  console.log('All done');
})();
