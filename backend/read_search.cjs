const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/tcg/search'"));
if (idx !== -1) {
    console.log(lines.slice(idx, idx + 60).join('\n'));
}
