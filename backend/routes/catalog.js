// Catálogo de cartas: proxys (TCGCSV, Pokémon TCG API, imágenes) y base local de juegos, ediciones y cartas.
import express from 'express';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { prisma } from '../core/db.js';
import { badRequest, isAllowedProxyImageUrl } from '../core/validation.js';
import { MYL_ID_PREFIX, rawMylId } from '../core/mylIdentity.js';
import { nameDistance, nameMatch, searchFragments, similarCardName } from '../core/cardSearch.js';

const router = express.Router();
const gzipAsync = promisify(gzip);

// Proxy con caché hacia TCGCSV (Pokémon inglés y japonés, One Piece, Magic, Riftbound, Yu-Gi-Oh!): el navegador no puede llamarlo directo por CORS
const TCGCSV_ALLOWED_PATH = /^\/tcgplayer\/(1|2|3|68|85|89)\/(groups|\d+\/(products|prices))$/;
const TCGCSV_TTL_MS = 30 * 60 * 1000;
const TCGCSV_STALE_MS = 6 * 60 * 60 * 1000; // si TCGCSV falla se sigue sirviendo la última copia por este tiempo
const TCGCSV_MAX_ENTRIES = 200;
const tcgcsvCache = new Map(); // ruta -> { at, body, gzip, etag }
const tcgcsvPending = new Map(); // ruta -> descarga en curso (varios pedidos iguales comparten una sola)

const loadTcgcsv = async (tcgcsvPath) => {
  const response = await fetch('https://tcgcsv.com' + tcgcsvPath, {
    headers: { 'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = new Error(`TCGCSV respondió ${response.status}`);
    error.notFound = response.status === 404;
    throw error;
  }
  let body = await response.text();
  // TCGCSV alimenta varias pantallas del frontend. Enriquecemos sus productos
  // con la imagen local vinculada en CatalogCard para que R2 sea la fuente
  // principal; si una carta todavía no tiene imageKey se conserva la URL API.
  if (/\/products$/.test(tcgcsvPath)) {
    try {
      const json = JSON.parse(body);
      const products = Array.isArray(json.results) ? json.results : [];
      const ids = [...new Set(products.map((item) => Number(item.productId)).filter(Number.isInteger))];
      if (ids.length) {
        const linked = await prisma.catalogCard.findMany({
          where: { productId: { in: ids }, kind: 'card', imageKey: { not: null } },
          select: { productId: true, imageKey: true },
        });
        const byId = new Map(linked.map((item) => [item.productId, r2PublicUrl(item.imageKey)]));
        json.results = products.map((item) => ({ ...item, imageUrl: byId.get(Number(item.productId)) || item.imageUrl }));
        body = JSON.stringify(json);
      }
    } catch (error) {
      console.warn('No se pudieron enriquecer imágenes TCGCSV desde CatalogCard:', error.message);
    }
  }
  const entry = {
    at: Date.now(),
    body,
    gzip: await gzipAsync(body),
    etag: `"${createHash('sha1').update(body).digest('base64url')}"`,
  };
  if (tcgcsvCache.size >= TCGCSV_MAX_ENTRIES) tcgcsvCache.delete(tcgcsvCache.keys().next().value);
  tcgcsvCache.set(tcgcsvPath, entry);
  return entry;
};

const r2PublicUrl = (key) => {
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!base || !key) return null;
  return `${base}/${String(key).split('/').map((part) => encodeURIComponent(part).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')}`;
};

router.get(/^\/api\/tcgcsv(\/.*)$/, async (req, res) => {
  const tcgcsvPath = req.params[0];
  if (!TCGCSV_ALLOWED_PATH.test(tcgcsvPath)) {
    return res.status(400).json({ success: false, message: 'Ruta no permitida' });
  }

  const send = (entry) => {
    res.set({ 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600', ETag: entry.etag, Vary: 'Accept-Encoding' });
    if (req.headers['if-none-match'] === entry.etag) return res.status(304).end();
    res.type('application/json');
    if (/gzip/.test(req.headers['accept-encoding'] || '')) {
      res.set('Content-Encoding', 'gzip');
      return res.send(entry.gzip);
    }
    return res.send(entry.body);
  };

  const cached = tcgcsvCache.get(tcgcsvPath);
  if (cached && Date.now() - cached.at < TCGCSV_TTL_MS) return send(cached);

  try {
    let pending = tcgcsvPending.get(tcgcsvPath);
    if (!pending) {
      pending = loadTcgcsv(tcgcsvPath).finally(() => tcgcsvPending.delete(tcgcsvPath));
      tcgcsvPending.set(tcgcsvPath, pending);
    }
    return send(await pending);
  } catch (error) {
    console.error('Error consultando TCGCSV:', error.message);
    if (cached && Date.now() - cached.at < TCGCSV_STALE_MS) return send(cached);
    return res.status(error.notFound ? 404 : 502).json({ success: false, message: 'No se pudo obtener el catálogo' });
  }
});

// Dólar en pesos chilenos para convertir los precios de mercado (TCGplayer vende en USD). Es solo referencial.
const USD_CLP_TTL_MS = 6 * 60 * 60 * 1000;
let usdClpCache = null;
router.get('/api/usd-clp', async (_req, res) => {
  if (usdClpCache && Date.now() - usdClpCache.at < USD_CLP_TTL_MS) return res.json({ success: true, rate: usdClpCache.rate });
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
    const rate = response.ok ? Number((await response.json())?.rates?.CLP) : NaN;
    if (!Number.isFinite(rate) || rate < 100 || rate > 5000) throw new Error('Respuesta de cambio inválida');
    usdClpCache = { at: Date.now(), rate };
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ success: true, rate });
  } catch (error) {
    console.error('Error consultando el dólar:', error.message);
    // Con el último valor conocido es mejor que dejar la carta sin referencia
    if (usdClpCache) return res.json({ success: true, rate: usdClpCache.rate });
    return res.status(502).json({ success: false, message: 'No se pudo obtener el tipo de cambio' });
  }
});

