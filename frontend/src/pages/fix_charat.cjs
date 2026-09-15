const fs = require('fs');

function fixLazyFolderCard() {
  const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/components/LazyFolderCard.jsx';
  let content = fs.readFileSync(path, 'utf8');
  
  // Replace details.user.charAt(0) with safe string extraction
  content = content.replace(
    /\{details\.user\.charAt\(0\)\.toUpperCase\(\)\}/g,
    "{ (typeof details.user === 'string' ? details.user : (details.user?.username || details.user?.name || 'U')).charAt(0).toUpperCase() }"
  );
  
  // Replace details.user rendering
  content = content.replace(
    /<span className="text-\[5\.5cqi\] font-bold text-white drop-shadow-md line-clamp-1 leading-tight">\{details\.user\}<\/span>/g,
    '<span className="text-[5.5cqi] font-bold text-white drop-shadow-md line-clamp-1 leading-tight">{typeof details.user === "string" ? details.user : (details.user?.username || details.user?.name || "Usuario")}</span>'
  );

  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed LazyFolderCard.jsx');
}

function fixMessages() {
  const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/Messages.jsx';
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(
      /otherUser\.name\.charAt\(0\)/g,
      "(otherUser.name || 'U').charAt(0)"
    );
    content = content.replace(
      /getOtherParticipant\(activeChat\)\.name\.charAt\(0\)/g,
      "(getOtherParticipant(activeChat).name || 'U').charAt(0)"
    );
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed Messages.jsx');
  }
}

fixLazyFolderCard();
fixMessages();
