const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. index.html fixes
replaceInFile(path.join(__dirname, 'index.html'), [
    [/<!-- Preload Hero Images -->[\s\S]*?<\/head>/g, '</head>'],
    [/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Plus\+Jakarta\+Sans:wght@400;700;800&family=Work\+Sans:wght@600;700&display=swap" rel="stylesheet"\/>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined:wght,FILL@100\.\.700,0\.\.1&display=swap" rel="stylesheet"\/>/g, '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Work+Sans:wght@600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap" rel="stylesheet" />']
]);

// 2. LandingPage.jsx lazy loading
replaceInFile(path.join(__dirname, 'src/pages/LandingPage.jsx'), [
    [/<img\s+src=\{item\.img\}/g, '<img src={item.img} loading="lazy"'],
    [/<img\s+src=\{item\.logo\}/g, '<img src={item.logo} loading="lazy"']
]);

// 3. Replace all .png with .webp for specific folders
function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
            walk(full);
        } else if (file.endsWith('.jsx')) {
            replaceInFile(full, [
                [/\/images\/4k\/([a-zA-Z0-9_]+)\.png/g, '/images/4k/$1.webp'],
                [/\/images\/logos\/([a-zA-Z0-9_]+)\.png/g, '/images/logos/$1.webp'],
                [/\/images\/promos\/([a-zA-Z0-9_]+)\.png/g, '/images/promos/$1.webp'],
                [/\/images\/carpeta_v4\.png/g, '/images/carpeta_v4.webp']
            ]);
        }
    }
}

walk(path.join(__dirname, 'src'));
console.log('Replacements applied safely!');
