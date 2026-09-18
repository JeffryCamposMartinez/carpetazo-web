const fs = require('fs');
const path = require('path');

function fixBOM(filePath) {
    let content = fs.readFileSync(filePath);
    // Check if starts with BOM (EF BB BF)
    if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
        console.log(`Fixing BOM in ${filePath}`);
        content = content.slice(3);
    }
    
    // Also, PowerShell might have messed up the encoding completely if it read it as ANSI and saved as UTF8-BOM.
    // Let's actually just read the file as utf8. Wait, if it was read as ANSI and written as UTF8, the characters are double-encoded!
    // Pokémon means it was UTF-8 bytes read as Windows-1252, then written as UTF-8.
    fs.writeFileSync(filePath, content);
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
            walk(full);
        } else if (file.endsWith('.jsx') || file.endsWith('.html')) {
            fixBOM(full);
        }
    }
}

walk(__dirname);
console.log('BOM check complete');
