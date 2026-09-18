const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/images/4k');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

(async () => {
  for (const file of files) {
    const input = path.join(dir, file);
    const output = path.join(dir, file.replace('.png', '.webp'));
    console.log(`Compressing ${file}...`);
    await sharp(input)
      .resize(1920, null, { withoutEnlargement: true }) // Downscale to 1080p width max
      .webp({ quality: 80 })
      .toFile(output);
    console.log(`Saved ${output}`);
  }
})();
