// Catálogo de cartas: proxys (TCGCSV, Pokémon TCG API, imágenes) y base local de juegos, ediciones y cartas.
import express from 'express';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { prisma } from '../core/db.js';
import { badRequest, isAllowedProxyImageUrl } from '../core/validation.js';
import { MYL_ID_PREFIX, rawMylId } from '../core/mylIdentity.js';
import { likeEscape, nameDistance, nameMatch, searchFragments, similarCardName } from '../core/cardSearch.js';
import { TCGDEX_CATEGORY, numberKey, tcgdexJson, usableCards } from '../core/tcgSync/tcgdex.js';
import { editionFamilyGroupIds, isEditionFamily, isKnownEditionFamily } from '../core/editionFamilies.js';

const router = express.Router();
const gzipAsync = promisify(gzip);

// Proxy con caché hacia TCGCSV (Pokémon inglés y japonés, One Piece, Magic, Riftbound, Yu-Gi-Oh!): el navegador no puede llamarlo directo por CORS
const TCGCSV_ALLOWED_PATH = /^\/tcgplayer\/(1|2|3|63|68|71|85|89)\/(groups|\d+\/(products|prices))$/;
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
router.param('groupId', (req, res, next, value) => (/^\d{1,9}$/.test(value) || value === 'otros' || isKnownEditionFamily(value) ? next() : badRequest(res, 'Edición inválida')));

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

// Cartas en español de una edición de TCGdex, por número: es el respaldo cuando la imagen todavía no está en la base ni en R2 (se guarda 6 horas)
// Respaldo de TCGplayer (TCGCSV) para el idioma Español: lo que todavía no está en la base (una edición recién publicada) se pide en vivo; usa la misma caché que /api/tcgcsv
const tcgcsvResults = async (tcgcsvPath) => {
  const hit = tcgcsvCache.get(tcgcsvPath);
  const entry = hit && Date.now() - hit.at < TCGCSV_TTL_MS ? hit : await loadTcgcsv(tcgcsvPath);
  const json = JSON.parse(entry.body);
  return Array.isArray(json.results) ? json.results : [];
};
// Cartas que TCGdex tiene en español y TCGplayer no (el enlace con las inglesas las dejó marcadas, TcgplayerLinked = '0'): salen solas, con su nombre e imagen de TCGdex y sin precio.
// Por edición en español: cuántas son y a qué edición inglesa pertenece la mayoría de sus cartas enlazadas (null si ninguna)
const SPANISH_GROUP_BASE = 9000000;
const spanishOnlySets = async () => (await prisma.$queryRaw`SELECT "groupId", MODE() WITHIN GROUP (ORDER BY ("attributes"->>'TcgplayerGroupId')::int) AS "english" FROM "CatalogCard" WHERE "categoryId" = ${TCGDEX_CATEGORY} AND "imageKey" IS NOT NULL GROUP BY "groupId" HAVING COUNT(*) FILTER (WHERE "attributes"->>'TcgplayerLinked' = '0') > 0`);
const spanishOnlyCards = (groupIds) => (groupIds.length ? prisma.catalogCard.findMany({
  where: { categoryId: TCGDEX_CATEGORY, groupId: { in: groupIds }, imageKey: { not: null }, attributes: { path: ['TcgplayerLinked'], equals: '0' } },
  orderBy: [{ number: 'asc' }, { productId: 'asc' }],
  select: { productId: true, name: true, number: true, imageKey: true, attributes: true, groupId: true, set: { select: { name: true, publishedOn: true } } },
}) : []);
const spanishOnlyView = (card, groupId, group) => ({
  productId: card.productId, categoryId: TCGDEX_CATEGORY, groupId, name: card.name, hasImage: true, imageUrl: r2PublicUrl(card.imageKey), number: card.number, rarity: null,
  extendedData: [{ name: 'Number', value: card.number }, { name: 'Language', value: 'es' }], group: group || card.set, game: 'Pokémon (Español)',
});
const NO_IMAGE_KEY = 'Carpetazo.cl/Sin_Imagen/Carpetazo_TCG_Sin_Imagen.webp';
const TCGDEX_SET_TTL_MS = 6 * 60 * 60 * 1000;
const tcgdexSetCache = new Map();
const within = (promise) => Promise.race([promise, new Promise((_resolve, reject) => setTimeout(() => reject(new Error('TCGdex tardó demasiado')), 5000))]);
const tcgdexSetImages = async (setId) => {
  const hit = tcgdexSetCache.get(setId);
  if (hit && Date.now() - hit.at < TCGDEX_SET_TTL_MS) return hit.images;
  const detail = await within(tcgdexJson(`/sets/${encodeURIComponent(setId)}`, 0));
  const images = new Map();
  for (const card of usableCards(detail)) images.set(numberKey(card.localId), images.has(numberKey(card.localId)) ? null : `${card.image}/high.webp`); // número repetido: no se adivina
  if (tcgdexSetCache.size >= 300) tcgdexSetCache.delete(tcgdexSetCache.keys().next().value);
  tcgdexSetCache.set(setId, { at: Date.now(), images });
  return images;
};