router.get('/api/proxy-image', async (req, res) => {
  const imageUrl = String(req.query.url || '').trim();

  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'URL de imagen requerida' });
  }

  if (!isAllowedProxyImageUrl(imageUrl) || new URL(imageUrl).pathname.startsWith('/api/')) {
    return res.status(400).json({ success: false, message: 'URL de imagen no permitida' });
  }

  try {
    const response = await fetch(imageUrl, {
      redirect: 'error', // una redirección podría apuntar a un host no permitido
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: 'No se pudo obtener la imagen' });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.toLowerCase().startsWith('image/') || contentType.toLowerCase().includes('svg')) {
      return res.status(415).json({ success: false, message: 'El recurso no es una imagen' });
    }

    const MAX_PROXY_IMAGE_BYTES = 10 * 1024 * 1024;
    if (Number(response.headers.get('content-length') || 0) > MAX_PROXY_IMAGE_BYTES) {
      return res.status(413).json({ success: false, message: 'La imagen es demasiado grande' });
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PROXY_IMAGE_BYTES) {
      return res.status(413).json({ success: false, message: 'La imagen es demasiado grande' });
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Error proxying image:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Error obteniendo imagen' });
  }
});

// --- POKEMON TCG API PROXY CON CACHÉ ---
const tcgCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora en milisegundos
const TCG_CACHE_MAX = 200; // tope de entradas: consultas distintas no pueden llenar la memoria
const setTcgCache = (key, data) => {
  if (tcgCache.size >= TCG_CACHE_MAX) tcgCache.delete(tcgCache.keys().next().value);
  tcgCache.set(key, { timestamp: Date.now(), data });
};
// Pide a la API externa con tope de tiempo. Un rechazo por consulta mal formada (4xx) se devuelve como 400;
// una caída o demora de la API externa como 502 (no es un fallo de este servidor).
const fetchTcgApi = async (url) => {
  const fetchOptions = { signal: AbortSignal.timeout(8000), ...(process.env.POKEMON_TCG_API_KEY ? { headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } } : {}) };
  const response = await fetch(url, fetchOptions);
  if (!response.ok) throw Object.assign(new Error('Error en la API de cartas'), { upstreamStatus: response.status });
  return response.json();
};
const sendTcgError = (res, error, what) => {
  console.error(`TCG API ${what} Error:`, error?.upstreamStatus || error?.name || error?.message);
  if (error?.upstreamStatus >= 400 && error.upstreamStatus < 500 && error.upstreamStatus !== 429) return badRequest(res, 'Búsqueda inválida');
  return res.status(502).json({ success: false, message: 'El catálogo externo no está disponible por ahora. Intenta nuevamente.' });
};

