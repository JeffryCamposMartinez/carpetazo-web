const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const targetStr = `      if (folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') {
        if (mylType && card.extData?.type !== mylType) matchesMyl = false;
        if (mylCost && parseInt(card.extData?.cost) !== parseInt(mylCost)) matchesMyl = false;`;

const replaceStr = `      if (folderData?.tcg === 'Mitos y Leyendas' || searchCategory === '99') {
        if (mylType && card.extData?.type !== mylType) matchesMyl = false;
        if (mylCost && parseInt(card.extData?.cost) !== parseInt(mylCost)) matchesMyl = false;
        if (searchPhysicalProduct && String(card.physicalProductId) !== String(searchPhysicalProduct)) matchesMyl = false;`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Updated FolderPokemon.jsx client-side filter");
} else {
    // try regex
    code = code.replace(
      /if \(mylCost && parseInt\(card\.extData\?\.cost\) !== parseInt\(mylCost\)\) matchesMyl = false;/,
      "if (mylCost && parseInt(card.extData?.cost) !== parseInt(mylCost)) matchesMyl = false;\n        if (searchPhysicalProduct && String(card.physicalProductId) !== String(searchPhysicalProduct)) matchesMyl = false;"
    );
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Updated FolderPokemon.jsx using regex");
}
