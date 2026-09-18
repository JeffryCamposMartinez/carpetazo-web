const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const filesToUpdate = [
    'components/PokemonCard.jsx',
    'pages/AdminPanel.jsx',
    'pages/FolderPokemon.jsx',
    'pages/PublicCatalog.jsx'
];

filesToUpdate.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Add import if not exists
    if (!content.includes('getProxyImageUrl')) {
        // Find a place to insert the import (after other imports)
        let importMatch = content.match(/import .* from '.*';\r?\n/g);
        if (importMatch) {
            let lastImport = importMatch[importMatch.length - 1];
            content = content.replace(lastImport, lastImport + "import { getProxyImageUrl } from '../utils/api';\n");
        } else {
             // AdminPanel/FolderPokemon might have utils/api imported already
             if(content.includes("import { api }")) {
                 content = content.replace("import { api } from '../utils/api';", "import { api, getProxyImageUrl } from '../utils/api';");
             }
        }
    }

    // Replace src={card.imageUrl}
    content = content.replace(/src=\{card\.imageUrl\}/g, "src={getProxyImageUrl(card.tcgProductId || card.id, card.imageUrl)}");
    // Replace src={item.imageUrl}
    content = content.replace(/src=\{item\.imageUrl\}/g, "src={getProxyImageUrl(item.tcgProductId || item.id, item.imageUrl)}");
    // Replace src={selectedCard.imageUrl || selectedCard.imageUrl}
    content = content.replace(/src=\{selectedCard\.imageUrl \|\| selectedCard\.imageUrl\}/g, "src={getProxyImageUrl(selectedCard.tcgProductId || selectedCard.id, selectedCard.imageUrl)}");

    // Replace ../utils/api import if it's wrong depth
    if (file === 'components/PokemonCard.jsx') {
       if (content.includes("import { getProxyImageUrl } from '../utils/api';") && !content.includes("import { getProxyImageUrl } from")) {
            // Already handled
       }
    }

    fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Updated frontend components');