router.get('/api/tcg/sets', async (req, res) => {
    const cacheKey = 'sets';
    
    if (tcgCache.has(cacheKey)) {
        const cached = tcgCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
    }
    
    try {
        const data = await fetchTcgApi('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate');
        setTcgCache(cacheKey, data);
        res.json(data);
    } catch (error) {
        sendTcgError(res, error, 'Sets');
    }
});

router.get('/api/tcg/cards', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length > 200) return badRequest(res, 'Búsqueda inválida');
    const cacheKey = `cards_${query}`;
    
    if (tcgCache.has(cacheKey)) {
        const cached = tcgCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
    }
    
    try {
        const url = query 
            ? `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}` 
            : 'https://api.pokemontcg.io/v2/cards';
            
        const data = await fetchTcgApi(url);
        setTcgCache(cacheKey, data);
        res.json(data);
    } catch (error) {
        sendTcgError(res, error, 'Cards');
    }
});
// --- TCGCSV LOCAL DB ---
// Identificadores de las rutas del catálogo: solo enteros positivos (groupId también admite "otros")
router.param('categoryId', (req, res, next, value) => (/^\d{1,9}$/.test(value) ? next() : badRequest(res, 'Juego inválido')));
router.param('groupId', (req, res, next, value) => (/^\d{1,9}$/.test(value) || value === 'otros' ? next() : badRequest(res, 'Edición inválida')));