// Qué edición de TCGdex es una edición de TCGplayer, cuando la base todavía no las enlazó: por el nombre (el de TCGdex en inglés) y, si no, por la sigla
const setNorm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/([a-z])0+(\d)/g, '$1$2');
let tcgdexIndex = null;
const tcgdexSetIndex = async () => {
  if (tcgdexIndex && Date.now() - tcgdexIndex.at < TCGDEX_SET_TTL_MS) return tcgdexIndex;
  const [es, en] = await Promise.all([within(tcgdexJson('/sets', 0, 'es')), within(tcgdexJson('/sets', 0, 'en'))]);
  tcgdexIndex = { at: Date.now(), byId: new Map((es || []).map((set) => [setNorm(set.id), set.id])), byName: new Map((en || []).map((set) => [setNorm(set.name), set.id])) };
  return tcgdexIndex;
};
const tcgdexSetFor = (index, set) => index.byName.get(setNorm(String(set.name).split(': ').slice(1).join(': '))) || index.byName.get(setNorm(set.name))
  || (String(set.abbreviation || '').length >= 3 ? index.byId.get(setNorm(set.abbreviation)) : undefined) || null; // las siglas cortas («PR») sirven a muchas ediciones: no se usan

// Catálogo local de cartas TCGplayer. Las pantallas de carpetas/deseadas usan
// esta ruta para no descargar cada edición desde TCGCSV en cada búsqueda.
router.get('/api/tcg/catalog/:categoryId/:groupId/cards', async (req, res) => {
  try {
    const categoryId = Number.parseInt(req.params.categoryId, 10);
    const groupId = Number.parseInt(req.params.groupId, 10);
    if (!Number.isInteger(categoryId) || !Number.isInteger(groupId)) return badRequest(res, 'Edición inválida');
    // Pokémon en español: las cartas inglesas de la edición (datos y precio de TCGplayer) que tienen su versión en español, con la imagen en español
    const spanish = categoryId === TCGDEX_CATEGORY;
    if (spanish && groupId >= SPANISH_GROUP_BASE) {
      res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=7200');
      return res.json({ success: true, source: 'database', data: (await spanishOnlyCards([groupId])).map((card) => spanishOnlyView(card, groupId)) });
    }
    const spanishImages = new Map();
    const tcgdexImages = new Map();
    let liveGroup = null; // edición de TCGplayer que aún no está en la base
    if (spanish) {
      const links = await prisma.catalogCard.findMany({ where: { categoryId: TCGDEX_CATEGORY, imageKey: { not: null }, attributes: { path: ['TcgplayerGroupId'], equals: String(groupId) } }, select: { attributes: true, imageKey: true, groupId: true }, orderBy: { productId: 'asc' } });
      for (const link of links) if (!spanishImages.has(Number(link.attributes.TcgplayerProductId))) spanishImages.set(Number(link.attributes.TcgplayerProductId), link.imageKey);
      // Lo que no está en la base ni en R2 se completa con la imagen de TCGdex (los datos y el precio siguen siendo de TCGplayer)
      const setIds = (await prisma.catalogSet.findMany({ where: { groupId: { in: [...new Set(links.map((link) => link.groupId))] } }, select: { abbreviation: true } })).map((set) => set.abbreviation).filter(Boolean);
      let own = await prisma.catalogSet.findUnique({ where: { groupId }, select: { name: true, abbreviation: true } });
      if (!own) {
        liveGroup = (await tcgcsvResults('/tcgplayer/3/groups').catch(() => [])).find((item) => item.groupId === groupId) || null;
        own = liveGroup;
      }
      const mapped = own ? await tcgdexSetIndex().then((index) => tcgdexSetFor(index, own)).catch(() => null) : null;
      for (const setId of new Set([...setIds, mapped].filter(Boolean))) {
        try { for (const [key, url] of await tcgdexSetImages(setId)) if (url && !tcgdexImages.has(key)) tcgdexImages.set(key, url); } catch (error) { console.error('TCGdex no respondió:', error.message); }
      }
    }
    let rows = await prisma.catalogCard.findMany({
      where: spanish ? { groupId, kind: 'card' } : { categoryId, groupId, kind: 'card' },
      orderBy: [{ number: 'asc' }, { name: 'asc' }, { productId: 'asc' }],
      select: { productId: true, categoryId: true, groupId: true, name: true, number: true, rarity: true, imageKey: true, sourceImageUrl: true, attributes: true, set: { select: { name: true, publishedOn: true } }, game: { select: { name: true } } },
    });
    if (liveGroup && rows.length === 0) {
      rows = (await tcgcsvResults(`/tcgplayer/3/${groupId}/products`).catch(() => [])).map((product) => {
        const ext = Object.fromEntries((product.extendedData || []).filter((item) => item?.name).map((item) => [item.name, String(item.value ?? '')]));
        return { productId: product.productId, categoryId: 3, groupId, name: product.name, number: ext.Number || null, rarity: ext.Rarity || null, imageKey: null, sourceImageUrl: null, attributes: ext, set: { name: liveGroup.name, publishedOn: liveGroup.publishedOn }, game: { name: 'Pokémon' } };
      }).filter((card) => card.number);
    }
    const data = rows.map((card) => {
      // Sin versión en español (ni en la base, ni en R2, ni en TCGdex): sale igual, con «Sin imagen», para poder agregarla con foto propia
      if (spanish) { card.imageKey = spanishImages.get(card.productId) || null; card.sourceImageUrl = card.imageKey ? null : tcgdexImages.get(numberKey(card.number)) || r2PublicUrl(NO_IMAGE_KEY); }
      const attributes = card.attributes && typeof card.attributes === 'object' && !Array.isArray(card.attributes) ? card.attributes : {};
      const extendedData = Object.entries(attributes).map(([name, value]) => ({ name, value: String(value ?? '') }));
      if (card.number && !extendedData.some((item) => item.name === 'Number')) extendedData.push({ name: 'Number', value: card.number });
      return {
        productId: card.productId, categoryId: card.categoryId, groupId: card.groupId, name: card.name,
        // R2 es la fuente principal. Solo si todavía no se subió la imagen
        // se entrega la URL de respaldo de la importación (o el CDN de la
        // carta) sin consultar el endpoint remoto de productos.
        hasImage: Boolean(card.imageKey) || (spanish && card.sourceImageUrl !== r2PublicUrl(NO_IMAGE_KEY)), // sin imagen propia en R2: la persona puede subir una foto
        imageUrl: r2PublicUrl(card.imageKey) || card.sourceImageUrl || `https://tcgplayer-cdn.tcgplayer.com/product/${encodeURIComponent(String(card.productId))}_400w.jpg`, number: card.number, rarity: card.rarity,
        extendedData, group: card.set, game: card.game.name,
      };
    });
    if (spanish) {
      // Las cartas solo en español de la edición en español que corresponde a esta edición inglesa
      const sameSet = (await spanishOnlySets().catch(() => [])).filter((item) => item.english === groupId).map((item) => item.groupId);
      const englishSet = sameSet.length ? await prisma.catalogSet.findUnique({ where: { groupId }, select: { name: true, publishedOn: true } }) : null;
      if (englishSet) data.push(...(await spanishOnlyCards(sameSet)).map((card) => spanishOnlyView(card, groupId, englishSet)));
    }
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
    // Pokémon en español: todas las ediciones de TCGplayer (las cartas sin versión en español salen con «Sin imagen»)
    const sets = await prisma.catalogSet.findMany({
      where: { categoryId: categoryId === TCGDEX_CATEGORY ? 3 : categoryId, cards: { some: { kind: 'card' } } },
      orderBy: [{ publishedOn: 'desc' }, { name: 'asc' }, { groupId: 'desc' }],
      select: { groupId: true, categoryId: true, name: true, abbreviation: true, publishedOn: true, modifiedOn: true },
    });
    if (categoryId === TCGDEX_CATEGORY) {
      // Ediciones de TCGplayer que todavía no están en la base (la sincronización nocturna las agrega)
      const known = new Set((await prisma.catalogSet.findMany({ where: { categoryId: 3 }, select: { groupId: true } })).map((set) => set.groupId));
      const live = await tcgcsvResults('/tcgplayer/3/groups').catch(() => []);
      const recent = Date.now() - 45 * 24 * 3600 * 1000; // las antiguas que no están en la base son solo sellado
      for (const group of live) if (!known.has(group.groupId) && new Date(group.publishedOn).getTime() > recent && new Date(group.publishedOn) <= new Date()) sets.unshift({ groupId: group.groupId, categoryId: 3, name: group.name, abbreviation: group.abbreviation || null, publishedOn: group.publishedOn, modifiedOn: group.modifiedOn });
    }
    if (categoryId === TCGDEX_CATEGORY) {
      // Ediciones en español sin edición inglesa equivalente: salen con su propio nombre
      const orphans = (await spanishOnlySets().catch(() => [])).filter((item) => item.english === null).map((item) => item.groupId);
      if (orphans.length) sets.push(...await prisma.catalogSet.findMany({ where: { groupId: { in: orphans } }, select: { groupId: true, categoryId: true, name: true, abbreviation: true, publishedOn: true, modifiedOn: true } }));
    }
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

// Datos públicos del catálogo (los mismos que usa el buscador de «agregar cartas») de cartas ya guardadas en una carpeta: así la carpeta pública
// filtra Yu-Gi-Oh!, Magic, One Piece y Riftbound con los mismos criterios. Solo ids numéricos de TCGplayer.
router.post('/api/tcg/catalog/cards-data', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length > 500) return badRequest(res, 'Demasiadas cartas');
    const productIds = [...new Set(ids.map((id) => String(id).trim()).filter((id) => /^[1-9]\d{0,9}$/.test(id)).map(Number))];
    if (productIds.length === 0) return res.json({ success: true, data: {} });
    const rows = await prisma.catalogCard.findMany({
      where: { productId: { in: productIds }, kind: 'card' },
      select: { productId: true, attributes: true, number: true, set: { select: { groupId: true, name: true, abbreviation: true, publishedOn: true } } },
    });
    const data = {};
    rows.forEach((row) => {
      const attributes = row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes) ? row.attributes : {};
      const extendedData = Object.entries(attributes).map(([name, value]) => ({ name, value: String(value ?? '') }));
      if (row.number && !extendedData.some((item) => item.name === 'Number')) extendedData.push({ name: 'Number', value: row.number });
      data[row.productId] = { extendedData, group: row.set };
    });
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error cargando datos de cartas del catálogo:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

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
    } else if (isEditionFamily(groupId)) {
      if (!isKnownEditionFamily(groupId)) return res.status(400).json({ success: false, message: 'Edición inválida' });
      whereClause.groupId = { in: await editionFamilyGroupIds(prisma, parseInt(categoryId), groupId) };
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
        { cleanName: { contains: likeEscape(cleanQ), mode: 'insensitive' } }
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
      } else if (isEditionFamily(groupId)) {
        if (!isKnownEditionFamily(groupId) || !categoryId) return badRequest(res, 'Búsqueda inválida');
        whereClause.groupId = { in: await editionFamilyGroupIds(prisma, parseInt(categoryId), groupId) };
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
