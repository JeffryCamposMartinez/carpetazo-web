const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, search, replacement) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
}

replaceInFile(
    path.join(__dirname, 'src/components/AuthModal.jsx'),
    'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
    '/images/logos/google.svg'
);

replaceInFile(
    path.join(__dirname, 'src/components/Header.jsx'),
    'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
    '/images/logos/google.svg'
);

// Fix CSP in index.html to allow Firebase iframe for Google Login
let indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
// Add frame-src https://*.firebaseapp.com; to CSP
indexContent = indexContent.replace(
    /font-src 'self' https:\/\/fonts\.gstatic\.com;" \/>/,
    "font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.firebaseapp.com;\" />"
);
fs.writeFileSync(path.join(__dirname, 'index.html'), indexContent, 'utf8');
console.log('Applied fixes natively via node');