router.get('/api/tcg/categories', async (req, res) => {
  try {
    const categories = await prisma.tcgCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/tcg/:categoryId/groups', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const groups = await prisma.tcgGroup.findMany({
      where: { categoryId: parseInt(categoryId) },
      orderBy: [{ publishedOn: 'desc' }, { groupId: 'desc' }, { name: 'asc' }]
    });
    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Catálogo local de cartas TCGplayer. Las pantallas de carpetas/deseadas usan
// esta ruta para no descargar cada edición desde TCGCSV en cada búsqueda.
router.get('/api/tcg/catalog/:categoryId/:groupId/cards', async (req, res) => {
  try {
    const categoryId = Number.parseInt(req.params.categoryId, 10);
    const groupId = Number.parseInt(req.params.groupId, 10);
    if (!Number.isInteger(categoryId) || !Number.isInteger(groupId)) return badRequest(res, 'Edición inválida');
    const rows = await prisma.catalogCard.findMany({
      where: { categoryId, groupId, kind: 'card' },
      orderBy: [{ number: 'asc' }, { name: 'asc' }, { productId: 'asc' }],
      select: { productId: true, categoryId: true, groupId: true, name: true, number: true, rarity: true, imageKey: true, sourceImageUrl: true, attributes: true, set: { select: { name: true, publishedOn: true } }, game: { select: { name: true } } },
    });
    const data = rows.map((card) => {
      const attributes = card.attributes && typeof card.attributes === 'object' && !Array.isArray(card.attributes) ? card.attributes : {};
      const extendedData = Object.entries(attributes).map(([name, value]) => ({ name, value: String(value ?? '') }));
      if (card.number && !extendedData.some((item) => item.name === 'Number')) extendedData.push({ name: 'Number', value: card.number });
      return {
        productId: card.productId, categoryId: card.categoryId, groupId: card.groupId, name: card.name,
        // R2 es la fuente principal. Solo si todavía no se subió la imagen
        // se entrega la URL de respaldo de la importación (o el CDN de la
        // carta) sin consultar el endpoint remoto de productos.
        imageUrl: r2PublicUrl(card.imageKey) || card.sourceImageUrl || `https://tcgplayer-cdn.tcgplayer.com/product/${encodeURIComponent(String(card.productId))}_400w.jpg`, number: card.number, rarity: card.rarity,
        extendedData, group: card.set, game: card.game.name,
      };
    });
    res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=7200');
    return res.json({ success: true, source: 'database', data });
  } catch (error) {
    console.error('Error cargando cartas TCG desde CatalogCard:', error.message);
    return res.status(503).json({ success: false, message: 'No se pudo cargar el catálogo local' });
  }
});

// Ediciones disponibles en el catálogo local. Las pantallas de búsqueda usan
// esta lista para no recorrer ediciones que solo existen en TCGCSV.
router.get('/api/tcg/catalog/sets', async (req, res) => {
  const categoryId = Number.parseInt(String(req.query.categoryId || ''), 10);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return badRequest(res, 'Categoría inválida');
  try {
    const sets = await prisma.catalogSet.findMany({
      where: { categoryId, cards: { some: { kind: 'card' } } },
      orderBy: [{ publishedOn: 'desc' }, { name: 'asc' }, { groupId: 'desc' }],
      select: { groupId: true, categoryId: true, name: true, abbreviation: true, publishedOn: true, modifiedOn: true },
    });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    return res.json({ success: true, source: 'database', data: sets });
  } catch (error) {
    console.error('Error cargando ediciones del catálogo local:', error.message);
    return res.status(503).json({ success: false, message: 'Catálogo local no disponible' });
  }
});

const FILTER_OPTIONS_TTL_MS = 30 * 60 * 1000;
const filterOptionsCache = new Map(); // categoryId -> { at, data } o { pending: Promise }
router.get('/api/tcg/:categoryId/filter-options', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (!Number.isFinite(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    const cached = filterOptionsCache.get(categoryId);
    if (cached?.data && Date.now() - cached.at < FILTER_OPTIONS_TTL_MS) return res.json({ success: true, data: cached.data });
    if (cached?.pending) return res.json({ success: true, data: await cached.pending });
    const pending = buildFilterOptions(categoryId);
    filterOptionsCache.set(categoryId, { pending });
    try {
      const data = await pending;
      filterOptionsCache.set(categoryId, { at: Date.now(), data });
      return res.json({ success: true, data });
    } catch (error) {
      filterOptionsCache.delete(categoryId);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching TCG filter options:', error);
    res.status(500).json({ success: false, message: 'Error fetching filter options' });
  }
});

async function buildFilterOptions(categoryId) {
    // Solo los pares nombre/valor que sirven de filtro, distintos y calculados en la base:
    // antes se traía el JSON completo de cada carta del juego (decenas de MB) para quedarse con unas decenas de valores
    const rows = await prisma.$queryRaw`
      SELECT lower(e->>'name') AS name, e->>'value' AS value
      FROM "TcgProduct" t, jsonb_array_elements(t."extData") e
      WHERE t."categoryId" = ${categoryId} AND jsonb_typeof(t."extData") = 'array'
        AND lower(e->>'name') IN ('type', 'race', 'cost', 'frequency', 'rarity', 'card number / rarity')
      GROUP BY 1, 2`;

    const types = new Set();
    const races = new Set();
    const costs = new Set();
    const rarities = new Set();

    const addValue = (target, rawValue) => {
      if (rawValue === undefined || rawValue === null) return;
      String(rawValue)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => target.add(value));
    };

    rows.forEach(({ name, value }) => {
      if (name === 'type') addValue(types, value);
      if (name === 'race') addValue(races, value);
      if (name === 'cost') {
        const cost = Number(value);
        if (Number.isFinite(cost) && cost >= 0 && cost <= 10) addValue(costs, String(cost));
      }
      if (name === 'frequency' || name === 'rarity' || name === 'card number / rarity') addValue(rarities, value);
    });

    const sortText = (a, b) => a.localeCompare(b, 'es');
    const sortNumberText = (a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
      return sortText(a, b);
    };

    return {
      types: [...types].sort(sortText),
      races: [...races].sort(sortText),
      costs: [...costs].sort(sortNumberText),
      rarities: [...rarities].sort(sortText),
    };
}

router.post('/api/tcg/products/metadata', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length > 500) return badRequest(res, 'Demasiadas cartas');
    const requestedIds = [...new Set(ids.map(id => String(id).trim()).filter(Boolean))];
    // Las cartas publicadas de Mitos usan ids con namespace (myl:1212),
    // mientras TcgProduct conserva su id numérico interno.
    const rawByRequested = new Map(requestedIds.map((id) => [id, id.startsWith(MYL_ID_PREFIX) ? rawMylId(id) : id]));
    const productIds = [...new Set([...rawByRequested.values()])];

    if (productIds.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const products = await prisma.tcgProduct.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        extData: true,
        group: { select: { name: true, groupId: true } },
      },
    });

    const getExtValue = (extData, fieldName) => {
      if (!Array.isArray(extData)) return '';
      const item = extData.find(entry => String(entry?.name || '').toLowerCase() === fieldName.toLowerCase());
      return item?.value || '';
    };

    const data = {};
    products.forEach((product) => {
      const requested = requestedIds.find((id) => rawByRequested.get(id) === String(product.productId)) || String(product.productId);
      data[requested] = {
        set: product.group?.name || '',
        groupId: product.group?.groupId || null,
        type: getExtValue(product.extData, 'Type'),
        race: getExtValue(product.extData, 'Race'),
        cost: getExtValue(product.extData, 'Cost'),
        effect: getExtValue(product.extData, 'Effect'),
        rarity: getExtValue(product.extData, 'Frequency') || getExtValue(product.extData, 'Rarity') || getExtValue(product.extData, 'Card Number / Rarity'),
        number: getExtValue(product.extData, 'Number'),
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching product metadata:', error);
    res.status(500).json({ success: false, message: 'Error fetching product metadata' });
  }
});

