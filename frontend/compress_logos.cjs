const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/images/logos');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

(async () => {
  for (const file of files) {
    const input = path.join(dir, file);
    const output = path.join(dir, file.replace('.png', '.webp'));
    console.log(`Compressing ${file}...`);
    await sharp(input)
      .resize(800, null, { withoutEnlargement: true }) // Downscale logos to 800px width max
      .webp({ quality: 90 })
      .toFile(output);
    console.log(`Saved ${output}`);
  }
})();
