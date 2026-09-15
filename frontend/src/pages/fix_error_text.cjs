const fs = require('fs');

function fixErrorText(path) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(
    /Esta vista es exclusiva para cat.{1,5}logos Pok.{1,5}mon/g,
    'Carpeta no encontrada o error al cargar los datos.'
  );
  fs.writeFileSync(path, content, 'utf8');
  console.log(`Fixed error text in ${path}`);
}

fixErrorText('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx');
fixErrorText('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/AdminPanel.jsx');
