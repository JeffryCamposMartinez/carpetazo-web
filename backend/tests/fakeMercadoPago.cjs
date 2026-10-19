// Mercado Pago simulado para probar suscripciones sin dinero: guarda el estado de cada preapproval y registra las llamadas (GET /__log).
// Corre como proceso aparte porque tests/run.cjs queda bloqueado mientras ejecuta cada prueba.
const mpState = new Map();
const mpLog = [];
require('http').createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, 'http://x');
    const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (url.pathname === '/__log') return send(200, mpLog);
    const id = decodeURIComponent(url.pathname.split('/')[2] || '');
    if (url.pathname.startsWith('/__set/')) { mpState.set(decodeURIComponent(url.pathname.split('/')[2]), body); return send(200, {}); }
    mpLog.push({ method: req.method, path: url.pathname, body });
    if (req.method === 'PUT') { mpState.set(id, { ...(mpState.get(id) || {}), ...body }); return send(200, { id, ...mpState.get(id) }); }
    return send(200, { id, status: 'authorized', ...(mpState.get(id) || {}) });
  });
}).listen(Number(process.env.CZ_MP_PORT || '8991'), '127.0.0.1');
