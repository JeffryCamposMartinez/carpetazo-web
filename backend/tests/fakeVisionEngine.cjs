// Motor de reconocimiento falso para las pruebas del escáner: exige la clave de servicio y devuelve una respuesta fija (con campos internos que el backend no debe pasar).
const http = require('http');

const PORT = Number(process.env.CZ_ENGINE_PORT || 8992);
http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST' || req.url !== '/scan' || req.headers['x-service-key'] !== 'cztest-engine') { res.statusCode = 401; return res.end('{"error":"no autorizado"}'); }
    const body = Buffer.concat(chunks);
    const games = String(req.headers['x-games'] || '');
    if (games.split(',').includes('89')) { res.statusCode = 500; return res.end('{"error":"fallo de prueba"}'); } // Riftbound: simula un motor caído
    if (games.split(',').includes('85')) return res.end(JSON.stringify({ found: false }));
    res.end(JSON.stringify({
      found: true, preview: 'data:image/jpeg;base64,AAAA', indexed: 1, source: 'E1', e1: true, ms: 12,
      received: { bytes: body.length, crop: req.headers['x-crop'] || '', games },
      top: [
        { name: 'CZTEST Carta', number: '001/100', set: 'CZTEST Edición', rarity: 'Rare', lang: 'Pokémon EN', image: 'https://example.com/no-permitida.webp', relation: 'interno', category_id: 3, product_id: 9876, score: 0.8123456, group: 'cztest carta', secreto: 'x' },
        { name: 'CZTEST Otra', number: '002/100', set: 'CZTEST Edición', rarity: null, lang: 'Pokémon EN', image: null, category_id: 3, product_id: 9877, score: 0.6, group: 'cztest otra' },
      ],
      ocr: { name: ['cztest carta'], lines: ['texto interno'], boost: 0.2, margin: 0.31 },
    }));
  });
}).listen(PORT, '127.0.0.1');
