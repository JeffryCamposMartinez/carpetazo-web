const fs = require('fs');
// Revert back to cbad605 because the file is corrupted
const execSync = require('child_process').execSync;
execSync('git checkout HEAD -- C:/Users/Jeffry/Desktop/Carpetazo.cl/"Publicar mis cartas"/frontend/src/components/AlbumView.jsx');
