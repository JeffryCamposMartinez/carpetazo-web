const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  const input = path.join(__dirname, 'public/images/carpeta_v4.png');
  const output = path.join(__dirname, 'public/images/carpeta_v4.webp');
  console.log(`Compressing folder image...`);
  await sharp(input).webp({ quality: 90 }).toFile(output);
  console.log(`Saved ${output}`);
})();