// Una carta puede pertenecer a varios productos físicos: se filtra por la tabla de enlaces y se devuelven todos sus ids
const physicalLinkFilter = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? { physicalLinks: { some: { physicalProductId: id } } } : null;
};
const withPhysicalIds = (rows) => rows.map(({ physicalLinks, ...row }) => ({
  ...row,
  physicalProductIds: (physicalLinks || []).map((link) => link.physicalProductId)
}));

router.get('/api/tcg/:categoryId/:groupId/products', async (req, res) => {
  try {
    const { categoryId, groupId } = req.params;
    const { mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;

    let whereClause = { categoryId: parseInt(categoryId) };
    if (physicalProductId) {
      const linkFilter = physicalLinkFilter(physicalProductId);
      if (!linkFilter) return res.status(400).json({ success: false, message: 'Producto inválido' });
      Object.assign(whereClause, linkFilter);
    }
    if (groupId === 'otros') {
      const groups = await prisma.tcgGroup.findMany({ where: { categoryId: parseInt(categoryId) }, select: { groupId: true } });
      const groupIds = groups.map(g => g.groupId);
      whereClause.groupId = { notIn: groupIds };
    } else {
      whereClause.groupId = parseInt(groupId);
    }

    let andConditions = [];
    if (mylType) andConditions.push({ extData: { array_contains: [{ name: 'Type', value: mylType }] } });
    if (mylRace) andConditions.push({ extData: { array_contains: [{ name: 'Race', value: mylRace }] } });
    if (mylFrequency) andConditions.push({ extData: { array_contains: [{ name: 'Frequency', value: mylFrequency }] } });
    if (mylCost !== undefined && mylCost !== '') andConditions.push({ extData: { array_contains: [{ name: 'Cost', value: mylCost.toString() }] } });

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const products = await prisma.tcgProduct.findMany({
      where: whereClause,
      include: { physicalLinks: { select: { physicalProductId: true } } },
      orderBy: [
        { physicalProductId: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: withPhysicalIds(products) });
  } catch (error) {
    console.error('Error loading TCG products:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});




router.get('/api/tcg/physical-products', async (req, res) => {
  try {
    // Opcional: ?categoryId=<juego> para pedir solo los productos de un juego
    const categoryId = Number.parseInt(req.query.categoryId, 10);
    if (req.query.categoryId !== undefined && !Number.isInteger(categoryId)) {
      return res.status(400).json({ success: false, message: 'Juego inválido' });
    }
    // Solo productos con al menos una carta enlazada: los vacíos harían que el filtro no muestre resultados
    const products = await prisma.tcgPhysicalProduct.findMany({
      where: { productLinks: { some: {} }, ...(Number.isInteger(categoryId) ? { categoryId } : {}) },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error loading physical products:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/tcg/blocks', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const whereClause = categoryId ? { categoryId: parseInt(categoryId) } : {};
    const blocks = await prisma.tcgBlock.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: blocks });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/tcg/search', async (req, res) => {
  try {
    const { q, categoryId, groupId, blockId, mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;
    const textParams = [q, mylType, mylRace, mylFrequency, mylCost, physicalProductId, groupId];
    if (textParams.some((value) => value !== undefined && (typeof value !== 'string' || value.length > 80))
      || [categoryId, blockId].some((value) => value !== undefined && !/^\d{1,9}$/.test(String(value)))) {
      return badRequest(res, 'Búsqueda inválida');
    }

    let whereClause = {};
    if (q) {
      const cleanQ = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "");
      whereClause.OR = [
        nameMatch(q), // sin importar los apóstrofos
        { cleanName: { contains: cleanQ, mode: 'insensitive' } }
      ];
    }
    if (categoryId) whereClause.categoryId = parseInt(categoryId);
    if (physicalProductId) {
      const linkFilter = physicalLinkFilter(physicalProductId);
      if (!linkFilter) return res.status(400).json({ success: false, message: 'Producto inválido' });
      Object.assign(whereClause, linkFilter);
    }

    if (groupId) {
      if (groupId === 'otros') {
        const groups = await prisma.tcgGroup.findMany({ where: { categoryId: parseInt(categoryId) }, select: { groupId: true } });
        const groupIds = groups.map(g => g.groupId);
        whereClause.groupId = { notIn: groupIds };
      } else {
        whereClause.groupId = parseInt(groupId);
      }
    } else if (blockId) {
      const groups = await prisma.tcgGroup.findMany({ where: { blockId: parseInt(blockId) }, select: { groupId: true } });
      const groupIds = groups.map(g => g.groupId);
      if (groupIds.length > 0) {
        whereClause.groupId = { in: groupIds };
      } else {
        whereClause.groupId = -1; // No groups found for this block, return empty
      }
    }

    // Mitos y Leyendas Filters
    let andConditions = [];
    if (mylType) andConditions.push({ extData: { array_contains: [{ name: 'Type', value: mylType }] } });
    if (mylRace) andConditions.push({ extData: { array_contains: [{ name: 'Race', value: mylRace }] } });
    if (mylFrequency) andConditions.push({ extData: { array_contains: [{ name: 'Frequency', value: mylFrequency }] } });
    if (mylCost !== undefined && mylCost !== '') andConditions.push({ extData: { array_contains: [{ name: 'Cost', value: mylCost.toString() }] } });

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const productQuery = {
      take: 2000,
      include: { group: true, physicalLinks: { select: { physicalProductId: true } } },
      orderBy: [
        { group: { publishedOn: 'desc' } },
        { physicalProductId: 'asc' },
        { name: 'asc' }
      ]
    };
    let products = await prisma.tcgProduct.findMany({ where: whereClause, ...productQuery });
    // Sin coincidencias: nombres parecidos a lo escrito (letras de más o de menos), los más cercanos primero
    const fragments = q && products.length === 0 ? searchFragments(q) : [];
    if (fragments.length) {
      const { OR: _text, ...scope } = whereClause;
      const candidates = await prisma.tcgProduct.findMany({ where: { ...scope, OR: fragments.map((fragment) => ({ name: { contains: fragment, mode: 'insensitive' } })) }, select: { productId: true, name: true }, take: 5000 });
      const close = candidates.filter((card) => similarCardName(card.name, q)).sort((a, b) => nameDistance(a.name, q) - nameDistance(b.name, q)).slice(0, 200);
      if (close.length) {
        const found = await prisma.tcgProduct.findMany({ where: { productId: { in: close.map((card) => card.productId) } }, include: productQuery.include });
        const order = new Map(close.map((card, index) => [card.productId, index]));
        products = found.sort((a, b) => order.get(a.productId) - order.get(b.productId));
      }
    }
    res.json({ success: true, data: withPhysicalIds(products) });
  } catch (error) {
    console.error('Error searching TCG products:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
