const fs = require('fs');

function fixSyntax(path) {
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    
    // The broken snippet starts with `<div className="w-full">{` and ends with `}` before `</div>`
    // We will replace that exact structure.
    
    // Because it might be tricky to regex multiline cleanly without breaking, we'll just replace the specific broken lines.
    content = content.replace('<div className="w-full">{', '<div className="w-full">');
    content = content.replace('            </div>\n          }\n      </div>', '            </div>\n        </div>\n      </div>');
    
    fs.writeFileSync(path, content, 'utf8');
    console.log(`Fixed syntax in ${path}`);
  }
}

fixSyntax('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx');
fixSyntax('C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/AdminPanel.jsx');
