const fs=require('fs'); 
const file1 = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx'; 
const file2 = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/AdminPanel.jsx'; 
const patch = (f) => { 
    let content = fs.readFileSync(f, 'utf8'); 
    content = content.replace(/if \(originalUrl\.includes\('api\.carpetazo\.cl\/images'\)\) return originalUrl;/g, "if (originalUrl.includes('api.carpetazo.cl/images') || originalUrl.includes('r2.dev') || originalUrl.includes('imagenes.carpetazo.cl')) return originalUrl;"); 
    fs.writeFileSync(f, content); 
}; 
patch(file1); 
patch(file2); 
console.log('Patched frontend proxy functions!');
